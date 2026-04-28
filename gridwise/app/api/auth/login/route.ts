import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, type UserRole } from "@/lib/auth";
import { GRIDWISE_TOKEN_COOKIE, SEVEN_DAYS_IN_SECONDS } from "@/lib/constants";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export async function POST(req: NextRequest) {
    try {
        const forwardedProto = req.headers.get("x-forwarded-proto");
        const isHttps = req.nextUrl.protocol === "https:" || forwardedProto === "https";

        const body = await req.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", issues: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                hashedPassword: true,
                role: true,
                district: true,
                city: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const isMatch = await comparePassword(parsed.data.password, user.hashedPassword);
        if (!isMatch) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await signToken({
            userId: user.id,
            email: user.email,
            role: user.role as UserRole,
            district: user.district,
            city: user.city,
            name: user.name,
        });

        const response = NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                district: user.district,
                city: user.city,
            },
        });

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
                error: "Failed to login",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
