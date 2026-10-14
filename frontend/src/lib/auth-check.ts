import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function verifyAuth(): Promise<
  { token: string } | { error: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Avtorizatsiya talab etiladi" },
        { status: 401 }
      ),
    };
  }

  return { token };
}
