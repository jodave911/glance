/**
 * Audit Logger — Logs all admin actions to a JSON-lines file.
 * Every state-changing operation is recorded with timestamp, user, IP, and details.
 */

import fs from "fs";
import path from "path";

export interface AuditEntry {
    ts: string;
    user: string;
    ip: string;
    action: string;
    target: string;
    detail?: string;
    success: boolean;
}

function getAuditLogPath(): string {
    return process.env.AUDIT_LOG_PATH || path.join(process.cwd(), "audit.log");
}

/**
 * Write an audit log entry
 */
export function logAudit(entry: AuditEntry): void {
    try {
        const line = JSON.stringify({
            ...entry,
            ts: entry.ts || new Date().toISOString(),
        }) + "\n";

        fs.appendFileSync(getAuditLogPath(), line, "utf8");
    } catch (err) {
        // Don't let audit logging failures break the app
        console.error("[audit] Failed to write audit log:", err);
    }
}

/**
 * Read the last N audit log entries
 */
export function readAuditLog(limit: number = 100): AuditEntry[] {
    try {
        const logPath = getAuditLogPath();
        if (!fs.existsSync(logPath)) return [];

        const content = fs.readFileSync(logPath, "utf8");
        const lines = content.trim().split("\n").filter(Boolean);
        const entries: AuditEntry[] = [];

        // Read from the end (most recent first)
        const startIdx = Math.max(0, lines.length - limit);
        for (let i = lines.length - 1; i >= startIdx; i--) {
            try {
                entries.push(JSON.parse(lines[i]));
            } catch {
                // Skip malformed lines
            }
        }

        return entries;
    } catch {
        return [];
    }
}

/**
 * Helper to create audit entries for common actions
 */
export const AuditActions = {
    login(user: string, ip: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "auth.login", target: "session", success };
    },
    logout(user: string, ip: string): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "auth.logout", target: "session", success: true };
    },
    shareCreate(user: string, ip: string, shareName: string, detail: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "share.create", target: shareName, detail, success };
    },
    shareUpdate(user: string, ip: string, shareName: string, detail: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "share.update", target: shareName, detail, success };
    },
    shareDelete(user: string, ip: string, shareName: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "share.delete", target: shareName, success };
    },
    userCreate(user: string, ip: string, targetUser: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "user.create", target: targetUser, success };
    },
    userDelete(user: string, ip: string, targetUser: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "user.delete", target: targetUser, success };
    },
    serviceControl(user: string, ip: string, service: string, action: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: `service.${action}`, target: service, success };
    },
    configEdit(user: string, ip: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: "config.edit", target: "smb.conf", success };
    },
    fileOperation(user: string, ip: string, op: string, filePath: string, success: boolean): AuditEntry {
        return { ts: new Date().toISOString(), user, ip, action: `file.${op}`, target: filePath, success };
    },
};
