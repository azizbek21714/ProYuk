"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDashboard, ROLE_LABELS } from "@/contexts/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  History,
  ClipboardCheck,
  Shield,
  Edit,
  Trash2,
  Scale,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { useAdminI18n } from "@/lib/admin-i18n";
import { localizePersonName, localized, type TeacherLanguage } from "@/lib/teacher-i18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// --- Types ---
interface DashboardStats {
  jamiOqituvchilar: number;
  tasdiqlanganRejalar: number;
  kutilayotganTasdiqlar: number;
  pastYuklamalarSoni: number;
}

interface BarChartItem {
  id: string;
  fio: string;
  shortName: string;
  jamiSoat: number;
  lavozim?: string;
  minNorm?: number;
  maxNorm?: number;
}

interface KutilayotganAmal {
  rejaId: string;
  bosqich: string;
  oqituvchiFio: string;
  kafedraNomi: string | null;
  oquvYiliNomi: string;
  createdAt: string;
  kunSoni: number;
}

interface AuditLogItem {
  id: string;
  tableName: string;
  action: string;
  kimFio: string;
  kimRole: string;
  rowId: string;
  sana: string;
}

interface DashboardData {
  stats: DashboardStats;
  barChartData: BarChartItem[];
  kutilayotganAmallar: KutilayotganAmal[];
  auditLogs: AuditLogItem[];
}

type WorkloadLevel = "below" | "normal" | "over";

function getWorkloadLevel(soat: number, minNorm = 0, maxNorm = Number.POSITIVE_INFINITY): WorkloadLevel {
  if (soat < minNorm) return "below";
  if (soat <= maxNorm + 10) return "normal";
  return "over";
}

function workloadColor(soat: number, minNorm?: number, maxNorm?: number): string {
  const level = getWorkloadLevel(soat, minNorm, maxNorm);
  if (level === "below") return "#eab308";
  if (level === "over") return "#ef4444";
  return "#22c55e";
}

function getBarColorClass(soat: number, minNorm?: number, maxNorm?: number): string {
  const level = getWorkloadLevel(soat, minNorm, maxNorm);
  if (level === "below") return "text-yellow-600 dark:text-yellow-400";
  if (level === "over") return "text-red-600 dark:text-red-400";
  return "text-green-600 dark:text-green-400";
}

function formatRelativeDate(dateStr: string, language: TeacherLanguage): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return localized(language, "Hozirgina", "Только что", "Just now");
  if (minutes < 60) return localized(language, `${minutes} daqiqa oldin`, `${minutes} мин. назад`, `${minutes} min ago`);
  if (hours < 24) return localized(language, `${hours} soat oldin`, `${hours} ч. назад`, `${hours} hr ago`);
  if (days < 7) return localized(language, `${days} kun oldin`, `${days} дн. назад`, `${days} days ago`);
  return new Date(dateStr).toLocaleDateString(language === "ru" ? "ru-RU" : language === "en" ? "en-GB" : "uz-UZ", { day: "numeric", month: "short" });
}

