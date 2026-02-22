import { NextRequest, NextResponse } from "next/server";
import { getApiContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { executeCommand } from "@/lib/ssh";
import { CommandBuilder } from "@/lib/command-builder";

const ALLOWED_KEY_TYPES = [
    'ssh-rsa',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'ssh-ed25519',
    'sk-ecdsa-sha2-nistp256@openssh.com',
    'sk-ssh-ed25519@openssh.com'
];

interface SSHKey {
    id: string; // We'll use the key body as a unique identifier for deletion
    type: string;
    key: string;
    comment: string;
    raw: string;
}

export async function GET(req: NextRequest) {
    const context = await getApiContext(req);
    if (!context) return apiError("Unauthorized", 401);

    try {
        const result = await executeCommand(context.credentials, CommandBuilder.readAuthorizedKeys());

        const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const keys: SSHKey[] = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            const type = parts[0];
            const key = parts[1];
            const comment = parts.slice(2).join(' ');

            return {
                id: key, // Using the key body as ID
                type,
                key,
                comment: comment || 'No comment',
                raw: line.trim()
            };
        });

        return apiSuccess(keys);
    } catch (error: any) {
        return apiError("Failed to read SSH keys: " + error.message);
    }
}

export async function POST(req: NextRequest) {
    const context = await getApiContext(req);
    if (!context) return apiError("Unauthorized", 401);

    try {
        const { type, key, comment } = await req.json();

        if (!ALLOWED_KEY_TYPES.includes(type)) {
            return apiError(`Invalid key type. Supported: ${ALLOWED_KEY_TYPES.join(', ')}`);
        }

        if (!key || key.length < 10) {
            return apiError("Invalid key body");
        }

        // Clean key body (remove newlines/whitespace)
        const cleanKey = key.trim().replace(/\s+/g, '');
        const fullKeyLine = `${type} ${cleanKey}${comment ? ' ' + comment : ''}`;

        // 1. Ensure .ssh dir exists
        await executeCommand(context.credentials, CommandBuilder.ensureSshDir());

        // 2. Add the key
        await executeCommand(context.credentials, CommandBuilder.addAuthorizedKey(fullKeyLine));

        return apiSuccess({ message: "SSH key added successfully" });
    } catch (error: any) {
        return apiError("Failed to add SSH key: " + error.message);
    }
}

export async function DELETE(req: NextRequest) {
    const context = await getApiContext(req);
    if (!context) return apiError("Unauthorized", 401);

    try {
        const { keySnippet } = await req.json();

        if (!keySnippet) {
            return apiError("Missing key snippet for deletion");
        }

        await executeCommand(context.credentials, CommandBuilder.removeAuthorizedKey(keySnippet));

        return apiSuccess({ message: "SSH key removed successfully" });
    } catch (error: any) {
        return apiError("Failed to remove SSH key: " + error.message);
    }
}
