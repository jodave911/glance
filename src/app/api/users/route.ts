/**
 * GET/POST/PUT/DELETE /api/users — Samba user management
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { sanitizeServerOutput } from "@/lib/sanitize";
import { logAudit, AuditActions } from "@/lib/audit";
import { checkDestructiveRateLimit } from "@/lib/rate-limiter";

interface SambaUser {
    username: string;
    fullName: string;
    sid: string;
    flags: string;
}

function parsePdbeditOutput(output: string): SambaUser[] {
    const users: SambaUser[] = [];
    const blocks = output.split("---------------");

    for (const block of blocks) {
        const lines = block.trim().split("\n");
        const user: Partial<SambaUser> = {};

        for (const line of lines) {
            const [key, ...valueParts] = line.split(":");
            const value = valueParts.join(":").trim();

            if (key?.trim() === "Unix username") user.username = value;
            else if (key?.trim() === "Full Name") user.fullName = value;
            else if (key?.trim() === "User SID") user.sid = value;
            else if (key?.trim() === "Account Flags") user.flags = value;
        }

        if (user.username) {
            users.push({
                username: user.username,
                fullName: user.fullName || "",
                sid: user.sid || "",
                flags: user.flags || "",
            });
        }
    }

    return users;
}

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const result = await executeCommand(ctx.credentials, CommandBuilder.listSambaUsers());
        const users = parsePdbeditOutput(result.stdout);
        return apiSuccess({ users });
    } catch (error) {
        console.error("[api/users] GET Error:", error);
        return apiError("Failed to list users", 500);
    }
}

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) return apiError("Rate limit exceeded", 429);

    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return apiError("Username and password are required");
        }

        // Check if system user exists first
        const userCheck = await executeCommand(ctx.credentials, CommandBuilder.checkUserExists(username));
        if (userCheck.code !== 0) {
            return apiError(`System user "${sanitizeServerOutput(username)}" does not exist. Create the Linux user first.`);
        }

        // Add Samba user
        const spec = CommandBuilder.addSambaUser(username, password);
        const result = await executeCommand(ctx.credentials, spec);

        const success = result.code === 0;
        logAudit(AuditActions.userCreate(ctx.username, ctx.ip, username, success));

        if (!success) {
            return apiError("Failed to add user: " + sanitizeServerOutput(result.stderr));
        }

        return apiSuccess({ message: "User added", username });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add user";
        return apiError(message, 400);
    }
}

export async function PUT(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const body = await request.json();
        const { username, password, action } = body;

        if (!username) return apiError("Username is required");

        let spec;
        if (action === "enable") {
            spec = CommandBuilder.enableSambaUser(username);
        } else if (action === "disable") {
            spec = CommandBuilder.disableSambaUser(username);
        } else if (password) {
            spec = CommandBuilder.changeSambaPassword(username, password);
        } else {
            return apiError("Password or action (enable/disable) is required");
        }

        const result = await executeCommand(ctx.credentials, spec);
        const success = result.code === 0;

        return apiSuccess({
            message: success ? "User updated" : "Failed: " + sanitizeServerOutput(result.stderr),
            success,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update user";
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
        const { username } = body;

        if (!username) return apiError("Username is required");

        const spec = CommandBuilder.deleteSambaUser(username);
        const result = await executeCommand(ctx.credentials, spec);
        const success = result.code === 0;

        logAudit(AuditActions.userDelete(ctx.username, ctx.ip, username, success));

        return apiSuccess({
            message: success ? "User removed" : "Failed: " + sanitizeServerOutput(result.stderr),
            success,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove user";
        return apiError(message, 400);
    }
}
