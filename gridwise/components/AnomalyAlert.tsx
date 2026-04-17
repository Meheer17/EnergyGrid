"use client";

type Anomaly = {
    id: string;
    district: string;
    city: string;
    type: string;
    severity: string;
    description: string;
    suggestedAction: string;
};

type AnomalyAlertProps = {
    anomaly: Anomaly;
    onResolve?: (anomalyId: string) => Promise<void>;
    resolving?: boolean;
};

function severityClass(severity: string) {
    const value = severity.toLowerCase();
    if (value === "critical") return "bg-red-500/20 text-red-200 border-red-300/30";
    if (value === "high") return "bg-orange-500/20 text-orange-200 border-orange-300/30";
    if (value === "medium") return "bg-yellow-500/20 text-yellow-200 border-yellow-300/30";
    return "bg-slate-500/20 text-slate-200 border-slate-300/30";
}

export default function AnomalyAlert({ anomaly, onResolve, resolving = false }: AnomalyAlertProps) {
    return (
        <article className="rounded-xl border border-red-400/25 bg-red-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">{anomaly.type}</span>
                <span className={`rounded-full border px-2 py-1 text-xs ${severityClass(anomaly.severity)}`}>
                    {anomaly.severity}
                </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-white">
                {anomaly.city}, {anomaly.district}
            </h3>
            <p className="mt-2 text-sm text-red-100/90">{anomaly.description}</p>
            <p className="mt-2 text-sm text-cyan-200">Action: {anomaly.suggestedAction}</p>

            {onResolve && (
                <button
                    onClick={() => onResolve(anomaly.id)}
                    disabled={resolving}
                    className="mt-4 rounded-lg bg-red-400 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {resolving ? "Resolving..." : "Resolve"}
                </button>
            )}
        </article>
    );
}
