import { NextRequest, NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Elektron pochta va parolni kiriting" },
        { status: 400 }
      );
    }

    const { data, status } = await djangoFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const d = data as Record<string, unknown> | null;
    const access = d?.access as string | undefined;
    const refresh = d?.refresh as string | undefined;

    if ((status === 200 || status === 201) && access) {
      const user = (d?.user as Record<string, unknown>) || d;

      const res = NextResponse.json(
        { message: "Muvaffaqiyatli kirdingiz", user },
        { status: 200 }
      );
      // access token → "token" cookie (server-side reads uchun)
      res.cookies.set("token", access, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      if (refresh) {
        res.cookies.set("refresh", refresh, {
          httpOnly: true,
          secure: request.nextUrl.protocol === "https:",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    }

    return NextResponse.json(
      d || { error: "Elektron pochta yoki parol noto'g'ri" },
      { status: status || 401 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
  }
}
