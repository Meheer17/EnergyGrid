import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";

const schema = z.object({
    question: z.string().min(4),
    type: z.enum(["forecast", "anomaly", "capacity"]),
    payload: z.record(z.string(), z.any()).optional(),
});

const endpointMap: Record<"forecast" | "anomaly" | "capacity", string> = {
    forecast: "/rag/forecast",
    anomaly: "/rag/anomaly",
    capacity: "/rag/capacity",
};

function toFiniteNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const fallbackResult = {
    summary:
        "GridWise assistant is currently using fallback reasoning because the RAG service is unavailable.",
    districts_affected: [],
    recommended_actions: [
        "Shift discretionary loads out of peak windows (19:00-22:00)",
        "Increase local peer-trading participation in deficit districts",
        "Pre-charge battery storage before evening demand ramp",
    ],
    confidence: 0.41,
};

function withMeta(
    payload: Record<string, unknown>,
    meta: {
        source: "rag_service" | "fallback";
        type: "forecast" | "anomaly" | "capacity";
        endpoint: string;
        ragServiceUrl: string;
        reason?: string;
    }
) {
    return {
        ...payload,
        _meta: meta,
    };
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const ragServiceUrl = process.env.RAG_SERVICE_URL?.trim() || "http://localhost:8002";
    const endpoint = endpointMap[parsed.data.type];

    let outgoingBody: Record<string, unknown>;

    if (parsed.data.type === "forecast") {
        outgoingBody = {
            question: parsed.data.question,
            district: user.district,
            city: user.city,
        };
    } else if (parsed.data.type === "capacity") {
        const payload = parsed.data.payload ?? {};
        outgoingBody = {
            district:
                typeof payload.district === "string" && payload.district.trim()
                    ? payload.district
                    : user.district,
            forecasted_demand_3h: toFiniteNumber(payload.forecasted_demand_3h, 0),
            available_supply: toFiniteNumber(payload.available_supply, 0),
        };
    } else {
        const payload = parsed.data.payload ?? {};
        outgoingBody = {
            district:
                typeof payload.district === "string" && payload.district.trim()
                    ? payload.district
                    : user.district,
            city:
                typeof payload.city === "string" && payload.city.trim()
                    ? payload.city
                    : user.city,
            current_demand: toFiniteNumber(payload.current_demand, 0),
            current_solar: toFiniteNumber(payload.current_solar, 0),
            timestamp:
                typeof payload.timestamp === "string" && payload.timestamp.trim()
                    ? payload.timestamp
                    : new Date().toISOString(),
        };
    }

    try {
        const response = await fetch(`${ragServiceUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(outgoingBody),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(
                withMeta({
                    ...fallbackResult,
                    summary: `GridWise assistant is currently using fallback reasoning because the RAG service returned ${response.status}.`,
                    upstream: data,
                }, {
                    source: "fallback",
                    type: parsed.data.type,
                    endpoint,
                    ragServiceUrl,
                    reason: `RAG service responded with status ${response.status}`,
                }),
                { status: 200 }
            );
        }

        return NextResponse.json(
            withMeta(data as Record<string, unknown>, {
                source: "rag_service",
                type: parsed.data.type,
                endpoint,
                ragServiceUrl,
            })
        );
    } catch (error) {
        return NextResponse.json(
            withMeta(fallbackResult, {
                source: "fallback",
                type: parsed.data.type,
                endpoint,
                ragServiceUrl,
                reason: error instanceof Error ? error.message : "Unable to reach RAG service",
            }),
            { status: 200 }
        );
    }
});
