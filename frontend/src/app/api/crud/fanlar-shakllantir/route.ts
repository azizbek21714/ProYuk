import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth-check";
import { djangoProxy } from "@/lib/django";

// Kafedra yuklama_data sidan fanlarni (Subject) shakllantiradi (dedup bilan)
export async function POST(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fanlar-shakllantir");
}

// Kafedra yuklamasi + undan shakllangan barcha fanlarni o'chiradi
export async function DELETE(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fanlar-shakllantir");
}
