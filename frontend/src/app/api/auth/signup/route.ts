import { NextRequest, NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, status } = await djangoFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
  }
}
