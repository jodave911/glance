"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Key, Loader2, RefreshCw, UserCheck, UserX } from "lucide-react";

interface SambaUser {
    username: string;
    fullName: string;
    sid: string;
    flags: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<SambaUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"add" | "password">("add");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data.data.users);
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const method = dialogMode === "add" ? "POST" : "PUT";
            const res = await fetch("/api/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setDialogOpen(false);
            setUsername(""); setPassword("");
            fetchUsers();
        } catch {
            setError("Operation failed");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (user: string, action: "enable" | "disable") => {
        try {
            await fetch("/api/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, action }),
            });
            fetchUsers();
        } catch (err) {
            console.error("Toggle failed:", err);
        }
    };

    const handleDelete = async (user: string) => {
        if (!confirm(`Delete Samba user "${user}"?`)) return;
        try {
            await fetch("/api/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user }),
            });
            fetchUsers();
        } catch (err) {
            console.error("Delete failed:", err);
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
                    <h1 className="text-2xl font-bold text-foreground">Users</h1>
                    <p className="text-sm text-muted-foreground mt-1">{users.length} Samba users</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchUsers} className="p-2 bg-secondary rounded-xl hover:bg-accent transition-smooth">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setDialogMode("add"); setUsername(""); setPassword(""); setDialogOpen(true); setError(""); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-smooth"
                    >
                        <Plus className="w-4 h-4" /> Add User
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Username</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Full Name</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">SID</th>
                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => {
                            const isDisabled = user.flags?.includes("D");
                            return (
                                <tr key={user.username} className="border-b border-border last:border-0 hover:bg-muted/20 transition-smooth">
                                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" />
                                        {user.username}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{user.fullName || "—"}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${isDisabled ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                                            }`}>
                                            {isDisabled ? "Disabled" : "Active"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{user.sid || "—"}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => { setDialogMode("password"); setUsername(user.username); setPassword(""); setDialogOpen(true); setError(""); }}
                                                className="p-2 rounded-lg hover:bg-accent transition-smooth text-muted-foreground hover:text-foreground"
                                                title="Change password"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleToggle(user.username, isDisabled ? "enable" : "disable")}
                                                className="p-2 rounded-lg hover:bg-accent transition-smooth text-muted-foreground hover:text-foreground"
                                                title={isDisabled ? "Enable" : "Disable"}
                                            >
                                                {isDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.username)}
                                                className="p-2 rounded-lg hover:bg-destructive/10 transition-smooth text-muted-foreground hover:text-destructive"
                                                title="Delete user"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No Samba users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4">
                        <h2 className="text-lg font-bold text-foreground mb-4">
                            {dialogMode === "add" ? "Add Samba User" : "Change Password"}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground">Username</label>
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={dialogMode === "password"}
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
                    disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="username"
                                />
                                {dialogMode === "add" && (
                                    <p className="text-xs text-muted-foreground mt-1">Linux system user must already exist</p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground">
                                    {dialogMode === "add" ? "Password" : "New Password"}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full mt-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="••••••••"
                                />
                            </div>
                            {error && (
                                <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-accent transition-smooth">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-smooth flex items-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {dialogMode === "add" ? "Add User" : "Update Password"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
