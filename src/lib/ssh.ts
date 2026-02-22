/**
 * SSH Connection Utility — Hardened SSH execution over ssh2.
 * All commands MUST come through command-builder.ts (never raw strings from API).
 */

import { Client, type ConnectConfig, type SFTPWrapper } from "ssh2";
import type { CommandSpec } from "./command-builder";

export interface SSHCredentials {
    host: string;
    port: number;
    username: string;
    password: string;
}

export interface SSHExecResult {
    stdout: string;
    stderr: string;
    code: number;
}

const CONNECT_TIMEOUT = 10_000; // 10 seconds
const COMMAND_TIMEOUT = 30_000; // 30 seconds

/**
 * Get the expected host key fingerprint from environment (MITM detection)
 */
function getExpectedFingerprint(): string | null {
    return process.env.SSH_HOST_KEY_FINGERPRINT || null;
}

/**
 * Execute a pre-validated command specification on the remote server.
 * This function should ONLY be called with CommandSpec objects from command-builder.ts.
 */
export async function executeCommand(
    creds: SSHCredentials,
    spec: CommandSpec
): Promise<SSHExecResult> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let settled = false;

        // Command timeout
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                conn.end();
                reject(new Error("Command timed out after " + COMMAND_TIMEOUT / 1000 + "s"));
            }
        }, COMMAND_TIMEOUT);

        const connectConfig: ConnectConfig = {
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
            hostVerifier: (key: Buffer) => {
                const expectedFp = getExpectedFingerprint();
                if (!expectedFp) {
                    // No fingerprint configured — accept (first time setup)
                    return true;
                }
                // Convert key to hex fingerprint for comparison
                const crypto = require("crypto");
                const actualFp = crypto.createHash("sha256").update(key).digest("hex");
                return actualFp === expectedFp.replace(/:/g, "").toLowerCase();
            },
        };

        conn.on("ready", () => {
            // Build the full command - wrap with sudo if needed
            const fullCommand = spec.sudo
                ? `sudo -S ${spec.command}`
                : spec.command;

            conn.exec(fullCommand, { pty: false }, (err, stream) => {
                if (err) {
                    clearTimeout(timeout);
                    settled = true;
                    conn.end();
                    reject(err);
                    return;
                }

                let stdout = "";
                let stderr = "";

                stream.on("data", (data: Buffer) => {
                    stdout += data.toString();
                });

                stream.stderr.on("data", (data: Buffer) => {
                    const text = data.toString();
                    // Filter out sudo password prompts from stderr
                    if (!text.includes("[sudo] password")) {
                        stderr += text;
                    }
                });

                stream.on("close", (code: number) => {
                    clearTimeout(timeout);
                    if (!settled) {
                        settled = true;
                        conn.end();
                        resolve({ stdout, stderr, code: code || 0 });
                    }
                });

                // If command needs stdin (e.g., sudo password, smbpasswd)
                if (spec.sudo) {
                    // Send password for sudo
                    stream.write(creds.password + "\n");
                }
                if (spec.stdin) {
                    stream.write(spec.stdin);
                }
                stream.end();
            });
        });

        conn.on("error", (err) => {
            clearTimeout(timeout);
            if (!settled) {
                settled = true;
                reject(err);
            }
        });

        conn.connect(connectConfig);
    });
}

/**
 * Test SSH connection (used for login validation)
 */
