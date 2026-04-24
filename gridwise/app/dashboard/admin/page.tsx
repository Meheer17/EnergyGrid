"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import HeatmapGrid from "@/components/HeatmapGrid";
import AnomalyAlert from "@/components/AnomalyAlert";
import { DISTRICTS } from "@/lib/karnataka";

type GridAnomaly = {
    id: string;
    district: string;
    city: string;
    type: string;
    severity: string;
    description: string;
    suggestedAction: string;
};

type DistrictSurplus = {
    name: string;
    surplus_kWh: number;
};

type DemandSupplyPoint = {
    date: string;
    demand: number;
    supply: number;
};

type DistrictInsight = {
    district: string;
    avgDemand_kWh: number;
    avgSupply_kWh: number;
    avgSurplus_kWh: number;
    demand3h_kWh: number;
    supply3h_kWh: number;
    gap3h_kWh: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

type CityInsight = {
    district: string;
    city: string;
    avgDemand_kWh: number;
    avgSupply_kWh: number;
    avgSurplus_kWh: number;
    demand3h_kWh: number;
    supply3h_kWh: number;
    gap3h_kWh: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

type LedgerItem = {
    id: string;
    completedAt: string;
    energyAmount_kWh: number;
    billSplit_INR: number;
    seller?: { district?: string; city?: string; name?: string };
    buyer?: { district?: string; city?: string; name?: string };
    ledger?: {
        sellerEarnings_INR: number;
        buyerSavings_INR: number;
        carbonCredits: number;
    };
};

type CapacityAction = {
    action: string;
    expected_impact?: string;
    cost_INR?: number;
    time_to_implement?: string;
};

type RagMeta = {
    source: "rag_service" | "fallback";
    type: "forecast" | "anomaly" | "capacity";
    endpoint: string;
    ragServiceUrl: string;
    reason?: string;
};

type ForecastSnapshot = {
    forecast: {
        forecasted_demand_kWh: number;
        forecasted_solar_kWh: number;
        forecasted_surplus_kWh: number;
        confidence: number;
        model_version: string;
    };
    _meta?: {
        source: "ml_service" | "fallback";
        mlServiceUrl: string;
        mlServiceStatus: {
            reachable: boolean;
            httpStatus: number | null;
            reason?: string;
        };
    };
};

function riskPillClass(riskLevel: "LOW" | "MEDIUM" | "HIGH") {
    if (riskLevel === "HIGH") return "border-red-300/50 bg-red-500/15 text-red-200";
    if (riskLevel === "MEDIUM") return "border-amber-300/50 bg-amber-500/15 text-amber-200";
    return "border-emerald-300/50 bg-emerald-500/15 text-emerald-200";
}

function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function toCsvRow(values: Array<string | number>) {
    return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
}

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [anomalies, setAnomalies] = useState<GridAnomaly[]>([]);
    const [districtSurplus, setDistrictSurplus] = useState<DistrictSurplus[]>([]);
    const [demandSupplyTrend, setDemandSupplyTrend] = useState<DemandSupplyPoint[]>([]);
    const [districtInsights, setDistrictInsights] = useState<DistrictInsight[]>([]);
    const [cityInsights, setCityInsights] = useState<CityInsight[]>([]);
    const [ledger, setLedger] = useState<LedgerItem[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const [capacityActions, setCapacityActions] = useState<CapacityAction[]>([]);
    const [capacitySummary, setCapacitySummary] = useState<string>("");
    const [capacityDistrict, setCapacityDistrict] = useState<string>("");
    const [capacityDemand3h, setCapacityDemand3h] = useState<number>(0);
    const [capacitySupply3h, setCapacitySupply3h] = useState<number>(0);
    const [capacityGap3h, setCapacityGap3h] = useState<number>(0);
    const [capacityRisk, setCapacityRisk] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
    const [capacityMeta, setCapacityMeta] = useState<RagMeta | null>(null);

    const [adminForecastSnapshot, setAdminForecastSnapshot] = useState<ForecastSnapshot | null>(null);

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [districtFilter, setDistrictFilter] = useState("");

    const loadCoreData = useCallback(async () => {
        setLoading(true);
        try {
            const queryDistrict = selectedDistrict ? `?district=${encodeURIComponent(selectedDistrict)}` : "";
            const [anomalyRes, ledgerRes, forecastRes] = await Promise.all([
                fetch(`/api/grid/anomaly${queryDistrict}`, { cache: "no-store" }),
                fetch("/api/trade/ledger?pageSize=300", { cache: "no-store" }),
                fetch("/api/forecast", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ horizonHours: 12 }),
                    cache: "no-store",
                }),
            ]);

            const [anomalyData, ledgerData, forecastData] = await Promise.all([
                anomalyRes.json(),
                ledgerRes.json(),
                forecastRes.json(),
            ]);

            if (anomalyRes.ok) {
                setAnomalies(anomalyData.anomalies ?? []);
                setDistrictSurplus(anomalyData.districtSurplus ?? []);
                setDemandSupplyTrend(anomalyData.demandSupplyTrend ?? []);
                setDistrictInsights(anomalyData.districtInsights ?? []);
                setCityInsights(anomalyData.cityInsights ?? []);
            }

            if (ledgerRes.ok) {
                setLedger(ledgerData.items ?? []);
            }

            if (forecastRes.ok) {
                setAdminForecastSnapshot(forecastData as ForecastSnapshot);
            } else {
                setAdminForecastSnapshot(null);
            }
        } finally {
            setLoading(false);
        }
    }, [selectedDistrict]);

    const loadCapacityPlan = useCallback(async () => {
        const targetDistrictInsight =
            districtInsights
                .slice()
                .sort((a, b) => b.gap3h_kWh - a.gap3h_kWh)
                .find((item) => item.gap3h_kWh > 0) ??
            districtInsights.find((item) => item.district === selectedDistrict) ??
            districtInsights[0];

        const fallbackDistrict =
            districtSurplus
                .slice()
                .sort((a, b) => a.surplus_kWh - b.surplus_kWh)
                .find((item) => item.surplus_kWh < 0)?.name ?? selectedDistrict ?? "Bangalore Urban";

        const deficitDistrict = targetDistrictInsight?.district ?? fallbackDistrict;
        const forecastedDemand3h = Number((targetDistrictInsight?.demand3h_kWh ?? 420).toFixed(2));
        const availableSupply3h = Number((targetDistrictInsight?.supply3h_kWh ?? 340).toFixed(2));
        const computedGap3h = Number(Math.max(0, forecastedDemand3h - availableSupply3h).toFixed(2));
        const computedRisk =
            computedGap3h >= 120 ? "HIGH" : computedGap3h >= 45 ? "MEDIUM" : "LOW";

        setCapacityDistrict(deficitDistrict);
        setCapacityDemand3h(forecastedDemand3h);
        setCapacitySupply3h(availableSupply3h);
        setCapacityGap3h(computedGap3h);
        setCapacityRisk(computedRisk);
        setCapacityMeta(null);

        try {
            const response = await fetch("/api/rag/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: `Generate a 3-hour capacity plan for ${deficitDistrict}`,
                    type: "capacity",
                    payload: {
                        district: deficitDistrict,
                        forecasted_demand_3h: forecastedDemand3h,
                        available_supply: availableSupply3h,
                    },
                }),
            });

            const data = await response.json();
            setCapacityMeta((data._meta ?? null) as RagMeta | null);

            const actions: CapacityAction[] = (data.recommended_actions ?? []).map((item: unknown) => {
                if (typeof item === "string") {
                    return { action: item };
                }
                const row = item as CapacityAction;
                return {
                    action: row.action,
                    expected_impact: row.expected_impact,
                    cost_INR: row.cost_INR,
                    time_to_implement: row.time_to_implement,
                };
            });

            const rankedActions = actions.sort((a, b) => {
                const aImpact = (a.expected_impact ?? "").toLowerCase();
                const bImpact = (b.expected_impact ?? "").toLowerCase();
                const aHasReduce = aImpact.includes("reduce") || aImpact.includes("add") || aImpact.includes("cover");
                const bHasReduce = bImpact.includes("reduce") || bImpact.includes("add") || bImpact.includes("cover");
                if (aHasReduce === bHasReduce) return 0;
                return aHasReduce ? -1 : 1;
            });

            setCapacitySummary(data.summary ?? `Capacity plan generated for ${deficitDistrict}.`);
            setCapacityActions(rankedActions);
        } catch {
            setCapacitySummary(`Capacity planner is temporarily unavailable for ${deficitDistrict}.`);
            setCapacityMeta({
                source: "fallback",
                type: "capacity",
                endpoint: "/rag/capacity",
                ragServiceUrl: "",
                reason: "Unable to reach RAG service.",
            });
            setCapacityActions([
                {
                    action: "Run localized demand-response campaign in evening peak window",
                    expected_impact: "Reduce shortfall risk by 5-8%",
                    time_to_implement: "30-45 minutes",
                },
            ]);
        }
    }, [districtInsights, districtSurplus, selectedDistrict]);

    useEffect(() => {
        loadCoreData();
    }, [loadCoreData]);

    useEffect(() => {
        if (!loading) {
            loadCapacityPlan();
        }
    }, [loading, loadCapacityPlan]);

    const resolveAnomaly = async (anomalyId: string) => {
        setResolvingId(anomalyId);
        try {
            await fetch("/api/grid/anomaly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ anomalyId }),
            });
            await loadCoreData();
        } finally {
            setResolvingId(null);
        }
    };

    const tradedPerDay = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of ledger) {
            if (!item.completedAt) continue;
            const key = new Date(item.completedAt).toISOString().slice(0, 10);
            map.set(key, (map.get(key) ?? 0) + item.energyAmount_kWh);
        }

        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-30)
            .map(([date, energy]) => ({ date: date.slice(5), energy: Number(energy.toFixed(2)) }));
    }, [ledger]);

    const topProsumerDistricts = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of ledger) {
            const districtName = item.seller?.district ?? "Unknown";
            map.set(districtName, (map.get(districtName) ?? 0) + item.energyAmount_kWh);
        }

        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([district, energy]) => ({ district, energy: Number(energy.toFixed(2)) }));
    }, [ledger]);

    const demandVsSupply = useMemo(() => {
        if (demandSupplyTrend.length > 0) {
            return demandSupplyTrend.map((row) => ({
                ...row,
                date: row.date.length >= 10 ? row.date.slice(5) : row.date,
            }));
        }

        return tradedPerDay.map((row) => ({
            date: row.date,
            demand: Number((row.energy * 1.22).toFixed(2)),
            supply: Number((row.energy * 0.98).toFixed(2)),
        }));
    }, [demandSupplyTrend, tradedPerDay]);

    const topCityDeficits = useMemo(() => {
        const focusDistrict = capacityDistrict || selectedDistrict;
        const rows = focusDistrict
            ? cityInsights.filter((row) => row.district === focusDistrict)
            : cityInsights;

        return rows
            .slice()
            .sort((a, b) => b.gap3h_kWh - a.gap3h_kWh)
            .slice(0, 8);
    }, [cityInsights, capacityDistrict, selectedDistrict]);

    const topDistrictDeficits = useMemo(() => {
        return districtInsights
            .slice()
            .sort((a, b) => b.gap3h_kWh - a.gap3h_kWh)
            .slice(0, 6);
    }, [districtInsights]);

    const filteredLedger = useMemo(() => {
        return ledger.filter((item) => {
            const completed = item.completedAt ? new Date(item.completedAt) : null;
            const districtMatches = districtFilter
                ? (item.seller?.district ?? "") === districtFilter || (item.buyer?.district ?? "") === districtFilter
                : true;

            const fromMatches = dateFrom ? completed && completed >= new Date(`${dateFrom}T00:00:00`) : true;
            const toMatches = dateTo ? completed && completed <= new Date(`${dateTo}T23:59:59`) : true;

            return districtMatches && Boolean(fromMatches) && Boolean(toMatches);
        });
    }, [ledger, districtFilter, dateFrom, dateTo]);

    const exportCsv = () => {
        const header = [
            "Date",
            "Seller District",
            "Buyer District",
            "Energy kWh",
            "Bill Split INR",
            "Seller Earnings INR",
            "Buyer Savings INR",
            "Carbon Credits",
        ];

        const rows = filteredLedger.map((item) =>
            toCsvRow([
                item.completedAt ? new Date(item.completedAt).toISOString() : "",
                item.seller?.district ?? "",
                item.buyer?.district ?? "",
                item.energyAmount_kWh.toFixed(3),
                item.billSplit_INR.toFixed(2),
                (item.ledger?.sellerEarnings_INR ?? 0).toFixed(2),
                (item.ledger?.buyerSavings_INR ?? 0).toFixed(2),
                (item.ledger?.carbonCredits ?? 0).toFixed(2),
            ])
        );

        const csv = [toCsvRow(header), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gridwise-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-white">Karnataka District Heatmap</h2>
                    <p className="text-sm text-white/60">Cyan: surplus, Red: deficit</p>
                </div>
                {loading ? (
                    <div className="h-56 animate-pulse rounded-xl bg-white/5" />
                ) : (
                    <HeatmapGrid
                        districts={districtSurplus}
                        selectedDistrict={selectedDistrict}
                        onSelect={(district) => setSelectedDistrict((prev) => (prev === district ? null : district))}
                    />
                )}
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Admin Forecast Source</p>
                    <p className={`mt-1 text-lg font-semibold ${adminForecastSnapshot?._meta?.source === "ml_service" ? "text-emerald-200" : "text-amber-200"}`}>
                        {adminForecastSnapshot?._meta?.source === "ml_service" ? "ML Service" : "Fallback"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">{adminForecastSnapshot?._meta?.mlServiceStatus.reason ?? "Live forecast path"}</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Forecast Demand (Local)</p>
                    <p className="mt-1 text-lg font-semibold text-red-200">{(adminForecastSnapshot?.forecast.forecasted_demand_kWh ?? 0).toFixed(2)} kWh</p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Forecast Supply (Local)</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-200">
                        {((adminForecastSnapshot?.forecast.forecasted_demand_kWh ?? 0) + (adminForecastSnapshot?.forecast.forecasted_surplus_kWh ?? 0)).toFixed(2)} kWh
                    </p>
                </article>
                <article className="glass-card rounded-xl p-3">
                    <p className="metric-label">Model Confidence</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">
                        {(((adminForecastSnapshot?.forecast.confidence ?? 0) * 100)).toFixed(0)}%
                    </p>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="glass-card space-y-3 rounded-xl p-4">
                    <h2 className="text-xl font-semibold text-white">Anomaly Alerts</h2>
                    {anomalies.length === 0 && (
                        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">No open anomalies.</p>
                    )}
                    {anomalies.map((anomaly) => (
                        <AnomalyAlert
                            key={anomaly.id}
                            anomaly={anomaly}
                            onResolve={resolveAnomaly}
                            resolving={resolvingId === anomaly.id}
                        />
                    ))}
                </div>

                <div className="glass-card rounded-xl p-4">
                    <h2 className="text-xl font-semibold text-white">Capacity Planning Panel</h2>
                    <p className="mt-1 text-sm text-white/60">Top deficit-focused recommendations for next 3 hours, with district and city-level context.</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs ${capacityMeta?.source === "rag_service" ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" : "border-amber-300/40 bg-amber-500/15 text-amber-100"}`}>
                            Recommendation Source: {capacityMeta?.source === "rag_service" ? "RAG Service" : "Fallback"}
                        </span>
                        {capacityMeta?.reason && (
                            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/75">
                                {capacityMeta.reason}
                            </span>
                        )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs md:grid-cols-5">
                        <div>
                            <p className="text-white/50">Focus District</p>
                            <p className="mt-1 font-medium text-white">{capacityDistrict || "-"}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Demand (3h)</p>
                            <p className="mt-1 font-medium text-red-200">{capacityDemand3h.toFixed(2)} kWh</p>
                        </div>
                        <div>
                            <p className="text-white/50">Supply (3h)</p>
                            <p className="mt-1 font-medium text-cyan-200">{capacitySupply3h.toFixed(2)} kWh</p>
                        </div>
                        <div>
                            <p className="text-white/50">Deficit (3h)</p>
                            <p className="mt-1 font-medium text-amber-200">{capacityGap3h.toFixed(2)} kWh</p>
                        </div>
                        <div>
                            <p className="text-white/50">Risk</p>
                            <p className="mt-1">
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${riskPillClass(capacityRisk)}`}>
                                    {capacityRisk}
                                </span>
                            </p>
                        </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-cyan-100">{capacitySummary}</p>

                    <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-white/5 text-left text-white/70">
                                <tr>
                                    <th className="px-3 py-2">City</th>
                                    <th className="px-3 py-2">Demand (3h)</th>
                                    <th className="px-3 py-2">Supply (3h)</th>
                                    <th className="px-3 py-2">Gap (3h)</th>
                                    <th className="px-3 py-2">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topCityDeficits.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-3 text-center text-white/60">
                                            City-level forecast data is unavailable.
                                        </td>
                                    </tr>
                                )}
                                {topCityDeficits.map((row) => (
                                    <tr key={`${row.district}-${row.city}`} className="border-t border-white/10 text-white/80">
                                        <td className="px-3 py-2">{row.city}</td>
                                        <td className="px-3 py-2 text-red-200">{row.demand3h_kWh.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-cyan-200">{row.supply3h_kWh.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-amber-200">{row.gap3h_kWh.toFixed(2)}</td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${riskPillClass(row.riskLevel)}`}>
                                                {row.riskLevel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-white/5 text-left text-white/70">
                                <tr>
                                    <th className="px-3 py-2">Priority</th>
                                    <th className="px-3 py-2">Action</th>
                                    <th className="px-3 py-2">Expected Impact</th>
                                    <th className="px-3 py-2">Cost</th>
                                    <th className="px-3 py-2">ETA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {capacityActions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-4 text-center text-white/60">
                                            Waiting for capacity recommendations...
                                        </td>
                                    </tr>
                                )}
                                {capacityActions.map((action, idx) => (
                                    <tr key={`${action.action}-${idx}`} className="border-t border-white/10 text-white/80">
                                        <td className="px-3 py-2">
                                            <span className="rounded-full border border-cyan-300/40 px-2 py-1 text-[11px] font-semibold text-cyan-200">P{idx + 1}</span>
                                        </td>
                                        <td className="px-3 py-2">{action.action}</td>
                                        <td className="px-3 py-2">{action.expected_impact ?? "-"}</td>
                                        <td className="px-3 py-2">{action.cost_INR ? formatINR(action.cost_INR) : "-"}</td>
                                        <td className="px-3 py-2">{action.time_to_implement ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-white/5 text-left text-white/70">
                                <tr>
                                    <th className="px-3 py-2">District</th>
                                    <th className="px-3 py-2">Demand (3h)</th>
                                    <th className="px-3 py-2">Supply (3h)</th>
                                    <th className="px-3 py-2">Gap (3h)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topDistrictDeficits.map((row) => (
                                    <tr key={row.district} className="border-t border-white/10 text-white/80">
                                        <td className="px-3 py-2">{row.district}</td>
                                        <td className="px-3 py-2 text-red-200">{row.demand3h_kWh.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-cyan-200">{row.supply3h_kWh.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-amber-200">{row.gap3h_kWh.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {topDistrictDeficits.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-3 text-center text-white/60">
                                            District-level forecast data is unavailable.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="glass-card rounded-xl p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">District</label>
                        <select
                            value={districtFilter}
                            onChange={(e) => setDistrictFilter(e.target.value)}
                            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                            <option value="" className="bg-slate-900">
                                All districts
                            </option>
                            {DISTRICTS.map((district) => (
                                <option key={district} value={district} className="bg-slate-900">
                                    {district}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={exportCsv}
                        className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300"
                    >
                        Export CSV
                    </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-white/5 text-left text-white/70">
                            <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Seller District</th>
                                <th className="px-3 py-2">Buyer District</th>
                                <th className="px-3 py-2">Energy (kWh)</th>
                                <th className="px-3 py-2">Bill Split</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLedger.slice(0, 20).map((item) => (
                                <tr key={item.id} className="border-t border-white/10 text-white/80">
                                    <td className="px-3 py-2">{item.completedAt ? new Date(item.completedAt).toLocaleDateString("en-IN") : "-"}</td>
                                    <td className="px-3 py-2">{item.seller?.district ?? "-"}</td>
                                    <td className="px-3 py-2">{item.buyer?.district ?? "-"}</td>
                                    <td className="px-3 py-2">{item.energyAmount_kWh.toFixed(2)}</td>
                                    <td className="px-3 py-2">{formatINR(item.billSplit_INR)}</td>
                                </tr>
                            ))}
                            {filteredLedger.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-4 text-center text-white/60">
                                        No records for selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="glass-card min-w-0 rounded-xl p-4">
                    <h3 className="mb-2 text-lg font-semibold text-white">Total Traded Energy / Day</h3>
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={tradedPerDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                <XAxis dataKey="date" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip />
                                <Bar dataKey="energy" fill="#00e5ff" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card min-w-0 rounded-xl p-4">
                    <h3 className="mb-2 text-lg font-semibold text-white">Top 5 Prosumer Districts</h3>
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={topProsumerDistricts} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="district" type="category" width={120} stroke="#94a3b8" />
                                <Tooltip />
                                <Bar dataKey="energy" fill="#7c3aed" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card min-w-0 rounded-xl p-4">
                    <h3 className="mb-2 text-lg font-semibold text-white">State Demand vs Supply (30d)</h3>
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <LineChart data={demandVsSupply}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                <XAxis dataKey="date" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip />
                                <Line type="monotone" dataKey="demand" stroke="#ff6b6b" strokeWidth={2.2} dot={false} />
                                <Line type="monotone" dataKey="supply" stroke="#00e5ff" strokeWidth={2.2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>
        </div>
    );
}
