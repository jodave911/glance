/**
 * GET /api/files/content — Stream file content
 */

import { type NextRequest, NextResponse } from "next/server";
import { getApiContext, apiError } from "@/lib/api-helpers";
import { sftpReadStream } from "@/lib/ssh";
import { sandboxPath } from "@/lib/path-sandbox";

// Note: Next.js edge runtime might complain about ssh2, but this API route 
// should run on Node runtime by default. We can enforce it if needed.
export const runtime = "nodejs";

function getContentType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const mimeTypes: Record<string, string> = {
        // Images
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml",
        "webp": "image/webp",
        "bmp": "image/bmp",
        "ico": "image/x-icon",

        // Video
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mkv": "video/x-matroska",
        "avi": "video/x-msvideo",
        "mov": "video/quicktime",
        "wmv": "video/x-ms-wmv",

        // Audio
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "m4a": "audio/mp4",
        "flac": "audio/flac",
        "aac": "audio/aac",

        // Documents
        "pdf": "application/pdf",
        "txt": "text/plain",
        "csv": "text/csv",
        "json": "application/json",
        "xml": "application/xml",
        "html": "text/html",
        "css": "text/css"
    };

    return mimeTypes[ext] || "application/octet-stream";
}

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const { searchParams } = new URL(request.url);
        const requestedPath = searchParams.get("path");

        if (!requestedPath) {
            return apiError("File path is required", 400);
        }

        // Sandbox the path to ensure it's within allowed boundaries
        const safePath = sandboxPath(requestedPath);
        const filename = safePath.split("/").pop() || "";
        const contentType = getContentType(filename);

        // Get the readable stream from our SFTP connection helper
        // Since we are creating a generic Next.js stream, we need to pass this over
        const stream = await sftpReadStream(ctx.credentials, safePath);

        // Return the streaming response
        return new NextResponse(stream, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${filename}"`
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load file content";
        return apiError(message, 400);
    }
}
