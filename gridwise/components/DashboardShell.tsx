"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AUTH_ROLE_HOME } from "@/lib/constants";
import type { GridwiseTokenPayload } from "@/lib/auth";

type DashboardShellProps = {
    user: GridwiseTokenPayload;
    children: React.ReactNode;
};

type NavItem = { href: string; label: string };

export default function DashboardShell({ user, children }: DashboardShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

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

    return (
        <div className="flex min-h-screen bg-[#05060b] text-white">
            <aside className="hidden w-72 flex-col border-r border-white/10 bg-[#090b14] p-6 md:flex">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">GridWise Network</p>
                <h1 className="mt-3 text-2xl font-bold">Smart Energy Sharing</h1>

                <nav className="mt-10 space-y-2">
                    {navItems.map((item) => {
                        const active = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`block rounded-lg px-4 py-2 text-sm transition ${active
                                        ? "bg-cyan-400 text-slate-900"
                                        : "border border-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto rounded-xl border border-violet-300/25 bg-violet-500/10 p-4 text-sm text-white/80">
                    <p className="font-medium text-violet-200">Role</p>
                    <p className="mt-1">{user.role}</p>
                    <p className="mt-4 font-medium text-violet-200">District</p>
                    <p className="mt-1">{user.district}</p>
                </div>
            </aside>

            <section className="flex min-h-screen min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070911]/95 px-5 py-4 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-lg font-semibold">Welcome, {user.name ?? user.email}</p>
                            <p className="text-sm text-white/60">
                                {user.city}, {user.district}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
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
