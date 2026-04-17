import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { prisma } from "@/lib/prisma";
import { getCityGridConfig, getGeoHierarchy } from "@/lib/karnataka";
import { getDefaultWeather, getSeason, getWeatherAdjustmentFactor, isPeakHour } from "@/lib/energy";

type PredictPointResponse = {
    forecasted_demand_kWh: number;
    forecasted_solar_kWh: number;
    forecasted_surplus_kWh: number;
    confidence: number;
    model_version: string;
};

type HorizonServiceResponse = {
    horizon_hours: number;
    state: string;
    district: string;
    city: string;
    sub_city: string;
    local_area: string;
    average_confidence: number;
    model_version: string;
    forecasts: Array<{
        timestamp: string;
        label: string;
        hour_offset: number;
        hour: number;
        day: number;
        month: number;
        year: number;
        temperature_C: number;
        weather: string;
        forecasted_demand_kWh: number;
        forecasted_solar_kWh: number;
        forecasted_surplus_kWh: number;
        confidence: number;
        usage_local_area_kWh: number;
        usage_sub_city_kWh: number;
        usage_city_kWh: number;
        usage_state_kWh: number;
    }>;
};

type UiForecastPoint = {
    timestamp: string;
    label: string;
    hour: number;
    day: number;
    month: number;
    year: number;
    demand: number;
    solar: number;
    surplus: number;
    temperature_C: number;
    weather: string;
    usage: {
        localArea: number;
        subCity: number;
        city: number;
        state: number;
    };
};

