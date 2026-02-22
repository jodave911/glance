/**
 * Auth — JWT sign/verify using jose (Edge-compatible).
 * JWT contains ONLY a session ID + timestamps. No credentials.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import crypto from "crypto";

const JWT_COOKIE_NAME = "auth_token";
const JWT_TTL_SECONDS = 15 * 60; // 15 minutes

export interface AuthPayload extends JWTPayload {
    sid: string; // Session ID — maps to session-vault entry
}

function getSecret(): Uint8Array {
    let secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 64) {
        secret = crypto.randomBytes(64).toString("hex");
        process.env.JWT_SECRET = secret;
        console.warn("[auth] Auto-generated JWT_SECRET. Set it in .env.local for persistence.");
    }
    return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT containing only the session ID
 */
export async function signToken(sessionId: string): Promise<string> {
    const token = await new SignJWT({ sid: sessionId } as AuthPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${JWT_TTL_SECONDS}s`)
        .sign(getSecret());
    return token;
}

/**
 * Verify and decode a JWT, returning the session ID
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        if (!payload.sid || typeof payload.sid !== "string") return null;
        return payload as AuthPayload;
    } catch {
        return null;
    }
}

/**
 * Get the JWT cookie name
 */
export function getAuthCookieName(): string {
    return JWT_COOKIE_NAME;
}

/**
 * Build a Set-Cookie header for the auth JWT
 */
export function buildAuthCookie(token: string): string {
    return `${JWT_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${JWT_TTL_SECONDS}`;
}

/**
 * Build a Set-Cookie header that clears the auth JWT
 */
export function clearAuthCookie(): string {
    return `${JWT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
