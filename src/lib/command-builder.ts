/**
 * Command Builder — Allowlisted command factory.
 * ALL commands executed on the remote server MUST go through this module.
 * No raw string concatenation of user input into shell commands.
 */

// ─── Validation Patterns ────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-z_][a-z0-9_-]{0,30}$/;
const SHARE_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_PATH_REGEX = /^[a-zA-Z0-9/_.-]+$/;
const SERVICE_NAMES = ["smbd", "nmbd"] as const;
const SERVICE_ACTIONS = ["status", "start", "stop", "restart", "reload"] as const;

type ServiceName = (typeof SERVICE_NAMES)[number];
type ServiceAction = (typeof SERVICE_ACTIONS)[number];

// Log files that are allowed to be read
const ALLOWED_LOG_FILES: Record<string, string> = {
    "log.smbd": "/var/log/samba/log.smbd",
    "log.nmbd": "/var/log/samba/log.nmbd",
    "log.winbindd": "/var/log/samba/log.winbindd",
};

export interface CommandSpec {
    command: string;
    stdin?: string;  // For commands that need stdin input (like smbpasswd)
    sudo: boolean;
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateUsername(username: string): void {
    if (!USERNAME_REGEX.test(username)) {
        throw new Error(`Invalid username: must match ${USERNAME_REGEX}`);
    }
}

function validateShareName(name: string): void {
    if (!SHARE_NAME_REGEX.test(name)) {
        throw new Error(`Invalid share name: must match ${SHARE_NAME_REGEX}`);
    }
}

function validatePath(path: string): void {
    if (!path.startsWith("/")) {
        throw new Error("Path must be absolute");
    }
    if (!SAFE_PATH_REGEX.test(path)) {
        throw new Error("Path contains invalid characters");
    }
    if (path.includes("..")) {
        throw new Error("Path traversal (..) is not allowed");
    }
    if (path.includes("\0")) {
        throw new Error("Null bytes are not allowed in paths");
    }
}

function validateServiceName(name: string): asserts name is ServiceName {
    if (!SERVICE_NAMES.includes(name as ServiceName)) {
        throw new Error(`Invalid service name. Must be one of: ${SERVICE_NAMES.join(", ")}`);
    }
}

function validateServiceAction(action: string): asserts action is ServiceAction {
    if (!SERVICE_ACTIONS.includes(action as ServiceAction)) {
        throw new Error(`Invalid service action. Must be one of: ${SERVICE_ACTIONS.join(", ")}`);
    }
}

function validateLineCount(n: number): void {
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
        throw new Error("Line count must be an integer between 1 and 1000");
    }
}

function validatePassword(password: string): void {
    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
    }
    if (password.length > 128) {
        throw new Error("Password must be at most 128 characters");
    }
    // No shell-unsafe chars needed since we use stdin, not command args
}

// ─── Command Builders ───────────────────────────────────────────────────────

