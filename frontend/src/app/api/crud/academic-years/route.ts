import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth-check";
import { djangoProxy } from "@/lib/django";

export async function GET(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  const url = new URL(request.url);
  url.searchParams.set("type", "academic_year");
  return djangoProxy(new NextRequest(url, { method: request.method, headers: request.headers }), "normativlar");
}
