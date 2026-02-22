"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UploadItem } from "@/hooks/use-upload-queue";
import {
    X, CheckCircle, AlertCircle, Loader2,
    ChevronDown, ChevronUp, File, Folder, FastForward
} from "lucide-react";
import { useState } from "react";

interface UploadManagerProps {
    uploads: UploadItem[];
    isUploading: boolean;
    onClearFinished: () => void;
    onRemoveUpload: (id: string) => void;
}

export function UploadManager({
    uploads,
    isUploading,
    onClearFinished,
    onRemoveUpload
}: UploadManagerProps) {
    const [isMinimized, setIsMinimized] = useState(false);

    // If there are no uploads, don't show the manager at all
    if (uploads.length === 0) return null;

    const total = uploads.length;
    const completed = uploads.filter(u => u.status === "success" || u.status === "error" || u.status === "skipped").length;
    const hasErrors = uploads.some(u => u.status === "error");
    const allDone = completed === total;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-2xl overflow-hidden border border-border/50 bg-card/80 backdrop-blur-xl"
            >
                {/* Header */}
                <div
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="flex items-center justify-between px-4 py-3 bg-card cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                >
                    <div className="flex items-center gap-2">
                        {allDone ? (
                            hasErrors ? (
                                <AlertCircle className="w-5 h-5 text-destructive" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            )
                        ) : (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        )}
                        <span className="font-semibold text-sm">
                            {allDone
                                ? `${completed} upload${completed !== 1 ? 's' : ''} complete`
                                : `Uploading ${completed}/${total}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {allDone && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClearFinished();
                                }}
                                className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                title="Clear finished"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
                            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Upload List */}
                <AnimatePresence initial={false}>
                    {!isMinimized && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="max-h-[300px] overflow-y-auto"
                        >
                            <div className="p-2 space-y-1">
                                {uploads.map((upload) => (
                                    <div
                                        key={upload.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 group"
                                    >
                                        <div className="flex-shrink-0">
                                            {upload.status === "uploading" ? (
                                                <div className="relative w-8 h-8 flex items-center justify-center">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle
                                                            cx="16" cy="16" r="14"
                                                            className="stroke-muted fill-none"
                                                            strokeWidth="3"
                                                        />
                                                        <circle
                                                            cx="16" cy="16" r="14"
                                                            className="stroke-primary fill-none transition-all duration-300 ease-in-out"
                                                            strokeWidth="3"
                                                            strokeDasharray={`${2 * Math.PI * 14}`}
                                                            strokeDashoffset={`${2 * Math.PI * 14 * (1 - upload.progress / 100)}`}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <File className="w-3 h-3 text-primary absolute" />
                                                </div>
                                            ) : upload.status === "success" ? (
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <CheckCircle className="w-5 h-5" />
                                                </div>
                                            ) : upload.status === "skipped" ? (
                                                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground" title="Skipped (remote file exists)">
                                                    <FastForward className="w-5 h-5" />
                                                </div>
                                            ) : upload.status === "error" ? (
                                                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                                                    <AlertCircle className="w-5 h-5" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                                                    <File className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate text-foreground/90">
                                                {upload.file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {upload.status === "error"
                                                    ? upload.error
                                                    : upload.status === "uploading"
                                                        ? `${upload.progress}% • ${(upload.file.size / 1024 / 1024).toFixed(1)} MB`
                                                        : upload.status === "success"
                                                            ? "Uploaded"
                                                            : upload.status === "skipped"
                                                                ? "Skipped"
                                                                : "Waiting..."}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => onRemoveUpload(upload.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted text-muted-foreground rounded-md transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}
