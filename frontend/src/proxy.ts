import { NextRequest, NextResponse } from "next/server";

const DJANGO_BASE = (process.env.DJANGO_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    let access = token;
    let rotatedRefresh: string | undefined;
    let response = await fetch(`${DJANGO_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401) {
      const refresh = request.cookies.get("refresh")?.value;
      if (!refresh) return NextResponse.redirect(new URL("/login", request.url));
      const refreshed = await fetch(`${DJANGO_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!refreshed.ok) return NextResponse.redirect(new URL("/login", request.url));
      const tokens = await refreshed.json();
      access = tokens.access;
      rotatedRefresh = tokens.refresh;
      response = await fetch(`${DJANGO_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store",
      });
    }
    if (!response.ok) return NextResponse.redirect(new URL("/login", request.url));
    const data = await response.json();
    if (data?.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard/teacher", request.url));
    }
    const next = NextResponse.next();
    if (access !== token) {
      const secure = request.nextUrl.protocol === "https:";
      next.cookies.set("token", access, {
        httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
      });
      if (rotatedRefresh) {
        next.cookies.set("refresh", rotatedRefresh, {
          httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
        });
      }
    }
    return next;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/admin/:path*"],
};
