"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Server, Lock, User, Globe, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [host, setHost] = useState("192.168.0.101");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, host }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Login failed");
                return;
            }

            router.push("/dashboard");
        } catch {
            setError("Network error. Is the server running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-chart-1/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
            </div>

            <div className="w-full max-w-md px-6 relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                        <Server className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">SecureNAS</h1>
                    <p className="text-sm text-muted-foreground mt-1">Samba Server Management</p>
                </div>

                {/* Login Card */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl shadow-black/10">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Host */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                Server Host
                            </label>
                            <input
                                type="text"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                                className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                  transition-smooth"
                                placeholder="192.168.0.101"
                            />
                        </div>

                        {/* Username */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                SSH Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm
                  placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                  transition-smooth"
                                placeholder="admin"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                SSH Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full px-4 py-2.5 pr-12 bg-secondary border border-border rounded-xl text-foreground text-sm
                    placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                    transition-smooth"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth p-1"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold
                hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth
                flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Connect to Server"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-border">
                        <p className="text-xs text-muted-foreground text-center leading-relaxed">
                            Connects via SSH to manage Samba services.<br />
                            Your credentials are encrypted and stored server-side only.
                        </p>
                    </div>
                </div>

                {/* Security badge */}
                <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    <span>AES-256 encrypted • Session-based auth • Rate limited</span>
                </div>
            </div>
        </div>
    );
}
