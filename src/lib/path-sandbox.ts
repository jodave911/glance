/**
 * Path Sandbox — Prevents path traversal attacks.
 * All file paths from user input must go through sandboxPath() before use.
 */

import path from "path";

function getAllowedRoots(): string[] {
    const roots = process.env.ALLOWED_SHARE_ROOTS || "/srv/samba";
    return roots.split(",").map((r) => r.trim()).filter(Boolean);
}

/**
 * Validates and resolves a user-provided path to ensure it stays
 * within the allowed share root directories.
 * 
 * @returns The absolute, resolved path guaranteed to be within allowed roots
 * @throws Error if the path escapes the sandbox
 */
export function sandboxPath(userPath: string, basePath?: string): string {
    const allowedRoots = getAllowedRoots();

    if (!userPath) {
        throw new Error("Path cannot be empty");
    }

    // Reject null bytes
    if (userPath.includes("\0")) {
        throw new Error("Null bytes are not allowed in paths");
    }

    // Use posix path since the remote server is Linux
    // Normalize to remove redundant separators and resolve . segments
    let resolved: string;

    if (basePath) {
        // If a base path is provided, resolve relative to it
        resolved = path.posix.resolve(basePath, userPath);
    } else if (userPath.startsWith("/")) {
        resolved = path.posix.normalize(userPath);
    } else {
        // Relative paths must have a base - use the first allowed root
        resolved = path.posix.resolve(allowedRoots[0], userPath);
    }

    // Remove trailing slashes (except root /)
    resolved = resolved.replace(/\/+$/, "") || "/";

    // Check that resolved path falls within at least one allowed root
    const isAllowed = allowedRoots.some((root) => {
        const normalizedRoot = root.replace(/\/+$/, "");
        return resolved === normalizedRoot || resolved.startsWith(normalizedRoot + "/");
    });

    if (!isAllowed) {
        throw new Error(
            `Access denied: path "${resolved}" is outside allowed directories`
        );
    }

    return resolved;
}

/**
 * Validates a path component (filename or directory name) for safety.
 * Used when creating new files/dirs.
 */
export function validatePathComponent(name: string): void {
    if (!name || name.length === 0) {
        throw new Error("Name cannot be empty");
    }
    if (name.length > 255) {
        throw new Error("Name is too long (max 255 characters)");
    }
    if (name === "." || name === "..") {
        throw new Error("Invalid name");
    }
    if (name.includes("/") || name.includes("\\")) {
        throw new Error("Name cannot contain path separators");
    }
    if (name.includes("\0")) {
        throw new Error("Name cannot contain null bytes");
    }
    // Only allow printable ASCII and common unicode
    if (/[\x00-\x1f\x7f]/.test(name)) {
        throw new Error("Name contains control characters");
    }
}
