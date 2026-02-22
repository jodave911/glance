/**
 * POST /api/auth/refresh — Refresh JWT (sliding session)
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, getAuthCookieName, signToken, buildAuthCookie } from "@/lib/auth";
import { getSession } from "@/lib/session-vault";

export async function POST(request: NextRequest) {
    const token = request.cookies.get(getAuthCookieName())?.value;
    if (!token) {
        return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.sid) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check session still exists
    const session = getSession(payload.sid);
    if (!session) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Issue new token with fresh expiry
    const newToken = await signToken(payload.sid);
    const response = NextResponse.json({
        data: { username: session.username, host: session.host },
    });
    response.headers.append("Set-Cookie", buildAuthCookie(newToken));
    return response;
}
