"use client";

import { useEffect, useState } from "react";
import EnergyChart from "@/components/EnergyChart";

type ForecastPayload = {
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

export default function ForecastPanel() {
    const [data, setData] = useState<ForecastPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadForecast = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/forecast", { method: "POST" });
            const payload = await response.json();
            if (!response.ok) {
                setError(payload.error ?? "Failed to load forecast");
                return;
            }
            setData(payload);
        } catch {
            setError("Forecast service unavailable");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadForecast();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0a0f] p-4">
                <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
                <div className="h-64 w-full animate-pulse rounded bg-white/5" />
            </div>
        );
    }

    if (error) {
        return <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>;
    }

    if (!data) return null;

    const source = data._meta?.source ?? "fallback";
    const mlReachable = Boolean(data._meta?.mlServiceStatus.reachable);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-white">Demand Forecast</h2>
                    <p className="text-sm text-white/60">
                        Model: {data.forecast.model_version} | Horizon: {data.horizonHours}h
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <p className={`rounded-full border px-3 py-1 text-xs ${source === "ml_service" ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200" : "border-amber-300/40 bg-amber-500/10 text-amber-200"}`}>
                        Source: {source === "ml_service" ? "ML Service" : "Fallback"}
                    </p>
                    <p className={`rounded-full border px-3 py-1 text-xs ${mlReachable ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-200" : "border-red-300/40 bg-red-500/10 text-red-200"}`}>
                        ML {mlReachable ? "Reachable" : "Unavailable"}
                    </p>
                    <p className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-300">
                        Confidence {(data.forecast.confidence * 100).toFixed(0)}%
                    </p>
                    <button
                        onClick={loadForecast}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {data._meta?.mlServiceStatus.reason && source !== "ml_service" && (
                <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    ML fallback reason: {data._meta.mlServiceStatus.reason}
                </p>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Demand (Current Point)</p>
                    <p className="mt-1 text-xl font-semibold text-red-200">{data.forecast.forecasted_demand_kWh.toFixed(2)} kWh</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Solar (Current Point)</p>
                    <p className="mt-1 text-xl font-semibold text-amber-200">{data.forecast.forecasted_solar_kWh.toFixed(2)} kWh</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Surplus (Current Point)</p>
                    <p className={`mt-1 text-xl font-semibold ${data.forecast.forecasted_surplus_kWh >= 0 ? "text-emerald-200" : "text-orange-200"}`}>
                        {data.forecast.forecasted_surplus_kWh.toFixed(2)} kWh
                    </p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Forecast Horizon</p>
                    <p className="mt-1 text-xl font-semibold text-cyan-200">{data.horizonHours} Hours</p>
                </article>
            </div>

            <div className="glass-card grid grid-cols-1 gap-2 rounded-xl p-3 text-xs text-white/80 md:grid-cols-5">
                <p>
                    <span className="text-white/50">State:</span> {data.hierarchy.state}
                </p>
                <p>
                    <span className="text-white/50">District:</span> {data.hierarchy.district}
                </p>
                <p>
                    <span className="text-white/50">City:</span> {data.hierarchy.city}
                </p>
                <p>
                    <span className="text-white/50">Sub-City:</span> {data.hierarchy.subCity}
                </p>
                <p>
                    <span className="text-white/50">Local Area:</span> {data.hierarchy.localArea}
                </p>
            </div>

            <EnergyChart
                data={data.hourlyBreakdown}
                xKey="label"
                kind="area"
                lines={[
                    { key: "demand", color: "#38bdf8", label: "Demand (kWh)", type: "line" },
                    { key: "solar", color: "#fbbf24", label: "Solar (kWh)", type: "line" },
                ]}
            />

            <div className="glass-card overflow-hidden rounded-xl">
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-white/5 text-left text-white/70">
                        <tr>
                            <th className="px-3 py-2">Date/Time</th>
                            <th className="px-3 py-2">Demand</th>
                            <th className="px-3 py-2">Solar</th>
                            <th className="px-3 py-2">Surplus</th>
                            <th className="px-3 py-2">Temp</th>
                            <th className="px-3 py-2">Weather</th>
                            <th className="px-3 py-2">City Usage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.hourlyBreakdown.slice(0, 8).map((row) => (
                            <tr key={row.timestamp} className="border-t border-white/10 text-white/80">
                                <td className="px-3 py-2">{row.label}</td>
                                <td className="px-3 py-2 text-red-200">{row.demand.toFixed(2)}</td>
                                <td className="px-3 py-2 text-amber-200">{row.solar.toFixed(2)}</td>
                                <td className={`px-3 py-2 ${row.surplus >= 0 ? "text-emerald-200" : "text-orange-200"}`}>
                                    {row.surplus.toFixed(2)}
                                </td>
                                <td className="px-3 py-2">{row.temperature_C.toFixed(1)} C</td>
                                <td className="px-3 py-2">{row.weather}</td>
                                <td className="px-3 py-2">{row.usage.city.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
