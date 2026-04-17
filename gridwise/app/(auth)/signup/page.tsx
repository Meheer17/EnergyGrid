"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DISTRICTS, DISTRICT_CITY_MAP } from "@/lib/karnataka";
import { AUTH_ROLE_HOME } from "@/lib/constants";

const schema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Include at least one uppercase letter")
        .regex(/[0-9]/, "Include at least one number"),
    role: z.enum(["CONSUMER", "PROSUMER"]),
    district: z.string().min(1),
    city: z.string().min(1),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            role: "CONSUMER",
            district: DISTRICTS[0],
            city: DISTRICT_CITY_MAP[DISTRICTS[0]][0],
            pincode: "",
        },
    });

    const district = form.watch("district");
    const cities = useMemo(() => DISTRICT_CITY_MAP[district] ?? [], [district]);

    const onSubmit = form.handleSubmit(async (values) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error ?? "Signup failed");
                return;
            }

            const rolePath = AUTH_ROLE_HOME[data.user.role] ?? "/dashboard/consumer";
            router.replace(rolePath);
            router.refresh();
        } catch {
            setError("Unable to signup. Please try again.");
        } finally {
            setLoading(false);
        }
    });

    return (
        <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/50 p-8 shadow-[0_0_0_1px_rgba(124,58,237,0.35),0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-violet-300/80">GridWise</p>
            <h1 className="mt-3 text-3xl font-bold text-white">Create your smart energy account</h1>
            <p className="mt-2 text-sm text-white/70">Join your neighborhood energy network in Karnataka.</p>

            <form onSubmit={onSubmit} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                    <label htmlFor="name" className="mb-1 block text-sm text-white/80">
                        Name
                    </label>
                    <input
                        id="name"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                        <p className="mt-1 text-xs text-red-300">{form.formState.errors.name.message}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="email" className="mb-1 block text-sm text-white/80">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
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
                        {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                        <p className="mt-1 text-xs text-red-300">{form.formState.errors.password.message}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="role" className="mb-1 block text-sm text-white/80">
                        Role
                    </label>
                    <select
                        id="role"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        {...form.register("role")}
                    >
                        <option className="bg-slate-900" value="CONSUMER">
                            Consumer
                        </option>
                        <option className="bg-slate-900" value="PROSUMER">
                            Prosumer
                        </option>
                    </select>
                </div>

                <div>
                    <label htmlFor="district" className="mb-1 block text-sm text-white/80">
                        District
                    </label>
                    <select
                        id="district"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        {...form.register("district", {
                            onChange: (e) => {
                                const nextDistrict = e.target.value;
                                form.setValue("city", DISTRICT_CITY_MAP[nextDistrict]?.[0] ?? "");
                            },
                        })}
                    >
                        {DISTRICTS.map((item) => (
                            <option key={item} className="bg-slate-900" value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="city" className="mb-1 block text-sm text-white/80">
                        City
                    </label>
                    <select
                        id="city"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        {...form.register("city")}
                    >
                        {cities.map((item) => (
                            <option key={item} className="bg-slate-900" value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="pincode" className="mb-1 block text-sm text-white/80">
                        Pincode
                    </label>
                    <input
                        id="pincode"
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white outline-none ring-cyan-300 transition focus:ring-2"
                        {...form.register("pincode")}
                    />
                    {form.formState.errors.pincode && (
                        <p className="mt-1 text-xs text-red-300">{form.formState.errors.pincode.message}</p>
                    )}
                </div>

                {error && (
                    <p className="md:col-span-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="md:col-span-2 rounded-lg bg-cyan-400 px-4 py-2 font-medium text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Creating account..." : "Create account"}
                </button>
            </form>

            <p className="mt-6 text-sm text-white/70">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
                    Sign in
                </Link>
            </p>
        </section>
    );
}
