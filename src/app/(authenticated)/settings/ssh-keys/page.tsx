"use client";

import { useEffect, useState } from "react";
import {
    Key,
    Plus,
    Trash2,
    Loader2,
    ShieldCheck,
    AlertCircle,
    Copy,
    CheckCircle2,
    X,
    ChevronLeft
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface SSHKey {
    id: string;
    type: string;
    key: string;
    comment: string;
    raw: string;
}

const ALLOWED_KEY_TYPES = [
    'ssh-rsa',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'ssh-ed25519',
    'sk-ecdsa-sha2-nistp256@openssh.com',
    'sk-ssh-ed25519@openssh.com'
];

export default function SSHKeysPage() {
    const [keys, setKeys] = useState<SSHKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newKey, setNewKey] = useState({ type: 'ssh-rsa', key: '', comment: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings/ssh-keys");
            if (res.ok) {
                const data = await res.json();
                setKeys(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch keys:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKeys(); }, []);

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/settings/ssh-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newKey),
            });

            if (res.ok) {
                await fetchKeys();
                setIsAddOpen(false);
                setNewKey({ type: 'ssh-rsa', key: '', comment: '' });
            } else {
                const data = await res.json();
                setError(data.error);
            }
        } catch {
            setError("Failed to connect to API");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteKey = async (keySnippet: string) => {
        if (!confirm("Are you sure you want to remove this SSH key? This cannot be undone.")) return;

        try {
            const res = await fetch("/api/settings/ssh-keys", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keySnippet }),
            });

            if (res.ok) {
                setKeys(keys.filter(k => k.id !== keySnippet));
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const truncateKey = (key: string) => {
        if (key.length <= 40) return key;
        return `${key.substring(0, 20)}...${key.substring(key.length - 20)}`;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/settings"
                        className="p-2 bg-secondary/50 rounded-xl hover:bg-secondary transition-smooth"
                    >
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">SSH Keys</h1>
                        <p className="text-sm text-muted-foreground mt-1">Manage public keys authorized to access this server</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium
                             hover:opacity-90 transition-smooth shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> Add New Key
                </button>
            </div>

            {/* Info Card */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-semibold text-primary">Public Key Authentication</p>
                    <p className="text-muted-foreground mt-1 leading-relaxed">
                        Authorized keys allow you to connect to the server via SSH without a password.
                        Make sure you only add keys from trusted sources. These keys are stored in <code>~/.ssh/authorized_keys</code>.
                    </p>
                </div>
            </div>

            {/* Keys List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-48 bg-card/30 rounded-2xl border border-dashed border-border/50">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : keys.length === 0 ? (
                    <div className="text-center py-12 bg-card/30 rounded-2xl border border-dashed border-border/50">
                        <Key className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground">No SSH keys found in authorized_keys</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {keys.map((key) => (
                            <motion.div
                                key={key.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-smooth"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                                {key.type}
                                            </span>
                                            <h3 className="font-semibold text-foreground truncate">{key.comment}</h3>
                                        </div>
                                        <p className="text-xs font-mono text-muted-foreground break-all">
                                            {truncateKey(key.key)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => copyToClipboard(key.raw, key.id)}
                                            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-smooth"
                                            title="Copy full key"
                                        >
                                            {copiedId === key.id ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteKey(key.id)}
                                            className="p-2 rounded-xl hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-smooth"
                                            title="Remove key"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Key Modal */}
            <AnimatePresence>
                {isAddOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-primary" /> Add SSH Key
                                </h2>
                                <button onClick={() => setIsAddOpen(false)} className="p-1.5 rounded-xl hover:bg-secondary transition-smooth">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddKey} className="p-6 space-y-4">
                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">Title / Comment</label>
                                    <input
                                        type="text"
                                        required
                                        value={newKey.comment}
                                        onChange={(e) => setNewKey({ ...newKey, comment: e.target.value })}
                                        placeholder="Joshua's MacBook Pro"
                                        className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">Key Type</label>
                                    <select
                                        value={newKey.type}
                                        onChange={(e) => setNewKey({ ...newKey, type: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                                    >
                                        {ALLOWED_KEY_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 ml-1">Public Key Body</label>
                                    <textarea
                                        required
                                        value={newKey.key}
                                        onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                                        placeholder="AAAAB3NzaC1yc2EAAAADAQABAAABgQC..."
                                        className="w-full h-32 px-4 py-3 bg-secondary/50 border border-border rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddOpen(false)}
                                        className="flex-1 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-accent transition-smooth"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-smooth flex items-center justify-center gap-2"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                        Save Key
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
