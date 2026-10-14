import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth-check";
import { djangoProxy } from "@/lib/django";

export async function GET(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fakultetlar");
}

export async function POST(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fakultetlar");
}

export async function PUT(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fakultetlar");
}

export async function DELETE(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;
  return djangoProxy(request, "fakultetlar");
}
