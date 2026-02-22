"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
    FolderOpen, File, Folder, ChevronRight, Trash2, FolderPlus,
    Loader2, RefreshCw, LayoutGrid, List, Search, Pencil,
    FileText, FileImage, FileCode, FileArchive, Film, Music,
    X, MoreVertical, Home, HardDrive, Check, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MediaViewer } from "@/components/media-viewer";
import { UploadManager } from "@/components/upload-manager";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { UploadCloud, Upload } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileEntry {
    name: string;
    type: "file" | "directory" | "link" | "other";
    permissions: string;
    owner: string;
    group: string;
    size: string;
    modified: string;
}

type ViewMode = "grid" | "list";
type SortKey = "name" | "size" | "modified" | "owner";
type SortDir = "asc" | "desc";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(entry: FileEntry) {
    if (entry.type === "directory") return { icon: Folder, color: "text-amber-400" };

    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];
    const codeExts = ["ts", "tsx", "js", "jsx", "py", "go", "rs", "c", "cpp", "h", "java", "rb", "sh", "bash", "conf", "cfg", "ini", "yaml", "yml", "toml", "json", "xml", "html", "css"];
    const archiveExts = ["zip", "tar", "gz", "bz2", "xz", "7z", "rar"];
    const videoExts = ["mp4", "mkv", "avi", "mov", "wmv", "webm"];
    const audioExts = ["mp3", "wav", "flac", "ogg", "aac", "m4a"];
    const docExts = ["pdf", "doc", "docx", "txt", "md", "rtf", "odt", "csv", "xls", "xlsx"];

    if (imageExts.includes(ext)) return { icon: FileImage, color: "text-emerald-400/80" };
    if (codeExts.includes(ext)) return { icon: FileCode, color: "text-blue-400/80" };
    if (archiveExts.includes(ext)) return { icon: FileArchive, color: "text-orange-400/80" };
    if (videoExts.includes(ext)) return { icon: Film, color: "text-purple-400/80" };
    if (audioExts.includes(ext)) return { icon: Music, color: "text-pink-400/80" };
    if (docExts.includes(ext)) return { icon: FileText, color: "text-sky-400/80" };
    return { icon: File, color: "text-muted-foreground" };
}

function formatSize(sizeStr: string): string {
    const bytes = parseInt(sizeStr, 10);
    if (isNaN(bytes)) return sizeStr;
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr.replace(" ", "T"));
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
    } catch { return dateStr; }
}

