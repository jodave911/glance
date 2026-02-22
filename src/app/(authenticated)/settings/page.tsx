"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Loader2, AlertTriangle, RotateCcw, Key } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const [config, setConfig] = useState("");
    const [originalConfig, setOriginalConfig] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchConfig = async () => {
        try {
            const res = await fetch("/api/config");
            if (res.ok) {
                const data = await res.json();
                setConfig(data.data.config);
                setOriginalConfig(data.data.config);
            }
        } catch (err) {
            console.error("Failed to load config:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfig(); }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: data.data.message });
                setOriginalConfig(config);
            } else {
                setMessage({ type: "error", text: data.error });
            }
        } catch {
            setMessage({ type: "error", text: "Failed to save configuration" });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = config !== originalConfig;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Edit smb.conf directly</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setConfig(originalConfig)}
                        disabled={!hasChanges}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium
              hover:bg-accent disabled:opacity-50 transition-smooth"
                    >
                        <RotateCcw className="w-4 h-4" /> Revert
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium
              hover:opacity-90 disabled:opacity-50 transition-smooth"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save &amp; Reload
                    </button>
                </div>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    href="/settings/ssh-keys"
                    className="group flex items-center justify-between p-5 bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-smooth"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-smooth">
                            <Key className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">SSH Keys</h3>
                            <p className="text-xs text-muted-foreground">Manage authorized public keys</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-smooth">
                        <RotateCcw className="w-4 h-4 rotate-180" />
                    </div>
                </Link>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 px-4 py-3 bg-chart-3/10 border border-chart-3/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-chart-3 mt-0.5 shrink-0" />
                <div className="text-sm text-foreground">
                    <p className="font-medium">Direct config editing</p>
                    <p className="text-muted-foreground mt-0.5">
                        Changes are validated with <code className="text-xs bg-muted px-1 py-0.5 rounded">testparm</code> before applying.
                        If validation fails, the previous config is automatically restored.
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`px-4 py-3 rounded-xl text-sm border ${message.type === "success"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Editor */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
                    <span className="text-xs text-muted-foreground font-mono">/etc/samba/smb.conf</span>
                    {hasChanges && (
                        <span className="text-xs text-chart-3 font-medium">Unsaved changes</span>
                    )}
                </div>
                <textarea
                    value={config}
                    onChange={(e) => setConfig(e.target.value)}
                    className="w-full h-[500px] p-4 bg-transparent text-foreground font-mono text-sm leading-relaxed
            resize-none focus:outline-none"
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
