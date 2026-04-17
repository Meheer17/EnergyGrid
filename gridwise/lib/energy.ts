import type { ZoneType } from "@/lib/karnataka";

export type GridSeason = "Summer" | "SW_Monsoon" | "NE_Monsoon" | "Winter";

export function getSeason(month: number): GridSeason {
    if (month >= 3 && month <= 5) return "Summer";
    if (month >= 6 && month <= 9) return "SW_Monsoon";
    if (month >= 10 && month <= 11) return "NE_Monsoon";
    return "Winter";
}

export function isPeakHour(hour: number) {
    return [6, 7, 8, 19, 20, 21, 22].includes(hour);
}

type WeatherDefaults = {
    temperature_C: number;
    humidity_pct: number;
    solar_irradiance_Wm2: number;
    wind_speed_kmh: number;
    is_rainy: boolean;
    is_cloudy: boolean;
};

export function getDefaultWeather(zoneType: ZoneType, season: GridSeason, hour: number): WeatherDefaults {
    const daytime = hour >= 6 && hour <= 18;

    const irradianceBase = daytime ? Math.max(0, 900 - Math.abs(hour - 12) * 120) : 0;

    const zoneProfiles: Record<
        ZoneType,
        { summerTemp: number; winterTemp: number; humidity: number; wind: number; rainFactor: number }
    > = {
        urban: { summerTemp: 34, winterTemp: 23, humidity: 48, wind: 11, rainFactor: 0.25 },
        "semi-urban": { summerTemp: 33, winterTemp: 21, humidity: 50, wind: 12, rainFactor: 0.3 },
        rural: { summerTemp: 35, winterTemp: 20, humidity: 47, wind: 13, rainFactor: 0.28 },
        coastal: { summerTemp: 31, winterTemp: 26, humidity: 82, wind: 24, rainFactor: 0.45 },
        hill: { summerTemp: 24, winterTemp: 16, humidity: 67, wind: 10, rainFactor: 0.4 },
    };

    const profile = zoneProfiles[zoneType];

    const isMonsoon = season === "SW_Monsoon" || season === "NE_Monsoon";

    const temperature_C = season === "Winter" ? profile.winterTemp : profile.summerTemp;
    const humidity_pct = isMonsoon ? Math.min(95, profile.humidity + 18) : profile.humidity;
    const wind_speed_kmh = isMonsoon ? profile.wind + 4 : profile.wind;
    const is_rainy = isMonsoon && profile.rainFactor > 0.25;
    const is_cloudy = isMonsoon || zoneType === "coastal";

    return {
        temperature_C,
        humidity_pct,
        solar_irradiance_Wm2: is_cloudy ? irradianceBase * 0.6 : irradianceBase,
        wind_speed_kmh,
        is_rainy,
        is_cloudy,
    };
}

export function getWeatherAdjustmentFactor(
    temperatureC: number,
    isRainy: boolean,
    isHoliday: boolean,
    peakFlag: boolean
) {
    let factor = 1;

    if (temperatureC > 35) factor += 0.15;
    if (temperatureC > 40) factor += 0.1;
    if (isRainy) factor -= 0.05;
    if (isHoliday) factor -= 0.1;
    if (peakFlag) factor += 0.2;

    return Number(Math.max(0.5, factor).toFixed(3));
}
