import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SessionData {
    username: string;
    encryptedPassword: string; // AES-256-GCM encrypted
    iv: string;
    authTag: string;
    host: string;
    port: number;
    createdAt: number;
    lastAccessedAt: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_MINUTES || "30", 10)) * 60 * 1000;
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "50", 10);

function getVaultKey(): Buffer {
    let key = process.env.VAULT_KEY;
    if (!key || key.length < 64) {
        // Auto-generate if not set
        key = crypto.randomBytes(32).toString("hex");
        process.env.VAULT_KEY = key;
        console.warn("[session-vault] Auto-generated VAULT_KEY. Set it in .env.local for persistence across restarts.");
    }
    return Buffer.from(key, "hex");
}

// ─── In-Memory Session Store ────────────────────────────────────────────────
const sessions = new Map<string, SessionData>();

// Periodic cleanup every 60 seconds
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [sid, session] of sessions) {
            if (now - session.lastAccessedAt > SESSION_TTL_MS) {
                sessions.delete(sid);
            }
        }
    }, 60_000);
    // Don't prevent process exit
    if (cleanupInterval.unref) cleanupInterval.unref();
}

startCleanup();

// ─── Encrypt / Decrypt Helpers ──────────────────────────────────────────────
function encryptPassword(password: string): { encrypted: string; iv: string; authTag: string } {
    const key = getVaultKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return { encrypted, iv: iv.toString("hex"), authTag };
}

function decryptPassword(encrypted: string, iv: string, authTag: string): string {
    const key = getVaultKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function createSession(username: string, password: string, host: string, port: number): string {
    // Enforce max sessions
    if (sessions.size >= MAX_SESSIONS) {
        // Evict oldest session
        let oldestSid = "";
        let oldestTime = Infinity;
        for (const [sid, session] of sessions) {
            if (session.lastAccessedAt < oldestTime) {
                oldestTime = session.lastAccessedAt;
                oldestSid = sid;
            }
        }
        if (oldestSid) sessions.delete(oldestSid);
    }

    const sid = crypto.randomUUID();
    const { encrypted, iv, authTag } = encryptPassword(password);
    const now = Date.now();

    sessions.set(sid, {
        username,
        encryptedPassword: encrypted,
        iv,
        authTag,
        host,
        port,
        createdAt: now,
        lastAccessedAt: now,
    });

    return sid;
}

export function getSession(sid: string): { username: string; password: string; host: string; port: number } | null {
    const session = sessions.get(sid);
    if (!session) return null;

    // Check expiry
    if (Date.now() - session.lastAccessedAt > SESSION_TTL_MS) {
        sessions.delete(sid);
        return null;
    }

    // Update last accessed (sliding window)
    session.lastAccessedAt = Date.now();

    try {
        const password = decryptPassword(session.encryptedPassword, session.iv, session.authTag);
        return {
            username: session.username,
            password,
            host: session.host,
            port: session.port,
        };
    } catch {
        // Decryption failed — vault key may have changed
        sessions.delete(sid);
        return null;
    }
}

export function destroySession(sid: string): boolean {
    return sessions.delete(sid);
}

export function getActiveSessionCount(): number {
    return sessions.size;
}
