/**
 * Rate Limiter — In-memory sliding window rate limiter.
 * Protects against brute force attacks on login and API abuse.
 */

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            // Remove entries with no recent timestamps
            entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
            if (entry.timestamps.length === 0) {
                store.delete(key);
            }
        }
    }, CLEANUP_INTERVAL);
    if (cleanupTimer.unref) cleanupTimer.unref();
}

startCleanup();

/**
 * Check if a request should be rate limited.
 * @returns { allowed: boolean, retryAfterMs: number }
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number
): { allowed: boolean; retryAfterMs: number; remaining: number } {
    const now = Date.now();
    const entry = store.get(key) || { timestamps: [] };

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= maxRequests) {
        // Rate limited
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = oldestInWindow + windowMs - now;
        store.set(key, entry);
        return { allowed: false, retryAfterMs, remaining: 0 };
    }

    // Allow and record
    entry.timestamps.push(now);
    store.set(key, entry);
    return { allowed: true, retryAfterMs: 0, remaining: maxRequests - entry.timestamps.length };
}

// ─── Pre-configured limiters ────────────────────────────────────────────────

const LOGIN_MAX = parseInt(process.env.LOGIN_RATE_LIMIT_PER_15MIN || "5", 10);
const LOGIN_WINDOW = 15 * 60 * 1000; // 15 minutes

const API_MAX = parseInt(process.env.API_RATE_LIMIT_PER_MIN || "60", 10);
const API_WINDOW = 60 * 1000; // 1 minute

const DESTRUCTIVE_MAX = 10;
const DESTRUCTIVE_WINDOW = 5 * 60 * 1000; // 5 minutes

export function checkLoginRateLimit(ip: string) {
    return checkRateLimit(`login:${ip}`, LOGIN_MAX, LOGIN_WINDOW);
}

export function checkApiRateLimit(ip: string) {
    return checkRateLimit(`api:${ip}`, API_MAX, API_WINDOW);
}

export function checkDestructiveRateLimit(ip: string) {
    return checkRateLimit(`destructive:${ip}`, DESTRUCTIVE_MAX, DESTRUCTIVE_WINDOW);
}

// ─── Account Lockout ────────────────────────────────────────────────────────
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

const MAX_FAILED_LOGINS = 10;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export function recordFailedLogin(username: string): void {
    const entry = failedLogins.get(username) || { count: 0, lockedUntil: 0 };
    entry.count++;
    if (entry.count >= MAX_FAILED_LOGINS) {
        entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
    }
    failedLogins.set(username, entry);
}

export function clearFailedLogins(username: string): void {
    failedLogins.delete(username);
}

export function isAccountLocked(username: string): { locked: boolean; lockedUntilMs: number } {
    const entry = failedLogins.get(username);
    if (!entry) return { locked: false, lockedUntilMs: 0 };
    if (entry.lockedUntil > Date.now()) {
        return { locked: true, lockedUntilMs: entry.lockedUntil - Date.now() };
    }
    // Lock period expired — reset
    if (entry.lockedUntil > 0) {
        failedLogins.delete(username);
    }
    return { locked: false, lockedUntilMs: 0 };
}