export const CommandBuilder = {
    // --- System Info ---
    uptime(): CommandSpec {
        return { command: "uptime", sudo: false };
    },

    freeMemory(): CommandSpec {
        return { command: "free -m", sudo: false };
    },

    diskUsage(): CommandSpec {
        return { command: "df -h", sudo: false };
    },

    sambaVersion(): CommandSpec {
        return { command: "smbd --version", sudo: false };
    },

    hostname(): CommandSpec {
        return { command: "hostname", sudo: false };
    },

    // --- Service Control ---
    serviceControl(service: string, action: string): CommandSpec {
        validateServiceName(service);
        validateServiceAction(action);
        return { command: `systemctl ${action} ${service}`, sudo: action !== "status" };
    },

    // --- Samba Users ---
    listSambaUsers(): CommandSpec {
        return { command: "pdbedit -L -v", sudo: true };
    },

    addSambaUser(username: string, password: string): CommandSpec {
        validateUsername(username);
        validatePassword(password);
        // smbpasswd reads password from stdin (two lines: password + confirm)
        return {
            command: `smbpasswd -a -s ${username}`,
            stdin: `${password}\n${password}\n`,
            sudo: true,
        };
    },

    changeSambaPassword(username: string, password: string): CommandSpec {
        validateUsername(username);
        validatePassword(password);
        return {
            command: `smbpasswd -s ${username}`,
            stdin: `${password}\n${password}\n`,
            sudo: true,
        };
    },

    deleteSambaUser(username: string): CommandSpec {
        validateUsername(username);
        return { command: `smbpasswd -x ${username}`, sudo: true };
    },

    enableSambaUser(username: string): CommandSpec {
        validateUsername(username);
        return { command: `smbpasswd -e ${username}`, sudo: true };
    },

    disableSambaUser(username: string): CommandSpec {
        validateUsername(username);
        return { command: `smbpasswd -d ${username}`, sudo: true };
    },

    checkUserExists(username: string): CommandSpec {
        validateUsername(username);
        return { command: `id ${username}`, sudo: false };
    },

    // --- SMB Config ---
    readSmbConf(): CommandSpec {
        return { command: "cat /etc/samba/smb.conf", sudo: true };
    },

    testParm(): CommandSpec {
        return { command: "testparm -s 2>/dev/null", sudo: true };
    },

    backupSmbConf(): CommandSpec {
        return { command: "cp /etc/samba/smb.conf /etc/samba/smb.conf.bak", sudo: true };
    },

    restoreSmbConf(): CommandSpec {
        return { command: "cp /etc/samba/smb.conf.bak /etc/samba/smb.conf", sudo: true };
    },

    reloadSamba(): CommandSpec {
        return { command: "systemctl reload smbd", sudo: true };
    },

    // --- Connections ---
    smbStatus(): CommandSpec {
        return { command: "smbstatus --json 2>/dev/null || smbstatus", sudo: true };
    },

    // --- Logs ---
    readLog(logFile: string, lines: number): CommandSpec {
        if (!ALLOWED_LOG_FILES[logFile]) {
            throw new Error(`Invalid log file. Must be one of: ${Object.keys(ALLOWED_LOG_FILES).join(", ")}`);
        }
        validateLineCount(lines);
        const fullPath = ALLOWED_LOG_FILES[logFile];
        return { command: `tail -n ${lines} ${fullPath}`, sudo: true };
    },

    listLogFiles(): CommandSpec {
        return { command: "ls -la /var/log/samba/", sudo: true };
    },

    // --- File Operations (paths validated by path-sandbox before reaching here) ---
    listDirectory(safePath: string): CommandSpec {
        validatePath(safePath);
        return { command: `ls -la --time-style=long-iso ${safePath}`, sudo: false };
    },

    makeDirectory(safePath: string): CommandSpec {
        validatePath(safePath);
        return { command: `mkdir -p ${safePath}`, sudo: false };
    },

    removeFile(safePath: string): CommandSpec {
        validatePath(safePath);
        return { command: `rm ${safePath}`, sudo: false };
    },

    removeDirectory(safePath: string): CommandSpec {
        validatePath(safePath);
        return { command: `rm -rf ${safePath}`, sudo: false };
    },

    renameFile(safeSrc: string, safeDst: string): CommandSpec {
        validatePath(safeSrc);
        validatePath(safeDst);
        return { command: `mv ${safeSrc} ${safeDst}`, sudo: false };
    },

    getFileInfo(safePath: string): CommandSpec {
        validatePath(safePath);
        return { command: `stat ${safePath}`, sudo: false };
    },

    // --- SSH Key Management ---
    ensureSshDir(): CommandSpec {
        return { command: "mkdir -p ~/.ssh && chmod 700 ~/.ssh", sudo: false };
    },

    readAuthorizedKeys(): CommandSpec {
        return { command: "cat ~/.ssh/authorized_keys 2>/dev/null", sudo: false };
    },

    addAuthorizedKey(key: string): CommandSpec {
        // Base64-like and key-type validation happened at the API layer
        // We use double quotes and escape to be safe-ish, though key is validated
        const escapedKey = key.replace(/"/g, '\\"');
        return {
            command: `echo "${escapedKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
            sudo: false
        };
    },

    removeAuthorizedKey(fingerprintOrSnippet: string): CommandSpec {
        // Use grep -v to remove the line containing the snippet (usually the public key body)
        // We create a temp file to ensure atomic-ish update
        const escaped = fingerprintOrSnippet.replace(/"/g, '\\"');
        return {
            command: `grep -v "${escaped}" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp 2>/dev/null; mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys || rm -f ~/.ssh/authorized_keys.tmp`,
            sudo: false
        };
    }
} as const;

export { validateUsername, validateShareName, validatePath, validatePassword };
