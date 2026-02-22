/**
 * GET/POST/DELETE /api/files — File browser with path sandboxing
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { sandboxPath, validatePathComponent } from "@/lib/path-sandbox";
import { sanitizeServerOutput } from "@/lib/sanitize";
import { logAudit, AuditActions } from "@/lib/audit";

interface FileEntry {
    name: string;
    type: "file" | "directory" | "link" | "other";
    permissions: string;
    owner: string;
    group: string;
    size: string;
    modified: string;
}

function parseLsOutput(output: string): FileEntry[] {
    const lines = output.trim().split("\n");
    const entries: FileEntry[] = [];

    for (const line of lines) {
        // Skip the "total" line
        if (line.startsWith("total ")) continue;

        // Parse ls -la --time-style=long-iso output
        const parts = line.split(/\s+/);
        if (parts.length < 8) continue;

        const permissions = parts[0];
        const owner = parts[2];
        const group = parts[3];
        const size = parts[4];
        const date = parts[5];
        const time = parts[6];
        const name = parts.slice(7).join(" ");

        // Skip . and ..
        if (name === "." || name === "..") continue;

        // Handle symlinks (name -> target)
        const linkMatch = name.match(/^(.+?)\s+->\s+(.+)$/);
        const displayName = linkMatch ? linkMatch[1] : name;

        let type: FileEntry["type"] = "file";
        if (permissions.startsWith("d")) type = "directory";
        else if (permissions.startsWith("l")) type = "link";
        else if (!permissions.startsWith("-")) type = "other";

        entries.push({
            name: displayName,
            type,
            permissions,
            owner,
            group,
            size,
            modified: `${date} ${time}`,
        });
    }

    return entries;
}

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const { searchParams } = new URL(request.url);
        const requestedPath = searchParams.get("path") || "/";

        // Sandbox the path
        const safePath = sandboxPath(requestedPath);

        const result = await executeCommand(ctx.credentials, CommandBuilder.listDirectory(safePath));

        if (result.code !== 0) {
            return apiError("Failed to list directory: " + sanitizeServerOutput(result.stderr), 400);
        }

        const entries = parseLsOutput(result.stdout);
        return apiSuccess({ path: safePath, entries });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to browse files";
        return apiError(message, 400);
    }
}

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const body = await request.json();
        const { path: dirPath, action, name, newName } = body;

        if (!dirPath) return apiError("Path is required");

        const safePath = sandboxPath(dirPath);

        switch (action) {
            case "mkdir": {
                if (!name) return apiError("Directory name is required");
                validatePathComponent(name);
                const newDirPath = `${safePath}/${name}`;
                const safeNewDir = sandboxPath(newDirPath);
                const result = await executeCommand(ctx.credentials, CommandBuilder.makeDirectory(safeNewDir));
                logAudit(AuditActions.fileOperation(ctx.username, ctx.ip, "mkdir", safeNewDir, result.code === 0));
                return apiSuccess({ message: "Directory created", path: safeNewDir });
            }
            case "rename": {
                if (!name || !newName) return apiError("Current and new names are required");
                validatePathComponent(newName);
                const srcPath = sandboxPath(`${safePath}/${name}`);
                const dstPath = sandboxPath(`${safePath}/${newName}`);
                const result = await executeCommand(ctx.credentials, CommandBuilder.renameFile(srcPath, dstPath));
                logAudit(AuditActions.fileOperation(ctx.username, ctx.ip, "rename", srcPath, result.code === 0));
                return apiSuccess({ message: "Renamed", success: result.code === 0 });
            }
            default:
                return apiError("Invalid action. Use 'mkdir' or 'rename'");
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "File operation failed";
        return apiError(message, 400);
    }
}

export async function DELETE(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const body = await request.json();
        const { path: filePath, type } = body;

        if (!filePath) return apiError("Path is required");

        const safePath = sandboxPath(filePath);

        const spec = type === "directory"
            ? CommandBuilder.removeDirectory(safePath)
            : CommandBuilder.removeFile(safePath);

        const result = await executeCommand(ctx.credentials, spec);
        const success = result.code === 0;

        logAudit(AuditActions.fileOperation(ctx.username, ctx.ip, "delete", safePath, success));

        if (!success) {
            return apiError("Failed to delete: " + sanitizeServerOutput(result.stderr));
        }

        return apiSuccess({ message: "Deleted", path: safePath });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Delete failed";
        return apiError(message, 400);
    }
}
