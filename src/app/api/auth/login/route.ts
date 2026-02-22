/**
 * POST /api/auth/login — Authenticate via SSH credentials
 * Rate limited: 5 attempts per 15 minutes per IP
 */

import { NextResponse, type NextRequest } from "next/server";
import { testConnection } from "@/lib/ssh";
import { createSession } from "@/lib/session-vault";
import { signToken, buildAuthCookie } from "@/lib/auth";
import { generateCsrfToken, buildCsrfCookie } from "@/lib/csrf";
import { checkLoginRateLimit, isAccountLocked, recordFailedLogin, clearFailedLogins } from "@/lib/rate-limiter";
import { logAudit, AuditActions } from "@/lib/audit";
import { sanitizeTextInput } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";

    // Rate limit check
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many login attempts. Try again later." },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
            }
        );
    }

    try {
        const body = await request.json();
        const { username, password, host, port } = body;

        // Input validation
        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
        }

        const sanitizedUsername = sanitizeTextInput(username, "username", 32);
        const sshHost = sanitizeTextInput(host || process.env.SSH_HOST || "192.168.0.101", "host", 256);
        const sshPort = parseInt(port || process.env.SSH_PORT || "22", 10);

        if (isNaN(sshPort) || sshPort < 1 || sshPort > 65535) {
            return NextResponse.json({ error: "Invalid port" }, { status: 400 });
        }

        // Check account lockout
        const lockout = isAccountLocked(sanitizedUsername);
        if (lockout.locked) {
            return NextResponse.json(
                { error: "Account temporarily locked due to too many failed attempts." },
                { status: 423 }
            );
        }

        // Test SSH connection
        const success = await testConnection({
            host: sshHost,
            port: sshPort,
            username: sanitizedUsername,
            password,
        });

        if (!success) {
            recordFailedLogin(sanitizedUsername);
            logAudit(AuditActions.login(sanitizedUsername, ip, false));
            // Generic error message — don't reveal whether username exists
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Authentication successful
        clearFailedLogins(sanitizedUsername);

        // Create server-side session (credentials never leave the server)
        const sessionId = createSession(sanitizedUsername, password, sshHost, sshPort);

        // Sign JWT with only session ID
        const token = await signToken(sessionId);

        // Generate CSRF token
        const csrfToken = generateCsrfToken();

        // Audit log
        logAudit(AuditActions.login(sanitizedUsername, ip, true));

        // Build response with cookies
        const response = NextResponse.json({
            data: { username: sanitizedUsername, host: sshHost },
        });

        response.headers.append("Set-Cookie", buildAuthCookie(token));
        response.headers.append("Set-Cookie", buildCsrfCookie(csrfToken));

        return response;
    } catch (error) {
        console.error("[auth/login] Error:", error);
        return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
}
