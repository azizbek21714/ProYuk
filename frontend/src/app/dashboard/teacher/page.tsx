import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TeacherDashboardShell from "./teacher-shell";
import TeacherDashboardClient from "./teacher-client";
import { djangoFetch } from "@/lib/django";
import type { ProfileData } from "@/contexts/dashboard-context";

export default async function TeacherDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
  }

  const { data, status } = await djangoFetch("/api/auth/me", { token });

  if (status !== 200 || !data) {
    redirect("/login");
  }

  const d = data as Record<string, unknown>;
  const profile = ((d.user ?? d) as unknown) as ProfileData;

  if (!profile?.id) {
    redirect("/login");
  }

  if (profile.role && profile.role !== "oqituvchi") {
    redirect("/dashboard/admin");
  }

  return (
    <TeacherDashboardShell profile={profile}>
      <TeacherDashboardClient profileId={profile.id} />
    </TeacherDashboardShell>
  );
}
