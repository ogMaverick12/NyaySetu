import { NextResponse, type NextRequest } from "next/server";

/**
 * NyaySetu Edge Middleware
 *
 * 1. HTTPS Enforcement: Redirects unencrypted HTTP traffic to HTTPS in production.
 * 2. Ephemeral Session Provisioning: Automatically assigns and renews an anonymous
 *    UUIDv4 session cookie (nyaysetu_session) with a rolling 30-minute TTL.
 */
export function middleware(request: NextRequest): NextResponse {
  // 1. HTTPS Enforcement in production environments
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");

  if (process.env.NODE_ENV === "production" && proto === "http" && host) {
    const secureUrl = new URL(request.url);
    secureUrl.protocol = "https:";
    secureUrl.host = host;
    return NextResponse.redirect(secureUrl, { status: 301 });
  }

  // 2. Prepare downstream response
  const response = NextResponse.next();

  // 3. Rolling Ephemeral Session Cookie Management (30-minute rolling TTL)
  let sessionId = request.cookies.get("nyaysetu_session")?.value;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  response.cookies.set({
    name: "nyaysetu_session",
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60, // 30 minutes in seconds
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (Next.js static assets)
     * - _next/image (Image optimization)
     * - favicon.ico, images, or static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sample-agreements/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