function buildFallbackHorizon(
    demand: number,
    solar: number,
    startTime: Date,
    horizonHours: number,
    temperatureC: number,
    baseCityUsage: number
): UiForecastPoint[] {
    return Array.from({ length: horizonHours }, (_, offset) => {
        const dt = new Date(startTime.getTime() + offset * 60 * 60 * 1000);
        const hour = dt.getHours();

        const eveningPeak = hour >= 18 && hour <= 22 ? 1.2 : 0.92;
        const morningPeak = hour >= 6 && hour <= 9 ? 1.15 : 1;
        const demandVar = Math.max(0.72, Math.sin((hour / 24) * Math.PI * 2 - 1.2) * 0.22 + 1);
        const demandHour = demand * demandVar * eveningPeak * morningPeak;

        const dayFactor = hour >= 6 && hour <= 18 ? Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) : 0;
        const solarHour = solar * dayFactor;
        const cityUsage = Math.max(baseCityUsage, demandHour);

        return {
            timestamp: dt.toISOString(),
            label: dt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
            hour,
            day: dt.getDate(),
            month: dt.getMonth() + 1,
            year: dt.getFullYear(),
            demand: Number(demandHour.toFixed(3)),
            solar: Number(solarHour.toFixed(3)),
            surplus: Number((solarHour - demandHour).toFixed(3)),
            temperature_C: Number(temperatureC.toFixed(2)),
            weather: "Synthetic",
            usage: {
                localArea: Number((cityUsage * 0.14).toFixed(3)),
                subCity: Number((cityUsage * 0.38).toFixed(3)),
                city: Number(cityUsage.toFixed(3)),
                state: Number((cityUsage * 31).toFixed(3)),
            },
        };
    });
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
    let parsedBody: { horizonHours?: number } = {};
    try {
        parsedBody = await req.json();
    } catch {
        parsedBody = {};
    }

    const horizonHours = Math.min(Math.max(Number(parsedBody.horizonHours ?? 6), 3), 48);

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const season = getSeason(month);
    const peakFlag = isPeakHour(hour);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const gridConfig = getCityGridConfig(user.district, user.city);
    const hierarchy = getGeoHierarchy(user.district, user.city, now);

    const latestMeter = await prisma.smartMeter.findFirst({
        where: { userId: user.userId },
        orderBy: { timestamp: "desc" },
    });

    const recentReadings = await prisma.smartMeter.findMany({
        where: { userId: user.userId },
        orderBy: { timestamp: "desc" },
        take: 168,
    });

    const weatherBase = getDefaultWeather(gridConfig.zoneType, season, hour);

    const lag1 = recentReadings[0]?.currentLoad_kW ?? gridConfig.baseDemandKWh;
    const lag24 = recentReadings[23]?.currentLoad_kW ?? lag1;
    const lag168 = recentReadings[167]?.currentLoad_kW ?? lag24;

    const rollingWindow = recentReadings.slice(0, 24);
    const rollingMean24h =
        rollingWindow.length > 0
            ? rollingWindow.reduce((acc: number, row) => acc + row.currentLoad_kW, 0) / rollingWindow.length
            : gridConfig.baseDemandKWh;

    const growthFactor = Math.min((1.05 ** (year - 2019)), 2.2);
    const prosumerPct = Math.min(gridConfig.prosumerBasePct * growthFactor, 0.6);

    const weatherAdjustmentFactor = getWeatherAdjustmentFactor(
        weatherBase.temperature_C,
        weatherBase.is_rainy,
        false,
        peakFlag
    );

    const fallbackDemand =
        gridConfig.baseDemandKWh * gridConfig.householdCount * weatherAdjustmentFactor;
    const fallbackSolar =
        weatherBase.solar_irradiance_Wm2 *
        (0.18 - (year - 2019) * 0.002) *
        prosumerPct *
        gridConfig.householdCount *
        0.003;

    const cityUsageBaseline = rollingMean24h * gridConfig.householdCount;

    const payload = {
        state: hierarchy.state,
        district: user.district,
        city: user.city,
        sub_city: hierarchy.subCity,
        local_area: hierarchy.localArea,
        date: now.toISOString().slice(0, 10),
        day: now.getDate(),
        hour,
        day_of_week: dayOfWeek,
        month,
        year,
        is_weekend: isWeekend,
        is_holiday: false,
        season,
        temperature_C: latestMeter ? weatherBase.temperature_C + latestMeter.currentLoad_kW * 0.1 : weatherBase.temperature_C,
        humidity_pct: weatherBase.humidity_pct,
        solar_irradiance_Wm2: latestMeter
            ? Math.max(weatherBase.solar_irradiance_Wm2, latestMeter.solarGeneration_kW * 100)
            : weatherBase.solar_irradiance_Wm2,
        wind_speed_kmh: weatherBase.wind_speed_kmh,
        is_rainy: weatherBase.is_rainy,
        is_cloudy: weatherBase.is_cloudy,
        peak_flag: peakFlag,
        prosumer_pct: prosumerPct,
        household_count: gridConfig.householdCount,
        lag_1h: lag1,
        lag_24h: lag24,
        lag_168h: lag168,
        rolling_mean_24h: rollingMean24h,
        sub_city_usage_kWh: cityUsageBaseline * 0.38,
        city_usage_kWh: cityUsageBaseline,
        local_area_usage_kWh: cityUsageBaseline * 0.14,
        state_usage_kWh: cityUsageBaseline * 31,
        horizon_hours: horizonHours,
    };

    let forecast: PredictPointResponse = {
        forecasted_demand_kWh: Number(fallbackDemand.toFixed(3)),
        forecasted_solar_kWh: Number(fallbackSolar.toFixed(3)),
        forecasted_surplus_kWh: Number((fallbackSolar - fallbackDemand).toFixed(3)),
        confidence: 0.62,
        model_version: "fallback-v1",
    };

    let hourlyBreakdown: UiForecastPoint[] = buildFallbackHorizon(
        forecast.forecasted_demand_kWh,
        forecast.forecasted_solar_kWh,
        now,
        horizonHours,
        payload.temperature_C,
        cityUsageBaseline
    );

    const mlServiceUrl = process.env.ML_SERVICE_URL?.trim() || "http://localhost:8001";

    try {
        const response = await fetch(`${mlServiceUrl}/predict/horizon`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        if (response.ok) {
            const remote = (await response.json()) as HorizonServiceResponse;
            const firstPoint = remote.forecasts[0];

            if (firstPoint) {
                forecast = {
                    forecasted_demand_kWh: Number(firstPoint.forecasted_demand_kWh),
                    forecasted_solar_kWh: Number(firstPoint.forecasted_solar_kWh),
                    forecasted_surplus_kWh: Number(firstPoint.forecasted_surplus_kWh),
                    confidence: Number(remote.average_confidence ?? firstPoint.confidence ?? 0.75),
                    model_version: String(remote.model_version ?? "ml-horizon-v1"),
                };

                hourlyBreakdown = remote.forecasts.map((point) => ({
                    timestamp: point.timestamp,
                    label: point.label,
                    hour: point.hour,
                    day: point.day,
                    month: point.month,
                    year: point.year,
                    demand: Number(point.forecasted_demand_kWh),
                    solar: Number(point.forecasted_solar_kWh),
                    surplus: Number(point.forecasted_surplus_kWh),
                    temperature_C: Number(point.temperature_C),
                    weather: point.weather,
                    usage: {
                        localArea: Number(point.usage_local_area_kWh),
                        subCity: Number(point.usage_sub_city_kWh),
                        city: Number(point.usage_city_kWh),
                        state: Number(point.usage_state_kWh),
                    },
                }));
            }
        }
    } catch {
        forecast = {
            ...forecast,
            model_version: "fallback-v1",
        };
    }

    await prisma.energyForecast.create({
        data: {
            userId: user.userId,
            forecastedDemand_kWh: forecast.forecasted_demand_kWh,
            forecastedSurplus_kWh: forecast.forecasted_surplus_kWh,
            horizon_hours: horizonHours,
            modelVersion: forecast.model_version,
        },
    });

    return NextResponse.json({
        forecast,
        hierarchy,
        horizonHours,
        hourlyBreakdown,
    });
});
