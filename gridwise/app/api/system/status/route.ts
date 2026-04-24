import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";

type ServiceProbe = {
    name: "ml" | "rag";
    url: string;
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number;
    details?: unknown;
    error?: string;
};

async function probeService(name: "ml" | "rag", baseUrl: string): Promise<ServiceProbe> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    try {
        const response = await fetch(`${baseUrl}/health`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });

        let details: unknown = null;
        try {
            details = await response.json();
        } catch {
            details = null;
        }

        return {
            name,
            url: baseUrl,
            ok: response.ok,
            httpStatus: response.status,
            latencyMs: Date.now() - startedAt,
            details,
        };
    } catch (error) {
        return {
            name,
            url: baseUrl,
            ok: false,
            httpStatus: null,
            latencyMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Unknown connectivity error",
        };
    } finally {
        clearTimeout(timer);
    }
}

export const GET = withAuth(async () => {
    const mlServiceUrl = process.env.ML_SERVICE_URL?.trim() || "http://localhost:8001";
    const ragServiceUrl = process.env.RAG_SERVICE_URL?.trim() || "http://localhost:8002";

    const [ml, rag] = await Promise.all([
        probeService("ml", mlServiceUrl),
        probeService("rag", ragServiceUrl),
    ]);

    return NextResponse.json({
        checkedAt: new Date().toISOString(),
        services: {
            ml,
            rag,
        },
    });
});
