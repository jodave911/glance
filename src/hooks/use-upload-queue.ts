import { useState, useCallback, useRef } from "react";

export type UploadStatus = "pending" | "uploading" | "success" | "error" | "skipped";

export interface UploadItem {
    id: string;      // Unique local id
    file: File;      // The raw file to upload
    targetPath: string; // The absolute path on the Samba server where it should go, including the filename
    status: UploadStatus;
    progress: number; // 0 to 100
    error?: string;
}

export function useUploadQueue(onUploadComplete?: () => void) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // We use a ref to track the active upload so we don't start it multiple times
    const activeUploadRef = useRef<boolean>(false);

    const addFilesToQueue = useCallback((files: { file: File, targetPath: string }[]) => {
        const newItems: UploadItem[] = files.map(f => {
            // Fallback for non-secure contexts where crypto.randomUUID is undefined
            const id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            return {
                id,
                file: f.file,
                targetPath: f.targetPath,
                status: "pending",
                progress: 0
            };
        });

        setUploads(prev => [...prev, ...newItems]);
    }, []);

    const processNext = useCallback(async () => {
        // Prevent concurrent runners
        if (activeUploadRef.current) return;

        setUploads(currentUploads => {
            const nextPending = currentUploads.find(u => u.status === "pending");

            if (!nextPending) {
                // Queue is finished
                setIsUploading(false);
                if (currentUploads.some(u => u.status === "success" || u.status === "skipped") && currentUploads.every(u => u.status !== "uploading" && u.status !== "pending")) {
                    // If all done, and at least one succeeded or skipped, trigger a refresh
                    onUploadComplete?.();
                }
                return currentUploads;
            }

            // Start uploading the next one
            activeUploadRef.current = true;
            setIsUploading(true);

            const uploadItem = async (item: UploadItem) => {
                // Mark as uploading
                setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: "uploading", progress: 0 } : u));

                try {
                    // Extract CSRF token from cookies 
                    const getCookie = (name: string) => {
                        const value = `; ${document.cookie}`;
                        const parts = value.split(`; ${name}=`);
                        if (parts.length === 2) return parts.pop()?.split(";").shift();
                        return null;
                    };
                    const csrfToken = getCookie("csrf_token");

                    // 1. Pre-flight Check
                    const checkRes = await fetch("/api/files/upload/check", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
                        },
                        body: JSON.stringify({
                            path: item.targetPath,
                            size: item.file.size
                        })
                    });

                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        if (checkData?.data?.status === "skip") {
                            // Remote file is the same size or larger, skip the upload entirely
                            setUploads(prev => prev.map(u =>
                                u.id === item.id ? { ...u, status: "skipped", progress: 100 } : u
                            ));
                            return; // Exit early, skipping the XHR upload
                        }
                    }

                    // 2. Full Upload
                    const formData = new FormData();
                    formData.append("file", item.file);
                    // Path includes the directory and the filename
                    formData.append("path", item.targetPath);

                    // We use XMLHttpRequest here instead of fetch so we can track upload progress events
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            const percent = Math.round((event.loaded / event.total) * 100);
                            setUploads(prev => prev.map(u =>
                                u.id === item.id ? { ...u, progress: percent } : u
                            ));
                        }
                    });

                    const response = await new Promise((resolve, reject) => {
                        xhr.addEventListener("load", () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    resolve(JSON.parse(xhr.responseText));
                                } catch (e) {
                                    resolve(xhr.response);
                                }
                            } else {
                                reject(new Error(xhr.responseText || `HTTP Error ${xhr.status}`));
                            }
                        });
                        xhr.addEventListener("error", () => reject(new Error("Network Error")));
                        xhr.addEventListener("abort", () => reject(new Error("Upload Aborted")));

                        xhr.open("POST", "/api/files/upload");

                        if (csrfToken) {
                            xhr.setRequestHeader("X-CSRF-Token", csrfToken);
                        }

                        // We do not set Content-Type header manually for FormData, the browser adds it with the correct boundary
                        xhr.send(formData);
                    });

                    const result = response as any;
                    if (result?.data?.status === "skipped") {
                        setUploads(prev => prev.map(u =>
                            u.id === item.id ? { ...u, status: "skipped", progress: 100 } : u
                        ));
                    } else {
                        // Success
                        setUploads(prev => prev.map(u =>
                            u.id === item.id ? { ...u, status: "success", progress: 100 } : u
                        ));
                    }

                } catch (err: any) {
                    console.error("Failed to upload file", item.file.name, err);
                    setUploads(prev => prev.map(u =>
                        u.id === item.id ? { ...u, status: "error", error: err.message || "Unknown error" } : u
                    ));
                } finally {
                    activeUploadRef.current = false;
                    // Trigger next in queue
                    processNext();
                }
            };

            // Kick off the async function without awaiting it here
            // (processNext acts as a synchronous starter lock)
            uploadItem(nextPending);

            return currentUploads;
        });
    }, [onUploadComplete]);

    // Whenever uploads array changes, try to process the next one if available
    // but we have `processNext` inside a `useEffect` dependent only on pending items 
    // to strictly enforce the chain.
    const hasPending = uploads.some(u => u.status === "pending");

    // Auto-start queue if there are pending items and we're not currently running
    if (hasPending && !activeUploadRef.current) {
        // Using setTimeout to avoid React state update collisions while rendering
        setTimeout(processNext, 0);
    }

    const clearFinished = useCallback(() => {
        setUploads(prev => prev.filter(u => u.status === "pending" || u.status === "uploading"));
    }, []);

    const removeUpload = useCallback((id: string) => {
        setUploads(prev => prev.filter(u => u.id !== id));
    }, []);

    return {
        uploads,
        isUploading,
        addFilesToQueue,
        clearFinished,
        removeUpload
    };
}
