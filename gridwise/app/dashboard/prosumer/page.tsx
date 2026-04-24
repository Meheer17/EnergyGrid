"use client";

import { useEffect, useMemo, useState } from "react";
import EnergyChart from "@/components/EnergyChart";

type ForecastData = {
    forecast: {
        forecasted_demand_kWh: number;
        forecasted_solar_kWh: number;
        forecasted_surplus_kWh: number;
        confidence: number;
        model_version: string;
    };
    hierarchy: {
        state: string;
        district: string;
        city: string;
        subCity: string;
        localArea: string;
    };
    horizonHours: number;
    _meta?: {
        source: "ml_service" | "fallback";
        mlServiceUrl: string;
        mlServiceStatus: {
            reachable: boolean;
            httpStatus: number | null;
            reason?: string;
        };
    };
    hourlyBreakdown: Array<{
        timestamp: string;
        label: string;
        hour: number;
        day: number;
        month: number;
        year: number;
        demand: number;
        solar: number;
        surplus: number;
        temperature_C: number;
        weather: string;
        usage: {
            localArea: number;
            subCity: number;
            city: number;
            state: number;
        };
    }>;
};

type Offer = {
    id: string;
    status: string;
    energyAmount_kWh: number;
    pricePerUnit_INR: number;
    billSplit_INR: number;
    createdAt: string;
};

type LedgerSummary = {
    totalEarnings_INR?: number;
    carbonCredits?: number;
};

