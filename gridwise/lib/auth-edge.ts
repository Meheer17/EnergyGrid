import type { GridwiseTokenPayload, UserRole } from "@/lib/auth";

function decodeBase64UrlToString(input: string) {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function decodeBase64UrlToBytes(input: string) {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parsePayload(payload: Record<string, unknown>): GridwiseTokenPayload {
    return {
        userId: String(payload.userId),
        email: String(payload.email),
        role: String(payload.role) as UserRole,
        district: String(payload.district),
        city: String(payload.city),
        name: payload.name ? String(payload.name) : undefined,
    };
}

export async function verifyTokenEdge(token: string): Promise<GridwiseTokenPayload> {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error("Malformed JWT");
    }

    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        throw new Error("JWT_SECRET is missing");
    }

    const header = JSON.parse(decodeBase64UrlToString(headerB64)) as { alg?: string };
    if (header.alg !== "HS256") {
        throw new Error("Unsupported JWT algorithm");
    }

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );

    const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        decodeBase64UrlToBytes(signatureB64),
        new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );

    if (!isValid) {
        throw new Error("Invalid JWT signature");
    }

    const payloadObj = JSON.parse(decodeBase64UrlToString(payloadB64)) as Record<string, unknown>;

    const exp = Number(payloadObj.exp ?? 0);
    if (exp && Date.now() >= exp * 1000) {
        throw new Error("JWT expired");
    }

    return parsePayload(payloadObj);
}
