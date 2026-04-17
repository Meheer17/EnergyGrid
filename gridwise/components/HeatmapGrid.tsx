"use client";

type DistrictHeatDatum = {
    name: string;
    surplus_kWh: number;
};

type HeatmapGridProps = {
    districts: DistrictHeatDatum[];
    selectedDistrict?: string | null;
    onSelect?: (district: string) => void;
};

function blendHex(a: [number, number, number], b: [number, number, number], t: number) {
    const lerp = (x: number, y: number, p: number) => Math.round(x + (y - x) * p);
    return `rgb(${lerp(a[0], b[0], t)}, ${lerp(a[1], b[1], t)}, ${lerp(a[2], b[2], t)})`;
}

function getHeatColor(value: number) {
    const clamped = Math.max(-200, Math.min(200, value));

    if (clamped < 0) {
        const t = Math.abs(clamped) / 200;
        return blendHex([120, 128, 140], [255, 85, 85], t);
    }

    const t = clamped / 200;
    return blendHex([120, 128, 140], [0, 229, 255], t);
}

export default function HeatmapGrid({ districts, selectedDistrict, onSelect }: HeatmapGridProps) {
    const columns = 6;
    const cellW = 125;
    const cellH = 62;
    const gap = 10;
    const rows = Math.ceil(districts.length / columns);
    const width = columns * cellW + (columns - 1) * gap;
    const height = rows * cellH + (rows - 1) * gap;

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0a0a0f] p-4">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="District surplus heatmap">
                {districts.map((district, index) => {
                    const row = Math.floor(index / columns);
                    const col = index % columns;
                    const x = col * (cellW + gap);
                    const y = row * (cellH + gap);
                    const selected = selectedDistrict === district.name;

                    return (
                        <g key={district.name} onClick={() => onSelect?.(district.name)} className="cursor-pointer">
                            <rect
                                x={x}
                                y={y}
                                width={cellW}
                                height={cellH}
                                rx={12}
                                fill={getHeatColor(district.surplus_kWh)}
                                stroke={selected ? "#ffffff" : "rgba(255,255,255,0.25)"}
                                strokeWidth={selected ? 2.5 : 1}
                            />
                            <text x={x + 10} y={y + 24} fontSize={12} fill="#06121a" fontWeight={700}>
                                {district.name}
                            </text>
                            <text x={x + 10} y={y + 44} fontSize={11} fill="#06121a" fontWeight={600}>
                                {district.surplus_kWh.toFixed(1)} kWh
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
