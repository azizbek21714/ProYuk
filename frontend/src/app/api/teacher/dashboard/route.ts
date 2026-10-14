import { NextRequest, NextResponse } from "next/server";
import { getToken, djangoFetch } from "@/lib/django";

export async function PATCH(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Avtorizatsiya talab etiladi" }, { status: 401 });
  const body = await request.json();
  const { data, status } = await djangoFetch('/api/teacher/dashboard/', {
    token, method: 'PATCH', body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: "Avtorizatsiya talab etiladi" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const { data, status } = await djangoFetch(
      `/api/teacher/dashboard/${qs ? "?" + qs : ""}`,
      { token }
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("Teacher dashboard error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
