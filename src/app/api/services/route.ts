/**
 * GET/POST /api/services — Samba service control
 */

import { type NextRequest } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";
import { sanitizeServerOutput } from "@/lib/sanitize";
import { logAudit, AuditActions } from "@/lib/audit";
import { checkDestructiveRateLimit } from "@/lib/rate-limiter";

export async function GET(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    try {
        const [smbd, nmbd] = await Promise.all([
            executeCommand(ctx.credentials, CommandBuilder.serviceControl("smbd", "status")),
            executeCommand(ctx.credentials, CommandBuilder.serviceControl("nmbd", "status")),
        ]);

        return apiSuccess({
            smbd: {
                output: sanitizeServerOutput(smbd.stdout),
                active: smbd.stdout.includes("active (running)"),
                code: smbd.code,
            },
            nmbd: {
                output: sanitizeServerOutput(nmbd.stdout),
                active: nmbd.stdout.includes("active (running)"),
                code: nmbd.code,
            },
        });
    } catch (error) {
        console.error("[api/services] GET Error:", error);
        return apiError("Failed to fetch service status", 500);
    }
}

export async function POST(request: NextRequest) {
    const ctx = getApiContext(request);
    if (!ctx) return apiError("Unauthorized", 401);

    // Destructive rate limit
    const rateLimit = checkDestructiveRateLimit(ctx.ip);
    if (!rateLimit.allowed) {
        return apiError("Rate limit exceeded for service control", 429);
    }

    try {
        const body = await request.json();
        const { service, action } = body;

        if (!service || !action) {
            return apiError("service and action are required");
        }

        const spec = CommandBuilder.serviceControl(service, action);
        const result = await executeCommand(ctx.credentials, spec);

        const success = result.code === 0;
        logAudit(AuditActions.serviceControl(ctx.username, ctx.ip, service, action, success));

        return apiSuccess({
            output: sanitizeServerOutput(result.stdout || result.stderr),
            success,
            code: result.code,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Service control failed";
        return apiError(message, 400);
    }
}
