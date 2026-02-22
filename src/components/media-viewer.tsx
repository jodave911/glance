"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, Download } from "lucide-react";

export interface MediaViewerProps {
    isOpen: boolean;
    onClose: () => void;
    filePath: string;
    fileName: string;
}

export function MediaViewer({ isOpen, onClose, filePath, fileName }: MediaViewerProps) {
    const [loading, setLoading] = useState(true);

    // Get the file extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    // Categorize by simple extensions
    const isImage = ["png", "jpg", "jpeg", "gif", "blob", "webp", "bmp", "svg", "ico"].includes(ext);
    const isVideo = ["mp4", "webm", "mkv", "avi", "mov", "wmv"].includes(ext);
    const isPdf = ["pdf"].includes(ext);

    // Generate the URL for our new streaming API
    const fileUrl = `/api/files/content?path=${encodeURIComponent(filePath)}`;

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Reset loading state when opened
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
        }
    }, [isOpen, filePath]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
                    onClick={onClose}
                >
                    {/* Top action bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
                        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl text-white pointer-events-auto border border-white/10 select-none max-w-[70vw] truncate">
                            {fileName}
                        </div>
                        <div className="flex gap-2 pointer-events-auto">
                            <a
                                href={fileUrl}
                                download={fileName}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2.5 bg-black/50 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all border border-white/10"
                                title="Download File"
                            >
                                <Download className="w-5 h-5" />
                            </a>
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2.5 bg-black/50 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all border border-white/10"
                                title="Open in New Tab"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                            <button
                                onClick={onClose}
                                className="p-2.5 bg-black/50 backdrop-blur-md rounded-xl text-white hover:bg-destructive/80 transition-all border border-white/10"
                                title="Close (Esc)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative max-w-full max-h-full flex items-center justify-center flex-col outline-none w-full h-full"
                        onClick={(e) => e.stopPropagation()} // Prevent close when clicking content
                    >
                        {isImage ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                                    </div>
                                )}
                                <img
                                    src={fileUrl}
                                    alt={fileName}
                                    className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
                                    onLoad={() => setLoading(false)}
                                    onError={() => setLoading(false)} // Need to handle eventually
                                />
                            </div>
                        ) : isVideo ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <video
                                    src={fileUrl}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-black/50"
                                    onLoadedData={() => setLoading(false)}
                                />
                            </div>
                        ) : isPdf ? (
                            <div className="w-full h-full max-w-6xl max-h-[85vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    </div>
                                )}
                                <iframe
                                    src={`${fileUrl}#toolbar=0`}
                                    className="w-full h-full border-0"
                                    title={fileName}
                                    onLoad={() => setLoading(false)}
                                />
                            </div>
                        ) : (
                            <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <ExternalLink className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-2">Unsupported Preview</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    No preview available for .{ext} files. You can download the file to view its contents.
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                                    >
                                        Close
                                    </button>
                                    <a
                                        href={fileUrl}
                                        download={fileName}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Download
                                    </a>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
