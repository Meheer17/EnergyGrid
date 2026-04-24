"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type ChartLine = {
    key: string;
    color: string;
    label: string;
    type?: "line" | "area";
};

type EnergyChartProps = {
    data: Record<string, unknown>[];
    xKey: string;
    lines: ChartLine[];
    kind?: "line" | "area";
    height?: number;
};

export default function EnergyChart({
    data,
    xKey,
    lines,
    kind = "line",
    height = 280,
}: EnergyChartProps) {
    const ChartComponent = kind === "area" ? AreaChart : LineChart;

    return (
        <div className="glass-card min-w-0 rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap gap-2">
                {lines.map((line) => (
                    <span
                        key={line.key}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80"
                    >
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
                        {line.label}
                    </span>
                ))}
            </div>
            <div style={{ width: "100%", height, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <ChartComponent data={data}>
                        <CartesianGrid strokeDasharray="4 6" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey={xKey} tick={{ fill: "#dbe4f0", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#dbe4f0", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{
                                background: "#0a1424",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 10,
                                color: "#fff",
                            }}
                            labelStyle={{ color: "#7dd3fc" }}
                        />
                        {lines.map((line) => {
                            const renderAsArea = line.type === "area" || kind === "area";

                            if (renderAsArea) {
                                return (
                                    <Area
                                        key={line.key}
                                        type="monotone"
                                        dataKey={line.key}
                                        name={line.label}
                                        stroke={line.color}
                                        fill={line.color}
                                        fillOpacity={0.22}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                );
                            }

                            return (
                                <Line
                                    key={line.key}
                                    type="monotone"
                                    dataKey={line.key}
                                    name={line.label}
                                    stroke={line.color}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            );
                        })}
                    </ChartComponent>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