// --- Custom recharts tooltip ---
function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: BarChartItem }> }) {
  const { language } = useAdminI18n();
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-lg">
      <p className="font-medium text-foreground">{localizePersonName(data.fio, language)}</p>
      <p className={`mt-1 font-mono font-bold ${getBarColorClass(data.jamiSoat, data.minNorm, data.maxNorm)}`}>
        {formatNumber(data.jamiSoat)} {tr("soat", "часов", "hours")}
      </p>
      {(data.minNorm != null && data.maxNorm != null) && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {tr("Me’yor", "Норма", "Standard")}: {data.minNorm}–{data.maxNorm} {tr("soat", "часов", "hours")}
        </p>
      )}
      {data.minNorm != null && data.jamiSoat < data.minNorm && (
        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
          {tr(`Me’yordan ${formatNumber(data.minNorm - data.jamiSoat)} soat kam`, `Ниже нормы на ${formatNumber(data.minNorm - data.jamiSoat)} часов`, `${formatNumber(data.minNorm - data.jamiSoat)} hours below standard`)}
        </p>
      )}
      {data.maxNorm != null && data.jamiSoat > data.maxNorm && (
        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
          {tr(`Me’yordan ${formatNumber(data.jamiSoat - data.maxNorm)} soat ko‘p`, `Выше нормы на ${formatNumber(data.jamiSoat - data.maxNorm)} часов`, `${formatNumber(data.jamiSoat - data.maxNorm)} hours above standard`)}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { profile } = useDashboard();
  const router = useRouter();
  const { language, t } = useAdminI18n();
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Next.js proxy orqali (nisbiy URL) — boshqa qurilmalarda ham ishlaydi
        const res = await fetch(`/api/dashboard/stats`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error("Dashboard stats error:", res.status, errBody);
          throw new Error(errBody?.detail || errBody?.error || `Status: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch {
        // stats endpoint hali tayyor emas — sahifa ishlashda davom etadi
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const translatedRoles: Record<string, string> = {
    admin: t("admin"), oquv_bolimi: t("education"), dekan: t("dean"), kafedra_mudiri: t("departmentHead"),
  };
  const roleLabel = profile?.role
    ? translatedRoles[profile.role] || ROLE_LABELS[profile.role] || profile.role
    : t("admin");
  const bosqichLabels: Record<string, string> = {
    kafedra: tr("Kafedra", "Кафедра", "Department"), dekan: tr("Dekan", "Декан", "Dean"),
    oquv_bolimi: tr("O‘quv bo‘limi", "Учебный отдел", "Academic affairs"),
  };
  const tableLabels: Record<string, string> = {
    shaxsiy_reja: tr("Shaxsiy reja", "Индивидуальный план", "Individual plan"),
    tasdiqlash: tr("Tasdiqlash", "Утверждение", "Approval"), topshiriq: tr("Topshiriq", "Задание", "Assignment"),
    oqituvchi: tr("O‘qituvchi", "Преподаватель", "Teacher"), fan: tr("Fan", "Дисциплина", "Subject"), guruh: tr("Guruh", "Группа", "Group"),
  };
  const actionLabels: Record<string, { label: string; icon: typeof Edit; color: string }> = {
    create: { label: tr("Yaratildi", "Создано", "Created"), icon: Edit, color: "text-blue-500" },
    update: { label: tr("Yangilandi", "Обновлено", "Updated"), icon: Edit, color: "text-amber-500" },
    delete: { label: tr("O‘chirildi", "Удалено", "Deleted"), icon: Trash2, color: "text-red-500" },
    tasdiqlash: { label: tr("Tasdiqlandi", "Утверждено", "Approved"), icon: CheckCircle2, color: "text-emerald-500" },
    rad_etish: { label: tr("Rad etildi", "Отклонено", "Rejected"), icon: AlertTriangle, color: "text-red-500" },
    status_update: { label: tr("Status o‘zgardi", "Статус изменён", "Status changed"), icon: History, color: "text-purple-500" },
  };
  // Sort bar chart by jamiSoat descending for display
  const sortedChartData = useMemo(() => {
    if (!data?.barChartData) return [];
    return [...data.barChartData]
      .sort((a, b) => b.jamiSoat - a.jamiSoat)
      .map((item) => ({
        ...item,
        shortName: localizePersonName(item.shortName || item.fio, language),
      }));
  }, [data?.barChartData, language]);

  // Y o'qi: 100 oraliqda (0-100-...-1000), kerak bo'lsa kengayadi
  const yMax = useMemo(() => {
    const m = sortedChartData.reduce((mx, d) => Math.max(mx, d.jamiSoat, d.maxNorm ?? 0), 0);
    return Math.max(1000, Math.ceil(m / 100) * 100);
  }, [sortedChartData]);
  const yTicks = useMemo(() => {
    const arr: number[] = [];
    for (let v = 0; v <= yMax; v += 100) arr.push(v);
    return arr;
  }, [yMax]);
  const chartMaxNorm = useMemo(
    () => sortedChartData.reduce((max, item) => Math.max(max, item.maxNorm ?? 0), 0),
    [sortedChartData],
  );

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const stats = data?.stats || {
    jamiOqituvchilar: 0,
    tasdiqlanganRejalar: 0,
    kutilayotganTasdiqlar: 0,
    pastYuklamalarSoni: 0,
  };

  return (
    <div className="space-y-6">
      {/* ===== WELCOME HEADING ===== */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("dashboard")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {localizePersonName(profile?.fio, language) || t("user")} — {roleLabel}. {tr("Tizim ko‘rsatkichlari va amallar.", "Показатели системы и действия.", "System metrics and actions.")}
        </p>
      </div>

      {/* ===== TOP ROW: 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Jami o'qituvchilar */}
        <StatCard
          icon={Users}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          value={stats.jamiOqituvchilar}
          label={tr("Jami o‘qituvchilar", "Всего преподавателей", "Total teachers")}
          description={profile?.role === "kafedra_mudiri" ? tr("Kafedra bo‘yicha", "По кафедре", "By department") : tr("Barcha kafedralar", "Все кафедры", "All departments")}
        />

        {/* Card 2: Tasdiqlangan rejalar */}
        <StatCard
          icon={CheckCircle2}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          value={stats.tasdiqlanganRejalar}
          label={tr("Tasdiqlangan rejalar", "Утверждённые планы", "Approved plans")}
          description={tr("Joriy o‘quv yili", "Текущий учебный год", "Current academic year")}
        />

        {/* Card 3: Kutilayotgan tasdiqlar */}
        <StatCard
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          value={stats.kutilayotganTasdiqlar}
          label={tr("Kutilayotgan tasdiqlar", "Ожидают утверждения", "Pending approvals")}
          description={tr("Siz tasdiqlashingiz kerak", "Требуют вашего утверждения", "Require your approval")}
          highlight={stats.kutilayotganTasdiqlar > 0}
        />

        {/* Card 4: Past yuklamalilar */}
        <StatCard
          icon={AlertTriangle}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
          value={stats.pastYuklamalarSoni}
          label={tr("Past yuklamalilar", "Нагрузка ниже нормы", "Below workload standard")}
          description={tr("Me’yordan kam", "Ниже нормы", "Below standard")}
          highlight={stats.pastYuklamalarSoni > 0}
        />
      </div>

      {/* ===== MIDDLE SECTION: CHART + SIDEBAR ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  {tr("O‘qituvchilar yuklama taqsimoti", "Распределение нагрузки преподавателей", "Teacher workload distribution")}
                </CardTitle>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  {tr("Me’yorida (+10 gacha)", "В норме (до +10)", "Within range (up to +10)")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  {tr("Minimumdan kam", "Ниже минимума", "Below minimum")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  {tr("Maksimumdan 10+", "Более чем на 10 выше максимума", "Over maximum by more than 10")}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tr("O‘qituvchilar yuklamasi haqida ma’lumot yo‘q", "Нет данных о нагрузке преподавателей", "No teacher workload data")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {tr("Shaxsiy ish rejalari yaratilgach, bu yerda ko‘rinadi", "Данные появятся после создания индивидуальных планов", "Data will appear after individual plans are created")}
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={sortedChartData}
                  margin={{ top: 8, right: 8, left: -10, bottom: 60 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.65}
                  />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    domain={[0, yMax]}
                    ticks={yTicks}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    cursor={{
                      fill: "var(--muted)",
                      fillOpacity: 0.45,
                      stroke: "var(--border)",
                      strokeWidth: 1,
                    }}
                    content={<CustomBarTooltip />}
                  />
                  {chartMaxNorm > 0 && <ReferenceLine
                    y={chartMaxNorm}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{
                      value: tr(`Eng yuqori me’yor ${chartMaxNorm}`, `Максимальная норма ${chartMaxNorm}`, `Maximum standard ${chartMaxNorm}`),
                      position: "insideTopRight",
                      fill: "#ef4444",
                      fontSize: 11,
                    }}
                  />}
                  <Bar
                    dataKey="jamiSoat"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  >
                    {sortedChartData.map((entry, index) => (
                      <Cell key={index} fill={workloadColor(entry.jamiSoat, entry.minNorm, entry.maxNorm)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Kutilayotgan amallar */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base font-semibold">
                  {tr("Kutilayotgan amallar", "Ожидаемые действия", "Pending actions")}
                </CardTitle>
              </div>
              {stats.kutilayotganTasdiqlar > 0 && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                  {stats.kutilayotganTasdiqlar}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {(!data?.kutilayotganAmallar || data.kutilayotganAmallar.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {tr("Kutilayotgan amallar yo‘q", "Нет ожидаемых действий", "No pending actions")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {tr("Barcha rejalar ko‘rib chiqilgan", "Все планы рассмотрены", "All plans have been reviewed")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.kutilayotganAmallar.slice(0, 3).map((amal) => (
                  <button
                    key={`${amal.rejaId}-${amal.bosqich}`}
                    onClick={() => router.push(`/dashboard/admin/rejalar/${amal.rejaId}`)}
                    className="w-full text-left rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all p-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {localizePersonName(amal.oqituvchiFio, language)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {bosqichLabels[amal.bosqich] || amal.bosqich}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {amal.oquvYiliNomi}
                          </span>
                        </div>
                        {amal.kunSoni > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {tr(`${amal.kunSoni} kun oldin yuborilgan`, `Отправлено ${amal.kunSoni} дн. назад`, `Sent ${amal.kunSoni} days ago`)}
                          </p>
                        )}
                        {amal.kunSoni === 0 && (
                          <p className="text-xs text-emerald-600 mt-1">
                            {tr("Bugun yuborilgan", "Отправлено сегодня", "Sent today")}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
                {stats.kutilayotganTasdiqlar > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => router.push("/dashboard/admin/rejalar")}
                  >
                    {tr("Barchasini ko‘rish", "Посмотреть все", "View all")} ({stats.kutilayotganTasdiqlar})
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== BOTTOM: So'nggi o'zgarishlar ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              {tr("So‘nggi o‘zgarishlar", "Последние изменения", "Recent changes")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(!data?.auditLogs || data.auditLogs.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {tr("Hali o‘zgarishlar yo‘q", "Изменений пока нет", "No changes yet")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {tr("Amallar bajarilgach, bu yerda ko‘rinadi", "Изменения появятся после выполнения действий", "Changes will appear after actions are performed")}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {data.auditLogs.map((log, i) => {
                  const actionInfo = actionLabels[log.action] || {
                    label: log.action,
                    icon: History,
                    color: "text-muted-foreground",
                  };
                  const ActionIcon = actionInfo.icon;

                  return (
                    <div key={log.id} className="flex gap-4 relative">
                      {/* Timeline dot */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background z-10 ${actionInfo.color}`}>
                        <ActionIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {localizePersonName(log.kimFio, language)}
                          </span>
                          {log.kimRole && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {translatedRoles[log.kimRole] || ROLE_LABELS[log.kimRole as keyof typeof ROLE_LABELS] || log.kimRole}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            — {actionInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tableLabels[log.tableName] || log.tableName}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {formatRelativeDate(log.sana, language)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Stat Card Component ---
function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  description,
  highlight = false,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/[0.02]" : ""}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground mt-1">
              {formatNumber(value)}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 truncate">
              {description}
            </p>
          </div>
          <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 sm:h-5.5 sm:w-5.5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
