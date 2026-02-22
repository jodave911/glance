import { NextRequest, NextResponse } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { CommandBuilder } from "@/lib/command-builder";
import { executeCommand, sftpWriteStream, sftpStat } from "@/lib/ssh";
import { sandboxPath } from "@/lib/path-sandbox";

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) {
        return apiError("Unauthorized", 401);
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const uploadPath = formData.get("path") as string;

        if (!file || !uploadPath) {
            return apiError("Missing file or target path", 400);
        }

        // Sanitize the requested destination path
        const safeDestination = sandboxPath(uploadPath);

        // Pre-flight check: conditionally skip upload if remote file is as large or larger
        const existingFileStat = await sftpStat(ctx.credentials, safeDestination);

        if (existingFileStat && !existingFileStat.isDirectory) {
            if (existingFileStat.size >= file.size) {
                // Return 200 OK immediately with a skipped status flag
                return apiSuccess({ status: "skipped", message: "Remote file is larger or equal in size" });
            }
        }

        // Create parent directories if they don't exist
        const parentDir = safeDestination.substring(0, safeDestination.lastIndexOf("/"));

        if (parentDir && parentDir !== "/data") {
            await executeCommand(ctx.credentials, CommandBuilder.makeDirectory(parentDir));
        }

        // Pipe the uploaded file stream to the SSH SFTP writer
        await sftpWriteStream(
            ctx.credentials,
            safeDestination,
            file.stream()
        );

        return apiSuccess({ status: "success", message: "File uploaded successfully" });
    } catch (error: any) {
        console.error("Upload stream error:", error);
        return apiError(error.message || "Failed to process stream upload", 500);
    }
}
