"use client";

import { useEffect, useState } from "react";
import { Server, Wifi, Play, Square, RotateCcw, RefreshCw, Loader2 } from "lucide-react";

interface ServiceInfo {
    active: boolean;
    output: string;
    code: number;
}

export default function ServicesPage() {
    const [smbd, setSmbd] = useState<ServiceInfo | null>(null);
    const [nmbd, setNmbd] = useState<ServiceInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const res = await fetch("/api/services");
            if (res.ok) {
                const data = await res.json();
                setSmbd(data.data.smbd);
                setNmbd(data.data.nmbd);
            }
        } catch (err) {
            console.error("Failed to fetch services:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, []);

    const handleAction = async (service: string, action: string) => {
        setActionLoading(`${service}-${action}`);
        try {
            await fetch("/api/services", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ service, action }),
            });
            await fetchStatus();
        } catch (err) {
            console.error("Action failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const ServiceCard = ({ name, icon: Icon, info }: { name: string; icon: typeof Server; info: ServiceInfo | null }) => (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${info?.active ? "bg-primary/10" : "bg-destructive/10"
                        }`}>
                        <Icon className={`w-6 h-6 ${info?.active ? "text-primary" : "text-destructive"}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">{name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${info?.active ? "bg-primary animate-pulse" : "bg-destructive"}`} />
                            <span className={`text-sm ${info?.active ? "text-primary" : "text-destructive"}`}>
                                {info?.active ? "Running" : "Stopped"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mb-6">
                {!info?.active && (
                    <button
                        onClick={() => handleAction(name, "start")}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium
              hover:opacity-90 disabled:opacity-50 transition-smooth"
                    >
                        {actionLoading === `${name}-start` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start
                    </button>
                )}
                {info?.active && (
                    <button
                        onClick={() => handleAction(name, "stop")}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-xl text-sm font-medium
              hover:opacity-90 disabled:opacity-50 transition-smooth"
                    >
                        {actionLoading === `${name}-stop` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        Stop
                    </button>
                )}
                <button
                    onClick={() => handleAction(name, "restart")}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium
            hover:bg-accent disabled:opacity-50 transition-smooth"
                >
                    {actionLoading === `${name}-restart` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Restart
                </button>
            </div>

            {/* Service output */}
            <div className="bg-background border border-border rounded-xl p-4 max-h-60 overflow-y-auto">
                <pre className="log-viewer text-muted-foreground whitespace-pre-wrap break-words">
                    {info?.output || "No output available"}
                </pre>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Services</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage Samba services</p>
                </div>
                <button onClick={fetchStatus} className="p-2 bg-secondary rounded-xl hover:bg-accent transition-smooth">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ServiceCard name="smbd" icon={Server} info={smbd} />
                <ServiceCard name="nmbd" icon={Wifi} info={nmbd} />
            </div>
        </div>
    );
}
