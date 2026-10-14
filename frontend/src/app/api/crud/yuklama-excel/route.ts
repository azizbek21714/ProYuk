import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-check";
import { DJANGO_BASE, getToken } from "@/lib/django";

// Excel faylni (multipart/form-data) Django yuklama-excel endpointiga uzatadi.
// Umumiy djangoProxy faqat JSON bilan ishlagani uchun alohida route.
export async function POST(request: NextRequest) {
  const check = await verifyAuth();
  if ("error" in check) return check.error;

  const token = getToken(request);
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Fayl yuborilmadi. 'file' maydonida Excel fayl yuboring." },
        { status: 400 }
      );
    }

    const fwd = new FormData();
    fwd.append("file", file, (file as File).name || "upload.xlsx");
    // save / department_id parametrlarini ham uzatamiz (server-side saqlash uchun)
    const save = incoming.get("save");
    if (typeof save === "string") fwd.append("save", save);
    const departmentId = incoming.get("department_id");
    if (typeof departmentId === "string") fwd.append("department_id", departmentId);

    const res = await fetch(`${DJANGO_BASE}/api/crud/yuklama-excel/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fwd,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[yuklama-excel proxy]", err);
    return NextResponse.json(
      { error: "Backend bilan ulanishda xato" },
      { status: 502 }
    );
  }
}
