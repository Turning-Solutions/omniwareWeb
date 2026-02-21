"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams?.get("redirect") ?? null;
    const redirectTo = redirect?.startsWith("/") ? redirect : null;
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            const { data } = await api.post("/auth/login", formData);
            localStorage.setItem("userInfo", JSON.stringify(data));
            router.push(redirectTo || "/admin");
        } catch (err: unknown) {
            setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Login failed");
        }
    };

    return (
        <div className="bg-card border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-6 text-center">Admin Login</h1>
            {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg mb-4 text-center">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                    <input
                        type="text"
                        autoComplete="username"
                        required
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                    <input
                        type="password"
                        autoComplete="current-password"
                        required
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    Sign In
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen pt-20 flex items-center justify-center px-4">
            <Suspense fallback={<div className="bg-card border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl h-64 animate-pulse" />}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
