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

    const outgoingBody =
        parsed.data.type === "forecast"
            ? { question: parsed.data.question, district: user.district, city: user.city }
            : parsed.data.payload ?? { question: parsed.data.question, district: user.district, city: user.city };

    try {
        const response = await fetch(`${ragServiceUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(outgoingBody),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(
                { error: data.error ?? "RAG service error", upstream: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(fallbackResult, { status: 200 });
    }
});
