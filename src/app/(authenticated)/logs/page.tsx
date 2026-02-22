"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw, Loader2, Search, ArrowDown } from "lucide-react";

export default function LogsPage() {
    const [content, setContent] = useState("");
    const [logFile, setLogFile] = useState("log.smbd");
    const [lines, setLines] = useState(100);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/logs?file=${logFile}&lines=${lines}`);
            if (res.ok) {
                const data = await res.json();
                setContent(data.data.content);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [logFile, lines]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, logFile, lines]);

    const filteredLines = filter
        ? content.split("\n").filter((line) => line.toLowerCase().includes(filter.toLowerCase())).join("\n")
        : content;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Logs</h1>
                    <p className="text-sm text-muted-foreground mt-1">Samba server logs</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-tail
                    </label>
                    <button onClick={fetchLogs} className="p-2 bg-secondary rounded-xl hover:bg-accent transition-smooth">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={logFile}
                    onChange={(e) => setLogFile(e.target.value)}
                    className="px-4 py-2 bg-secondary border border-border rounded-xl text-sm text-foreground
            focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="log.smbd">log.smbd</option>
                    <option value="log.nmbd">log.nmbd</option>
                    <option value="log.winbindd">log.winbindd</option>
                </select>
                <select
                    value={lines}
                    onChange={(e) => setLines(parseInt(e.target.value))}
                    className="px-4 py-2 bg-secondary border border-border rounded-xl text-sm text-foreground
            focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value={50}>50 lines</option>
                    <option value={100}>100 lines</option>
                    <option value={250}>250 lines</option>
                    <option value={500}>500 lines</option>
                    <option value={1000}>1000 lines</option>
                </select>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm text-foreground
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Filter logs..."
                    />
                </div>
            </div>

            {/* Log content */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="p-4 max-h-[600px] overflow-auto">
                        <pre className="log-viewer text-muted-foreground whitespace-pre-wrap break-words">
                            {filteredLines || "No log entries found"}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
