import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/api/admin") || pathname.startsWith("/api/dashboard");

  if (!isProtected) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("session")?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*", "/api/dashboard/:path*"],
};
