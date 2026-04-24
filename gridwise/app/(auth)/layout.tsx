export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_16%_12%,rgba(22,217,227,0.2),transparent_38%),radial-gradient(circle_at_84%_6%,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,#071220_0%,#040b15_100%)] p-6">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="glass-card hidden rounded-3xl p-8 lg:flex lg:flex-col lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">GridWise</p>
                        <h1 className="mt-4 text-4xl font-bold leading-tight text-white">
                            AI-Powered Energy Operations for Karnataka
                        </h1>
                        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
                            Forecast demand, balance supply, detect anomalies, and coordinate peer-to-peer trading with explainable dashboards.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm">
                        <article className="rounded-xl border border-white/15 bg-white/5 p-3">
                            <p className="metric-label">Forecasting</p>
                            <p className="mt-1 text-white/90">Multi-hour demand and surplus prediction using the ML service.</p>
                        </article>
                        <article className="rounded-xl border border-white/15 bg-white/5 p-3">
                            <p className="metric-label">Recommendations</p>
                            <p className="mt-1 text-white/90">RAG-backed assistant with transparent source badges and fallback behavior.</p>
                        </article>
                        <article className="rounded-xl border border-white/15 bg-white/5 p-3">
                            <p className="metric-label">Operations</p>
                            <p className="mt-1 text-white/90">City and district-level analytics for quick decision making.</p>
                        </article>
                    </div>
                </section>

                <div className="flex items-center justify-center">
                    {children}
                </div>
            </div>
        </main>
    );
}
