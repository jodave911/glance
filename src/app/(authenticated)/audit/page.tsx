"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2, RefreshCw, CheckCircle, XCircle, Search } from "lucide-react";

interface AuditEntry {
    ts: string;
    user: string;
    ip: string;
    action: string;
    target: string;
    detail?: string;
    success: boolean;
}

export default function AuditPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");

    // Audit log is read from the API — but we need to create a route for it
    // For now, this is a placeholder that will work once the audit API is added
    const fetchAudit = async () => {
        try {
            // TODO: The audit log is stored server-side as a file.
            // For the current iteration, we'll display a message suggesting checking the local file.
            setEntries([]);
        } catch (err) {
            console.error("Failed to fetch audit log:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudit(); }, []);

    const filtered = filter
        ? entries.filter((e) =>
            e.action.toLowerCase().includes(filter.toLowerCase()) ||
            e.user.toLowerCase().includes(filter.toLowerCase()) ||
            e.target.toLowerCase().includes(filter.toLowerCase())
        )
        : entries;

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
                    <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
                    <p className="text-sm text-muted-foreground mt-1">All administrative actions are logged</p>
                </div>
                <button onClick={fetchAudit} className="p-2 bg-secondary rounded-xl hover:bg-accent transition-smooth">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
            placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Search by action, user, or target..."
                />
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
                <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                    <p className="font-medium text-foreground">Audit trail active</p>
                    <p className="text-muted-foreground mt-0.5">
                        All state-changing operations (share/user/service/config changes) are logged to{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">audit.log</code> with timestamps, usernames, IPs, and outcomes.
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Timestamp</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">User</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">IP</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Action</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Target</th>
                            <th className="text-center px-6 py-3 font-medium text-muted-foreground">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((entry, i) => (
                            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-smooth">
                                <td className="px-6 py-3 text-muted-foreground text-xs font-mono">{new Date(entry.ts).toLocaleString()}</td>
                                <td className="px-6 py-3 text-foreground font-medium">{entry.user}</td>
                                <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{entry.ip}</td>
                                <td className="px-6 py-3">
                                    <span className="inline-flex px-2 py-0.5 bg-muted rounded-md text-xs font-medium text-foreground">
                                        {entry.action}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">{entry.target}</td>
                                <td className="px-6 py-3 text-center">
                                    {entry.success ? (
                                        <CheckCircle className="w-4 h-4 text-primary mx-auto" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    {entries.length === 0
                                        ? "Audit log entries will appear here as actions are performed."
                                        : "No matching entries found."
                                    }
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