const isMediaFile = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "pdf", "mp4", "webm", "mkv", "avi", "mov", "wmv"].includes(ext);
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function FilesPage() {
    const [currentPath, setCurrentPath] = useState("/");
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [isDragging, setIsDragging] = useState(false);

    // UI States
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
    const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [mkdirOpen, setMkdirOpen] = useState(false);
    const [newDirName, setNewDirName] = useState("");

    // Media Viewer
    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [mediaViewerFile, setMediaViewerFile] = useState<{ path: string; name: string } | null>(null);

    const renameInputRef = useRef<HTMLInputElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // ─── Upload Manager ─────────────────────────────────────────────────

    // Automatically refresh folder when queue finishes uploading successfully
    const { uploads, isUploading, addFilesToQueue, clearFinished, removeUpload } = useUploadQueue(() => {
        fetchFiles(currentPath);
    });

    const handleUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const fileList = Array.from(e.target.files);
        addFilesToQueue(fileList.map(f => ({
            file: f,
            // For file inputs, `webkitRelativePath` is empty usually, so we fallback to name
            targetPath: `${currentPath}/${f.webkitRelativePath || f.name}`
        })));
        e.target.value = ''; // Reset
    };

    // ─── Drag and Drop ──────────────────────────────────────────────────

    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer?.types.includes("Files")) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.relatedTarget === null) {
                setIsDragging(false);
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const fileList = Array.from(e.dataTransfer.files);
                addFilesToQueue(fileList.map(f => ({
                    file: f,
                    targetPath: `${currentPath}/${f.name}`
                })));
            }
        };

        document.addEventListener("dragover", handleDragOver);
        document.addEventListener("dragleave", handleDragLeave);
        document.addEventListener("drop", handleDrop);

        return () => {
            document.removeEventListener("dragover", handleDragOver);
            document.removeEventListener("dragleave", handleDragLeave);
            document.removeEventListener("drop", handleDrop);
        };
    }, [currentPath, addFilesToQueue]);

    // ─── Data fetching ──────────────────────────────────────────────────

    const fetchFiles = useCallback(async (path: string) => {
        setLoading(true);
        setError("");
        setSelected(new Set());
        setContextMenu(null);
        setRenamingEntry(null);
        try {
            const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            if (res.ok) {
                setEntries(data.data.entries);
                setCurrentPath(data.data.path);
            } else {
                setError(data.error || "Failed to load directory");
            }
        } catch {
            setError("Failed to load directory");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchFiles(currentPath); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Sorting & Filtering ────────────────────────────────────────────

    const sortedEntries = [...entries]
        .filter(e => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (a.type === "directory" && b.type !== "directory") return -1;
            if (a.type !== "directory" && b.type === "directory") return 1;

            let cmp = 0;
            switch (sortKey) {
                case "name": cmp = a.name.localeCompare(b.name); break;
                case "size": cmp = parseInt(a.size || "0") - parseInt(b.size || "0"); break;
                case "modified": cmp = a.modified.localeCompare(b.modified); break;
                case "owner": cmp = a.owner.localeCompare(b.owner); break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

    // ─── Navigation ─────────────────────────────────────────────────────

    const navigateTo = (name: string) => {
        fetchFiles(`${currentPath}/${name}`);
    };

    const goToPath = (path: string) => {
        fetchFiles(path);
    };

    const breadcrumbs = currentPath.split("/").filter(Boolean);

    // ─── Selection ──────────────────────────────────────────────────────

    const toggleSelect = (name: string, ctrlKey: boolean) => {
        setSelected(prev => {
            const next = new Set(ctrlKey ? prev : []);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === sortedEntries.length) setSelected(new Set());
        else setSelected(new Set(sortedEntries.map(e => e.name)));
    };

    // ─── Context Menu ───────────────────────────────────────────────────

    const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
        if (!selected.has(entry.name)) {
            setSelected(new Set([entry.name]));
        }
    };

    useEffect(() => {
        const closeMenu = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener("mousedown", closeMenu);
        return () => document.removeEventListener("mousedown", closeMenu);
    }, []);

    // ─── File operations ────────────────────────────────────────────────

    const handleMkdir = async () => {
        if (!newDirName.trim()) return;
        try {
            const res = await fetch("/api/files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: currentPath, action: "mkdir", name: newDirName }),
            });
            if (res.ok) {
                setMkdirOpen(false);
                setNewDirName("");
                fetchFiles(currentPath);
            } else {
                const data = await res.json();
                setError(data.error);
            }
        } catch {
            setError("Failed to create directory");
        }
    };

    const handleRename = async (oldName: string) => {
        if (!renameValue.trim() || renameValue === oldName) {
            setRenamingEntry(null);
            return;
        }
        try {
            const res = await fetch("/api/files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: currentPath, action: "rename", name: oldName, newName: renameValue }),
            });
            if (res.ok) {
                fetchFiles(currentPath);
            } else {
                const data = await res.json();
                setError(data.error);
            }
        } catch {
            setError("Rename failed");
        } finally {
            setRenamingEntry(null);
        }
    };

    const handleDelete = async (entriesToDelete: FileEntry[]) => {
        const names = entriesToDelete.map(e => e.name).join(", ");
        if (!confirm(`Delete ${entriesToDelete.length > 1 ? `${entriesToDelete.length} items` : `"${names}"`}?`)) return;

        for (const entry of entriesToDelete) {
            try {
                await fetch("/api/files", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: `${currentPath}/${entry.name}`, type: entry.type }),
                });
            } catch {
                setError(`Failed to delete "${entry.name}"`);
            }
        }
        setSelected(new Set());
        fetchFiles(currentPath);
    };

    const startRename = (entry: FileEntry) => {
        setRenamingEntry(entry.name);
        setRenameValue(entry.name);
        setContextMenu(null);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const openMediaViewer = (entry: FileEntry) => {
        setMediaViewerFile({ path: `${currentPath}/${entry.name}`, name: entry.name });
        setMediaViewerOpen(true);
        setContextMenu(null);
    };

    const selectedEntries = entries.filter(e => selected.has(e.name));
    const dirCount = sortedEntries.filter(e => e.type === "directory").length;
    const fileCount = sortedEntries.filter(e => e.type !== "directory").length;

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] relative">
            <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleUploadFiles}
            />
            {/* webkitdirectory is non-standard but widely supported for directory uploads */}
            <input
                type="file"
                //@ts-expect-error
                webkitdirectory="true"
                directory="true"
                className="hidden"
                ref={folderInputRef}
                onChange={handleUploadFiles}
            />

            {/* ═══ Drag overlay ═══ */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[150] bg-background/80 backdrop-blur-md rounded-2xl border-2 border-dashed border-primary flex items-center justify-center p-8"
                    >
                        <div className="bg-card w-full max-w-lg p-16 rounded-3xl border border-border/50 shadow-2xl flex flex-col items-center justify-center gap-6 pointer-events-none">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center pointer-events-none border border-primary/20 animate-pulse">
                                <UploadCloud className="w-12 h-12 text-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-foreground">Drop files here</h3>
                                <p className="text-muted-foreground mt-2 text-sm font-medium">
                                    Files will be uploaded directly to <code className="bg-muted px-1.5 py-0.5 rounded ml-1">{currentPath.split('/').pop()}</code>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Toolbar ═══ */}
            <div className="shrink-0 space-y-4 pb-4">
                {/* Top row: title + actions */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm shadow-primary/5">
                            <HardDrive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">File Browser</h1>
                            <p className="text-xs text-muted-foreground/80 font-medium">Browse and manage Samba shares</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchFiles(currentPath)}
                            className="p-2.5 bg-secondary/80 backdrop-blur border border-border/50 rounded-xl hover:bg-accent transition-smooth text-muted-foreground hover:text-foreground shadow-sm"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <div className="flex bg-secondary/80 backdrop-blur rounded-xl border border-border/50 p-1 shadow-sm">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg text-sm font-semibold transition-all"
                            >
                                <Upload className="w-4 h-4 text-emerald-500" /> Files
                            </button>
                            <button
                                onClick={() => folderInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg text-sm font-semibold transition-all"
                            >
                                <UploadCloud className="w-4 h-4 text-emerald-500" /> Folder
                            </button>
                        </div>

                        <button
                            onClick={() => { setMkdirOpen(true); setNewDirName(""); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-smooth shadow-md shadow-primary/20"
                        >
                            <FolderPlus className="w-4 h-4" /> New Folder
                        </button>
                    </div>
                </div>

                {/* Breadcrumbs + search + view toggle */}
                <div className="flex items-center gap-3">
                    {/* Breadcrumbs */}
                    <div className="flex-1 flex items-center gap-1 px-4 py-2.5 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl overflow-x-auto text-sm min-w-0 shadow-sm">
                        <button
                            onClick={() => goToPath("/")}
                            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-smooth shrink-0"
                        >
                            <Home className="w-4 h-4" />
                        </button>
                        {breadcrumbs.map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1 shrink-0">
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                                <button
                                    onClick={() => goToPath("/" + breadcrumbs.slice(0, i + 1).join("/"))}
                                    className={`hover:text-primary transition-smooth truncate max-w-32 ${i === breadcrumbs.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground font-medium"
                                        }`}
                                >
                                    {crumb}
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter files..."
                            className="w-full pl-9 pr-8 py-2.5 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-smooth shadow-sm"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-1 shrink-0 shadow-sm">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Error Banner ═══ */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="shrink-0 mb-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium flex items-center justify-between backdrop-blur-md"
                    >
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-destructive hover:text-destructive/80"><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Bulk actions bar ═══ */}
            <AnimatePresence>
                {selected.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="shrink-0 mb-3 flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm backdrop-blur-md shadow-sm"
                    >
                        <button onClick={selectAll} className="p-1 rounded-md hover:bg-primary/10 transition-smooth">
                            <Check className="w-4 h-4 text-primary" />
                        </button>
                        <span className="text-primary font-bold">{selected.size} selected</span>
                        <div className="flex-1" />
                        <button
                            onClick={() => handleDelete(selectedEntries)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-smooth text-xs font-bold"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Content Area ═══ */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-inner relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center py-20 gap-4 bg-card/40 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground">Loading file magic...</p>
                    </div>
                ) : null}

                {sortedEntries.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                        <div className="w-24 h-24 rounded-3xl bg-muted/40 flex items-center justify-center border border-border/40 shadow-sm">
                            <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                        <div className="text-center">
                            <p className="text-foreground font-bold text-lg">{searchQuery ? "No files match" : "This folder is empty"}</p>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">
                                {searchQuery ? `No files matching "${searchQuery}"` : "Create a new folder to get started"}
                            </p>
                        </div>
                        {!searchQuery && (
                            <button
                                onClick={() => { setMkdirOpen(true); setNewDirName(""); }}
                                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 hover:opacity-90 transition-all duration-300 transform hover:-translate-y-0.5"
                            >
                                <FolderPlus className="w-4 h-4" /> New Folder
                            </button>
                        )}
                    </div>
                ) : viewMode === "grid" ? (
                    /* ══ Grid View ══ */
                    <motion.div
                        initial={false}
                        className="p-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3"
                        onClick={() => setSelected(new Set())}
                    >
                        <AnimatePresence>
                            {sortedEntries.map((entry) => {
                                const { icon: Icon, color } = getFileIcon(entry);
                                const isSelected = selected.has(entry.name);
                                const isRenaming = renamingEntry === entry.name;
                                const isMedia = isMediaFile(entry.name);

                                return (
                                    <motion.div
                                        key={entry.name}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        whileHover={{ y: -2, scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`group relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border cursor-pointer transition-colors duration-200 select-none bg-card
                                            ${isSelected
                                                ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20 shadow-md shadow-primary/10"
                                                : "border-border/40 hover:border-border hover:bg-muted/40 shadow-sm hover:shadow-md"
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isRenaming) return;
                                            if (entry.type === "directory" && !e.ctrlKey && !e.metaKey) {
                                                navigateTo(entry.name);
                                            } else {
                                                toggleSelect(entry.name, e.ctrlKey || e.metaKey);
                                            }
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, entry)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (entry.type === "directory") navigateTo(entry.name);
                                            else if (isMedia) openMediaViewer(entry);
                                            else startRename(entry);
                                        }}
                                    >
                                        {/* Selection indicator */}
                                        <div className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 z-10
                                            ${isSelected
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:border-muted-foreground"
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); toggleSelect(entry.name, true); }}
                                        >
                                            {isSelected && <Check className="w-3 h-3 text-primary-foreground font-bold" />}
                                        </div>

                                        {/* More menu button */}
                                        <button
                                            className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground z-10"
                                            onClick={(e) => { e.stopPropagation(); handleContextMenu(e, entry); }}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {/* Icon */}
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                                            ${entry.type === "directory" ? "bg-amber-400/15" : "bg-secondary/80"}`}>
                                            <Icon className={`w-7 h-7 ${color}`} />
                                        </div>

                                        {/* Filename */}
                                        {isRenaming ? (
                                            <input
                                                ref={renameInputRef}
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onBlur={() => handleRename(entry.name)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleRename(entry.name);
                                                    if (e.key === "Escape") setRenamingEntry(null);
                                                }}
                                                className="w-full text-center text-xs px-2 py-1 bg-background border border-primary/50 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-xs text-foreground font-semibold truncate w-full text-center leading-tight" title={entry.name}>
                                                {entry.name}
                                            </span>
                                        )}

                                        {/* Meta */}
                                        <span className="text-[10px] text-muted-foreground font-medium truncate w-full text-center">
                                            {entry.type === "directory" ? "Folder" : formatSize(entry.size)}
                                            {" · "}
                                            {formatDate(entry.modified)}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    /* ══ List View ══ */
                    <table className="w-full text-sm">
                        <thead className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="w-12 px-4 py-3 border-r border-border/30">
                                    <button onClick={selectAll}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${selected.size === sortedEntries.length && sortedEntries.length > 0 ? "border-primary bg-primary" : "border-muted-foreground/30 hover:border-muted-foreground/60"}`}>
                                        {selected.size === sortedEntries.length && sortedEntries.length > 0 && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                    </button>
                                </th>
                                {[
                                    { key: "name" as SortKey, label: "Name", className: "text-left flex-1" },
                                    { key: "size" as SortKey, label: "Size", className: "text-left w-24" },
                                    { key: "owner" as SortKey, label: "Owner", className: "text-left w-28" },
                                    { key: "modified" as SortKey, label: "Modified", className: "text-left w-36" },
                                ].map(col => (
                                    <th key={col.key} className={`px-4 py-3 ${col.className}`}>
                                        <button onClick={() => handleSort(col.key)}
                                            className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-smooth ${sortKey === col.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                            {col.label}
                                            {sortKey === col.key && <span className="text-[10px] font-black">{sortDir === "asc" ? "↑" : "↓"}</span>}
                                        </button>
                                    </th>
                                ))}
                                <th className="w-24 px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Perms
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {sortedEntries.map((entry) => {
                                    const { icon: Icon, color } = getFileIcon(entry);
                                    const isSelected = selected.has(entry.name);
                                    const isRenaming = renamingEntry === entry.name;
                                    const isMedia = isMediaFile(entry.name);

                                    return (
                                        <motion.tr
                                            layout
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            key={entry.name}
                                            className={`group border-b border-border/40 last:border-0 cursor-pointer transition-colors duration-150
                                                ${isSelected ? "bg-primary/5" : "hover:bg-muted/30 bg-card"}`}
                                            onClick={(e) => {
                                                if (isRenaming) return;
                                                if (entry.type === "directory" && !e.ctrlKey && !e.metaKey) {
                                                    navigateTo(entry.name);
                                                } else {
                                                    toggleSelect(entry.name, e.ctrlKey || e.metaKey);
                                                }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, entry)}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (entry.type === "directory") navigateTo(entry.name);
                                                else if (isMedia) openMediaViewer(entry);
                                                else startRename(entry);
                                            }}
                                        >
                                            <td className="w-12 px-4 py-3 text-center border-r border-border/30">
                                                <div className={`w-5 h-5 rounded border-2 mx-auto flex items-center justify-center transition-all
                                                    ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:border-muted-foreground/80"}`}
                                                    onClick={(e) => { e.stopPropagation(); toggleSelect(entry.name, true); }}
                                                >
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground font-bold" />}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                                                    {isRenaming ? (
                                                        <input
                                                            ref={renameInputRef}
                                                            value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            onBlur={() => handleRename(entry.name)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleRename(entry.name);
                                                                if (e.key === "Escape") setRenamingEntry(null);
                                                            }}
                                                            className="flex-1 text-sm font-medium px-2 py-0.5 bg-background border border-primary/50 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                                                            onClick={(e) => e.stopPropagation()}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className={`font-semibold truncate ${entry.type === "directory" ? "text-foreground" : "text-foreground/90"}`}>
                                                            {entry.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                                                {entry.type === "directory" ? "—" : formatSize(entry.size)}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs font-medium">{entry.owner}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs font-medium">{formatDate(entry.modified)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <code className="text-[10px] text-muted-foreground/50 font-mono font-bold">{entry.permissions}</code>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═══ Status Bar ═══ */}
            <div className="shrink-0 flex items-center justify-between px-5 py-2 mt-3 bg-secondary/40 backdrop-blur border border-border/50 rounded-xl text-xs font-bold text-muted-foreground shadow-sm">
                <div className="flex items-center gap-4">
                    <span>{dirCount} folder{dirCount !== 1 ? "s" : ""}</span>
                    <span className="text-border/50">|</span>
                    <span>{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
                    {searchQuery && (
                        <>
                            <span className="text-border/50">|</span>
                            <span className="text-primary tracking-wide">Filtered: &quot;{searchQuery}&quot;</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground/60">
                    <code className="text-[10px]">{currentPath}</code>
                </div>
            </div>

            {/* ═══ Context Menu ═══ */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        ref={contextMenuRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[110] min-w-[200px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl shadow-black/20 overflow-hidden"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        {contextMenu.entry.type === "directory" ? (
                            <button
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-smooth"
                                onClick={() => { navigateTo(contextMenu.entry.name); setContextMenu(null); }}
                            >
                                <FolderOpen className="w-4 h-4 text-muted-foreground" /> Open
                            </button>
                        ) : isMediaFile(contextMenu.entry.name) ? (
                            <button
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-smooth"
                                onClick={() => openMediaViewer(contextMenu.entry)}
                            >
                                <ExternalLink className="w-4 h-4 text-primary" /> Preview Media
                            </button>
                        ) : null}

                        <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-smooth"
                            onClick={() => startRename(contextMenu.entry)}
                        >
                            <Pencil className="w-4 h-4 text-muted-foreground" /> Rename
                        </button>
                        <div className="border-t border-border/50 m-1" />
                        <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition-smooth rounded-b-lg"
                            onClick={() => { handleDelete([contextMenu.entry]); setContextMenu(null); }}
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ New Folder Dialog ═══ */}
            <AnimatePresence>
                {mkdirOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[120]"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border/80 rounded-3xl p-6 w-full max-w-sm shadow-2xl mx-4"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <FolderPlus className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">New Folder</h2>
                                    <p className="text-xs text-muted-foreground font-medium">Create in <span className="text-foreground/80">{currentPath.split('/').pop()}</span></p>
                                </div>
                            </div>
                            <input
                                value={newDirName}
                                onChange={(e) => setNewDirName(e.target.value)}
                                className="w-full px-4 py-3 bg-secondary/80 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-smooth shadow-inner"
                                placeholder="e.g. Project Assets"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") handleMkdir(); if (e.key === "Escape") setMkdirOpen(false); }}
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setMkdirOpen(false)} className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-bold hover:bg-muted transition-smooth">Cancel</button>
                                <button onClick={handleMkdir} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-smooth disabled:opacity-50 shadow-md shadow-primary/20" disabled={!newDirName.trim()}>Create</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Media Viewer ═══ */}
            {mediaViewerFile && (
                <MediaViewer
                    isOpen={mediaViewerOpen}
                    onClose={() => setMediaViewerOpen(false)}
                    filePath={mediaViewerFile.path}
                    fileName={mediaViewerFile.name}
                />
            )}

            {/* ═══ Upload Manager ═══ */}
            <UploadManager
                uploads={uploads}
                isUploading={isUploading}
                onClearFinished={clearFinished}
                onRemoveUpload={removeUpload}
            />
        </div>
    );
}
