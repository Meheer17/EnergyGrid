"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AUTH_ROLE_HOME } from "@/lib/constants";

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = form.handleSubmit(async (values) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error ?? "Login failed");
                return;
            }

            const rolePath = AUTH_ROLE_HOME[data.user.role] ?? "/dashboard/consumer";
            router.replace(rolePath);
            router.refresh();
        } catch {
            setError("Unable to login. Please try again.");
        } finally {
            setLoading(false);
        }
    });

    return (
        <section className="glass-card w-full max-w-md rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">GridWise Access</p>
            <h1 className="mt-3 text-3xl font-bold text-white">Sign in to Control Room</h1>
            <p className="mt-2 text-sm text-white/70">Access district-level forecasts, trading, and AI recommendations.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm text-white/80">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder="you@example.com"
                        {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                        <p className="mt-1 text-xs text-red-300">{form.formState.errors.email.message}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="mb-1 block text-sm text-white/80">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder="********"
                        {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                        <p className="mt-1 text-xs text-red-300">{form.formState.errors.password.message}</p>
                    )}
                </div>

                {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Signing in..." : "Sign in"}
                </button>
            </form>

            <p className="mt-6 text-sm text-white/70">
                New to GridWise?{" "}
                <Link href="/signup" className="font-medium text-cyan-300 hover:text-cyan-200">
                    Create an account
                </Link>
            </p>
        </section>
    );
}
