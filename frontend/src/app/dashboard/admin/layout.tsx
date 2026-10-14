"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard, ROLE_LABELS, LAVOZIM_LABELS } from "@/contexts/dashboard-context";
import { djangoLogout } from "@/lib/django-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Landmark,
  Settings,
  LogOut,
  Menu,
  Scale,
  ClipboardList,
  Check,
} from "lucide-react";
import { localizePersonName } from "@/lib/teacher-i18n";
import { setAdminLanguage, useAdminI18n, type AdminLanguage } from "@/lib/admin-i18n";
import { AdminTranslationLayer } from "@/components/admin/admin-translation-layer";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  labelKey: "dashboard" | "university" | "teachers" | "subjects" | "groups" | "workload" | "workloadBuilder" | "norms";
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { labelKey: "university", href: "/dashboard/admin/otm", icon: Landmark },
  { labelKey: "teachers", href: "/dashboard/admin/oqituvchilar", icon: Users },
  { labelKey: "subjects", href: "/dashboard/admin/fanlar", icon: BookOpen },
  { labelKey: "groups", href: "/dashboard/admin/guruhlar", icon: GraduationCap },
  { labelKey: "workload", href: "/dashboard/admin/yuklama", icon: Scale },
  { labelKey: "workloadBuilder", href: "/dashboard/admin/yuklama-shakllantirish", icon: ClipboardList },
  { labelKey: "norms", href: "/dashboard/admin/normativlar", icon: Settings },
];

const LANGUAGES: Array<{ code: AdminLanguage; flagSrc: string; label: string }> = [
  { code: "uz", flagSrc: "/flags/uz.svg", label: "O‘zbek" },
  { code: "ru", flagSrc: "/flags/ru.svg", label: "Русский" },
  { code: "en", flagSrc: "/flags/en.svg", label: "English" },
];

function FlagCircle({ src, label }: { src: string; label: string }) {
  return <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted shadow-sm ring-1 ring-border"><img src={src} alt={label} className="h-full w-full object-cover" /></span>;
}

