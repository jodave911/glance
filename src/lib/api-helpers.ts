/**
 * API Route Helpers — Common utilities for all API routes.
 * Provides session extraction, error responses, and IP detection.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "./session-vault";
import type { SSHCredentials } from "./ssh";

export interface ApiContext {
    sessionId: string;
    username: string;
    credentials: SSHCredentials;
    ip: string;
}

/**
 * Extract authenticated session context from a request.
 * Should only be called in routes protected by middleware.
 */
export function getApiContext(request: NextRequest): ApiContext | null {
    // Session ID is set by middleware after JWT verification
    const sessionId = request.headers.get("x-session-id");
    if (!sessionId) return null;

    // Full session lookup happens here (Node.js runtime, not Edge)
    const session = getSession(sessionId);
    if (!session) return null;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";

    return {
        sessionId,
        username: session.username,
        credentials: {
            host: session.host,
            port: session.port,
            username: session.username,
            password: session.password,
        },
        ip,
    };
}

/**
 * Standard error response
 */
export function apiError(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response
 */
export function apiSuccess(data: unknown, status: number = 200) {
    return NextResponse.json({ data }, { status });
}
