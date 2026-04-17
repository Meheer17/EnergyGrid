import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";
import { prisma } from "@/lib/prisma";

const createOfferSchema = z.object({
    energyAmount_kWh: z.number().positive(),
    pricePerUnit_INR: z.number().positive(),
});

export const GET = withAuth(async (req: NextRequest, { user }) => {
    const scope = req.nextUrl.searchParams.get("scope") ?? "open";

    const where =
        scope === "mine"
            ? { sellerId: user.userId }
            : {
                status: "OPEN" as const,
                district: user.district,
            };

    const offers = await prisma.tradeOffer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            seller: { select: { id: true, name: true, city: true } },
            buyer: { select: { id: true, name: true, city: true } },
        },
        take: 50,
    });

    return NextResponse.json({ offers });
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
    const body = await req.json();
    const parsed = createOfferSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid trade offer", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const billSplit_INR = parsed.data.energyAmount_kWh * parsed.data.pricePerUnit_INR;

    const offer = await prisma.tradeOffer.create({
        data: {
            sellerId: user.userId,
            district: user.district,
            city: user.city,
            energyAmount_kWh: parsed.data.energyAmount_kWh,
            pricePerUnit_INR: parsed.data.pricePerUnit_INR,
            billSplit_INR,
            status: "OPEN",
        },
    });

    return NextResponse.json({ offer }, { status: 201 });
}, ["PROSUMER"]);
