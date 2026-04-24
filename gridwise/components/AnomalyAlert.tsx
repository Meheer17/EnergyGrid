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
        <article className="glass-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">{anomaly.type}</span>
                <span className={`rounded-full border px-2 py-1 text-xs ${severityClass(anomaly.severity)}`}>
                    {anomaly.severity}
                </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-white">
                {anomaly.city}, {anomaly.district}
            </h3>
            <p className="mt-2 text-sm text-slate-100/90">{anomaly.description}</p>

            <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                <p className="text-xs uppercase tracking-[0.1em] text-amber-200/75">Suggested Action</p>
                <p className="mt-1">{anomaly.suggestedAction}</p>
            </div>

            {onResolve && (
                <button
                    onClick={() => onResolve(anomaly.id)}
                    disabled={resolving}
                    className="mt-4 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {resolving ? "Resolving..." : "Resolve"}
                </button>
            )}
        </article>
    );
}
