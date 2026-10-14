import { NextRequest, NextResponse } from "next/server";
import { DJANGO_BASE } from "@/lib/django";

function getCookieValue(req: NextRequest, name: string): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: NextRequest) {
  try {
    const access = getCookieValue(request, "token");
    const refresh = getCookieValue(request, "refresh");

    if (access) {
      await fetch(`${DJANGO_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ refresh: refresh || "" }),
      }).catch(() => {});
    }

    const res = NextResponse.json({ message: "Tizimdan chiqdingiz" });
    const cookieOpts = {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    };
    res.cookies.set("token", "", cookieOpts);
    res.cookies.set("refresh", "", cookieOpts);
    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
  }
}
