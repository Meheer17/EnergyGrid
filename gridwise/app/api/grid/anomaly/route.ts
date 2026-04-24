import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";
import { prisma } from "@/lib/prisma";

const resolveSchema = z.object({
    anomalyId: z.string().optional(),
    tradeOfferId: z.string().optional(),
});

export const GET = withAuth(async (req: NextRequest) => {
    const district = req.nextUrl.searchParams.get("district") ?? undefined;

    const anomalies = await prisma.gridAnomaly.findMany({
        where: {
            resolvedAt: null,
            ...(district ? { district } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    const latestForecasts = await prisma.energyForecast.findMany({
        include: {
            user: { select: { district: true, city: true } },
        },
        orderBy: { generatedAt: "desc" },
        take: 1000,
    });

    const districtBuckets = new Map<string, { surplusTotal: number; demandTotal: number; supplyTotal: number; count: number }>();
    const cityBuckets = new Map<
        string,
        { district: string; city: string; surplusTotal: number; demandTotal: number; supplyTotal: number; count: number }
    >();
    const dailyDemandSupplyBuckets = new Map<string, { demandTotal: number; supplyTotal: number; count: number }>();

    for (const forecast of latestForecasts) {
        const districtName = forecast.user.district;
        const cityName = forecast.user.city;
        const demand = Number(forecast.forecastedDemand_kWh);
        const surplus = Number(forecast.forecastedSurplus_kWh);
        const supply = Number(demand + surplus);

        const districtBucket = districtBuckets.get(districtName) ?? {
            surplusTotal: 0,
            demandTotal: 0,
            supplyTotal: 0,
            count: 0,
        };
        districtBucket.surplusTotal += surplus;
        districtBucket.demandTotal += demand;
        districtBucket.supplyTotal += supply;
        districtBucket.count += 1;
        districtBuckets.set(districtName, districtBucket);

        const cityKey = `${districtName}::${cityName}`;
        const cityBucket = cityBuckets.get(cityKey) ?? {
            district: districtName,
            city: cityName,
            surplusTotal: 0,
            demandTotal: 0,
            supplyTotal: 0,
            count: 0,
        };
        cityBucket.surplusTotal += surplus;
        cityBucket.demandTotal += demand;
        cityBucket.supplyTotal += supply;
        cityBucket.count += 1;
        cityBuckets.set(cityKey, cityBucket);

        const dateKey = forecast.generatedAt.toISOString().slice(0, 10);
        const dayBucket = dailyDemandSupplyBuckets.get(dateKey) ?? {
            demandTotal: 0,
            supplyTotal: 0,
            count: 0,
        };

        dayBucket.demandTotal += demand;
        dayBucket.supplyTotal += supply;
        dayBucket.count += 1;
        dailyDemandSupplyBuckets.set(dateKey, dayBucket);
    }

    const districtSurplus = Array.from(districtBuckets.entries()).map(([name, bucket]) => ({
        name,
        surplus_kWh: bucket.count ? bucket.surplusTotal / bucket.count : 0,
    }));

    const districtInsights = Array.from(districtBuckets.entries())
        .map(([districtName, bucket]) => {
            const avgDemand = bucket.count ? bucket.demandTotal / bucket.count : 0;
            const avgSupply = bucket.count ? bucket.supplyTotal / bucket.count : 0;
            const avgSurplus = bucket.count ? bucket.surplusTotal / bucket.count : 0;
            const demand3h = avgDemand * 3;
            const supply3h = avgSupply * 3;
            const gap3h = Math.max(0, demand3h - supply3h);

            const riskLevel = gap3h >= 120 ? "HIGH" : gap3h >= 45 ? "MEDIUM" : "LOW";

            return {
                district: districtName,
                avgDemand_kWh: Number(avgDemand.toFixed(3)),
                avgSupply_kWh: Number(avgSupply.toFixed(3)),
                avgSurplus_kWh: Number(avgSurplus.toFixed(3)),
                demand3h_kWh: Number(demand3h.toFixed(2)),
                supply3h_kWh: Number(supply3h.toFixed(2)),
                gap3h_kWh: Number(gap3h.toFixed(2)),
                riskLevel,
            };
        })
        .sort((a, b) => b.gap3h_kWh - a.gap3h_kWh);

    const cityInsights = Array.from(cityBuckets.values())
        .map((bucket) => {
            const avgDemand = bucket.count ? bucket.demandTotal / bucket.count : 0;
            const avgSupply = bucket.count ? bucket.supplyTotal / bucket.count : 0;
            const avgSurplus = bucket.count ? bucket.surplusTotal / bucket.count : 0;
            const demand3h = avgDemand * 3;
            const supply3h = avgSupply * 3;
            const gap3h = Math.max(0, demand3h - supply3h);

            const riskLevel = gap3h >= 60 ? "HIGH" : gap3h >= 20 ? "MEDIUM" : "LOW";

            return {
                district: bucket.district,
                city: bucket.city,
                avgDemand_kWh: Number(avgDemand.toFixed(3)),
                avgSupply_kWh: Number(avgSupply.toFixed(3)),
                avgSurplus_kWh: Number(avgSurplus.toFixed(3)),
                demand3h_kWh: Number(demand3h.toFixed(2)),
                supply3h_kWh: Number(supply3h.toFixed(2)),
                gap3h_kWh: Number(gap3h.toFixed(2)),
                riskLevel,
            };
        })
        .filter((row) => (district ? row.district === district : true))
        .sort((a, b) => b.gap3h_kWh - a.gap3h_kWh)
        .slice(0, 40);

    const demandSupplyTrend = Array.from(dailyDemandSupplyBuckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-30)
        .map(([date, bucket]) => ({
            date,
            demand: bucket.count ? Number((bucket.demandTotal / bucket.count).toFixed(2)) : 0,
            supply: bucket.count ? Number((bucket.supplyTotal / bucket.count).toFixed(2)) : 0,
        }));

    return NextResponse.json({
        anomalies,
        districtSurplus,
        demandSupplyTrend,
        districtInsights,
        cityInsights,
    });
}, ["ADMIN"]);

export const POST = withAuth(async (req: NextRequest) => {
    const body = await req.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const id = parsed.data.anomalyId ?? parsed.data.tradeOfferId;
    if (!id) {
        return NextResponse.json({ error: "anomalyId is required" }, { status: 400 });
    }

    try {
        const updated = await prisma.gridAnomaly.update({
            where: { id },
            data: { resolvedAt: new Date() },
        });

        return NextResponse.json({ anomaly: updated });
    } catch {
        return NextResponse.json({ error: "Anomaly not found" }, { status: 404 });
    }
}, ["ADMIN"]);
