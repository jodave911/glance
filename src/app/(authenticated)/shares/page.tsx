"use client";

import { useEffect, useState } from "react";
import { HardDrive, Plus, Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";

interface Share {
    name: string;
    path: string;
    comment?: string;
    "valid users"?: string;
    "read only"?: string;
    browseable?: string;
    "guest ok"?: string;
    writable?: string;
}

const emptyShare: Share = {
    name: "",
    path: "",
    comment: "",
    "valid users": "",
    "read only": "no",
    browseable: "yes",
    "guest ok": "no",
    writable: "yes",
};

export default function SharesPage() {
    const [shares, setShares] = useState<Share[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editShare, setEditShare] = useState<Share>(emptyShare);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const fetchShares = async () => {
        try {
            const res = await fetch("/api/shares");
            if (res.ok) {
                const data = await res.json();
                setShares(data.data.shares);
            }
        } catch (err) {
            console.error("Failed to fetch shares:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchShares(); }, []);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const method = isEditing ? "PUT" : "POST";
            const res = await fetch("/api/shares", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editShare),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error);
                return;
            }
            setDialogOpen(false);
            fetchShares();
        } catch {
            setError("Failed to save share");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Delete share "${name}"? This will remove it from smb.conf.`)) return;
        try {
            const res = await fetch("/api/shares", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) fetchShares();
        } catch (err) {
            console.error("Failed to delete share:", err);
        }
    };

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
                    <h1 className="text-2xl font-bold text-foreground">Shares</h1>
                    <p className="text-sm text-muted-foreground mt-1">{shares.length} configured shares</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchShares} className="p-2 bg-secondary rounded-xl hover:bg-accent transition-smooth">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setEditShare(emptyShare); setIsEditing(false); setDialogOpen(true); setError(""); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-smooth"
                    >
                        <Plus className="w-4 h-4" /> Add Share
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Path</th>
                                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Valid Users</th>
                                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Writable</th>
                                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Browseable</th>
                                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shares.map((share) => (
                                <tr key={share.name} className="border-b border-border last:border-0 hover:bg-muted/20 transition-smooth">
                                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                        <HardDrive className="w-4 h-4 text-primary" />
                                        {share.name}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{share.path}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{share["valid users"] || "—"}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${share.writable === "yes" || share["read only"] === "no"
                                            ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            }`}>
                                            {share.writable === "yes" || share["read only"] === "no" ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${share.browseable !== "no" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            }`}>
                                            {share.browseable !== "no" ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => { setEditShare(share); setIsEditing(true); setDialogOpen(true); setError(""); }}
                                                className="p-2 rounded-lg hover:bg-accent transition-smooth text-muted-foreground hover:text-foreground"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(share.name)}
                                                className="p-2 rounded-lg hover:bg-destructive/10 transition-smooth text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {shares.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        No shares configured. Click &quot;Add Share&quot; to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl mx-4">
                        <h2 className="text-lg font-bold text-foreground mb-4">
                            {isEditing ? "Edit Share" : "Add Share"}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground">Share Name</label>
                                <input
                                    value={editShare.name}
                                    onChange={(e) => setEditShare({ ...editShare, name: e.target.value })}
                                    disabled={isEditing}
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
                    disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="MyShare"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground">Path</label>
                                <input
                                    value={editShare.path}
                                    onChange={(e) => setEditShare({ ...editShare, path: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground font-mono
                    focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="/srv/samba/myshare"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground">Comment</label>
                                <input
                                    value={editShare.comment || ""}
                                    onChange={(e) => setEditShare({ ...editShare, comment: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Shared folder description"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground">Valid Users</label>
                                <input
                                    value={editShare["valid users"] || ""}
                                    onChange={(e) => setEditShare({ ...editShare, "valid users": e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="user1, @group1"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {(["writable", "browseable", "guest ok"] as const).map((field) => (
                                    <label key={field} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={editShare[field] === "yes"}
                                            onChange={(e) => setEditShare({ ...editShare, [field]: e.target.checked ? "yes" : "no" })}
                                            className="rounded"
                                        />
                                        <span className="capitalize text-foreground">{field}</span>
                                    </label>
                                ))}
                            </div>
                            {error && (
                                <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setDialogOpen(false)}
                                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-accent transition-smooth"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90
                  disabled:opacity-50 transition-smooth flex items-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isEditing ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
