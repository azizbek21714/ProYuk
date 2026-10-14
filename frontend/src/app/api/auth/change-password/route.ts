import { NextRequest, NextResponse } from "next/server";
import { djangoFetch, getToken } from "@/lib/django";

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Avtorizatsiya talab etiladi" }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const { data, status } = await djangoFetch("/api/auth/change-password", {
    method: "POST", token, body: JSON.stringify(body),
  });
  const result = data as Record<string, unknown> | null;
  if (status !== 200) return NextResponse.json(data, { status });
  const response = NextResponse.json({ detail: result?.detail });
  for (const [key, name, days] of [["access", "token", 7], ["refresh", "refresh", 30]] as const) {
    const value = result?.[key];
    if (typeof value === "string") {
      response.cookies.set(name, value, {
        httpOnly: true, secure: request.nextUrl.protocol === "https:",
        sameSite: "lax", path: "/", maxAge: days * 86400,
      });
    }
  }
  return response;
}
