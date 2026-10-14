"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useDashboard } from "@/contexts/dashboard-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Filter,
  GraduationCap,
  Building2,
  Library,
  Clock,
  Globe,
  ClipboardList,
  Loader2,
  BookMarked,
  CalendarDays,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface OtmRecord {
  id: string;
  nomi: string;
}

interface FakultetRecord {
  id: string;
  nomi: string;
  otmId: string;
}

interface KafedraRecord {
  id: string;
  nomi: string;
  fakultetId: string;
  yillikYuklama?: number;
}

interface FanRecord {
  id: string;
  kafedraId: string;
  nomi: string;
  kurs: number;
  talimTuri: string;
  semesterRaqami: number;
  semesterFasl: string;
  mashgulotTili: string;
  mashgulotTillari: string[];
  maruzaSoat: number;
  amaliyotSoat: number;
  laboratoriyaSoat: number;
  seminarSoat: number;
  jamiSoat: number;
  kafedra: {
    id: string;
    nomi: string;
    fakultet?: {
      id: string;
      nomi: string;
      otmId?: string;
      otm?: { id: string; nomi: string };
    } | null;
  } | null;
}

// ──────────────────────────────────────────────
// Django field normalizers (name -> nomi, numeric id -> string)
// ──────────────────────────────────────────────
 
const normOtm = (x: any) => ({ ...x, id: String(x.id), nomi: x.nomi || x.name || "" });
 
const normFak = (x: any) => ({
  ...x,
  id: String(x.id),
  nomi: x.nomi || x.name || "",
  otmId: String(
    x.otmId ?? x.otm_id ?? x.department ?? (typeof x.otm === "object" ? x.otm?.id : x.otm) ?? ""
  ),
});
 
const normKaf = (x: any) => ({
  ...x,
  id: String(x.id),
  nomi: x.nomi || x.name || "",
  fakultetId: String(
    x.fakultetId ?? x.fakultet_id ?? x.faculty ?? (typeof x.fakultet === "object" ? x.fakultet?.id : x.fakultet) ?? ""
  ),
});

// ──────────────────────────────────────────────
// Frontend <-> Django Subject value mapping
//   talimTuri  <-> program_type + study_format
//   kurs (1-5) <-> course_N        semesterRaqami <-> semester_N
//   tili       <-> study_language  jamiSoat       <-> hours
// ──────────────────────────────────────────────
function talimToDjango(talim: string): { program_type: string; study_format: string } {
  switch (talim) {
    case "magistr":
      return { program_type: "master", study_format: "full_time" };
    case "sirtqi":
    case "sirtqi_2ot":
      return { program_type: "bachelor", study_format: "part_time" };
    case "masofaviy":
      return { program_type: "bachelor", study_format: "distance" };
    default: // bakalavr
      return { program_type: "bachelor", study_format: "full_time" };
  }
}

function djangoToTalim(programType: string, studyFormat: string): string {
  if (programType === "master") return "magistr";
  if (studyFormat === "distance") return "masofaviy";
  if (studyFormat === "part_time" || studyFormat === "evening") return "sirtqi";
  return "bakalavr";
}

const TILI_TO_DJANGO: Record<string, string> = { uz: "uz", rus: "ru", eng: "en" };
const DJANGO_TO_TILI: Record<string, string> = { uz: "uz", ru: "rus", en: "eng" };

