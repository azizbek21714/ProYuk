import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { djangoFetch } from "@/lib/django";
import RejaShablonPage from "../../../admin/rejalar/[id]/page";

export default async function TeacherRejaPage() {
  const token = (await cookies()).get("token")?.value;
  if (!token) redirect("/login");

  const { data, status } = await djangoFetch("/api/auth/me", { token });
  const profile = data && typeof data === "object"
    ? ((data as Record<string, unknown>).user ?? data) as Record<string, unknown>
    : null;
  if (status !== 200 || profile?.role !== "oqituvchi") redirect("/dashboard/admin");

  return (
    <main className="min-h-screen bg-muted/30 p-3 sm:p-6">
      <RejaShablonPage />
    </main>
  );
}
