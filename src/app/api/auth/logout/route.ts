/**
 * POST /api/auth/logout — Destroy session and clear cookies
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, getAuthCookieName, clearAuthCookie } from "@/lib/auth";
import { destroySession } from "@/lib/session-vault";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    try {
        const token = request.cookies.get(getAuthCookieName())?.value;
        if (token) {
            const payload = await verifyToken(token);
            if (payload?.sid) {
                destroySession(payload.sid);
                logAudit(AuditActions.logout(request.headers.get("x-username") || "unknown", ip));
            }
        }
    } catch {
        // Ignore errors during logout
    }

    const response = NextResponse.json({ data: { message: "Logged out" } });
    response.headers.append("Set-Cookie", clearAuthCookie());
    response.headers.append("Set-Cookie", "csrf_token=; Path=/; SameSite=Strict; Max-Age=0");
    return response;
}
