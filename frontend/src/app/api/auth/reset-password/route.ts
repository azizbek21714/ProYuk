import { NextRequest, NextResponse } from "next/server";
import { getToken, djangoFetch } from "@/lib/django";

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    const body = await request.json();
    const { data, status } = await djangoFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
