/**
 * smb.conf Parser & Writer — Structured CRUD for Samba configuration.
 * All values are validated through sanitize.ts before writing.
 */

import { sanitizeSmbConfValue, sanitizeSmbConfBoolean } from "./sanitize";
import { validateShareName, validatePath } from "./command-builder";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShareConfig {
    name: string;
    path: string;
    comment?: string;
    "valid users"?: string;
    "read only"?: string;
    browseable?: string;
    "guest ok"?: string;
    writable?: string;
    "create mask"?: string;
    "directory mask"?: string;
    "force user"?: string;
    "force group"?: string;
    [key: string]: string | undefined;
}

export interface SmbConfig {
    global: Record<string, string>;
    shares: ShareConfig[];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse raw smb.conf text into structured config
 */
export function parseSmbConf(raw: string): SmbConfig {
    const lines = raw.split("\n");
    const config: SmbConfig = { global: {}, shares: [] };
    let currentSection: string | null = null;
    let currentData: Record<string, string> = {};

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;

        // Section header
        const sectionMatch = trimmed.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            // Save previous section
            if (currentSection !== null) {
                if (currentSection === "global") {
                    config.global = { ...currentData };
                } else {
                    config.shares.push({ name: currentSection, ...currentData } as ShareConfig);
                }
            }
            currentSection = sectionMatch[1];
            currentData = {};
            continue;
        }

        // Key = value
        const kvMatch = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim().toLowerCase();
            const value = kvMatch[2].trim();
            currentData[key] = value;
        }
    }

    // Save last section
    if (currentSection !== null) {
        if (currentSection === "global") {
            config.global = { ...currentData };
        } else {
            config.shares.push({ name: currentSection, ...currentData } as ShareConfig);
        }
    }

    return config;
}

/**
 * Serialize structured config back to smb.conf text
 */
export function serializeSmbConf(config: SmbConfig): string {
    const lines: string[] = [];

    // Global section
    lines.push("[global]");
    for (const [key, value] of Object.entries(config.global)) {
        lines.push(`   ${key} = ${value}`);
    }
    lines.push("");

    // Share sections
    for (const share of config.shares) {
        lines.push(`[${share.name}]`);
        for (const [key, value] of Object.entries(share)) {
            if (key === "name" || value === undefined) continue;
            lines.push(`   ${key} = ${value}`);
        }
        lines.push("");
    }

    return lines.join("\n");
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Add a new share to the config (with full validation)
 */
export function addShare(config: SmbConfig, share: ShareConfig): SmbConfig {
    validateShareName(share.name);
    validatePath(share.path);

    // Check for duplicate
    if (config.shares.some((s) => s.name === share.name)) {
        throw new Error(`Share "${share.name}" already exists`);
    }

    // Sanitize all values
    const sanitized: ShareConfig = {
        name: share.name,
        path: share.path,
    };

    const optionalFields = [
        "comment", "valid users", "read only", "browseable",
        "guest ok", "writable", "create mask", "directory mask",
        "force user", "force group",
    ];

    const booleanFields = ["read only", "browseable", "guest ok", "writable"];

    for (const field of optionalFields) {
        const value = share[field];
        if (value !== undefined && value !== "") {
            if (booleanFields.includes(field)) {
                sanitized[field] = sanitizeSmbConfBoolean(value, field);
            } else {
                sanitized[field] = sanitizeSmbConfValue(value, field);
            }
        }
    }

    return {
        ...config,
        shares: [...config.shares, sanitized],
    };
}

/**
 * Update an existing share
 */
export function updateShare(config: SmbConfig, shareName: string, updates: Partial<ShareConfig>): SmbConfig {
    validateShareName(shareName);

    const idx = config.shares.findIndex((s) => s.name === shareName);
    if (idx === -1) throw new Error(`Share "${shareName}" not found`);

    if (updates.path) validatePath(updates.path);

    const updated = { ...config.shares[idx] };
    const booleanFields = ["read only", "browseable", "guest ok", "writable"];

    for (const [key, value] of Object.entries(updates)) {
        if (key === "name") continue; // Don't allow renaming via update
        if (value === undefined) continue;

        if (booleanFields.includes(key)) {
            updated[key] = sanitizeSmbConfBoolean(value, key);
        } else if (key === "path") {
            updated[key] = value; // Already validated above
        } else {
            updated[key] = sanitizeSmbConfValue(value, key);
        }
    }

    const newShares = [...config.shares];
    newShares[idx] = updated;

    return { ...config, shares: newShares };
}

/**
 * Delete a share from the config
 */
export function deleteShare(config: SmbConfig, shareName: string): SmbConfig {
    validateShareName(shareName);

    const filtered = config.shares.filter((s) => s.name !== shareName);
    if (filtered.length === config.shares.length) {
        throw new Error(`Share "${shareName}" not found`);
    }

    return { ...config, shares: filtered };
}
