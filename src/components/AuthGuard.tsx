"use client";

import React, { useState, useEffect } from 'react';
import { Lock, Sparkles, ChefHat, Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('family_authenticated');
        if (saved === 'true') {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await res.json();
            if (data.success) {
                localStorage.setItem('family_authenticated', 'true');
                setIsAuthenticated(true);
            } else {
                setError(data.error || '認証に失敗しました。');
            }
        } catch (err) {
            setError('サーバーとの通信に失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
                <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-10 backdrop-blur-xl shadow-2xl">
                    <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/20">
                            <ChefHat className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">FAMILY LOGIN</h2>
                        <p className="mt-3 text-slate-400 text-sm">家族専用の「合言葉」を入力してください</p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500">
                                <Lock className="h-5 w-5" />
                            </div>
                            <input
                                type="password"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="合言葉を入力"
                                className="block w-full rounded-2xl border border-slate-700 bg-slate-800/50 py-4 pl-12 pr-4 text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-rose-400 font-medium bg-rose-400/10 p-3 rounded-xl border border-rose-400/20 text-center">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    アクセス
                                </span>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
