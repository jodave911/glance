/**
 * CSRF Protection — Double-submit cookie pattern.
 * All state-changing requests (POST/PUT/DELETE) must include X-CSRF-Token header.
 */

import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a new CSRF token (256-bit random hex string)
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Get the CSRF cookie name
 */
export function getCsrfCookieName(): string {
    return CSRF_COOKIE_NAME;
}

/**
 * Get the CSRF header name
 */
export function getCsrfHeaderName(): string {
    return CSRF_HEADER_NAME;
}

/**
 * Validate that the CSRF header matches the cookie value.
 * @returns true if valid, false if mismatch
 */
export function validateCsrf(cookieValue: string | undefined, headerValue: string | undefined): boolean {
    if (!cookieValue || !headerValue) return false;
    if (cookieValue.length !== 64 || headerValue.length !== 64) return false;

    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(cookieValue, "hex"),
            Buffer.from(headerValue, "hex")
        );
    } catch {
        return false;
    }
}

/**
 * Build Set-Cookie header for CSRF token
 */
export function buildCsrfCookie(token: string): string {
    // NOT HttpOnly so JS can read it and send as header
    // But SameSite=Strict and Secure prevent cross-origin access
    return `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Strict; Max-Age=86400`;
}
