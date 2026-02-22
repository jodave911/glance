/**
 * GET /api/system — Server system information
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
        const [uptime, memory, disk, version, hostname] = await Promise.all([
            executeCommand(ctx.credentials, CommandBuilder.uptime()),
            executeCommand(ctx.credentials, CommandBuilder.freeMemory()),
            executeCommand(ctx.credentials, CommandBuilder.diskUsage()),
            executeCommand(ctx.credentials, CommandBuilder.sambaVersion()),
            executeCommand(ctx.credentials, CommandBuilder.hostname()),
        ]);

        return apiSuccess({
            uptime: sanitizeServerOutput(uptime.stdout.trim()),
            memory: sanitizeServerOutput(memory.stdout.trim()),
            disk: sanitizeServerOutput(disk.stdout.trim()),
            sambaVersion: sanitizeServerOutput(version.stdout.trim()),
            hostname: sanitizeServerOutput(hostname.stdout.trim()),
        });
    } catch (error) {
        console.error("[api/system] Error:", error);
        return apiError("Failed to fetch system info", 500);
    }
}
