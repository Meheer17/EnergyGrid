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

    useEffect(() => {
        const run = async () => {
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

        run();
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

    return (
        <section className="space-y-4">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Demand Forecast</h2>
                    <p className="text-sm text-white/60">
                        Model: {data.forecast.model_version} | Horizon: {data.horizonHours}h
                    </p>
                </div>
                <p className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-300">
                    Confidence {(data.forecast.confidence * 100).toFixed(0)}%
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80 md:grid-cols-5">
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
                lines={[{ key: "demand", color: "#00e5ff", label: "Demand (kWh)", type: "area" }]}
            />

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0d13]">
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-white/5 text-left text-white/70">
                        <tr>
                            <th className="px-3 py-2">Date/Time</th>
                            <th className="px-3 py-2">Temp</th>
                            <th className="px-3 py-2">Weather</th>
                            <th className="px-3 py-2">Local Usage</th>
                            <th className="px-3 py-2">Sub-City Usage</th>
                            <th className="px-3 py-2">City Usage</th>
                            <th className="px-3 py-2">State Usage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.hourlyBreakdown.slice(0, 8).map((row) => (
                            <tr key={row.timestamp} className="border-t border-white/10 text-white/80">
                                <td className="px-3 py-2">{row.label}</td>
                                <td className="px-3 py-2">{row.temperature_C.toFixed(1)} C</td>
                                <td className="px-3 py-2">{row.weather}</td>
                                <td className="px-3 py-2">{row.usage.localArea.toFixed(2)}</td>
                                <td className="px-3 py-2">{row.usage.subCity.toFixed(2)}</td>
                                <td className="px-3 py-2">{row.usage.city.toFixed(2)}</td>
                                <td className="px-3 py-2">{row.usage.state.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
