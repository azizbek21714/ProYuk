import { NextRequest, NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

export async function POST(request: NextRequest) {
  try {
    let email = "";
    let password = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = body.email || "";
      password = body.password || "";
    } else {
      const formData = await request.formData();
      email = (formData.get("email") as string) || "";
      password = (formData.get("password") as string) || "";
    }

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=empty", request.url), 303);
    }

    const { data, status } = await djangoFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const d = data as Record<string, unknown> | null;
    const access = d?.access as string | undefined;
    const refresh = d?.refresh as string | undefined;

    if ((status === 200 || status === 201) && access) {
      const user = (d?.user as Record<string, unknown>) || d || {};
      const role = (user.role as string) || "";
      const targetPath =
        role === "oqituvchi" ? "/dashboard/teacher" : "/dashboard/admin";

      const isSecure = request.headers.get("x-forwarded-proto") === "https";
      const res = NextResponse.redirect(new URL(targetPath, request.url), 302);
      res.cookies.set("token", access, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      if (refresh) {
        res.cookies.set("refresh", refresh, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    }

    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  } catch (error) {
    console.error("Signin error:", error);
    return NextResponse.redirect(new URL("/login?error=server", request.url), 303);
  }
}
