import { NextRequest, NextResponse } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { sftpStat } from "@/lib/ssh";
import { sandboxPath } from "@/lib/path-sandbox";

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) {
        return apiError("Unauthorized", 401);
    }

    try {
        const body = await request.json();
        const { path, size } = body;

        // Path and Size are required
        if (!path || typeof size !== "number") {
            return apiError("Missing target path or file size", 400);
        }

        const safeDestination = sandboxPath(path);

        // Check if the file already exists on the Samba server
        const existingFileStat = await sftpStat(ctx.credentials, safeDestination);

        if (existingFileStat && !existingFileStat.isDirectory) {
            // If the remote file is larger than or equal to the local file, 
            // tell the client to skip uploading it to save time/bandwidth.
            if (existingFileStat.size >= size) {
                return apiSuccess({ status: "skip" });
            }
        }

        // Otherwise, tell the client they should proceed with the full upload stream
        return apiSuccess({ status: "upload" });
    } catch (error: any) {
        console.error("Upload check error:", error);
        return apiError(error.message || "Failed to check remote file status", 500);
    }
}
