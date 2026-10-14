import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardProvider, type ProfileData } from "@/contexts/dashboard-context";
import { djangoFetch } from "@/lib/django";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <DashboardProvider profile={profile}>
      {children}
    </DashboardProvider>
  );
}
