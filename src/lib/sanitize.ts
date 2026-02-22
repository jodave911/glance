/**
 * Input/Output Sanitization — Defense-in-depth for all user data and server output.
 */

// ─── Output Sanitization (server stdout/stderr → browser) ───────────────────

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * HTML-escape a string to prevent XSS when displaying server output
 */
export function escapeHtml(str: string): string {
    return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPES[char] || char);
}

/**
 * Strip ANSI escape codes from terminal output
 */
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function stripAnsi(str: string): string {
    return str.replace(ANSI_REGEX, "");
}

/**
 * Full server output sanitization: strip ANSI codes + HTML escape
 */
export function sanitizeServerOutput(str: string): string {
    return escapeHtml(stripAnsi(str));
}

// ─── Input Sanitization ─────────────────────────────────────────────────────

/**
 * Strip null bytes from a string
 */
export function stripNullBytes(str: string): string {
    return str.replace(/\0/g, "");
}

/**
 * Check if a string contains control characters (except newline, tab)
 */
export function hasControlChars(str: string): boolean {
    // Allow \n (0x0a) and \t (0x09), reject everything else below 0x20 and 0x7f
    // eslint-disable-next-line no-control-regex
    return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(str);
}

/**
 * Enforce maximum string length
 */
export function enforceMaxLength(str: string, maxLen: number, fieldName: string): string {
    if (str.length > maxLen) {
        throw new Error(`${fieldName} exceeds maximum length of ${maxLen} characters`);
    }
    return str;
}

/**
 * Sanitize a generic text input field
 */
export function sanitizeTextInput(str: string, fieldName: string, maxLen: number = 256): string {
    let s = stripNullBytes(str.trim());
    enforceMaxLength(s, maxLen, fieldName);
    if (hasControlChars(s)) {
        throw new Error(`${fieldName} contains invalid control characters`);
    }
    return s;
}

// ─── smb.conf Value Sanitization ────────────────────────────────────────────

/**
 * Validate an smb.conf value to prevent config injection.
 * Rejects newlines, comment characters at start, and control chars.
 */
export function sanitizeSmbConfValue(value: string, fieldName: string): string {
    const s = stripNullBytes(value.trim());
    enforceMaxLength(s, 4096, fieldName);

    if (s.includes("\n") || s.includes("\r")) {
        throw new Error(`${fieldName} must not contain newlines`);
    }

    // Reject lines that start with comment chars (could be used to inject sections)
    if (s.startsWith(";") || s.startsWith("#")) {
        throw new Error(`${fieldName} must not start with comment characters`);
    }

    // Reject square brackets (section markers)
    if (s.includes("[") || s.includes("]")) {
        throw new Error(`${fieldName} must not contain square brackets`);
    }

    if (hasControlChars(s)) {
        throw new Error(`${fieldName} contains invalid control characters`);
    }

    return s;
}

/**
 * Validate an smb.conf boolean value
 */
export function sanitizeSmbConfBoolean(value: string, fieldName: string): "yes" | "no" {
    const lower = value.trim().toLowerCase();
    if (lower === "yes" || lower === "true" || lower === "1") return "yes";
    if (lower === "no" || lower === "false" || lower === "0") return "no";
    throw new Error(`${fieldName} must be 'yes' or 'no'`);
}
