"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatNumber, formatDate } from "@/lib/formatters";
import { localizeEntityName, localizePersonName, useTeacherI18n } from "@/lib/teacher-i18n";
import {
  Eye, User, Info, CheckCircle2, ClipboardList, FolderOpen,
  AlertTriangle, ShieldCheck, ShieldX, Clock, Check, XCircle, MessageSquare,
} from "lucide-react";

type PlanRate = "rate_1" | "rate_0_5" | "rate_0_25";

// --- Types ---
interface OqituvchiInfo {
  id: string;
  fio: string;
  lavozim: string;
  ilmiyDaraja: string;
  ilmiyUnvon: string;
  stavka: number;
  stavkaKodi: string;
  stajYil: number | null;
  kafedraNomi: string | null;
  otmNomi: string | null;
  otmProfil: string;
}

interface TasdiqlashRecord {
  id: string;
  bosqich: string;
  holat: string;
  tekshiruvchiId: string | null;
  izoh: string | null;
  sana: string | null;
  tekshiruvchi: { id: string; fio: string; role: string } | null;
}

interface RejaInfo {
  id: string;
  oquvYiliNomi: string;
  status: string;
  jamiSoat: number;
  minNorm: number;
  maxNorm: number;
  topshiriqlar: TopshiriqRecord[];
  tasdiqlashlar: TasdiqlashRecord[];
  shaxsiyReja?: { activeStavka: PlanRate };
}

interface TopshiriqRecord {
  mashgulotTuri?: string;
  canEditLessonType?: boolean;
  id: string;
  yuklamaTuriId: string;
  fanId: string | null;
  guruhId: string | null;
  semesterRaqami: number;
  soat: number;
  hisobTuri: string;
  formulaInput: string;
  izoh: string | null;
  createdAt: string;
  yuklamaTuri: {
    id: string; nomi: string; kod: string; bandRaqami: number;
    hisobSoatbay: boolean; formulaIfoda: string;
  } | null;
  fan: { id: string; nomi: string } | null;
  guruh: { id: string; nomi: string; talabaSoni: number } | null;
}

const PLAN_RATE_OPTIONS: Array<{ key: PlanRate; label: string }> = [
  { key: "rate_0_25", label: "0.25" },
  { key: "rate_0_5", label: "0.5" },
  { key: "rate_1", label: "1" },
];

function availablePlanRates(rateCode: string): PlanRate[] {
  if (rateCode === "rate_1_5") return ["rate_0_5", "rate_1"];
  if (rateCode.includes("0_25")) return ["rate_0_25"];
  if (rateCode.includes("0_5")) return ["rate_0_5"];
  return ["rate_1"];
}

// --- Color helpers ---
function getSoatColor(soat: number, minimum: number): { text: string } {
  if (soat >= minimum) return { text: "text-emerald-600" };
  if (soat >= minimum * 0.75) return { text: "text-amber-600" };
  return { text: "text-red-600" };
}

