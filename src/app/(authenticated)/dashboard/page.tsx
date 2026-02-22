"use client";

import { useEffect, useState } from "react";
import {
    Server,
    HardDrive,
    Cpu,
    MemoryStick,
    Users,
    RefreshCw,
    Activity,
    Loader2,
    Wifi,
} from "lucide-react";

interface SystemData {
    uptime: string;
    memory: string;
    disk: string;
    sambaVersion: string;
    hostname: string;
}

interface ServiceStatus {
    smbd: { active: boolean; output: string };
    nmbd: { active: boolean; output: string };
}

function parseMemory(raw: string) {
    const lines = raw.split("\n");
    const memLine = lines.find((l) => l.startsWith("Mem:"));
    if (!memLine) return { total: 0, used: 0, percent: 0 };
    const parts = memLine.split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    return { total, used, percent: Math.round((used / total) * 100) };
}

function parseDisk(raw: string) {
    const lines = raw.split("\n").filter((l) => l.startsWith("/"));
    return lines.map((line) => {
        const parts = line.split(/\s+/);
        return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            percent: parts[4],
            mounted: parts[5],
        };
    });
}

function parseUptime(raw: string) {
    const match = raw.match(/up\s+(.+?),\s+\d+\s+user/);
    return match ? match[1].trim() : raw;
}

export default function DashboardPage() {
    const [system, setSystem] = useState<SystemData | null>(null);
    const [services, setServices] = useState<ServiceStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const [sysRes, svcRes] = await Promise.all([
                fetch("/api/system"),
                fetch("/api/services"),
            ]);

            if (sysRes.ok) {
                const sysData = await sysRes.json();
                setSystem(sysData.data);
            }
            if (svcRes.ok) {
                const svcData = await svcRes.json();
                setServices(svcData.data);
            }
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30_000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const mem = system ? parseMemory(system.memory) : { total: 0, used: 0, percent: 0 };
    const disks = system ? parseDisk(system.disk) : [];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {system?.hostname || "Server"} • {system?.sambaVersion || "Samba"}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium
            hover:bg-accent transition-smooth disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Uptime */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Uptime</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                        {system ? parseUptime(system.uptime) : "—"}
                    </p>
                </div>

                {/* Memory */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center">
                            <MemoryStick className="w-5 h-5 text-chart-2" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Memory</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{mem.used}MB / {mem.total}MB</p>
                    <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-chart-2 rounded-full transition-all duration-500"
                            style={{ width: `${mem.percent}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{mem.percent}% used</p>
                </div>

                {/* smbd Status */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${services?.smbd.active ? "bg-primary/10" : "bg-destructive/10"
                            }`}>
                            <Server className={`w-5 h-5 ${services?.smbd.active ? "text-primary" : "text-destructive"}`} />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">smbd</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${services?.smbd.active ? "bg-primary animate-pulse" : "bg-destructive"}`} />
                        <p className="text-lg font-semibold text-foreground">
                            {services?.smbd.active ? "Running" : "Stopped"}
                        </p>
                    </div>
                </div>

                {/* nmbd Status */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${services?.nmbd.active ? "bg-primary/10" : "bg-destructive/10"
                            }`}>
                            <Wifi className={`w-5 h-5 ${services?.nmbd.active ? "text-primary" : "text-destructive"}`} />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">nmbd</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${services?.nmbd.active ? "bg-primary animate-pulse" : "bg-destructive"}`} />
                        <p className="text-lg font-semibold text-foreground">
                            {services?.nmbd.active ? "Running" : "Stopped"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <HardDrive className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Disk Usage</h2>
                </div>
                <div className="space-y-4">
                    {disks.map((disk, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-40 text-sm text-muted-foreground truncate" title={disk.filesystem}>
                                {disk.mounted}
                            </div>
                            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${parseInt(disk.percent) > 90 ? "bg-destructive" :
                                            parseInt(disk.percent) > 70 ? "bg-chart-3" : "bg-primary"
                                        }`}
                                    style={{ width: disk.percent }}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground w-28 text-right">
                                {disk.used} / {disk.size}
                            </div>
                            <div className={`text-sm font-medium w-12 text-right ${parseInt(disk.percent) > 90 ? "text-destructive" : "text-foreground"
                                }`}>
                                {disk.percent}
                            </div>
                        </div>
                    ))}
                    {disks.length === 0 && (
                        <p className="text-sm text-muted-foreground">No disk data available</p>
                    )}
                </div>
            </div>
        </div>
    );
}
