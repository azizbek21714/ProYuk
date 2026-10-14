"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, LogOut } from "lucide-react";
import type { ProfileData } from "@/contexts/dashboard-context";
import { djangoLogout } from "@/lib/django-client";
import { localizePersonName, setTeacherLanguage, useTeacherI18n, type TeacherLanguage } from "@/lib/teacher-i18n";
import { ThemeToggle } from "@/components/theme-toggle";

interface TeacherShellProps {
  children: React.ReactNode;
  profile: ProfileData | null;
}

const LANGUAGES: Array<{ code: TeacherLanguage; flagSrc: string; label: string }> = [
  { code: "uz", flagSrc: "/flags/uz.svg", label: "O‘zbek" },
  { code: "ru", flagSrc: "/flags/ru.svg", label: "Русский" },
  { code: "en", flagSrc: "/flags/en.svg", label: "English" },
];

function FlagCircle({ src, label }: { src: string; label: string }) {
  return (
    <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted shadow-sm ring-1 ring-border">
      <img src={src} alt={label} className="h-full w-full object-cover" />
    </span>
  );
}

export default function TeacherDashboardShell({
  children,
  profile,
}: TeacherShellProps) {
  const router = useRouter();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const { language, t } = useTeacherI18n();

  async function handleSignOut() {
    await djangoLogout();
    router.push("/login");
    router.refresh();
  }

  const positionLabels: Record<string, string> = {
    professor: t("professor"),
    associate_professor: t("docent"),
    senior_teacher: t("senior"),
    teacher: t("trainee"),
    assistant: t("assistant"),
  };
  const roleLabel = profile?.lavozim
    ? positionLabels[profile.lavozim] || profile.lavozim
    : t("teacherRole");

  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="z-50 w-full shrink-0 border-b bg-card/95 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2">
              <img
                src="/ustoz-logo.png"
                alt="ProYuk"
                className="h-8 w-8 rounded-lg"
              />
              <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline">
                Pro<span className="text-primary">Yuk</span>
              </span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">
                {localizePersonName(profile?.fio, language) || t("user")}
              </span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-6" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label={t("language")}
                  title={t("language")}
                >
                  <FlagCircle
                    src={LANGUAGES.find((item) => item.code === language)?.flagSrc || "/flags/uz.svg"}
                    label={LANGUAGES.find((item) => item.code === language)?.label || "O‘zbek"}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-36">
                {LANGUAGES.map((item) => (
                  <DropdownMenuItem
                    key={item.code}
                    className="gap-3 py-2"
                    onSelect={() => setTeacherLanguage(item.code)}
                  >
                    <FlagCircle src={item.flagSrc} label={item.label} />
                    <span className="font-medium lowercase">{item.code}</span>
                    <span className="sr-only">{item.label}</span>
                    {language === item.code && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-y-auto bg-muted/60">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} ProYuk. {t("footer")}
          </p>
        </div>
      </footer>
      </div>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="max-w-md p-8">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl">{t("logoutTitle")}</DialogTitle>
            <DialogDescription className="text-base">
              {t("logoutQuestion")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-3 sm:justify-center">
            <Button
              variant="outline"
              size="lg"
              className="min-w-[100px]"
              onClick={() => setSignOutOpen(false)}
            >
              {t("no")}
            </Button>
            <Button
              size="lg"
              className="min-w-[100px] bg-destructive text-white hover:bg-destructive/90"
              onClick={handleSignOut}
            >
              {t("yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
