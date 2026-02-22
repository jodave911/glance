/**
 * GET /api/logs — Samba log viewer
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { sanitizeServerOutput } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const { searchParams } = new URL(request.url);
        const logFile = searchParams.get("file") || "log.smbd";
        const lines = parseInt(searchParams.get("lines") || "100", 10);

        const spec = CommandBuilder.readLog(logFile, lines);
        const result = await executeCommand(ctx.credentials, spec);

        // List available log files
        const lsResult = await executeCommand(ctx.credentials, CommandBuilder.listLogFiles());

        return apiSuccess({
            logFile,
            content: sanitizeServerOutput(result.stdout),
            available: sanitizeServerOutput(lsResult.stdout),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read logs";
        return apiError(message, 400);
    }
}
