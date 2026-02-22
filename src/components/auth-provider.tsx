"use client";

import { useEffect, useCallback, type ReactNode } from "react";

/**
 * Wrapper that provides:
 * 1. CSRF token in all fetch mutations
 * 2. Auto-refresh JWT before expiry
 * 3. Idle timeout logout
 */

function getCsrfToken(): string {
    const match = document.cookie.match(/csrf_token=([a-f0-9]+)/);
    return match ? match[1] : "";
}

// Monkey-patch fetch to include CSRF token on mutations
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
    const method = (init?.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

    if (isMutation) {
        const headers = new Headers(init?.headers);
        if (!headers.has("x-csrf-token")) {
            headers.set("x-csrf-token", getCsrfToken());
        }
        init = { ...init, headers };
    }

    return originalFetch(input, init);
};

export function AuthProvider({ children }: { children: ReactNode }) {
    // Auto-refresh JWT every 12 minutes (TTL is 15 min)
    useEffect(() => {
        const interval = setInterval(
            async () => {
                try {
                    const res = await fetch("/api/auth/refresh", { method: "POST" });
                    if (!res.ok) {
                        window.location.href = "/login";
                    }
                } catch {
                    // Network error — don't redirect
                }
            },
            12 * 60 * 1000
        );
        return () => clearInterval(interval);
    }, []);

    // Idle timeout — 15 min without mouse/keyboard
    const resetIdleTimer = useCallback(() => {
        const key = "lastActivity";
        sessionStorage.setItem(key, Date.now().toString());
    }, []);

    useEffect(() => {
        const events = ["mousedown", "keydown", "scroll", "touchstart"];
        events.forEach((e) => window.addEventListener(e, resetIdleTimer));
        resetIdleTimer();

        const idleCheck = setInterval(() => {
            const last = parseInt(sessionStorage.getItem("lastActivity") || "0", 10);
            if (Date.now() - last > 15 * 60 * 1000) {
                fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/login";
                });
            }
        }, 60_000);

        return () => {
            events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
            clearInterval(idleCheck);
        };
    }, [resetIdleTimer]);

    return <>{children}</>;
}
