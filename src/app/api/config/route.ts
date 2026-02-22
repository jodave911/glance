/**
 * GET/PUT /api/config — Raw smb.conf editor
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand, sftpWriteFile } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { sanitizeServerOutput } from "@/lib/sanitize";
import { logAudit, AuditActions } from "@/lib/audit";
import { checkDestructiveRateLimit } from "@/lib/rate-limiter";

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const result = await executeCommand(ctx.credentials, CommandBuilder.readSmbConf());
        return apiSuccess({ config: result.stdout });
    } catch (error) {
        console.error("[api/config] GET Error:", error);
        return apiError("Failed to read config", 500);
    }
}

export async function PUT(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) return apiError("Rate limit exceeded", 429);

    try {
        const body = await request.json();
        const { config } = body;

        if (!config || typeof config !== "string") {
            return apiError("Config content is required");
        }

        if (config.length > 65536) {
            return apiError("Config too large (max 64KB)");
        }

        // 1. Backup
        await executeCommand(ctx.credentials, CommandBuilder.backupSmbConf());

        // 2. Write via SFTP (no shell injection possible)
        await sftpWriteFile(ctx.credentials, "/tmp/smb.conf.new", config);

        // 3. Copy to final location
        await executeCommand(ctx.credentials, {
            command: "cp /tmp/smb.conf.new /etc/samba/smb.conf",
            sudo: true,
        });

        // 4. Validate
        const testResult = await executeCommand(ctx.credentials, CommandBuilder.testParm());
        if (testResult.code !== 0) {
            await executeCommand(ctx.credentials, CommandBuilder.restoreSmbConf());
            logAudit(AuditActions.configEdit(ctx.username, ctx.ip, false));
            return apiError("Invalid configuration: " + sanitizeServerOutput(testResult.stderr), 400);
        }

        // 5. Reload
        await executeCommand(ctx.credentials, CommandBuilder.reloadSamba());

        logAudit(AuditActions.configEdit(ctx.username, ctx.ip, true));
        return apiSuccess({ message: "Configuration saved and Samba reloaded" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save config";
        logAudit(AuditActions.configEdit(ctx.username, ctx.ip, false));
        return apiError(message, 500);
    }
}
