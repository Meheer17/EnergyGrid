import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DISTRICT_CITY_MAP } from "@/lib/karnataka";
import { GRIDWISE_TOKEN_COOKIE, SEVEN_DAYS_IN_SECONDS } from "@/lib/constants";
import { hashPassword, signToken, type UserRole } from "@/lib/auth";

const signupSchema = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(["CONSUMER", "PROSUMER"]),
    district: z.string().min(2),
    city: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be a 6-digit value"),
});

export async function POST(req: NextRequest) {
    try {
        const forwardedProto = req.headers.get("x-forwarded-proto");
        const isHttps = req.nextUrl.protocol === "https:" || forwardedProto === "https";

        const body = await req.json();
        const parsed = signupSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", issues: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const email = parsed.data.email.trim().toLowerCase();
        const district = parsed.data.district.trim();
        const city = parsed.data.city.trim();

        const cityOptions = DISTRICT_CITY_MAP[district] ?? [];
        if (!cityOptions.includes(city)) {
            return NextResponse.json(
                { error: "Invalid district/city combination" },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
        }

        const hashedPassword = await hashPassword(parsed.data.password);

        const user = await prisma.user.create({
            data: {
                name: parsed.data.name.trim(),
                email,
                hashedPassword,
                role: parsed.data.role,
                district,
                city,
                pincode: parsed.data.pincode,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                district: true,
                city: true,
            },
        });

        const token = await signToken({
            userId: user.id,
            email: user.email,
            role: user.role as UserRole,
            district: user.district,
            city: user.city,
            name: user.name,
        });

        const response = NextResponse.json({ user }, { status: 201 });
        response.cookies.set({
            name: GRIDWISE_TOKEN_COOKIE,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: isHttps,
            maxAge: SEVEN_DAYS_IN_SECONDS,
            path: "/",
        });

        return response;
    } catch (error) {
        return NextResponse.json(
            {
                error: "Failed to signup",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
