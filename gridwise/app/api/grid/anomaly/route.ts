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
            user: { select: { district: true } },
        },
        orderBy: { generatedAt: "desc" },
        take: 1000,
    });

    const districtBuckets = new Map<string, { total: number; count: number }>();
    for (const forecast of latestForecasts) {
        const districtName = forecast.user.district;
        const current = districtBuckets.get(districtName) ?? { total: 0, count: 0 };
        current.total += forecast.forecastedSurplus_kWh;
        current.count += 1;
        districtBuckets.set(districtName, current);
    }

    const districtSurplus = Array.from(districtBuckets.entries()).map(([name, bucket]) => ({
        name,
        surplus_kWh: bucket.count ? bucket.total / bucket.count : 0,
    }));

    return NextResponse.json({ anomalies, districtSurplus });
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