function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export default function ProsumerDashboardPage() {
    const [forecast, setForecast] = useState<ForecastData | null>(null);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [summary, setSummary] = useState<LedgerSummary>({});
    const [loading, setLoading] = useState(true);

    const [openModal, setOpenModal] = useState(false);
    const [energyAmount_kWh, setEnergyAmount] = useState(5);
    const [pricePerUnit_INR, setPricePerUnit] = useState(9);
    const [submittingOffer, setSubmittingOffer] = useState(false);

    const [question, setQuestion] = useState("");
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantResult, setAssistantResult] = useState<
        | {
            summary: string;
            recommended_actions?: string[];
            _meta?: {
                source: "rag_service" | "fallback";
                reason?: string;
            };
        }
        | null
    >(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [forecastRes, offersRes, ledgerRes] = await Promise.all([
                fetch("/api/forecast", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ horizonHours: 24 }),
                }),
                fetch("/api/trade/offer?scope=mine", { cache: "no-store" }),
                fetch("/api/trade/ledger?pageSize=20", { cache: "no-store" }),
            ]);

            const [forecastData, offersData, ledgerData] = await Promise.all([
                forecastRes.json(),
                offersRes.json(),
                ledgerRes.json(),
            ]);

            if (forecastRes.ok) setForecast(forecastData);
            if (offersRes.ok) setOffers(offersData.offers ?? []);
            if (ledgerRes.ok) setSummary(ledgerData.summary ?? {});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const submitOffer = async () => {
        setSubmittingOffer(true);
        try {
            const response = await fetch("/api/trade/offer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ energyAmount_kWh, pricePerUnit_INR }),
            });

            if (response.ok) {
                setOpenModal(false);
                await loadData();
            }
        } finally {
            setSubmittingOffer(false);
        }
    };

    const askAssistant = async () => {
        if (!question.trim()) return;

        const forecastWindow = forecast?.hourlyBreakdown.slice(0, 3) ?? [];
        const forecastedDemand3h =
            forecastWindow.length > 0
                ? forecastWindow.reduce((sum, point) => sum + point.demand, 0)
                : (forecast?.forecast.forecasted_demand_kWh ?? 0);
        const availableSupply =
            forecastWindow.length > 0
                ? forecastWindow.reduce((sum, point) => sum + Math.max(point.solar, 0), 0)
                : (forecast?.forecast.forecasted_solar_kWh ?? 0);

        setAssistantLoading(true);
        try {
            const response = await fetch("/api/rag/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question,
                    type: "capacity",
                    payload: {
                        district: forecast?.hierarchy.district ?? "Bangalore Urban",
                        forecasted_demand_3h: Number(forecastedDemand3h.toFixed(3)),
                        available_supply: Number(availableSupply.toFixed(3)),
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setAssistantResult({
                    summary: data.error ?? "Capacity recommendations are unavailable right now.",
                    recommended_actions: [],
                });
                return;
            }

            setAssistantResult(data);
        } finally {
            setAssistantLoading(false);
        }
    };

    const billSplit = useMemo(() => energyAmount_kWh * pricePerUnit_INR, [energyAmount_kWh, pricePerUnit_INR]);

    const sourceText = forecast?._meta?.source === "ml_service" ? "ML Service" : "Fallback";
    const forecastGap = useMemo(() => {
        if (!forecast) return 0;
        return Math.max(0, forecast.forecast.forecasted_demand_kWh - (forecast.forecast.forecasted_demand_kWh + forecast.forecast.forecasted_surplus_kWh));
    }, [forecast]);

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Forecast Source</p>
                    <p className={`mt-1 text-lg font-semibold ${forecast?._meta?.source === "ml_service" ? "text-emerald-200" : "text-amber-200"}`}>{sourceText}</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Demand (Current)</p>
                    <p className="mt-1 text-lg font-semibold text-red-200">{(forecast?.forecast.forecasted_demand_kWh ?? 0).toFixed(2)} kWh</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Surplus (Current)</p>
                    <p className={`mt-1 text-lg font-semibold ${(forecast?.forecast.forecasted_surplus_kWh ?? 0) >= 0 ? "text-emerald-200" : "text-orange-200"}`}>
                        {(forecast?.forecast.forecasted_surplus_kWh ?? 0).toFixed(2)} kWh
                    </p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Estimated Deficit</p>
                    <p className="mt-1 text-lg font-semibold text-amber-200">{forecastGap.toFixed(2)} kWh</p>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="glass-card xl:col-span-2 rounded-xl p-4">
                    <div className="mb-4 flex items-end justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white">Solar vs Demand (24h)</h2>
                            <p className="text-sm text-white/60">Surplus highlighted where solar exceeds demand.</p>
                        </div>
                        {forecast && (
                            <p className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-300">
                                Confidence {(forecast.forecast.confidence * 100).toFixed(0)}%
                            </p>
                        )}
                    </div>

                    {forecast?._meta?.mlServiceStatus.reason && forecast._meta.source !== "ml_service" && (
                        <p className="mb-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                            ML fallback reason: {forecast._meta.mlServiceStatus.reason}
                        </p>
                    )}

                    {forecast && (
                        <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/80 md:grid-cols-5">
                            <p>
                                <span className="text-white/50">State:</span> {forecast.hierarchy.state}
                            </p>
                            <p>
                                <span className="text-white/50">District:</span> {forecast.hierarchy.district}
                            </p>
                            <p>
                                <span className="text-white/50">City:</span> {forecast.hierarchy.city}
                            </p>
                            <p>
                                <span className="text-white/50">Sub-City:</span> {forecast.hierarchy.subCity}
                            </p>
                            <p>
                                <span className="text-white/50">Local Area:</span> {forecast.hierarchy.localArea}
                            </p>
                        </div>
                    )}

                    {loading || !forecast ? (
                        <div className="h-72 animate-pulse rounded-lg bg-white/5" />
                    ) : (
                        <EnergyChart
                            data={forecast.hourlyBreakdown.map((row) => ({
                                ...row,
                                surplusArea: row.solar > row.demand ? row.solar - row.demand : 0,
                            }))}
                            xKey="label"
                            kind="line"
                            lines={[
                                { key: "solar", color: "#facc15", label: "Solar (kWh)" },
                                { key: "demand", color: "#00e5ff", label: "Demand (kWh)" },
                                { key: "surplusArea", color: "#7c3aed", label: "Surplus", type: "area" },
                            ]}
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <div className="glass-card rounded-xl p-4">
                        <p className="text-sm text-white/60">This Month Earnings</p>
                        <h3 className="mt-2 text-3xl font-bold text-cyan-300">{formatINR(summary.totalEarnings_INR ?? 0)}</h3>
                        <p className="mt-2 text-sm text-white/70">
                            Carbon Credits: <span className="font-semibold text-violet-300">{(summary.carbonCredits ?? 0).toFixed(2)}</span>
                        </p>
                    </div>

                    <button
                        onClick={() => setOpenModal(true)}
                        className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-medium text-slate-900 hover:bg-cyan-300"
                    >
                        Create Trade Offer
                    </button>
                </div>
            </section>

            <section className="glass-card rounded-xl p-4">
                <h2 className="text-xl font-semibold text-white">My Active Offers</h2>
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-white/5 text-left text-white/70">
                            <tr>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3">Energy (kWh)</th>
                                <th className="px-4 py-3">Price/unit</th>
                                <th className="px-4 py-3">Bill Split</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-white/60">
                                        No offers yet.
                                    </td>
                                </tr>
                            )}
                            {offers.map((offer) => (
                                <tr key={offer.id} className="border-t border-white/10 text-white/80">
                                    <td className="px-4 py-3">{new Date(offer.createdAt).toLocaleDateString("en-IN")}</td>
                                    <td className="px-4 py-3">{offer.energyAmount_kWh.toFixed(2)}</td>
                                    <td className="px-4 py-3">INR {offer.pricePerUnit_INR.toFixed(2)}</td>
                                    <td className="px-4 py-3">{formatINR(offer.billSplit_INR)}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-xs text-cyan-200">{offer.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="glass-card rounded-xl p-4">
                <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                <p className="text-sm text-white/60">Generate capacity-oriented recommendations for the next 3 hours.</p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="How should I price surplus energy during evening peak?"
                        className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                    />
                    <button
                        onClick={askAssistant}
                        disabled={assistantLoading}
                        className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300 disabled:opacity-65"
                    >
                        {assistantLoading ? "Thinking..." : "Ask GridWise AI"}
                    </button>
                </div>

                {assistantResult && (
                    <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-500/10 p-4 text-sm text-violet-50">
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
                        {(assistantResult.recommended_actions ?? []).length > 0 && (
                            <ul className="mt-3 space-y-2 text-violet-100/85">
                                {(assistantResult.recommended_actions ?? []).map((item) => (
                                    <li key={item} className="rounded-lg border border-violet-200/10 bg-black/20 px-3 py-2">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </section>

            {openModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#0a0a0f] p-5">
                        <h3 className="text-lg font-semibold text-white">Create Trade Offer</h3>
                        <p className="text-sm text-white/60">Set your surplus energy amount and unit price.</p>

                        <div className="mt-4 space-y-3">
                            <label className="block text-sm text-white/80">
                                Energy Amount (kWh)
                                <input
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={energyAmount_kWh}
                                    onChange={(e) => setEnergyAmount(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none"
                                />
                            </label>

                            <label className="block text-sm text-white/80">
                                Price per Unit (INR)
                                <input
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={pricePerUnit_INR}
                                    onChange={(e) => setPricePerUnit(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none"
                                />
                            </label>

                            <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                                Bill Split: <span className="font-semibold">{formatINR(billSplit)}</span>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setOpenModal(false)}
                                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitOffer}
                                disabled={submittingOffer}
                                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
                            >
                                {submittingOffer ? "Creating..." : "Create Offer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
