/**
 * GET/POST/PUT/DELETE /api/shares — Samba share management
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand, sftpWriteFile } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { parseSmbConf, serializeSmbConf, addShare, updateShare, deleteShare, type ShareConfig } from "@/lib/samba-config";
import { logAudit, AuditActions } from "@/lib/audit";
import { checkDestructiveRateLimit } from "@/lib/rate-limiter";

async function readCurrentConfig(creds: Parameters<typeof executeCommand>[0]) {
    const result = await executeCommand(creds, CommandBuilder.readSmbConf());
    if (result.code !== 0) throw new Error("Failed to read smb.conf: " + result.stderr);
    return parseSmbConf(result.stdout);
}

async function writeAndReload(creds: Parameters<typeof executeCommand>[0], configText: string) {
    // 1. Backup current config
    await executeCommand(creds, CommandBuilder.backupSmbConf());

    // 2. Write new config via SFTP (safe from shell injection)
    await sftpWriteFile(creds, "/tmp/smb.conf.new", configText);

    // 3. Move to final location with sudo
    await executeCommand(creds, {
        command: "cp /tmp/smb.conf.new /etc/samba/smb.conf",
        sudo: true,
    });

    // 4. Validate with testparm
    const testResult = await executeCommand(creds, CommandBuilder.testParm());
    if (testResult.code !== 0) {
        // Restore backup
        await executeCommand(creds, CommandBuilder.restoreSmbConf());
        throw new Error("Configuration validation failed: " + testResult.stderr);
    }

    // 5. Reload Samba
    await executeCommand(creds, CommandBuilder.reloadSamba());
}

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const config = await readCurrentConfig(ctx.credentials);
        return apiSuccess({ shares: config.shares, global: config.global });
    } catch (error) {
        console.error("[api/shares] GET Error:", error);
        return apiError("Failed to read shares", 500);
    }
}

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) return apiError("Rate limit exceeded", 429);

    try {
        const body = await request.json();
        const share: ShareConfig = body;

        if (!share.name || !share.path) {
            return apiError("Share name and path are required");
        }

        const config = await readCurrentConfig(ctx.credentials);
        const updated = addShare(config, share);
        const configText = serializeSmbConf(updated);
        await writeAndReload(ctx.credentials, configText);

        logAudit(AuditActions.shareCreate(ctx.username, ctx.ip, share.name, `path=${share.path}`, true));
        return apiSuccess({ message: "Share created", share: share.name });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create share";
        logAudit(AuditActions.shareCreate(ctx.username, ctx.ip, "unknown", message, false));
        return apiError(message, 400);
    }
}

export async function PUT(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) return apiError("Rate limit exceeded", 429);

    try {
        const body = await request.json();
        const { name, ...updates } = body;

        if (!name) return apiError("Share name is required");

        const config = await readCurrentConfig(ctx.credentials);
        const updated = updateShare(config, name, updates);
        const configText = serializeSmbConf(updated);
        await writeAndReload(ctx.credentials, configText);

        logAudit(AuditActions.shareUpdate(ctx.username, ctx.ip, name, JSON.stringify(updates), true));
        return apiSuccess({ message: "Share updated", share: name });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update share";
        return apiError(message, 400);
    }
}

export async function DELETE(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) return apiError("Rate limit exceeded", 429);

    try {
        const body = await request.json();
        const { name } = body;

        if (!name) return apiError("Share name is required");

        const config = await readCurrentConfig(ctx.credentials);
        const updated = deleteShare(config, name);
        const configText = serializeSmbConf(updated);
        await writeAndReload(ctx.credentials, configText);

        logAudit(AuditActions.shareDelete(ctx.username, ctx.ip, name, true));
        return apiSuccess({ message: "Share deleted", share: name });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete share";
        return apiError(message, 400);
    }
}