function numFromChoice(v: unknown): number {
  const m = String(v ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Django Subject -> frontend FanRecord shape
 
function normFanRecord(x: any): FanRecord {
  const semesterRaqami = numFromChoice(x.semester);
  const maruzaSoat = Number(x.maruza_hours) || 0;
  const amaliyotSoat = Number(x.amaliyot_hours) || 0;
  const laboratoriyaSoat = Number(x.laboratoriya_hours) || 0;
  const seminarSoat = Number(x.seminar_hours) || 0;
  const breakdownSum = maruzaSoat + amaliyotSoat + laboratoriyaSoat + seminarSoat;
  const hours = Number(x.hours) || 0;

  // study_languages is a comma-separated list; fall back to single study_language
  const rawTillar: string[] = String(x.study_languages ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const djangoTillar = rawTillar.length ? rawTillar : [String(x.study_language ?? "uz")];
  const mashgulotTillari = djangoTillar.map((t) => DJANGO_TO_TILI[t] ?? "uz");

  return {
    id: String(x.id),
    kafedraId: x.department != null ? String(x.department) : "",
    nomi: x.nomi || x.name || "",
    kurs: numFromChoice(x.course),
    talimTuri: djangoToTalim(x.program_type, x.study_format),
    semesterRaqami,
    semesterFasl: semesterRaqami ? getSemestrFasl(semesterRaqami) : "",
    mashgulotTili: mashgulotTillari[0] ?? "uz",
    mashgulotTillari,
    // Per-type breakdown; older rows with only `hours` collapse into maruza
    maruzaSoat: breakdownSum > 0 ? maruzaSoat : hours,
    amaliyotSoat,
    laboratoriyaSoat,
    seminarSoat,
    jamiSoat: breakdownSum > 0 ? breakdownSum : hours,
    kafedra: x.kafedra ?? null,
  };
}

// frontend payload -> Django Subject payload
function mapFanToDjango(
  p: Record<string, unknown>,
  id: string | null
): Record<string, unknown> {
  const kurs = Number(p.kurs) || 1;
  const sem = Number(p.semesterRaqami) || 1;
  const { program_type, study_format } = talimToDjango(String(p.talimTuri));
  // Frontend tili codes -> Django codes. Multiple languages allowed.
  const tillar = Array.isArray(p.mashgulotTillari) ? (p.mashgulotTillari as string[]) : [];
  const djangoTillar = tillar.map((t) => TILI_TO_DJANGO[t] ?? "uz");
  const out: Record<string, unknown> = {
    name: String(p.nomi ?? "").trim(),
    department: Number(p.kafedraId),
    course: `course_${kurs}`,
    program_type,
    study_format,
    semester: `semester_${sem}`,
    // study_language kept for back-compat (first selected); study_languages holds all
    study_language: djangoTillar[0] ?? "uz",
    study_languages: djangoTillar.join(","),
    maruza_hours: Number(p.maruzaSoat) || 0,
    amaliyot_hours: Number(p.amaliyotSoat) || 0,
    laboratoriya_hours: Number(p.laboratoriyaSoat) || 0,
    seminar_hours: Number(p.seminarSoat) || 0,
    hours: Number(p.jamiSoat) || 0,
  };
  if (id) out.id = id;
  return out;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const KURS_OPTIONS: Record<string, number[]> = {
  bakalavr: [1, 2, 3, 4],
  magistr: [1, 2],
  sirtqi: [1, 2, 3, 4, 5],
  sirtqi_2ot: [2, 3, 4, 5],
  masofaviy: [1, 2, 3, 4],
};

const TALIM_TURI_OPTIONS: { value: string; label: string }[] = [
  { value: "bakalavr", label: "Bakalavr" },
  { value: "magistr", label: "Magistr" },
  { value: "sirtqi", label: "Sirtqi" },
  { value: "sirtqi_2ot", label: "Sirtqi 2-OT" },
  { value: "masofaviy", label: "Masofaviy" },
];

const TALIM_TURI_LABELS: Record<string, string> = {
  bakalavr: "Bakalavr",
  magistr: "Magistr",
  sirtqi: "Sirtqi",
  sirtqi_2ot: "Sirtqi 2-OT",
  masofaviy: "Masofaviy",
};

const FASL_OPTIONS: { value: string; label: string }[] = [
  { value: "bohorgi", label: "Bohorgi" },
  { value: "kuzgi", label: "Kuzgi" },
];

const FASL_LABELS: Record<string, string> = {
  bohorgi: "Bohorgi",
  kuzgi: "Kuzgi",
};

const MASHGULOT_TILI_OPTIONS: { value: string; label: string }[] = [
  { value: "uz", label: "O'zbek" },
  { value: "rus", label: "Rus" },
  { value: "eng", label: "Ingliz" },
];

const MASHGULOT_TILI_LABELS: Record<string, string> = {
  uz: "O'zbek",
  rus: "Rus",
  eng: "Ingliz",
};

const MASHGULOT_TURI_COLOR: Record<string, string> = {
  maruza: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
  amaliyot: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  laboratoriya: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
  seminar: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

// Kurs → Semestr mapping: which semesters are available for each kurs in each talim turi
const KURS_TO_SEMESTER: Record<string, Record<number, number[]>> = {
  bakalavr: { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8] },
  magistr: { 1: [1, 2], 2: [3, 4] },
  sirtqi: { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10] },
  sirtqi_2ot: { 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10] },
  masofaviy: { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8] },
};

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Avtomatik fasl: juft semestr → Bahorgi, toq semestr → Kuzgi
function getSemestrFasl(semesterNum: number): string {
  return semesterNum % 2 === 0 ? "bohorgi" : "kuzgi";
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export default function FanlarPage() {
  const { academicYears } = useDashboard();
  // --- Dialog state ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [editingFanId, setEditingFanId] = useState<string | null>(null);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nomi: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Dialog cascading selects ---
  const [dOtm, setDOtm] = useState("");
  const [dFakList, setDFakList] = useState<FakultetRecord[]>([]);
  const [dFakultet, setDFakultet] = useState("");
  const [dKafList, setDKafList] = useState<KafedraRecord[]>([]);
  const [dKafedra, setDKafedra] = useState("");

  // --- Dialog form fields ---
  const [dFanNomi, setDFanNomi] = useState("");
  const [dTalimTuri, setDTalimTuri] = useState("");
  const [dKurs, setDKurs] = useState("");
  const [dSemestrRaqami, setDSemestrRaqami] = useState("");
  const [dSemestrFasl, setDSemestrFasl] = useState("");
  const [dTillar, setDTillar] = useState<string[]>([]);

  // --- Soat fields (per mashg'ulot shakli) ---
  const [dMaruzaSoat, setDMaruzaSoat] = useState<number>(0);
  const [dAmaliyotSoat, setDAmaliyotSoat] = useState<number>(0);
  const [dLaboratoriyaSoat, setDLaboratoriyaSoat] = useState<number>(0);
  const [dSeminarSoat, setDSeminarSoat] = useState<number>(0);

  // --- Add mode: yillik yuklama ---
  const [dKafedraYuklama, setDKafedraYuklama] = useState<number>(0);
  const [dKafedraYuklamaSemestr, setDKafedraYuklamaSemestr] = useState<string>("");
  const [dShowYuklama, setDShowYuklama] = useState<boolean>(false);

  // --- "Fanlar jadvali" cascade filtri (OTM→Fakultet→Kafedra→O'quv yili→Semestr) ---
  const [y2Otm, setY2Otm] = useState("");
  const [y2FakList, setY2FakList] = useState<FakultetRecord[]>([]);
  const [y2Fak, setY2Fak] = useState("");
  const [y2KafList, setY2KafList] = useState<KafedraRecord[]>([]);
  const [y2Kaf, setY2Kaf] = useState("");
  const [y2OquvYili, setY2OquvYili] = useState("");
  const [y2Semestr, setY2Semestr] = useState<"all" | "kuzgi" | "bahorgi">("all");
  const [y2Fans, setY2Fans] = useState<FanRecord[]>([]);
  const [y2Loading, setY2Loading] = useState(false);

  // --- Lists ---
  const [otmList, setOtmList] = useState<OtmRecord[]>([]);
  const [fanList, setFanList] = useState<FanRecord[]>([]);

  // --- Loading states ---
  const [loadingOtm, setLoadingOtm] = useState(true);
  const [loadingFan, setLoadingFan] = useState(true);

  // --- Computed: edit mode jami soat ---
  const dEditJamiSoat = useMemo(() => {
    return dMaruzaSoat + dAmaliyotSoat + dLaboratoriyaSoat + dSeminarSoat;
  }, [dMaruzaSoat, dAmaliyotSoat, dLaboratoriyaSoat, dSeminarSoat]);

  // --- Dialog cascading API calls ---
  const dFetchFakultetlar = useCallback(async (otmId: string) => {
    try {
      const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      setDFakList(list.map(normFak));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const dFetchKafedralar = useCallback(async (fakultetId: string) => {
    try {
      const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakultetId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      setDKafList(list.map(normKaf));
    } catch (err) {
      console.error(err);
    }
  }, []);

  // --- API calls ---
  const fetchOtmList = useCallback(async () => {
    setLoadingOtm(true);
    try {
      const res = await fetch("/api/crud/otm");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      setOtmList(list.map(normOtm));
    } catch (err) {
      toast.error("OTM ro'yxatini yuklashda xato");
      console.error(err);
    }
    setLoadingOtm(false);
  }, []);

  const fetchFanList = useCallback(async () => {
    setLoadingFan(true);
    try {
      // Django sahifalaydi (20 tadan) — barcha sahifalarni yig'ib olamiz
      const all: Record<string, unknown>[] = [];
      let page = 1;
      while (page <= 200) {
        const res = await fetch(`/api/crud/fanlar?page=${page}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Xato");
        if (Array.isArray(json)) { all.push(...json); break; }
        all.push(...(json.results ?? []));
        if (!json.next || (json.results ?? []).length === 0) break;
        page++;
      }
      setFanList(all.map(normFanRecord));
    } catch (err) {
      toast.error("Fanlar ro'yxatini yuklashda xato");
      console.error(err);
    }
    setLoadingFan(false);
  }, []);

  // --- Effects ---
  useEffect(() => {
    fetchOtmList();
    fetchFanList();
  }, [fetchOtmList, fetchFanList]);

  // --- Dialog cascading effects ---
  useEffect(() => {
    if (dOtm) dFetchFakultetlar(dOtm);
    else setDFakList([]);
    setDFakultet("");
    setDKafList([]);
    setDKafedra("");
  }, [dOtm, dFetchFakultetlar]);

  useEffect(() => {
    if (dFakultet) dFetchKafedralar(dFakultet);
    else setDKafList([]);
    setDKafedra("");
  }, [dFakultet, dFetchKafedralar]);

  // When dialog kafedra changes in ADD mode → check yillikYuklama
  useEffect(() => {
    if (!editingFanId && dKafedra) {
      const kaf = dKafList.find((k) => k.id === dKafedra);
      const yuklama = kaf?.yillikYuklama;
      if (yuklama !== undefined && yuklama !== null && yuklama > 0) {
        setDShowYuklama(false);
      } else {
        setDShowYuklama(true);
      }
      setDKafedraYuklama(0);
    } else {
      setDShowYuklama(false);
      setDKafedraYuklama(0);
      setDKafedraYuklamaSemestr("");
    }
  }, [dKafedra, dKafList, editingFanId]);

  useEffect(() => {
    setDKurs("");
    setDSemestrRaqami("");
  }, [dTalimTuri]);

  // When dialog kurs changes → reset semestr
  useEffect(() => {
    setDSemestrRaqami("");
    setDSemestrFasl("");
  }, [dKurs]);

  // When dialog semestr changes → auto-set fasl (toq→Kuzgi, juft→Bahorgi)
  useEffect(() => {
    if (dSemestrRaqami && !editingFanId) {
      const num = parseInt(dSemestrRaqami, 10);
      if (num > 0) {
        setDSemestrFasl(getSemestrFasl(num));
      }
    }
  }, [dSemestrRaqami, editingFanId]);

  // --- Computed values ---
  const dAvailableKurs = useMemo(() => {
    if (!dTalimTuri) return [];
    return KURS_OPTIONS[dTalimTuri] || [];
  }, [dTalimTuri]);

  // Dialog: semestr options based on talim turi + kurs
  const dAvailableSemestr = useMemo(() => {
    if (!dTalimTuri || !dKurs) return [];
    const kursNum = parseInt(dKurs, 10);
    const semMap = KURS_TO_SEMESTER[dTalimTuri];
    if (!semMap) return [];
    return semMap[kursNum] || [];
  }, [dTalimTuri, dKurs]);

  // Cascade to'liq tanlanganmi (OTM, Fakultet, Kafedra, O'quv yili)
  const y2Complete = !!(y2Otm && y2Fak && y2Kaf && y2OquvYili);

  // Table data: faqat cascade to'liq tanlanganda kafedra yuklamasidagi fanlar
  // (semestr fasli bo'yicha filtrlanadi). Aks holda bo'sh.
  const tableData = useMemo(() => {
    if (!(y2Otm && y2Fak && y2Kaf && y2OquvYili)) return [];
    return y2Fans.filter((fan) => {
      // Kuzgi = toq semestr (1,3,5...), Bahorgi = juft semestr (2,4,6...)
      if (y2Semestr === "kuzgi" && fan.semesterRaqami % 2 === 0) return false;
      if (y2Semestr === "bahorgi" && fan.semesterRaqami % 2 !== 0) return false;
      return true;
    });
  }, [y2Fans, y2Otm, y2Fak, y2Kaf, y2OquvYili, y2Semestr]);

  // ── "Yuklamaga biriktirilgan fanlar" cascade handlerlari ──
  async function y2LoadFans(kafId: string) {
    setY2Loading(true);
    try {
      const all: Record<string, unknown>[] = [];
      let page = 1;
      while (page <= 200) {
        const res = await fetch(`/api/crud/fanlar?kafedraId=${kafId}&page=${page}`);
        if (!res.ok) break;
        const json = await res.json();
        if (Array.isArray(json)) { all.push(...json); break; }
        all.push(...(json.results ?? []));
        if (!json.next || (json.results ?? []).length === 0) break;
        page++;
      }
      setY2Fans(all.map(normFanRecord));
    } finally {
      setY2Loading(false);
    }
  }
  async function y2OtmChange(v: string) {
    setY2Otm(v); setY2Fak(""); setY2Kaf(""); setY2KafList([]); setY2Fans([]);
    if (v) {
      const r = await fetch(`/api/crud/fakultetlar?otmId=${v}`);
      const j = await r.json();
      setY2FakList((Array.isArray(j) ? j : (j.results ?? [])).map(normFak));
    } else setY2FakList([]);
  }
  async function y2FakChange(v: string) {
    setY2Fak(v); setY2Kaf(""); setY2Fans([]);
    if (v) {
      const r = await fetch(`/api/crud/kafedralar?fakultetId=${v}`);
      const j = await r.json();
      setY2KafList((Array.isArray(j) ? j : (j.results ?? [])).map(normKaf));
    } else setY2KafList([]);
  }
  function y2KafChange(v: string) {
    setY2Kaf(v);
    if (v) y2LoadFans(v); else setY2Fans([]);
  }

  // ──────────────────────────────────────────────
  // Dialog helpers
  // ──────────────────────────────────────────────
  const resetDialog = useCallback(() => {
    setEditingFanId(null);
    setDOtm("");
    setDFakList([]);
    setDFakultet("");
    setDKafList([]);
    setDKafedra("");
    setDFanNomi("");
    setDTalimTuri("");
    setDKurs("");
    setDSemestrRaqami("");
    setDSemestrFasl("");
    setDTillar([]);
    setDMaruzaSoat(0);
    setDAmaliyotSoat(0);
    setDLaboratoriyaSoat(0);
    setDSeminarSoat(0);
    setDKafedraYuklama(0);
    setDKafedraYuklamaSemestr("");
    setDShowYuklama(false);
  }, []);

  // --- Open dialog for editing ---
  const handleEditFan = useCallback(async (fan: FanRecord) => {
    setEditingFanId(fan.id);
    // Pre-fill form fields
    setDFanNomi(fan.nomi);
    setDTalimTuri(fan.talimTuri);
    setDKurs(String(fan.kurs));
    setDSemestrRaqami(String(fan.semesterRaqami));
    setDTillar(fan.mashgulotTillari?.length ? fan.mashgulotTillari : (fan.mashgulotTili ? [fan.mashgulotTili] : []));

    // Pre-fill edit mode soat fields
    setDMaruzaSoat(fan.maruzaSoat || 0);
    setDAmaliyotSoat(fan.amaliyotSoat || 0);
    setDLaboratoriyaSoat(fan.laboratoriyaSoat || 0);
    setDSeminarSoat(fan.seminarSoat || 0);

    // Cascade OTM → Fakultet → Kafedra from fan's kafedra chain
     
    const fakultet = fan.kafedra?.fakultet as any;
    const otmRaw =
      fakultet?.otmId ?? fakultet?.otm_id ?? fakultet?.department ??
      (typeof fakultet?.otm === "object" ? fakultet?.otm?.id : fakultet?.otm);
    const otmId = otmRaw != null ? String(otmRaw) : "";
    if (otmId) {
      setDOtm(otmId);
      try {
        const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
        const json = await res.json();
        if (res.ok) {
          const list = Array.isArray(json) ? json : (json.results ?? []);
          setDFakList(list.map(normFak));
        }
      } catch (err) { console.error(err); }
    } else {
      setDOtm("");
      setDFakList([]);
    }

    const fakId = fakultet?.id != null ? String(fakultet.id) : "";
    if (fakId) {
      setDFakultet(fakId);
      try {
        const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakId}`);
        const json = await res.json();
        if (res.ok) {
          const list = Array.isArray(json) ? json : (json.results ?? []);
          setDKafList(list.map(normKaf));
        }
      } catch (err) { console.error(err); }
    } else {
      setDFakultet("");
      setDKafList([]);
    }

    setDKafedra(fan.kafedraId != null ? String(fan.kafedraId) : "");
    setDialogOpen(true);
  }, []);

  // --- Delete fan ---
  const handleDeleteFan = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/crud/fanlar?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Fan muvaffaqiyatli o'chirildi");
      fetchFanList();
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "O'chirishda xato");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchFanList]);

  const onDialogSave = useCallback(async () => {
    if (!dKafedra || !dFanNomi.trim() || !dTalimTuri || !dKurs || !dSemestrRaqami || dTillar.length === 0) {
      toast.error("Barcha maydonlarni to'ldiring (kamida bitta til tanlang)");
      return;
    }

    const isEdit = !!editingFanId;

    const jamiSoat = dMaruzaSoat + dAmaliyotSoat + dLaboratoriyaSoat + dSeminarSoat;

    // Kamida bitta mashg'ulot shakliga soat kiritilishi shart
    if (jamiSoat <= 0) {
      toast.error("Kamida bitta mashg'ulot shakliga soat kiriting");
      return;
    }

    setDialogSubmitting(true);
    try {
      let payload: Record<string, unknown>;

      if (isEdit) {
        // Edit mode: simplified save
        payload = {
          id: editingFanId,
          nomi: dFanNomi.trim(),
          kafedraId: dKafedra,
          kurs: parseInt(dKurs, 10),
          talimTuri: dTalimTuri,
          semesterRaqami: parseInt(dSemestrRaqami, 10),
          mashgulotTillari: dTillar,
          maruzaSoat: dMaruzaSoat,
          amaliyotSoat: dAmaliyotSoat,
          laboratoriyaSoat: dLaboratoriyaSoat,
          seminarSoat: dSeminarSoat,
          jamiSoat,
        };
      } else {
        // Add mode: per mashg'ulot shakli soat
        payload = {
          nomi: dFanNomi.trim(),
          kafedraId: dKafedra,
          kurs: parseInt(dKurs, 10),
          talimTuri: dTalimTuri,
          semesterRaqami: parseInt(dSemestrRaqami, 10),
          semesterFasl: getSemestrFasl(parseInt(dSemestrRaqami, 10)),
          mashgulotTillari: dTillar,
          maruzaSoat: dMaruzaSoat,
          amaliyotSoat: dAmaliyotSoat,
          laboratoriyaSoat: dLaboratoriyaSoat,
          seminarSoat: dSeminarSoat,
          jamiSoat,
        };
      }

      const method = isEdit ? "PUT" : "POST";

      // Translate frontend payload -> Django Subject schema
      const djangoPayload = mapFanToDjango(payload, isEdit ? editingFanId : null);

      const res = await fetch("/api/crud/fanlar", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(djangoPayload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }

      // Add mode: update kafedra yillikYuklama if shown and value entered
      if (!isEdit && dShowYuklama && dKafedraYuklama > 0) {
        try {
          await fetch("/api/crud/kafedralar", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: dKafedra,
              yillikYuklama: dKafedraYuklama,
            }),
          });
        } catch (err) {
          console.error("Kafedra yillik yuklamasini yangilashda xato:", err);
        }
      }

      toast.success(isEdit ? "Fan muvaffaqiyatli tahrirlandi" : "Fan muvaffaqiyatli qo'shildi");
      setDialogOpen(false);
      resetDialog();
      fetchFanList();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setDialogSubmitting(false);
    }
  }, [editingFanId, dKafedra, dFanNomi, dTalimTuri, dKurs, dSemestrRaqami, dTillar, dMaruzaSoat, dAmaliyotSoat, dLaboratoriyaSoat, dSeminarSoat, dShowYuklama, dKafedraYuklama, resetDialog, fetchFanList]);

  // ──────────────────────────────────────────────
  // Select field helper
  // ──────────────────────────────────────────────
  function SelectField({
    id,
    label,
    icon: Icon,
    value,
    onValueChange,
    disabled,
    loading,
    placeholder,
    children,
  }: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    loading?: boolean;
    placeholder?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm font-medium flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {label}
        </Label>
        <Select value={value} onValueChange={onValueChange} disabled={disabled || loading}>
          <SelectTrigger id={id} className={`${disabled && !loading ? "opacity-50" : ""} overflow-hidden w-full`}>
            {loading ? (
              <span className="flex items-center gap-2 min-w-0">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="truncate">Yuklanmoqda...</span>
              </span>
            ) : (
              <span className="min-w-0 flex-1">
                <SelectValue placeholder={placeholder} />
              </span>
            )}
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Mashg'ulot tili — multi-select checkboxes
  // ──────────────────────────────────────────────
  function TiliCheckboxes() {
    const toggle = (val: string, checked: boolean) => {
      setDTillar((prev) =>
        checked ? [...prev, val] : prev.filter((v) => v !== val)
      );
    };
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Tili / Mashg&apos;ulot tili
        </Label>
        <div className="flex flex-wrap gap-4 rounded-md border px-3 py-2.5">
          {MASHGULOT_TILI_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`d-tili-${opt.value}`}
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <Checkbox
                id={`d-tili-${opt.value}`}
                checked={dTillar.includes(opt.value)}
                onCheckedChange={(c) => toggle(opt.value, c === true)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Fanlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fanlarni kafedra, ta&apos;lim turi, kurs va semestr bo&apos;yicha filtrlash
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="gap-1.5 text-sm shrink-0">
            <Filter className="h-3.5 w-3.5" />
            {tableData.length} ta fan
          </Badge>
          <Button
            onClick={() => { resetDialog(); setDialogOpen(true); }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4" />
            Fan qo&apos;shish
          </Button>
        </div>
      </div>

      {/* ────────────────────────────────────────────
          Fan qo'shish / Tahrirlash Dialog
          ──────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sm:text-center">
            <DialogTitle>{editingFanId ? "Fanni tahrirlash" : "Fan qo'shish"}</DialogTitle>
            <DialogDescription>
              {editingFanId
                ? "Fan ma'lumotlarini o'zgartiring."
                : "Yangi fan ma'lumotlarini kiriting."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* ── OTM → Fakultet → Kafedra cascade (gorizontal, both modes) ── */}
            <div className="grid grid-cols-3 gap-4 items-start">
              <SelectField
                id="d-otm"
                label={editingFanId ? "OTM (faqat ko'rish uchun)" : "OTM ni tanlang"}
                icon={Building2}
                value={dOtm}
                onValueChange={setDOtm}
                disabled={loadingOtm || !!editingFanId}
                loading={loadingOtm}
                placeholder="OTM tanlang..."
              >
                {otmList.map((otm) => (
                  <SelectItem key={otm.id} value={otm.id}>
                    {otm.nomi}
                  </SelectItem>
                ))}
              </SelectField>

              <SelectField
                id="d-fakultet"
                label={editingFanId ? "Fakultet (faqat ko'rish uchun)" : "Fakultetni tanlang"}
                icon={GraduationCap}
                value={dFakultet}
                onValueChange={setDFakultet}
                disabled={!dOtm || !!editingFanId}
                placeholder="Avval OTM tanlang..."
              >
                {dFakList.map((fak) => (
                  <SelectItem key={fak.id} value={fak.id}>
                    {fak.nomi}
                  </SelectItem>
                ))}
              </SelectField>

              <SelectField
                id="d-kafedra"
                label="Kafedrani tanlang"
                icon={Library}
                value={dKafedra}
                onValueChange={setDKafedra}
                disabled={!dFakultet}
                placeholder="Avval fakultet tanlang..."
              >
                {dKafList.map((kaf) => (
                  <SelectItem key={kaf.id} value={kaf.id}>
                    {kaf.nomi}
                  </SelectItem>
                ))}
              </SelectField>
            </div>

            <Separator />

            {/* Fan nomi (edit mode only — add mode has it inside the grid below) */}
            {editingFanId && (
              <div className="space-y-1.5">
                <Label htmlFor="d-fanNomi" className="text-sm font-medium flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Fan nomi
                </Label>
                <Input
                  id="d-fanNomi"
                  placeholder="Masalan: Oliy matematika"
                  value={dFanNomi}
                  onChange={(e) => setDFanNomi(e.target.value)}
                />
              </div>
            )}

            {/* ── EDIT MODE: Simplified fields ── */}
            {editingFanId ? (
              <>
                {/* Ma'ruza, Amaliyot, Lab, Seminar soatlar */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-maruzaSoat" className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      Ma&apos;ruza
                    </Label>
                    <Input
                      id="d-maruzaSoat"
                      type="number"
                      min={0}
                      value={dMaruzaSoat || ""}
                      onChange={(e) => setDMaruzaSoat(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-amaliyotSoat" className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Amaliyot
                    </Label>
                    <Input
                      id="d-amaliyotSoat"
                      type="number"
                      min={0}
                      value={dAmaliyotSoat || ""}
                      onChange={(e) => setDAmaliyotSoat(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-laboratoriyaSoat" className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      Laboratoriya
                    </Label>
                    <Input
                      id="d-laboratoriyaSoat"
                      type="number"
                      min={0}
                      value={dLaboratoriyaSoat || ""}
                      onChange={(e) => setDLaboratoriyaSoat(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-seminarSoat" className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      Seminar
                    </Label>
                    <Input
                      id="d-seminarSoat"
                      type="number"
                      min={0}
                      value={dSeminarSoat || ""}
                      onChange={(e) => setDSeminarSoat(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    />
                  </div>
                </div>

                {/* Jami (auto-calculated, read-only) */}
                <div className="space-y-1.5">
                  <Label htmlFor="d-editJami" className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Jami (avtomatik)
                  </Label>
                  <Input
                    id="d-editJami"
                    readOnly
                    value={dEditJamiSoat || ""}
                    placeholder="0"
                    className="bg-muted cursor-not-allowed font-bold"
                  />
                </div>

                <Separator />

                {/* Ta'lim turi */}
                <SelectField
                  id="d-talimTuri"
                  label="Ta'lim turi"
                  icon={BookMarked}
                  value={dTalimTuri}
                  onValueChange={setDTalimTuri}
                  placeholder="Ta'lim turini tanlang..."
                >
                  {TALIM_TURI_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectField>

                {/* Kurs + Semestr */}
                <div className="grid grid-cols-2 gap-4 items-start">
                  <SelectField
                    id="d-kurs"
                    label="Kurs"
                    icon={CalendarDays}
                    value={dKurs}
                    onValueChange={setDKurs}
                    disabled={!dTalimTuri}
                    placeholder="Avval ta'lim turini tanlang..."
                  >
                    {dAvailableKurs.map((k) => (
                      <SelectItem key={k} value={String(k)}>
                        {k}-kurs
                      </SelectItem>
                    ))}
                  </SelectField>

                  <SelectField
                    id="d-semestrRaqami"
                    label="Semestr"
                    icon={ClipboardList}
                    value={dSemestrRaqami}
                    onValueChange={setDSemestrRaqami}
                    disabled={!dKurs}
                    placeholder={!dKurs ? "Avval kursni tanlang..." : "Semestr tanlang..."}
                  >
                    {dAvailableSemestr.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}-semestr
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>

                {/* Mashg'ulot tili — bir nechta */}
                <TiliCheckboxes />
              </>
            ) : (
              <>
                {/* ── ADD MODE ── */}
                {/* Fan nomi + Tili (gorizontal) */}
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-fanNomi" className="text-sm font-medium flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Fan nomi
                    </Label>
                    <Input
                      id="d-fanNomi"
                      placeholder="Masalan: Oliy matematika"
                      value={dFanNomi}
                      onChange={(e) => setDFanNomi(e.target.value)}
                    />
                  </div>

                  <TiliCheckboxes />
                </div>

                {/* Mashg'ulot shakli — har biriga soat */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Mashg&apos;ulot shakli (soat)
                  </Label>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="d-maruzaSoat-add" className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        Ma&apos;ruza
                      </Label>
                      <Input
                        id="d-maruzaSoat-add"
                        type="number"
                        min={0}
                        value={dMaruzaSoat || ""}
                        onChange={(e) => setDMaruzaSoat(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="d-amaliyotSoat-add" className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Amaliyot
                      </Label>
                      <Input
                        id="d-amaliyotSoat-add"
                        type="number"
                        min={0}
                        value={dAmaliyotSoat || ""}
                        onChange={(e) => setDAmaliyotSoat(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="d-laboratoriyaSoat-add" className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-violet-500" />
                        Laboratoriya
                      </Label>
                      <Input
                        id="d-laboratoriyaSoat-add"
                        type="number"
                        min={0}
                        value={dLaboratoriyaSoat || ""}
                        onChange={(e) => setDLaboratoriyaSoat(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="d-seminarSoat-add" className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Seminar
                      </Label>
                      <Input
                        id="d-seminarSoat-add"
                        type="number"
                        min={0}
                        value={dSeminarSoat || ""}
                        onChange={(e) => setDSeminarSoat(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Jami: <span className="font-semibold text-foreground">{dEditJamiSoat}</span> soat
                  </p>
                </div>

                {/* Ta'lim turi; Kurs; Semestr (gorizontal) */}
                <div className="grid grid-cols-3 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-talimTuri" className="text-sm font-medium flex items-center gap-1.5">
                      <BookMarked className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Ta&apos;lim turi
                    </Label>
                    <Select value={dTalimTuri} onValueChange={setDTalimTuri}>
                      <SelectTrigger id="d-talimTuri" className="w-full">
                        <SelectValue placeholder="Ta'lim turini tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TALIM_TURI_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-kurs" className="text-sm font-medium flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Kurs
                    </Label>
                    <Select value={dKurs} onValueChange={setDKurs} disabled={!dTalimTuri}>
                      <SelectTrigger id="d-kurs" className={`${!dTalimTuri ? "opacity-50" : ""} w-full`}>
                        <SelectValue placeholder="Avval ta'lim turini tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dAvailableKurs.map((k) => (
                          <SelectItem key={k} value={String(k)}>
                            {k}-kurs
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="d-semestrRaqami" className="text-sm font-medium flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Semestr
                    </Label>
                    <Select value={dSemestrRaqami} onValueChange={setDSemestrRaqami} disabled={!dKurs}>
                      <SelectTrigger id="d-semestrRaqami" className={`${!dKurs ? "opacity-50" : ""} w-full`}>
                        <SelectValue placeholder={!dKurs ? "Avval kursni tanlang..." : "Semestr tanlang..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {dAvailableSemestr.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}-semestr ({FASL_LABELS[getSemestrFasl(s)]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="pt-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetDialog();
              }}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              disabled={dialogSubmitting}
              onClick={onDialogSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {dialogSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saqlanmoqda...
                </>
              ) : editingFanId ? (
                "Saqlash"
              ) : (
                "Qo'shish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────
          Delete Confirmation Dialog
          ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fanni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.nomi}</span> fanini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFan}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />O'chirilmoqda...</>
              ) : (
                "O'chirish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ────────────────────────────────────────────
          Filtered Fanlar Table
          ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Fanlar jadvali
            </CardTitle>
            <CardDescription>
              {y2Kaf
                ? "Tanlangan kafedra yuklamasidagi fanlar"
                : "Qo'shilgan barcha fanlar ro'yxati"}
            </CardDescription>
          </div>
          {/* OTM → Fakultet → Kafedra → O'quv yili → Semestr */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5"><Building2 className="h-3 w-3 text-emerald-600" /> OTM</Label>
              <Select value={y2Otm} onValueChange={y2OtmChange}>
                <SelectTrigger className="w-full"><SelectValue placeholder="OTM tanlang..." /></SelectTrigger>
                <SelectContent>{otmList.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nomi}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5"><GraduationCap className="h-3 w-3 text-emerald-600" /> Fakultet</Label>
              <Select value={y2Fak} onValueChange={y2FakChange} disabled={!y2Otm}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Avval OTM..." /></SelectTrigger>
                <SelectContent>{y2FakList.map((f) => (<SelectItem key={f.id} value={f.id}>{f.nomi}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5"><Library className="h-3 w-3 text-emerald-600" /> Kafedra</Label>
              <Select value={y2Kaf} onValueChange={y2KafChange} disabled={!y2Fak}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Avval fakultet..." /></SelectTrigger>
                <SelectContent>{y2KafList.map((k) => (<SelectItem key={k.id} value={k.id}>{k.nomi}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5"><CalendarDays className="h-3 w-3 text-emerald-600" /> O&apos;quv yili</Label>
              <Select value={y2OquvYili} onValueChange={setY2OquvYili}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5"><ClipboardList className="h-3 w-3 text-emerald-600" /> Semestr</Label>
              <Select value={y2Semestr} onValueChange={(v) => setY2Semestr(v as "all" | "kuzgi" | "bahorgi")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semestr" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha semestrlar</SelectItem>
                  <SelectItem value="kuzgi">Kuzgi semestr</SelectItem>
                  <SelectItem value="bahorgi">Bahorgi semestr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!y2Complete ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Filter className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Bo&apos;limlarni tanlang</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                OTM, Fakultet, Kafedra va O&apos;quv yilini tanlang — fanlar shu yerda chiqadi
              </p>
            </div>
          ) : (loadingFan || y2Loading) ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : tableData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              {fanList.length === 0 ? (
                <>
                  <h3 className="text-lg font-medium">
                    Hali fanlar qo&apos;shilmagan
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Yuqoridagi &quot;Fan qo&apos;shish&quot; tugmasini bosing
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium">
                    Fanlar topilmadi
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tanlangan filterlar bo&apos;yicha fanlar mavjud emas
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="w-[220px] max-w-[220px] text-center">Fan nomi</TableHead>
                    <TableHead className="text-center">Kurs</TableHead>
                    <TableHead className="text-center">Ta&apos;lim turi</TableHead>
                    <TableHead className="text-center">Semestr</TableHead>
                    <TableHead className="text-center">Tili</TableHead>
                    <TableHead className="text-center">Ma&apos;ruza</TableHead>
                    <TableHead className="text-center">Amaliyot</TableHead>
                    <TableHead className="text-center">Lab</TableHead>
                    <TableHead className="text-center">Seminar</TableHead>
                    <TableHead className="text-center font-bold">Jami</TableHead>
                    <TableHead className="min-w-[160px] text-center">Kafedra</TableHead>
                    <TableHead className="w-24 text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((fan, idx) => (
                    <TableRow key={fan.id}>
                      <TableCell className="text-center text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium w-[220px] max-w-[220px] whitespace-normal break-words leading-tight text-[12px] text-center">{fan.nomi}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {fan.kurs}-kurs
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {TALIM_TURI_LABELS[fan.talimTuri] || fan.talimTuri}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">
                          {fan.semesterRaqami}-semestr{" "}
                          <span className="text-muted-foreground text-xs">
                            ({FASL_LABELS[fan.semesterFasl] || FASL_LABELS[getSemestrFasl(fan.semesterRaqami)]})
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {(fan.mashgulotTillari?.length ? fan.mashgulotTillari : [fan.mashgulotTili]).map((t) => (
                            <span key={t} className="text-xs rounded bg-muted px-1.5 py-0.5">
                              {MASHGULOT_TILI_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-medium ${MASHGULOT_TURI_COLOR["maruza"]} rounded-md px-2 py-0.5`}>
                          {formatNumber(fan.maruzaSoat)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-medium ${MASHGULOT_TURI_COLOR["amaliyot"]} rounded-md px-2 py-0.5`}>
                          {formatNumber(fan.amaliyotSoat)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-medium ${MASHGULOT_TURI_COLOR["laboratoriya"]} rounded-md px-2 py-0.5`}>
                          {formatNumber(fan.laboratoriyaSoat)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-medium ${MASHGULOT_TURI_COLOR["seminar"]} rounded-md px-2 py-0.5`}>
                          {formatNumber(fan.seminarSoat)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(fan.jamiSoat)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs text-center">
                        {fan.kafedra?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditFan(fan)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Tahrirlash</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: fan.id, nomi: fan.nomi })}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">O&apos;chirish</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
