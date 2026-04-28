"use client";

import { useEffect, useMemo, useState } from "react";
import ForecastPanel from "@/components/ForecastPanel";
import TradeCard from "@/components/TradeCard";

type Offer = {
    id: string;
    city: string;
    energyAmount_kWh: number;
    pricePerUnit_INR: number;
    billSplit_INR: number;
    status: string;
    seller?: { city: string };
};

type LedgerEntry = {
    id: string;
    completedAt: string;
    energyAmount_kWh: number;
    billSplit_INR: number;
    ledger?: {
        buyerSavings_INR: number;
        carbonCredits: number;
    };
};

function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export default function ConsumerDashboardPage() {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loadingOffers, setLoadingOffers] = useState(true);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(true);
    const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);

    const [question, setQuestion] = useState("");
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantResult, setAssistantResult] = useState<
        | {
            summary: string;
            sector_breakdown?: Record<string, number>;
            recommended_actions?: Array<{
                action: string;
                expected_impact: string;
                cost_INR: number;
                time_to_implement: string;
            }>;
            _meta?: {
                source: "rag_service" | "fallback";
                type?: string;
                endpoint?: string;
                reason?: string;
            };
        }
        | null
    >(null);

    const loadOffers = async () => {
        setLoadingOffers(true);
        try {
            const response = await fetch("/api/trade/offer?scope=open", { cache: "no-store" });
            const data = await response.json();
            setOffers((data.offers ?? []).filter((item: Offer) => item.status === "OPEN"));
        } finally {
            setLoadingOffers(false);
        }
    };

    const loadLedger = async () => {
        setLoadingLedger(true);
        try {
            const response = await fetch("/api/trade/ledger?pageSize=8", { cache: "no-store" });
            const data = await response.json();
            setLedger(data.items ?? []);
        } finally {
            setLoadingLedger(false);
        }
    };

    useEffect(() => {
        loadOffers();
        loadLedger();
    }, []);

    const acceptOffer = async (offerId: string) => {
        setAcceptingOfferId(offerId);
        try {
            await fetch("/api/trade/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tradeOfferId: offerId }),
            });
            await Promise.all([loadOffers(), loadLedger()]);
        } finally {
            setAcceptingOfferId(null);
        }
    };

    const askAssistant = async () => {
        if (!question.trim()) return;
        setAssistantLoading(true);
        try {
            const response = await fetch("/api/rag/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question,
                    type: "forecast",
                }),
            });

            const data = await response.json();
            setAssistantResult(data);
        } finally {
            setAssistantLoading(false);
        }
    };

    const rows = useMemo(
        () =>
            ledger.map((item) => ({
                id: item.id,
                date: new Date(item.completedAt).toLocaleDateString("en-IN"),
                kWh: item.energyAmount_kWh,
                saved: item.ledger?.buyerSavings_INR ?? item.billSplit_INR * 0.15,
                carbon: item.ledger?.carbonCredits ?? item.energyAmount_kWh * 0.82,
            })),
        [ledger]
    );

    const consumerKpis = useMemo(() => {
        const totalSaved = rows.reduce((sum, row) => sum + row.saved, 0);
        const totalCarbon = rows.reduce((sum, row) => sum + row.carbon, 0);
        return {
            openOffers: offers.length,
            totalSaved,
            totalCarbon,
        };
    }, [offers.length, rows]);

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Open District Offers</p>
                    <p className="mt-1 text-2xl font-semibold text-cyan-200">{consumerKpis.openOffers}</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Total Savings (Shown Period)</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-200">{formatINR(consumerKpis.totalSaved)}</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Carbon Offset (kg)</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-200">{consumerKpis.totalCarbon.toFixed(2)}</p>
                </article>
            </section>

            <ForecastPanel />

            <section>
                <h2 className="mb-3 text-xl font-semibold text-white">Open Trade Offers</h2>
                {loadingOffers ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="h-48 animate-pulse rounded-xl bg-white/5" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {offers.length === 0 && (
                            <p className="col-span-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                                No open offers available in your district right now.
                            </p>
                        )}
                        {offers.map((offer) => (
                            <TradeCard
                                key={offer.id}
                                offer={{
                                    ...offer,
                                    city: offer.seller?.city ?? offer.city,
                                }}
                                onAccept={acceptOffer}
                                accepting={acceptingOfferId === offer.id}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h2 className="mb-3 text-xl font-semibold text-white">My Trade History</h2>
                <div className="glass-card overflow-hidden rounded-xl">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-white/5 text-left text-white/70">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">kWh Bought</th>
                                <th className="px-4 py-3">Amount Saved</th>
                                <th className="px-4 py-3">Carbon Offset (kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingLedger && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-white/60">
                                        Loading history...
                                    </td>
                                </tr>
                            )}
                            {!loadingLedger && rows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-white/60">
                                        No completed trades yet.
                                    </td>
                                </tr>
                            )}
                            {!loadingLedger &&
                                rows.map((row) => (
                                    <tr key={row.id} className="border-t border-white/10 text-white/80">
                                        <td className="px-4 py-3">{row.date}</td>
                                        <td className="px-4 py-3">{row.kWh.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-cyan-300">{formatINR(row.saved)}</td>
                                        <td className="px-4 py-3">{row.carbon.toFixed(2)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="glass-card rounded-xl p-4">
                <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                <p className="mt-1 text-sm text-white/60">Ask for district-level forecast insights and actions.</p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="How can I reduce evening demand spikes in my area?"
                        className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                    />
                    <button
                        onClick={askAssistant}
                        disabled={assistantLoading}
                        className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {assistantLoading ? "Thinking..." : "Ask GridWise AI"}
                    </button>
                </div>

                {assistantResult && (
                    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-4 text-sm text-cyan-50">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-1 text-[11px] ${assistantResult._meta?.source === "rag_service" ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" : "border-amber-300/40 bg-amber-500/15 text-amber-100"}`}>
                                Source: {assistantResult._meta?.source === "rag_service" ? "RAG Service" : "Fallback"}
                            </span>
                            {assistantResult._meta?.reason && (
                                <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/80">
                                    {assistantResult._meta.reason}
                                </span>
                            )}
                        </div>
                        <p className="font-medium">{assistantResult.summary}</p>

                        {assistantResult.sector_breakdown && (
                            <div className="mt-3 rounded-lg border border-cyan-200/10 bg-black/20 px-3 py-2">
                                <p className="text-[11px] font-semibold text-cyan-300">Sector Breakdown:</p>
                                <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                                    {Object.entries(assistantResult.sector_breakdown).map(([sector, kwh]) => (
                                        <div key={sector} className="text-cyan-200">
                                            {sector}: <span className="font-semibold">{typeof kwh === "number" ? kwh.toFixed(2) : String(kwh)} kWh</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(assistantResult.recommended_actions ?? []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                <p className="text-[11px] font-semibold text-cyan-300">Recommended Actions:</p>
                                {(assistantResult.recommended_actions ?? []).map((item, idx) => (
                                    <div key={idx} className="rounded-lg border border-cyan-200/10 bg-black/20 px-3 py-2">
                                        <p className="font-semibold text-cyan-100">{item.action}</p>
                                        <p className="mt-1 text-[11px] text-cyan-200">
                                            <span className="text-white/60">Impact:</span> {item.expected_impact}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                                            <span className="text-cyan-300">
                                                Cost: <span className="font-semibold">₹{typeof item.cost_INR === "number" ? item.cost_INR.toLocaleString("en-IN") : String(item.cost_INR)}</span>
                                            </span>
                                            <span className="text-cyan-300">
                                                Timeline: <span className="font-semibold">{String(item.time_to_implement)}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
