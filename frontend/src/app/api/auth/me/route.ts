import { NextRequest, NextResponse } from "next/server";
import { getToken, djangoFetch, refreshAccessToken } from "@/lib/django";

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let { data, status } = await djangoFetch("/api/auth/me", { token });
    let refreshed: Awaited<ReturnType<typeof refreshAccessToken>> = null;
    if (status === 401) {
      refreshed = await refreshAccessToken(request);
      if (refreshed) {
        ({ data, status } = await djangoFetch("/api/auth/me", { token: refreshed.access }));
      }
    }
    if (status === 200 && data) {
      const d = data as Record<string, unknown>;
      const user = (d.user as Record<string, unknown>) || d;
      const response = NextResponse.json({ user });
      if (refreshed) {
        const secure = request.nextUrl.protocol === "https:";
        response.cookies.set("token", refreshed.access, {
          httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
        });
        if (refreshed.refresh) {
          response.cookies.set("refresh", refreshed.refresh, {
            httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
          });
        }
      }
      return response;
    }

    return NextResponse.json({ user: null }, { status: 401 });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
