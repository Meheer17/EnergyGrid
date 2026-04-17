import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma-client";

const schema = z.object({
    tradeOfferId: z.string().min(10),
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const offer = await prisma.tradeOffer.findUnique({
        where: { id: parsed.data.tradeOfferId },
    });

    if (!offer) {
        return NextResponse.json({ error: "Trade offer not found" }, { status: 404 });
    }

    if (offer.status !== "OPEN") {
        return NextResponse.json({ error: "Offer is no longer open" }, { status: 409 });
    }

    if (offer.district !== user.district) {
        return NextResponse.json(
            { error: "Trade can only be accepted within your district" },
            { status: 403 }
        );
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updatedOffer = await tx.tradeOffer.update({
            where: { id: offer.id },
            data: {
                buyerId: user.userId,
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        const ledger = await tx.tradeLedger.create({
            data: {
                tradeId: updatedOffer.id,
                sellerEarnings_INR: updatedOffer.billSplit_INR,
                buyerSavings_INR: updatedOffer.billSplit_INR * 0.15,
                carbonCredits: updatedOffer.energyAmount_kWh * 0.82,
            },
        });

        return { updatedOffer, ledger };
    });

    return NextResponse.json(result, { status: 200 });
}, ["CONSUMER"]);
