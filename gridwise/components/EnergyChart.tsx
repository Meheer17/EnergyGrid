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
        <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-4">
            <div style={{ width: "100%", height }}>
                <ResponsiveContainer>
                    <ChartComponent data={data}>
                        <CartesianGrid strokeDasharray="4 6" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey={xKey} tick={{ fill: "#cdd6f4", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#cdd6f4", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{
                                background: "#07080f",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 10,
                                color: "#fff",
                            }}
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
