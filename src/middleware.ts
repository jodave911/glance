/**
 * Next.js Middleware — Security stack applied to every request.
 * 
 * IMPORTANT: This runs in Edge runtime, so we can only use Edge-compatible libraries.
 * We use jose for JWT (Edge-compatible) but NOT session-vault or crypto (Node.js only).
 * Session validation happens inside API routes (Node.js runtime).
 * 
 * 1. Security headers (CSP, HSTS, X-Frame-Options, etc.)
 * 2. JWT verification (skip for login page and login API)
 * 3. CSRF validation for state-changing requests (POST/PUT/DELETE)
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Routes that should bypass CSRF
const CSRF_EXEMPT_PATHS = ["/api/auth/login", "/api/auth/refresh"];

const AUTH_COOKIE = "auth_token";

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET || "";
    return new TextEncoder().encode(secret);
}

/** Apply security headers to any response */
function applySecurityHeaders(response: NextResponse): void {
    const isDev = process.env.NODE_ENV === "development";
    const csp = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://localhost:3000; frame-ancestors 'none'"
        : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "0");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── 1. Skip auth for public paths ────────────────────────────────
    const isPublicPath = PUBLIC_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (isPublicPath) {
        const response = NextResponse.next();
        applySecurityHeaders(response);
        return response;
    }

    // ─── 2. JWT Verification ──────────────────────────────────────────
    const token = request.cookies.get(AUTH_COOKIE)?.value;

    if (!token) {
        if (pathname.startsWith("/api/")) {
            const resp = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            applySecurityHeaders(resp);
            return resp;
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    let sessionId: string;
    try {
        const secret = getJwtSecret();
        // If no secret configured, skip JWT verification (dev mode)
        if (secret.length === 0) {
            const response = NextResponse.next();
            applySecurityHeaders(response);
            return response;
        }

        const { payload } = await jwtVerify(token, secret);

        if (!payload.sid || typeof payload.sid !== "string") {
            throw new Error("Invalid token payload");
        }

        sessionId = payload.sid;
    } catch {
        if (pathname.startsWith("/api/")) {
            const resp = NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
            applySecurityHeaders(resp);
            return resp;
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // ─── 3. CSRF Validation (for state-changing methods) ──────────────
    const method = request.method.toUpperCase();
    const isMutating = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
    const isCsrfExempt = CSRF_EXEMPT_PATHS.some((p) => pathname === p);

    if (isMutating && !isCsrfExempt && pathname.startsWith("/api/")) {
        const csrfCookie = request.cookies.get("csrf_token")?.value;
        const csrfHeader = request.headers.get("x-csrf-token");

        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            const resp = NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
            applySecurityHeaders(resp);
            return resp;
        }
    }

    // ─── 4. Forward session ID to API routes via REQUEST headers ──────
    // This is the correct Next.js pattern: NextResponse.next({ request: { headers } })
    // passes modified request headers to downstream handlers (API routes).
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-session-id", sessionId);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });
    applySecurityHeaders(response);
    return response;
}

export const config = {
    matcher: [
        // Match all routes except static files and Next.js internals
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
