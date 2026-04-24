"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AUTH_ROLE_HOME } from "@/lib/constants";
import type { GridwiseTokenPayload } from "@/lib/auth";

type DashboardShellProps = {
    user: GridwiseTokenPayload;
    children: React.ReactNode;
};

type NavItem = { href: string; label: string };

type ServiceProbe = {
    name: "ml" | "rag";
    url: string;
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number;
    error?: string;
    details?: unknown;
};

type ServiceStatusResponse = {
    checkedAt: string;
    services: {
        ml: ServiceProbe;
        rag: ServiceProbe;
    };
};

function serviceBadgeClass(ok: boolean) {
    return ok
        ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
        : "border-red-300/40 bg-red-500/15 text-red-100";
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);
    const [serviceStatus, setServiceStatus] = useState<ServiceStatusResponse | null>(null);

    const navItems = useMemo<NavItem[]>(() => {
        if (user.role === "CONSUMER") {
            return [{ href: "/dashboard/consumer", label: "Consumer Dashboard" }];
        }
        if (user.role === "PROSUMER") {
            return [{ href: "/dashboard/prosumer", label: "Prosumer Dashboard" }];
        }
        return [{ href: "/dashboard/admin", label: "Admin Control Room" }];
    }, [user.role]);

    const logout = async () => {
        setLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
            router.refresh();
        } finally {
            setLoggingOut(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const loadStatus = async () => {
            try {
                const response = await fetch("/api/system/status", { cache: "no-store" });
                const data = await response.json();
                if (!mounted || !response.ok) return;
                setServiceStatus(data as ServiceStatusResponse);
            } catch {
                if (!mounted) return;
                setServiceStatus(null);
            }
        };

        loadStatus();
        const interval = setInterval(loadStatus, 45000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="flex min-h-screen bg-[#06101b] text-white">
            <aside className="hidden w-80 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,15,27,0.98)_0%,rgba(6,12,23,0.96)_100%)] p-6 md:flex">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">GridWise Command</p>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-white">Energy Control Studio</h1>
                <p className="mt-2 text-sm text-slate-300/80">Forecast, trade, and grid interventions for Karnataka operations.</p>

                <nav className="mt-10 space-y-2">
                    {navItems.map((item) => {
                        const active = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`block rounded-xl px-4 py-3 text-sm transition ${active
                                    ? "border border-cyan-300/40 bg-cyan-300/90 text-slate-950 shadow-[0_12px_30px_rgba(0,180,200,0.24)]"
                                    : "border border-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Service Health</p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                        <div className={`rounded-lg border px-3 py-2 text-xs ${serviceBadgeClass(Boolean(serviceStatus?.services.ml.ok))}`}>
                            <p className="font-semibold">ML Service</p>
                            <p className="mt-1 text-[11px]">{serviceStatus?.services.ml.ok ? "Online" : "Unavailable"}</p>
                            <p className="text-[11px] opacity-85">
                                {serviceStatus?.services.ml.httpStatus ? `HTTP ${serviceStatus.services.ml.httpStatus}` : "No response"}
                                {serviceStatus?.services.ml.latencyMs ? ` • ${serviceStatus.services.ml.latencyMs} ms` : ""}
                            </p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2 text-xs ${serviceBadgeClass(Boolean(serviceStatus?.services.rag.ok))}`}>
                            <p className="font-semibold">RAG Service</p>
                            <p className="mt-1 text-[11px]">{serviceStatus?.services.rag.ok ? "Online" : "Unavailable"}</p>
                            <p className="text-[11px] opacity-85">
                                {serviceStatus?.services.rag.httpStatus ? `HTTP ${serviceStatus.services.rag.httpStatus}` : "No response"}
                                {serviceStatus?.services.rag.latencyMs ? ` • ${serviceStatus.services.rag.latencyMs} ms` : ""}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <p className="font-medium text-cyan-200">Role</p>
                    <p className="mt-1">{user.role}</p>
                    <p className="mt-4 font-medium text-cyan-200">District</p>
                    <p className="mt-1">{user.district}</p>
                    <p className="mt-4 font-medium text-cyan-200">City</p>
                    <p className="mt-1">{user.city}</p>
                </div>
            </aside>

            <section className="flex min-h-screen min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07111f]/90 px-5 py-4 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-lg font-semibold">Welcome, {user.name ?? user.email}</p>
                            <p className="text-sm text-white/60">
                                {user.city}, {user.district}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className={`rounded-full border px-3 py-1 text-xs ${serviceBadgeClass(Boolean(serviceStatus?.services.ml.ok))}`}>
                                ML {serviceStatus?.services.ml.ok ? "Live" : "Fallback"}
                            </div>
                            <div className={`rounded-full border px-3 py-1 text-xs ${serviceBadgeClass(Boolean(serviceStatus?.services.rag.ok))}`}>
                                RAG {serviceStatus?.services.rag.ok ? "Live" : "Fallback"}
                            </div>
                            <Link
                                href={AUTH_ROLE_HOME[user.role]}
                                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                            >
                                Home
                            </Link>
                            <button
                                onClick={logout}
                                disabled={loggingOut}
                                className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
                            >
                                {loggingOut ? "Logging out..." : "Logout"}
                            </button>
                        </div>
                    </div>
                </header>

                <div className="min-w-0 flex-1 p-5 md:p-7">{children}</div>
            </section>
        </div>
    );
}