export default function TeacherDashboardClient({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { t } = useTeacherI18n();
  const [oqituvchi, setOqituvchi] = useState<OqituvchiInfo | null>(null);
  const [reja, setReja] = useState<RejaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Fetch ---
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/teacher/dashboard");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Xato");
        setOqituvchi(json.oqituvchi);
        setReja(json.reja);
      } catch (err) {
        console.error(err);
        toast.error(t("loadError"));
      }
      setLoading(false);
    }
    load();
  }, [profileId, t]);

  // --- Stats ---
  const tabSoat = useMemo(() => {
    if (!reja) return { s1: 0, s2: 0 };
    const s1 = reja.topshiriqlar.filter((t) => t.semesterRaqami === 1).reduce((s, t) => s + t.soat, 0);
    const s2 = reja.topshiriqlar.filter((t) => t.semesterRaqami === 2).reduce((s, t) => s + t.soat, 0);
    return { s1, s2 };
  }, [reja]);

  // --- Warnings ---
  const warnings = useMemo(() => {
    if (!reja || !oqituvchi) return [];
    const w: string[] = [];

    if (reja.jamiSoat > 0 && reja.jamiSoat < reja.minNorm) {
      w.push(t("lowWorkload", { min: reja.minNorm }));
    }

    if (oqituvchi.lavozim !== "professor" && oqituvchi.lavozim !== "dotsent" && oqituvchi.stajYil != null && oqituvchi.stajYil < 3) {
      const maruzaItems = reja.topshiriqlar.filter((t) => t.yuklamaTuri?.kod === "MARUZA");
      if (maruzaItems.length > 0) {
        w.push(t("lectureExperience"));
      }
    }

    if (oqituvchi.ilmiyDaraja === "yoq") {
      const maruzaTotal = reja.topshiriqlar
        .filter((t) => t.yuklamaTuri?.kod === "MARUZA")
        .reduce((s, t) => s + t.soat, 0);
      if (maruzaTotal > 250) {
        w.push(t("lectureLimit"));
      }
    }

    return w;
  }, [reja, oqituvchi, t]);

  const bosqichConfig = [
    { key: "kafedra", label: t("department") },
    { key: "dekan", label: t("dean") },
    { key: "oquv_bolimi", label: t("education") },
    { key: "yakuniy", label: t("approved") },
  ] as const;

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  // --- No oqituvchi linked ---
  if (!oqituvchi) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">{t("profileMissing")}</h2>
          <p className="mt-2 text-muted-foreground max-w-md">
            {t("profileMissingText")}
          </p>
        </div>
      </div>
    );
  }

  // --- No reja ---
  if (!reja) {
    return (
      <div className="space-y-6">
        <PersonalInfoCard oqituvchi={oqituvchi} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">{t("planMissing")}</h2>
          <p className="mt-2 text-muted-foreground max-w-md">
            {t("planMissingText")}
          </p>
        </div>
      </div>
    );
  }

  const annualTarget = reja.maxNorm || reja.minNorm;
  const soatColor = getSoatColor(reja.jamiSoat, annualTarget);
  const isLoyiha = reja.status === "loyiha";
  const isTasdiqlangan = reja.status === "tasdiqlangan";
  const isRadEtilgan = reja.status === "rad_etilgan";

  // Find rejected stage with reason
  const rejectedStage = (reja.tasdiqlashlar || []).find((t) => t.holat === "rad_etilgan");

  return (
    <div className="space-y-6">
      {/* ===== STATUS BANNER ===== */}
      {isLoyiha && (
        <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            {t("draftInfo")}
          </AlertDescription>
        </Alert>
      )}
      {isTasdiqlangan && (
        <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">
            {t("approvedInfo")}
          </AlertDescription>
        </Alert>
      )}
      {isRadEtilgan && (
        <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-800 dark:text-red-200">
            {t("rejectedInfo")}
            {rejectedStage?.izoh && ` ${t("reason")}: ${rejectedStage.izoh}`}
          </AlertDescription>
        </Alert>
      )}

      {/* ===== PERSONAL INFO CARD ===== */}
      <PersonalInfoCard oqituvchi={oqituvchi} />

      {/* ===== WORKLOAD OVERVIEW ===== */}
      <div className="space-y-4">
        {/* Yearly progress */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("annualWorkload")}</h3>
            <span className={`text-2xl font-bold font-mono ${soatColor.text}`}>
              {formatNumber(reja.jamiSoat)} / {formatNumber(annualTarget)} {t("hours")}
            </span>
          </div>
          <div className="space-y-1.5">
            <Progress
              value={Math.min(reja.jamiSoat, annualTarget)}
              max={annualTarget}
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{reja.jamiSoat >= annualTarget ? t("normReached") : t("hoursNeeded", { hours: formatNumber(annualTarget - reja.jamiSoat) })}</span>
              <span>{Math.round((Math.min(reja.jamiSoat, annualTarget) / annualTarget) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Semester cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1-semester */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("semester1")}</p>
              <span className="text-lg font-bold font-mono">{formatNumber(tabSoat.s1)}</span>
            </div>
            <Progress
              value={Math.min(tabSoat.s1, 200)}
              max={200}
              className="h-2"
            />
          </div>

          {/* 2-semester */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("semester2")}</p>
              <span className="text-lg font-bold font-mono">{formatNumber(tabSoat.s2)}</span>
            </div>
            <Progress
              value={Math.min(tabSoat.s2, 200)}
              max={200}
              className="h-2"
            />
          </div>

          {/* Ijro foizi */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("completion")}</p>
              <span className="text-lg font-bold font-mono text-muted-foreground">0%</span>
            </div>
            <Progress value={0} max={100} className="h-2 [&>div]:bg-muted" />
            <p className="text-[10px] text-muted-foreground">
              {t("comingSoon")}
            </p>
          </div>
        </div>
      </div>

      {/* ===== APPROVAL TIMELINE (horizontal) ===== */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("approval")}
        </h3>

        {/* Horizontal timeline */}
        <div className="flex items-center gap-0">
          {bosqichConfig.map((config, idx) => {
            const t = (reja.tasdiqlashlar || []).find((t) => t.bosqich === config.key);
            const holat = config.key === "yakuniy" && reja.status === "tasdiqlangan"
              ? "tasdiqlangan"
              : t?.holat || "kutmoqda";
            const isDone = holat === "tasdiqlangan";
            const isRejected = holat === "rad_etilgan";
            const isPending = holat === "kutmoqda";

            return (
              <div
                key={config.key}
                className={`flex min-w-0 items-center ${idx < bosqichConfig.length - 1 ? "flex-1" : "shrink-0"}`}
              >
                {/* Stage circle + label */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isDone ? "border-emerald-500 bg-emerald-500 text-white" :
                    isRejected ? "border-red-500 bg-red-500 text-white" :
                    "border-muted-foreground/30 bg-background text-muted-foreground"
                  }`}>
                    {isDone ? <Check className="h-5 w-5" /> : isRejected ? <XCircle className="h-5 w-5" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs font-medium text-center leading-tight ${
                    isDone ? "text-emerald-600" : isRejected ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {config.label}
                  </span>
                  {t?.sana && (
                    <>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(t.sana)}
                      </span>
                      {t?.tekshiruvchi?.fio && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {t.tekshiruvchi.fio}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Connector line */}
                {idx < bosqichConfig.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${isDone ? "bg-emerald-500" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Rejection reason */}
        {rejectedStage && rejectedStage.izoh && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 p-3">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{t("rejectionReason")} ({bosqichConfig.find((b) => b.key === rejectedStage.bosqich)?.label}):</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">{rejectedStage.izoh}</p>
          </div>
        )}
      </div>

      {/* ===== OGohlANTIRISHLAR ===== */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <Alert key={i} className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                {w}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <section className="min-w-0 w-full rounded-xl border bg-card p-3 sm:p-5" aria-label={t("myWorkloads")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("myWorkloads")}</h2>
            <p className="text-sm text-muted-foreground">{reja.oquvYiliNomi} &mdash; {t("workloadCount", { count: reja.topshiriqlar.length })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PLAN_RATE_OPTIONS.filter(({ key }) => availablePlanRates(oqituvchi.stavkaKodi).includes(key)).map(({ key, label }) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/dashboard/teacher/reja/${reja.id}?stavka=${key}`)}
              >
                <Eye className="h-4 w-4" />
                <span>{label} {t("rate")}</span>
              </Button>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

// ===== Personal Info Card =====
function PersonalInfoCard({ oqituvchi }: { oqituvchi: OqituvchiInfo }) {
  const { language, t } = useTeacherI18n();
  const positionLabels: Record<string, string> = {
    associate_professor: t("docent"), dotsent: t("docent"),
    senior_teacher: t("senior"), katta_oqituvchi: t("senior"),
    teacher: t("trainee"), oqituvchi: t("teacherRole"),
    assistant: t("assistant"), assistent: t("assistant"), professor: t("professor"),
  };
  const degreeLabels: Record<string, string> = {
    yoq: t("none"), bachelor: t("bachelor"), master: t("master"), phd: t("phd"),
    fd: t("doctorScience"), dsc: t("doctor"),
  };
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 text-center sm:grid-cols-4 gap-x-6 gap-y-1">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{t("fullName")}</p>
            <p className="text-sm font-semibold truncate">{localizePersonName(oqituvchi.fio, language)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{t("position")}</p>
            <p className="text-sm font-medium">
              {positionLabels[oqituvchi.lavozim] || oqituvchi.lavozim}
              {oqituvchi.ilmiyDaraja !== "yoq" && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  {degreeLabels[oqituvchi.ilmiyDaraja] || oqituvchi.ilmiyDaraja}
                </Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{t("chair")}</p>
            <p className="text-sm font-medium truncate">
              {localizeEntityName(oqituvchi.kafedraNomi, language) || "\u2014"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{t("rateExperience")}</p>
            <p className="text-sm font-medium">
              {oqituvchi.stavka} {t("rate")}
              {oqituvchi.stajYil != null && <> &middot; {oqituvchi.stajYil} {t("year")}</>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

