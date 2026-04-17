import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { prisma } from "@/lib/prisma";

function getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") ?? "20"), 100);
    const skip = (Math.max(page, 1) - 1) * pageSize;

    const roleWhere =
        user.role === "CONSUMER"
            ? { buyerId: user.userId, status: "COMPLETED" as const }
            : user.role === "PROSUMER"
                ? { sellerId: user.userId, status: "COMPLETED" as const }
                : { status: "COMPLETED" as const };

    const [items, total] = await Promise.all([
        prisma.tradeOffer.findMany({
            where: roleWhere,
            include: {
                seller: { select: { id: true, name: true, city: true, district: true } },
                buyer: { select: { id: true, name: true, city: true, district: true } },
                ledger: true,
            },
            orderBy: { completedAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.tradeOffer.count({ where: roleWhere }),
    ]);

    const monthStart = getMonthStart();

    let summary: Record<string, number> = {};

    if (user.role === "CONSUMER") {
        const entries = await prisma.tradeLedger.findMany({
            where: {
                timestamp: { gte: monthStart },
                trade: { buyerId: user.userId },
            },
            select: { buyerSavings_INR: true, carbonCredits: true },
        });

        summary = {
            totalSavings_INR: entries.reduce((sum: number, item) => sum + item.buyerSavings_INR, 0),
            carbonOffset: entries.reduce((sum: number, item) => sum + item.carbonCredits, 0),
        };
    } else if (user.role === "PROSUMER") {
        const entries = await prisma.tradeLedger.findMany({
            where: {
                timestamp: { gte: monthStart },
                trade: { sellerId: user.userId },
            },
            select: { sellerEarnings_INR: true, carbonCredits: true },
        });

        summary = {
            totalEarnings_INR: entries.reduce((sum: number, item) => sum + item.sellerEarnings_INR, 0),
            carbonCredits: entries.reduce((sum: number, item) => sum + item.carbonCredits, 0),
        };
    } else {
        const entries = await prisma.tradeLedger.findMany({
            where: { timestamp: { gte: monthStart } },
            select: { sellerEarnings_INR: true, buyerSavings_INR: true, carbonCredits: true },
        });

        summary = {
            totalTraded_INR: entries.reduce((sum: number, item) => sum + item.sellerEarnings_INR, 0),
            totalSavings_INR: entries.reduce((sum: number, item) => sum + item.buyerSavings_INR, 0),
            carbonCredits: entries.reduce((sum: number, item) => sum + item.carbonCredits, 0),
        };
    }

    return NextResponse.json({
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
        summary,
    });
});
