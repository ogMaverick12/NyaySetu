import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/security/session-store";

export function DELETE(request: NextRequest): NextResponse {
  try {
    const sessionId =
      request.headers.get("x-session-id") || request.cookies.get("nyaysetu_session")?.value;

    if (sessionId) {
      sessionStore.deleteSession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      message: "Session data and document content permanently deleted.",
    });

    // Clear session cookie
    response.cookies.delete("nyaysetu_session");

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to purge session";
    return NextResponse.json({ error: `Session deletion error: ${msg}` }, { status: 500 });
  }
}

export function GET(request: NextRequest): NextResponse {
  const sessionId =
    request.headers.get("x-session-id") || request.cookies.get("nyaysetu_session")?.value;

  if (!sessionId) {
    return NextResponse.json({ active: false, message: "No active session found" });
  }

  const session = sessionStore.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ active: false, message: "Session expired or not found" });
  }

  const remainingTtlSeconds = Math.max(
    0,
    Math.round((session.lastAccessedAt + session.ttlMs - Date.now()) / 1000)
  );

  // Return zero document content in telemetry
  return NextResponse.json({
    active: true,
    sessionId: session.id,
    hasDocument: !!session.document,
    clauseCount: session.clauses.length,
    remainingTtlSeconds,
    createdAt: session.createdAt,
  });
}