function SidebarNav({
  onNavigate,
  onSignOut,
}: {
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const { profile } = useDashboard();
  const { t } = useAdminI18n();

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || profile?.role === "admin"
  );

  return (
    <nav className="flex h-full flex-col px-2">
      <div className="flex flex-col gap-1">
        {filteredItems.map((item) => {
          const isActive =
            item.href === "/dashboard/admin"
              ? pathname === "/dashboard/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-white font-semibold text-primary shadow-sm dark:bg-primary/15 dark:text-primary dark:shadow-none"
                  : "text-white/80 hover:bg-white/10 hover:text-white dark:text-sidebar-foreground/75 dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-1 justify-start gap-3 px-3 text-white/80 hover:bg-white/10 hover:text-white dark:text-sidebar-foreground/75 dark:hover:bg-destructive/15 dark:hover:text-red-300"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>{t("logout")}</span>
      </Button>
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useDashboard();
  const { language, t } = useAdminI18n();

  // Role-based access: oqituvchi should not access admin dashboard
  useEffect(() => {
    if (profile?.role === "oqituvchi") {
      router.push("/dashboard/teacher");
    }
  }, [profile, router]);

  const translatedRoles: Record<string, string> = {
    admin: t("admin"), oquv_bolimi: t("education"), dekan: t("dean"), kafedra_mudiri: t("departmentHead"),
  };
  const roleLabel = profile?.role ? translatedRoles[profile.role] || ROLE_LABELS[profile.role] || profile.role : t("position");
  // Lavozim (o'qituvchilar bo'limidan) — bo'lmasa role ko'rsatiladi
  const positionLabels: Record<string, string> = language === "ru" ? {
    professor: "Профессор", associate_professor: "Доцент", senior_teacher: "Старший преподаватель",
    teacher: "Преподаватель-стажёр", assistant: "Ассистент",
  } : language === "en" ? {
    professor: "Professor", associate_professor: "Associate professor", senior_teacher: "Senior teacher",
    teacher: "Trainee teacher", assistant: "Assistant",
  } : LAVOZIM_LABELS;
  const lavozimLabel = profile?.lavozim
    ? positionLabels[profile.lavozim] || profile.lavozim
    : roleLabel;
  const currentPage = navItems.find((item) =>
    item.href === "/dashboard/admin"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const currentPageLabel = currentPage ? t(currentPage.labelKey) : t("dashboard");
  const displayName = localizePersonName(profile?.fio, language) || t("user");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await djangoLogout();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col bg-primary text-white dark:bg-sidebar md:flex">
          <Link href="/dashboard/admin" className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-sm">
              <img src="/ustoz-logo.png" alt="ProYuk" className="h-8 w-8 rounded-lg" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              Pro<span className="text-white/75 dark:text-primary">Yuk</span>
            </span>
          </Link>
          <div className="min-h-0 flex-1 overflow-y-auto py-5">
            <SidebarNav onSignOut={() => setSignOutOpen(true)} />
          </div>
          <div className="border-t border-white/10 px-5 py-4 text-[11px] text-white/55 dark:text-sidebar-foreground/45">
            ProYuk • 3076-son me’yor
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="z-40 shrink-0 border-b bg-card/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:h-20">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">{t("menu")}</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex w-64 flex-col border-white/10 bg-primary p-0 text-white dark:bg-sidebar [&>button]:text-white">
                    <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
                    <Link href="/dashboard/admin" onClick={() => setOpen(false)} className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95">
                        <img src="/ustoz-logo.png" alt="ProYuk" className="h-8 w-8 rounded-lg" />
                      </span>
                      <span className="text-xl font-bold">ProYuk</span>
                    </Link>
                    <div className="min-h-0 flex-1 py-5">
                      <SidebarNav
                        onNavigate={() => setOpen(false)}
                        onSignOut={() => {
                          setOpen(false);
                          setSignOutOpen(true);
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {currentPageLabel}
                  </p>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {t("dashboard")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={t("language")} title={t("language")}>
                      <FlagCircle src={LANGUAGES.find((item) => item.code === language)?.flagSrc || "/flags/uz.svg"} label={LANGUAGES.find((item) => item.code === language)?.label || "O‘zbek"} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-36">
                    {LANGUAGES.map((item) => (
                      <DropdownMenuItem key={item.code} className="gap-3 py-2" onSelect={() => setAdminLanguage(item.code)}>
                        <FlagCircle src={item.flagSrc} label={item.label} />
                        <span className="font-medium lowercase">{item.code}</span>
                        {language === item.code && <Check className="ml-auto h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Separator orientation="vertical" className="hidden h-8 sm:block" />
                <div className="hidden flex-col items-end lg:flex">
                  <span className="max-w-48 truncate text-sm font-semibold text-foreground">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{lavozimLabel}</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/15">
                  {initials || "P"}
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto bg-muted/60">
            <div className="flex min-h-full flex-col">
              <div className="flex-1 p-4 sm:p-6 lg:p-7">
                <AdminTranslationLayer language={language}>{children}</AdminTranslationLayer>
              </div>
              <footer className="border-t border-border/70 bg-background/60">
                <div className="px-4 py-4 sm:px-6">
                  <p className="text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} ProYuk. {t("footer")}
                  </p>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>

      {/* Chiqishni tasdiqlash oynasi (markazda, tashqariga bosilsa yopiladi) */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl">{t("logoutTitle")}</DialogTitle>
            <DialogDescription className="text-base">
              {t("logoutQuestion")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 mt-2">
            <Button variant="outline" size="lg" className="min-w-[100px]" onClick={() => setSignOutOpen(false)}>
              {t("no")}
            </Button>
            <Button
              size="lg"
              onClick={handleSignOut}
              className="min-w-[100px] bg-destructive text-white hover:bg-destructive/90"
            >
              {t("yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