export async function testConnection(creds: SSHCredentials): Promise<boolean> {
    return new Promise((resolve) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
            conn.end();
            resolve(false);
        }, CONNECT_TIMEOUT);

        conn.on("ready", () => {
            clearTimeout(timeout);
            conn.end();
            resolve(true);
        });

        conn.on("error", () => {
            clearTimeout(timeout);
            resolve(false);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

/**
 * Upload a file via SFTP (used for smb.conf writes and file uploads)
 */
export async function sftpWriteFile(
    creds: SSHCredentials,
    remotePath: string,
    content: Buffer | string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
            conn.end();
            reject(new Error("SFTP operation timed out"));
        }, COMMAND_TIMEOUT);

        conn.on("ready", () => {
            conn.sftp((err, sftp: SFTPWrapper) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    reject(err);
                    return;
                }

                const stream = sftp.createWriteStream(remotePath);
                stream.on("close", () => {
                    clearTimeout(timeout);
                    conn.end();
                    resolve();
                });
                stream.on("error", (writeErr: Error) => {
                    clearTimeout(timeout);
                    conn.end();
                    reject(writeErr);
                });
                stream.end(content);
            });
        });

        conn.on("error", (connErr) => {
            clearTimeout(timeout);
            reject(connErr);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

/**
 * Read a file via SFTP
 */
export async function sftpReadFile(
    creds: SSHCredentials,
    remotePath: string
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
            conn.end();
            reject(new Error("SFTP read timed out"));
        }, COMMAND_TIMEOUT);

        conn.on("ready", () => {
            conn.sftp((err, sftp: SFTPWrapper) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    reject(err);
                    return;
                }

                const chunks: Buffer[] = [];
                const stream = sftp.createReadStream(remotePath);
                stream.on("data", (chunk: Buffer) => chunks.push(chunk));
                stream.on("end", () => {
                    clearTimeout(timeout);
                    conn.end();
                    resolve(Buffer.concat(chunks));
                });
                stream.on("error", (readErr: Error) => {
                    clearTimeout(timeout);
                    conn.end();
                    reject(readErr);
                });
            });
        });

        conn.on("error", (connErr) => {
            clearTimeout(timeout);
            reject(connErr);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

/**
 * Read a file via SFTP and push it to a stream (used for media viewing)
 */
export async function sftpReadStream(
    creds: SSHCredentials,
    remotePath: string
): Promise<ReadableStream<Uint8Array>> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
            conn.end();
            reject(new Error("SFTP read stream timed out"));
        }, COMMAND_TIMEOUT);

        conn.on("ready", () => {
            conn.sftp((err, sftp: SFTPWrapper) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    reject(err);
                    return;
                }

                const stream = sftp.createReadStream(remotePath);

                // Wrap the standard Node stream into a Web ReadableStream
                const webStream = new ReadableStream({
                    start(controller) {
                        clearTimeout(timeout);

                        stream.on("data", (chunk: Buffer) => {
                            controller.enqueue(new Uint8Array(chunk));
                        });

                        stream.on("end", () => {
                            controller.close();
                            conn.end();
                        });

                        stream.on("error", (readErr: Error) => {
                            controller.error(readErr);
                            conn.end();
                        });
                    },
                    cancel() {
                        stream.destroy();
                        conn.end();
                    }
                });

                resolve(webStream);
            });
        });

        conn.on("error", (connErr) => {
            clearTimeout(timeout);
            reject(connErr);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

/**
 * Upload a file as a stream via SFTP
 */
export async function sftpWriteStream(
    creds: SSHCredentials,
    remotePath: string,
    inputStream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        // Since uploads can take a long time, we cannot have a tight timeout
        // But we should enforce a timeout on the initial connection
        const connectTimeout = setTimeout(() => {
            conn.end();
            reject(new Error("SFTP stream connect timed out"));
        }, CONNECT_TIMEOUT);

        conn.on("ready", () => {
            clearTimeout(connectTimeout);

            conn.sftp(async (err, sftp: SFTPWrapper) => {
                if (err) {
                    conn.end();
                    reject(err);
                    return;
                }

                const writeStream = sftp.createWriteStream(remotePath);

                writeStream.on("close", () => {
                    conn.end();
                    resolve();
                });

                writeStream.on("error", (writeErr: Error) => {
                    conn.end();
                    reject(writeErr);
                });

                try {
                    // Modern iterables over the web stream or node stream
                    for await (const chunk of inputStream as any) {
                        if (!writeStream.write(Buffer.from(chunk))) {
                            // Handle backpressure
                            await new Promise(r => writeStream.once('drain', r));
                        }
                    }
                    writeStream.end();
                } catch (streamErr) {
                    writeStream.destroy();
                    conn.end();
                    reject(streamErr);
                }
            });
        });

        conn.on("error", (connErr) => {
            clearTimeout(connectTimeout);
            reject(connErr);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

/**
 * Get file stats via SFTP. Returns null if file doesn't exist or on error.
 */
export async function sftpStat(
    creds: SSHCredentials,
    remotePath: string
): Promise<{ size: number; isDirectory: boolean } | null> {
    return new Promise((resolve) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
            conn.end();
            resolve(null);
        }, CONNECT_TIMEOUT);

        conn.on("ready", () => {
            conn.sftp((err, sftp: SFTPWrapper) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    resolve(null);
                    return;
                }

                sftp.stat(remotePath, (statErr, stats) => {
                    clearTimeout(timeout);
                    conn.end();
                    if (statErr) {
                        resolve(null);
                    } else {
                        resolve({
                            size: stats.size,
                            isDirectory: stats.isDirectory()
                        });
                    }
                });
            });
        });

        conn.on("error", () => {
            clearTimeout(timeout);
            resolve(null);
        });

        conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: CONNECT_TIMEOUT,
        });
    });
}

