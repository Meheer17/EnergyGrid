import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type UserRole = "CONSUMER" | "PROSUMER" | "ADMIN";

export type GridwiseTokenPayload = {
    userId: string;
    email: string;
    role: UserRole;
    district: string;
    city: string;
    name?: string;
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        throw new Error("JWT_SECRET is not configured.");
    }
    return new TextEncoder().encode(secret);
}

export async function signToken(payload: GridwiseTokenPayload) {
    return new SignJWT(payload as unknown as JWTPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(getJwtSecret());
}

export async function verifyToken(token: string) {
    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
        userId: String(payload.userId),
        email: String(payload.email),
        role: String(payload.role) as UserRole,
        district: String(payload.district),
        city: String(payload.city),
        name: payload.name ? String(payload.name) : undefined,
    };
}

export const hashPassword = async (pw: string) => {
    const bcrypt = await import("bcryptjs");
    return bcrypt.hash(pw, 12);
};

export const comparePassword = async (pw: string, hash: string) => {
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(pw, hash);
};
