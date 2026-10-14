"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SectionUslubiy, SectionIlmiy, SectionUstoz, ReytingTable,
  type UslubiyRow, type IlmiyRow, type UstozRow, type ReytingData,
} from "@/components/reja/sections";
import { getPlanTeachingHours } from "@/lib/workload-hours";
import {
  ClipboardList,
  Building2,
  Landmark,
  Library,
  Loader2,
  CheckCircle2,
  Users,
  RefreshCw,
  Percent,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Search,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/contexts/dashboard-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ==================== TYPES ====================
interface OtmItem { id: number; nomi: string; qisqaNomi: string; }
interface FakItem { id: number; nomi: string; }
interface KafItem { id: number; nomi: string; }

interface Teacher {
  id: string;
  fio: string;
  lavozim: string;
  ilmiyDaraja: string;
  stavka: string;
}

interface RejaInfo {
  rejaId: string;
  jamiSoat: number;
  status: string;
}

interface FanOpt {
  // `id` bitta biriktiriladigan mashg'ulotning noyob kaliti. Bir fan uchun
  // ma'ruza va har bir amaliy guruh alohida id oladi.
  id: string;
  subjectId?: string;
  lessonType?: "maruza" | "amaliyot" | "laboratoriya";
  workloadKind?: "nazorat" | "kurs_loyihasi" | "md_ilmiy_rahbarlik" | "bmi_rahbarlik" | "amaliyot" | "dak_taqriz" | "boshqa";
  groupIndex?: number;
  groupCount?: number;
  studentCount?: number;
  hourPerStudent?: number;
  sourceRowKey?: string;
  baseNomi?: string;
  educationType: EducationType;
  nomi: string;
  soat: number;
  semestr: "kuzgi" | "bahorgi"; // fan semestri (toq -> kuzgi, juft -> bahorgi)
}

type EducationType = "kunduzgi" | "sirtqi" | "masofaviy" | "qoshma" | "magistr";

const EDUCATION_GROUPS: Array<{ value: EducationType; label: string }> = [
  { value: "kunduzgi", label: "Kunduzgi ta'lim" },
  { value: "sirtqi", label: "Sirtqi ta'lim" },
  { value: "masofaviy", label: "Masofaviy ta'lim" },
  { value: "qoshma", label: "Qo'shma ta'lim" },
  { value: "magistr", label: "Magistratura ta'limi" },
];

function educationTypeFrom(value: unknown, name = ""): EducationType {
  const raw = `${String(value ?? "")} ${name}`.toLocaleLowerCase("uz");
  if (raw.includes("magistr")) return "magistr";
  if (raw.includes("masof")) return "masofaviy";
  if (raw.includes("sirtqi")) return "sirtqi";
  if (raw.includes("2-ot") || raw.includes("qo'shma") || raw.includes("qoshma")) return "qoshma";
  return "kunduzgi";
}

function isLegacyFan(fan: Pick<FanOpt, "id">): boolean {
  return !String(fan.id).startsWith("lesson:");
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function fanNameKey(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("uz");
}

function buildLessonOptions(
  yuklamaData: Record<string, unknown>,
  subjects: Array<Record<string, unknown>>,
): FanOpt[] {
  const subjectByName = new Map(
    subjects.map((subject) => [fanNameKey(subject.nomi ?? subject.name), String(subject.id)]),
  );
  const options: FanOpt[] = [];

  for (const semestr of ["kuzgi", "bahorgi"] as const) {
    const rows = Array.isArray(yuklamaData[semestr])
      ? yuklamaData[semestr] as Array<Record<string, unknown>>
      : [];
    rows.forEach((row, rowIndex) => {
      const baseName = String(row.fan_nomi ?? "").trim();
      if (!baseName) return;
      const subjectId = subjectByName.get(fanNameKey(baseName));
      const sourceKey = subjectId || `${semestr}-${rowIndex + 1}`;
      const sourceRowKey = `${semestr}:${rowIndex + 1}`;
      const educationType = educationTypeFrom(row.talim_shakli, baseName);
      const maruza = numberValue(row.maruza_reja) || numberValue(row.maruza_jami);
      const amaliyJami = numberValue(row.amaliy_jami);
      const groupCount = Math.max(0, Math.trunc(numberValue(row.guruhlar_soni)));
      const amaliy = numberValue(row.amaliy_reja) || (groupCount ? amaliyJami / groupCount : amaliyJami);
      const laboratoriyaJami = numberValue(row.laboratoriya_jami);
      const laboratoriya = numberValue(row.laboratoriya_reja) || (groupCount ? laboratoriyaJami / groupCount : laboratoriyaJami);

      // BMI oldi amaliyoti Excelda soati bo'sh yoki umumiy ko'rinishda kelishi
      // mumkin. Biriktirishda esa doim guruhlar sonicha, har biri 90 soatdan.
      const isPreGraduationPractice = fanNameKey(baseName).includes("bitiruv malakaviy ishi oldi amaliyoti");
      if (isPreGraduationPractice) {
        const count = Math.max(1, groupCount);
        for (let groupIndex = 1; groupIndex <= count; groupIndex++) {
          options.push({
            id: `lesson:${sourceKey}:${semestr}:${rowIndex + 1}:bitiruv-oldi-amaliyoti:${groupIndex}`,
            subjectId,
            workloadKind: "amaliyot",
            groupIndex,
            groupCount: count,
            educationType,
            sourceRowKey,
            baseNomi: baseName,
            nomi: `BMI oldi amaliyoti: ${baseName}`,
            soat: 90,
            semestr,
          });
        }
        return;
      }

      if (maruza > 0) {
        options.push({
          id: `lesson:${sourceKey}:${semestr}:${rowIndex + 1}:maruza`,
          subjectId,
          lessonType: "maruza",
          educationType,
          sourceRowKey,
          baseNomi: baseName,
          nomi: `Ma'ruza: ${baseName}`,
          soat: maruza,
          semestr,
        });
      }
      if (amaliy > 0) {
        // Guruhlar soni 3 bo'lsa, aynan 3 ta mustaqil amaliyot biriktirmasi yaratiladi.
        const count = Math.max(1, groupCount);
        for (let groupIndex = 1; groupIndex <= count; groupIndex++) {
          options.push({
            id: `lesson:${sourceKey}:${semestr}:${rowIndex + 1}:amaliyot:${groupIndex}`,
            subjectId,
            lessonType: "amaliyot",
            educationType,
            sourceRowKey,
            baseNomi: baseName,
            groupIndex,
            groupCount: count,
            nomi: `Amaliyot: ${baseName}`,
            soat: amaliy,
            semestr,
          });
        }
      }
      if (laboratoriya > 0) {
        const count = Math.max(1, groupCount);
        for (let groupIndex = 1; groupIndex <= count; groupIndex++) {
          options.push({
            id: `lesson:${sourceKey}:${semestr}:${rowIndex + 1}:laboratoriya:${groupIndex}`,
            subjectId,
            lessonType: "laboratoriya",
            groupIndex,
            groupCount: count,
            educationType,
            sourceRowKey,
            baseNomi: baseName,
            nomi: `Laboratoriya: ${baseName}`,
            soat: laboratoriya,
            semestr,
          });
        }
      }

      // Ma'ruza/amaliy/laboratoriyasi bo'lmagan fan ham ro'yxatdan tushib
      // qolmasin (masalan, “Ilmiy pedagogik ish” — Amaliyot ustunida).
      if (maruza <= 0 && amaliy <= 0 && laboratoriya <= 0) {
        const otherFields: Array<[FanOpt["workloadKind"], string, unknown]> = [
          ["md_ilmiy_rahbarlik", "MD ilmiy rahbarlik", row.md_ilmiy_rahbarlik],
          ["bmi_rahbarlik", "BMI rahbarlik", row.bmi_rahbarlik],
          ["amaliyot", "Amaliyot", row.amaliyot],
          ["kurs_loyihasi", "Kurs loyihasi", row.kurs_loyihasi],
          ["nazorat", "Nazorat", row.nazorat],
          ["dak_taqriz", "DAK, taqriz", row.dak_taqriz],
        ];
        const found = otherFields.find(([, , value]) => numberValue(value) > 0);
        const soat = found ? numberValue(found[2]) : numberValue(row.jami);
        if (soat > 0) {
          options.push({
            id: `lesson:${sourceKey}:${semestr}:${rowIndex + 1}:${found?.[0] ?? "boshqa"}`,
            subjectId,
            workloadKind: found?.[0] ?? "boshqa",
            hourPerStudent: found?.[0] === "md_ilmiy_rahbarlik" ? 50 : found?.[0] === "bmi_rahbarlik" ? 28 : undefined,
            educationType,
            sourceRowKey,
            baseNomi: baseName,
            nomi: `${found?.[1] ?? "Boshqa yuklama"}: ${baseName}`,
            soat: found?.[0] === "md_ilmiy_rahbarlik" || found?.[0] === "bmi_rahbarlik" ? 0 : soat,
            semestr,
          });
        }
      }
    });
  }
  return options;
}

// Subject.semester ("semester_3") -> kuzgi/bahorgi (toq -> kuzgi, juft -> bahorgi)
function semestrFromSubject(value: unknown): "kuzgi" | "bahorgi" {
  const m = String(value ?? "").match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return n % 2 === 1 ? "kuzgi" : "bahorgi";
}

// Asosiy me'yor 1 stavka uchun 800 soat. ±20 soat tolerantlik bilan
// maksimal 820 soatgacha biriktirish mumkin. Qisman stavkalar mutanosib.
const STAVKA_TARGET_SOAT: Record<string, number> = {
  rate_1: 800,
  rate_0_5: 400,
  rate_0_25: 200,
};

const STAVKA_TOLERANCE: Record<string, number> = {
  rate_1: 20,
  rate_0_5: 10,
  rate_0_25: 5,
};

const STAVKA_MAX_SOAT: Record<string, number> = {
  rate_1: 820,
  rate_0_5: 410,
  rate_0_25: 205,
};

type PlanRate = "rate_1" | "rate_0_5" | "rate_0_25";

// O'qituvchi ish stavkasiga qarab qaysi yuklama variantlari ruxsat etilgan:
//  1 stavka -> faqat 1 stavka; 0.5 stavka -> faqat 0.5; 1.5 stavka -> ikkalasi (1 + 0.5)
function allowedStavkas(rate: string | undefined): PlanRate[] {
  const r = String(rate || "");
  if (r === "rate_1_5") return ["rate_1", "rate_0_5"];
  if (r.includes("0_25")) return ["rate_0_25"];
  if (r.includes("0_5")) return ["rate_0_5"];
  return ["rate_1"];
}

// Bitta stavka uchun shakllangan yuklama (variant)
interface DlgVariant {
  fanlar: FanOpt[];
  uslubiy: UslubiyRow[];
  ilmiy: IlmiyRow[];
  ustozShogird: UstozRow[];
  reyting: ReytingData;
  docMeta: Record<string, unknown>;
}
const EMPTY_VARIANT: DlgVariant = {
  fanlar: [], uslubiy: [], ilmiy: [], ustozShogird: [], reyting: {}, docMeta: {},
};

// O'qituvchi qo'shishdagi stavka variantlari bilan bir xil
const STAVKA_OPTIONS = [
  { value: "rate_1_5", label: "1.5 stavka" },
  { value: "rate_1", label: "1 stavka" },
  { value: "rate_0_5_ichki", label: "0.5 ichki stavka" },
  { value: "rate_0_5_tashqi", label: "0.5 stavka tashqi" },
  { value: "rate_0_25", label: "0.25 stavka" },
];

const LAVOZIM_LABELS: Record<string, string> = {
  professor: "Professor",
  associate_professor: "Dotsent",
  senior_teacher: "Katta o'qituvchi",
  teacher: "Stajyor-o'qituvchi",
  assistant: "Assistent",
};

const DARAJA_LABELS: Record<string, string> = {
  phd: "PhD",
  dsc: "Fan doktori (DSc)",
  master: "Magistr",
  bachelor: "Bakalavr",
};

const STAVKA_LABELS: Record<string, string> = {
  rate_1_5: "1.5 stavka",
  rate_1: "1 stavka",
  rate_0_5_ichki: "0.5 ichki stavka",
  rate_0_5_tashqi: "0.5 stavka tashqi",
  rate_0_25: "0.25 stavka",
};

// ==================== PAGE ====================
export default function YuklamaShakllantirish() {
  const router = useRouter();
  const { academicYears, activeAcademicYear } = useDashboard();
  // Cascading selects
  const [otmList, setOtmList] = useState<OtmItem[]>([]);
  const [fakList, setFakList] = useState<FakItem[]>([]);
  const [kafList, setKafList] = useState<KafItem[]>([]);
  const [selectedOtm, setSelectedOtm] = useState("");
  const [selectedFak, setSelectedFak] = useState("");
  const [selectedKaf, setSelectedKaf] = useState("");
  const [oquvYili, setOquvYili] = useState(activeAcademicYear);

  useEffect(() => setOquvYili(activeAcademicYear), [activeAcademicYear]);
  const [stavka, setStavka] = useState("all");

  // Teachers + reja info map
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rejaMap, setRejaMap] = useState<Map<string, RejaInfo>>(new Map());
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Shakllantirish dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null);
  const [viewRejaId, setViewRejaId] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [dlgFans, setDlgFans] = useState<FanOpt[]>([]); // o'qituvchiga biriktirilgan fanlar
  const [kafFans, setKafFans] = useState<FanOpt[]>([]); // kafedraning barcha fanlari (manba)
  const [assignedElsewhere, setAssignedElsewhere] = useState<Set<string>>(new Set()); // boshqa o'qituvchilarga biriktirilgan fan id lari
  const [dlgRejaData, setDlgRejaData] = useState<Record<string, unknown>>({}); // reja.data (saqlashda saqlab qolinadi)
  const [addFanOpen, setAddFanOpen] = useState(false); // "Qo'shish" — fan tanlash ochiqmi
  const [fanSearch, setFanSearch] = useState("");
  const [pendingSupervision, setPendingSupervision] = useState<FanOpt | null>(null);
  const [supervisionStudentCount, setSupervisionStudentCount] = useState("");
  const [dlgStavka, setDlgStavka] = useState<PlanRate>("rate_1"); // tanlangan stavka
  const [dlgSemestr, setDlgSemestr] = useState<"kuzgi" | "bahorgi">("kuzgi"); // tanlangan semestr
  const [dlgSaving, setDlgSaving] = useState(false);
  // Shaxsiy ish rejasi bo'limlari (shablon bilan bir xil)
  const [dlgUslubiy, setDlgUslubiy] = useState<UslubiyRow[]>([]);
  const [dlgIlmiy, setDlgIlmiy] = useState<IlmiyRow[]>([]);
  const [dlgUstoz, setDlgUstoz] = useState<UstozRow[]>([]);
  const [dlgReyting, setDlgReyting] = useState<ReytingData>({});
  const [dlgDocMeta, setDlgDocMeta] = useState<Record<string, unknown>>({}); // doc ning boshqa maydonlari (saqlab qolinadi)
  const [dlgVariants, setDlgVariants] = useState<Record<string, DlgVariant>>({ rate_1: EMPTY_VARIANT, rate_0_5: EMPTY_VARIANT, rate_0_25: EMPTY_VARIANT }); // har stavka uchun alohida yuklama

  // Load OTMs on mount
  useEffect(() => {
    const toList = (d: unknown) => Array.isArray(d) ? d : ((d as Record<string,unknown>)?.results ?? []) as unknown[];

    fetch("/api/crud/otm")
      .then((r) => r.json())
      .then((d) => setOtmList((toList(d) as Record<string, unknown>[]).map((o) => ({
        id: Number(o.id),
        nomi: String(o.nomi ?? o.name ?? ""),
        qisqaNomi: String(o.qisqaNomi ?? o.short_name ?? ""),
      }))))
      .catch(console.error);
  }, []);

  // Reload rejaMap when oquvYili changes
  useEffect(() => {
    if (!selectedKaf || teachers.length === 0) return;
    loadRejaMap(teachers, oquvYili);
  }, [oquvYili]);

  // ==================== HELPERS ====================
  async function loadRejaMap(teacherList: Teacher[], yili: string) {
    try {
      const res = await fetch(`/api/crud/rejalar?oquvYili=${encodeURIComponent(yili)}`);
      if (!res.ok) return;
      const raw = await res.json();
      const list: Array<{ id: string | number; oqituvchiId: string | number; oquvYiliNomi: string; jamiSoat: number; status: string; data?: Record<string, unknown> }> =
        Array.isArray(raw) ? raw : (raw.results ?? []);
      const teacherIds = new Set(teacherList.map((t) => String(t.id)));
      // DL/MD biriktirma soatlari (o'qituvchi bo'yicha)
      const dlmdMap = new Map<string, number>();
      try {
        let p = 1;
        while (p <= 200) {
          const dr = await fetch(`/api/crud/dl-md?page=${p}`);
          if (!dr.ok) break;
          const dj = await dr.json();
          const drows = Array.isArray(dj) ? dj : (dj.results ?? []);
          for (const it of drows) {
            const tid = String(it.oqituvchiId);
            dlmdMap.set(tid, (dlmdMap.get(tid) || 0) + (Number(it.jamiSoat) || 0));
          }
          if (Array.isArray(dj) || !dj.next || drows.length === 0) break;
          p++;
        }
      } catch { /* e'tiborsiz */ }
      const map = new Map<string, RejaInfo>();
      for (const r of list) {
        const tid = String(r.oqituvchiId);
        if (String(r.oquvYiliNomi) === yili && teacherIds.has(tid)) {
          let soat = getPlanTeachingHours(r.data);
          // DL/MD soatini ham qo'shamiz
          soat += dlmdMap.get(tid) || 0;
          map.set(tid, {
            rejaId: String(r.id),
            jamiSoat: soat,
            status: r.status,
          });
        }
      }
      setRejaMap(map);
    } catch (e) {
      console.error(e);
    }
  }

  // ==================== CASCADING SELECTS ====================
  async function handleOtmChange(otmId: string) {
    setSelectedOtm(otmId);
    setSelectedFak("");
    setSelectedKaf("");
    setFakList([]);
    setKafList([]);
    setTeachers([]);
    setRejaMap(new Map());
    if (otmId) {
      const r = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
      if (r.ok) {
        const d = await r.json();
        const list = Array.isArray(d) ? d : (d.results ?? []);
        setFakList(list.map((f: Record<string, unknown>) => ({ id: Number(f.id), nomi: String(f.nomi ?? f.name ?? "") })));
      }
    }
  }

  async function handleFakChange(fakId: string) {
    setSelectedFak(fakId);
    setSelectedKaf("");
    setKafList([]);
    setTeachers([]);
    setRejaMap(new Map());
    if (fakId) {
      const r = await fetch(`/api/crud/kafedralar?fakultetId=${fakId}`);
      if (r.ok) {
        const d = await r.json();
        const list = Array.isArray(d) ? d : (d.results ?? []);
        setKafList(list.map((k: Record<string, unknown>) => ({ id: Number(k.id), nomi: String(k.nomi ?? k.name ?? "") })));
      }
    }
  }

  // Kafedra + stavka bo'yicha o'qituvchilarni yuklaydi (Django snake_case -> UI)
  async function loadTeachers(kafId: string, rate: string) {
    if (!kafId) {
      setTeachers([]);
      setRejaMap(new Map());
      return;
    }
    setLoadingTeachers(true);
    try {
      const params = new URLSearchParams({ kafedraId: kafId });
      if (rate && rate !== "all") params.set("rate", rate);
      const res = await fetch(`/api/crud/oqituvchilar?${params.toString()}`);
      const raw = res.ok ? await res.json() : [];
      const list = Array.isArray(raw) ? raw : (raw.results ?? []);
      const norm: Teacher[] = list.map((t: Record<string, unknown>) => ({
        id: String(t.id),
        fio: String(t.fio ?? t.full_name ?? ""),
        lavozim: String(t.lavozim ?? t.position ?? ""),
        ilmiyDaraja: String(t.ilmiyDaraja ?? t.degree ?? ""),
        stavka: String(t.stavka ?? t.rate ?? ""),
      }));
      setTeachers(norm);
      await loadRejaMap(norm, oquvYili);
    } finally {
      setLoadingTeachers(false);
    }
  }

  async function handleKafChange(kafId: string) {
    setSelectedKaf(kafId);
    setStavka("all"); // kafedra o'zgarsa — avval barcha o'qituvchilar
    await loadTeachers(kafId, "all");
  }

  function handleStavkaChange(val: string) {
    setStavka(val);
    loadTeachers(selectedKaf, val);
  }

  // ==================== SHAKLLANTIRISH ====================
  // Bitta o'qituvchi uchun yuklama shakllantirish: reja yaratiladi (yo'q bo'lsa)
  // va biriktirish (fan/DL/MD) oynasi ochiladi
  async function handleShakllantirishOne(teacher: Teacher) {
    let rejaId = rejaMap.get(teacher.id)?.rejaId;
    if (!rejaId) {
      try {
        const res = await fetch("/api/crud/rejalar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oqituvchiId: teacher.id,
            oquvYiliNomi: oquvYili,
            departmentId: selectedKaf,
          }),
        });
        if (res.status === 201) {
          const data = await res.json();
          rejaId = String(data.id);
        } else if (res.status === 409) {
          // Allaqachon mavjud — id ni qayta olamiz
          const r = await fetch(`/api/crud/rejalar?oqituvchiId=${teacher.id}&oquvYili=${encodeURIComponent(oquvYili)}`);
          const j = await r.json();
          const list = Array.isArray(j) ? j : (j.results ?? []);
          if (list[0]) rejaId = String(list[0].id);
        } else {
          toast.error("Reja yaratishda xato");
          return;
        }
        await loadRejaMap(teachers, oquvYili);
      } catch {
        toast.error("Xato yuz berdi");
        return;
      }
    }
    if (rejaId) openView(teacher, rejaId);
  }

  // O'qituvchining shakllangan yuklamasini (reja) o'chiradi
  async function handleDeleteReja(teacher: Teacher) {
    const rejaId = rejaMap.get(teacher.id)?.rejaId;
    if (!rejaId) return;
    if (!window.confirm(`${teacher.fio} ning yuklamasini o'chirasizmi?`)) return;
    try {
      const res = await fetch(`/api/crud/rejalar?id=${rejaId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast.success("Yuklama o'chirildi");
        await loadRejaMap(teachers, oquvYili);
      } else {
        throw new Error();
      }
    } catch {
      toast.error("O'chirishda xato");
    }
  }

  // ==================== SHAKLLANTIRISH DIALOG ====================
  // Variantni dialog holatiga yuklash
  function loadDlgFromVariant(v: DlgVariant) {
    setDlgFans(v.fanlar);
    setDlgUslubiy(v.uslubiy);
    setDlgIlmiy(v.ilmiy);
    setDlgUstoz(v.ustozShogird);
    setDlgReyting(v.reyting);
    setDlgDocMeta(v.docMeta);
  }
  // Joriy dialog holatini variant obyektiga aylantirish
  function snapshotVariant(): DlgVariant {
    return {
      fanlar: dlgFans, uslubiy: dlgUslubiy, ilmiy: dlgIlmiy,
      ustozShogird: dlgUstoz, reyting: dlgReyting, docMeta: dlgDocMeta,
    };
  }
  // Stavkani almashtirish: joriyni saqlab, yangisini yuklaymiz
  function switchStavka(ns: PlanRate) {
    if (ns === dlgStavka) return;
    // O'qituvchiga ruxsat etilmagan stavkaga o'tib bo'lmaydi
    if (!allowedStavkas(viewTeacher?.stavka).includes(ns)) return;
    setDlgVariants((prev) => ({ ...prev, [dlgStavka]: snapshotVariant() }));
    loadDlgFromVariant(dlgVariants[ns] ?? EMPTY_VARIANT);
    setDlgStavka(ns);
    setAddFanOpen(false);
    setPendingSupervision(null);
    setSupervisionStudentCount("");
  }

  async function openView(teacher: Teacher, rejaIdArg?: string) {
    const rejaId = rejaIdArg ?? rejaMap.get(teacher.id)?.rejaId;
    if (!rejaId) return;
    setViewTeacher(teacher);
    setViewRejaId(rejaId);
    setDlgFans([]);
    setKafFans([]);
    setAssignedElsewhere(new Set());
    setAddFanOpen(false);
    setFanSearch("");
    setPendingSupervision(null);
    setSupervisionStudentCount("");
    // Stavka standart qiymati — o'qituvchining stavkasidan kelib chiqib
    setDlgStavka(allowedStavkas(teacher.stavka)[0]);
    setViewOpen(true);
    setViewLoading(true);

    try {
      // 1) Shu o'qituvchining rejasi — har stavka uchun alohida variant (xom)
      let rejaData: Record<string, unknown> = {};
      // stavka -> { fanlarRaw, docObj }
      const rawVariants: Record<string, { fanlarRaw: Partial<FanOpt>[]; docObj: Record<string, unknown> }> = {
        rate_1: { fanlarRaw: [], docObj: {} },
        rate_0_5: { fanlarRaw: [], docObj: {} },
        rate_0_25: { fanlarRaw: [], docObj: {} },
      };
      const res = await fetch(`/api/crud/rejalar?id=${rejaId}`);
      if (res.ok) {
        const data = await res.json();
        rejaData = data.data && typeof data.data === "object" ? data.data : {};
        const variantsRaw = rejaData.variants as Record<string, { fanlar?: Partial<FanOpt>[]; doc?: Record<string, unknown> }> | undefined;
        if (variantsRaw && typeof variantsRaw === "object") {
          for (const k of ["rate_1", "rate_0_5", "rate_0_25"] as const) {
            const vv = variantsRaw[k] || {};
            rawVariants[k] = {
              fanlarRaw: Array.isArray(vv.fanlar) ? vv.fanlar : [],
              docObj: vv.doc && typeof vv.doc === "object" ? vv.doc : {},
            };
          }
        } else {
          // Eski (variantsiz) ma'lumot — yuqori darajadagi fanlar/doc data.stavka ga tegishli
          const legacy: PlanRate = rejaData.stavka === "rate_0_5" || rejaData.stavka === "rate_0_25"
            ? rejaData.stavka
            : "rate_1";
          rawVariants[legacy] = {
            fanlarRaw: Array.isArray(rejaData.fanlar) ? (rejaData.fanlar as Partial<FanOpt>[]) : [],
            docObj: rejaData.doc && typeof rejaData.doc === "object" ? (rejaData.doc as Record<string, unknown>) : {},
          };
        }
      }
      setDlgRejaData(rejaData);

      // 2) Kafedra yuklamasidagi fanlardan biriktirish variantlarini quramiz:
      // har fandan 1 ta ma'ruza, guruhlar sonicha alohida amaliyot.
      const subjects: Array<Record<string, unknown>> = [];
      let page = 1;
      while (page <= 200) {
        const fr = await fetch(`/api/crud/fanlar?kafedraId=${selectedKaf}&page=${page}`);
        if (!fr.ok) break;
        const fj = await fr.json();
        const rows = Array.isArray(fj) ? fj : (fj.results ?? []);
        for (const r of rows) {
          subjects.push(r as Record<string, unknown>);
        }
        if (!fj.next || rows.length === 0) break;
        page++;
      }
      let all: FanOpt[] = [];
      try {
        const depRes = await fetch(`/api/crud/kafedralar?id=${selectedKaf}`);
        if (depRes.ok) {
          const department = await depRes.json() as Record<string, unknown>;
          const yuklamaData = (department.yuklama_data ?? department.yuklamaData) as Record<string, unknown> | undefined;
          if (yuklamaData && typeof yuklamaData === "object") {
            all = buildLessonOptions(yuklamaData, subjects);
          }
        }
      } catch {
        /* Quyidagi eski fan ro'yxati zaxira sifatida ishlaydi. */
      }
      // Eski yoki hali Excel yuklamasi shakllantirilmagan kafedralar uchun zaxira.
      if (all.length === 0) {
        all = subjects.map((r) => {
          const soat = Number(r.hours ?? r.soat ?? 0) ||
            (Number(r.maruza_hours ?? 0) + Number(r.amaliyot_hours ?? 0) + Number(r.laboratoriya_hours ?? 0));
          return {
            id: String(r.id),
            subjectId: String(r.id),
            educationType: educationTypeFrom(r.program_type === "master" ? "magistr" : r.study_format, String(r.nomi ?? r.name ?? "")),
            sourceRowKey: `legacy:${String(r.id)}`,
            baseNomi: String(r.nomi ?? r.name ?? ""),
            nomi: String(r.nomi ?? r.name ?? ""),
            soat,
            semestr: semestrFromSubject(r.semester ?? r.semestr),
          };
        });
      }
      setKafFans(all);

      // Variantlarni qurib chiqamiz (fanlar soat/semestrini kafedra manbasidan to'ldirib)
      const kafMap = new Map(all.map((f) => [String(f.id), f]));
      const buildVariant = (raw: { fanlarRaw: Partial<FanOpt>[]; docObj: Record<string, unknown> }): DlgVariant => ({
        fanlar: raw.fanlarRaw.map((f) => {
          const ref = kafMap.get(String(f.id)) ?? all.find((item) =>
            !f.lessonType && item.subjectId === String(f.id)
          );
          return {
            ...f,
            id: String(f.id),
            subjectId: f.subjectId ?? ref?.subjectId,
            lessonType: f.lessonType ?? ref?.lessonType,
            workloadKind: f.workloadKind ?? ref?.workloadKind,
            sourceRowKey: f.sourceRowKey ?? ref?.sourceRowKey,
            baseNomi: f.baseNomi ?? ref?.baseNomi,
            educationType: f.educationType ?? ref?.educationType ?? "kunduzgi",
            nomi: String(f.nomi ?? ref?.nomi ?? ""),
            soat: Number(f.soat) || ref?.soat || 0,
            semestr: (f.semestr as "kuzgi" | "bahorgi") || ref?.semestr || "kuzgi",
          };
        }),
        uslubiy: Array.isArray(raw.docObj.uslubiy) ? (raw.docObj.uslubiy as UslubiyRow[]) : [],
        ilmiy: Array.isArray(raw.docObj.ilmiy) ? (raw.docObj.ilmiy as IlmiyRow[]) : [],
        ustozShogird: Array.isArray(raw.docObj.ustozShogird) ? (raw.docObj.ustozShogird as UstozRow[]) : [],
        reyting: raw.docObj.reyting && typeof raw.docObj.reyting === "object" ? (raw.docObj.reyting as ReytingData) : {},
        docMeta: raw.docObj,
      });
      const variants: Record<string, DlgVariant> = {
        rate_1: buildVariant(rawVariants.rate_1),
        rate_0_5: buildVariant(rawVariants.rate_0_5),
        rate_0_25: buildVariant(rawVariants.rate_0_25),
      };
      setDlgVariants(variants);

      // Faol stavka — o'qituvchiga ruxsat etilgan birinchi stavka
      const active = allowedStavkas(teacher.stavka)[0];
      setDlgStavka(active);
      loadDlgFromVariant(variants[active]);

      // 3) Boshqa o'qituvchilarga biriktirilgan fanlar (qayta tanlanmasligi uchun)
      const elsewhere = new Set<string>();
      try {
        const teacherIds = new Set(teachers.map((t) => String(t.id)));
        let rpage = 1;
        while (rpage <= 200) {
          const rr = await fetch(`/api/crud/rejalar?oquvYili=${encodeURIComponent(oquvYili)}&page=${rpage}`);
          if (!rr.ok) break;
          const rj = await rr.json();
          const rejalar = Array.isArray(rj) ? rj : (rj.results ?? []);
          for (const item of rejalar) {
            if (String(item.id) === String(rejaId)) continue;
            if (!teacherIds.has(String(item.oqituvchiId))) continue;
            const d = item.data && typeof item.data === "object" ? item.data : {};
            // Variantlardan ham, eski fanlardan ham yig'amiz
            const dv = d.variants && typeof d.variants === "object" ? d.variants : null;
            const fanArrays: Array<{ id?: string | number }[]> = dv
              ? Object.values(dv).map((x) => (Array.isArray((x as { fanlar?: unknown }).fanlar) ? (x as { fanlar: { id?: string | number }[] }).fanlar : []))
              : [Array.isArray(d.fanlar) ? d.fanlar : []];
            for (const arr of fanArrays) for (const f of arr) {
              elsewhere.add(String(f.id));
              // Eski formatda id fan id si edi va butun fan bitta o'qituvchiga tegishli.
              if (isLegacyFan(f as FanOpt)) elsewhere.add(`subject:${String(f.id)}`);
            }
          }
          if (Array.isArray(rj) || !rj.next || rejalar.length === 0) break;
          rpage++;
        }
      } catch {
        /* e'tiborsiz */
      }
      // Shu o'qituvchining o'z fanlari (ikkala variant) elsewhere dan chiqarilsin
      [...variants.rate_1.fanlar, ...variants.rate_0_5.fanlar, ...variants.rate_0_25.fanlar]
        .forEach((f) => elsewhere.delete(String(f.id)));
      setAssignedElsewhere(elsewhere);
    } finally {
      setViewLoading(false);
    }
  }

  // Fanni o'qituvchiga biriktirish (stavka soat limiti tekshiriladi)
  function dlgAddFan(fan: FanOpt) {
    const maxSoat = STAVKA_MAX_SOAT[dlgStavka] ?? 0;
    const used = dlgFans.reduce((acc, f) => acc + (f.soat || 0), 0);
    if (used >= maxSoat) {
      toast.error(`Soat limiti to'ldi (${maxSoat} soat). Boshqa fan biriktirib bo'lmaydi.`);
      return;
    }
    if (used + (fan.soat || 0) > maxSoat) {
      toast.error(
        `"${fan.nomi}" (${fan.soat} soat) qo'shilsa, limit (${maxSoat} soat) oshib ketadi. Qoldiq: ${maxSoat - used} soat.`
      );
      return;
    }
    setDlgFans((prev) => (prev.some((f) => f.id === fan.id) ? prev : [...prev, fan]));
    setAddFanOpen(false);
  }

  function chooseFan(fan: FanOpt) {
    if (fan.workloadKind === "md_ilmiy_rahbarlik" || fan.workloadKind === "bmi_rahbarlik") {
      setPendingSupervision(fan);
      setSupervisionStudentCount("");
      return;
    }
    dlgAddFan(fan);
  }

  function addSupervisionFan() {
    if (!pendingSupervision) return;
    const studentCount = Math.trunc(Number(supervisionStudentCount));
    if (!Number.isFinite(studentCount) || studentCount <= 0) {
      toast.error("Talabalar sonini kiriting");
      return;
    }
    const hourPerStudent = pendingSupervision.workloadKind === "md_ilmiy_rahbarlik" ? 50 : 28;
    dlgAddFan({
      ...pendingSupervision,
      nomi: `${pendingSupervision.nomi} — ${studentCount} talaba`,
      studentCount,
      hourPerStudent,
      soat: studentCount * hourPerStudent,
    });
    setPendingSupervision(null);
    setSupervisionStudentCount("");
  }

  function dlgRemoveFanGroup(ids: string[]) {
    const removeIds = new Set(ids);
    setDlgFans((prev) => prev.filter((fan) => !removeIds.has(fan.id)));
  }

  // Biriktirilgan fanlarni rejaga saqlash
  async function dlgSave() {
    if (!viewRejaId) return;
    setDlgSaving(true);
    try {
      // Joriy stavka variantini yangilab, ikkala variantni saqlaymiz
      const finalVariants = { ...dlgVariants, [dlgStavka]: snapshotVariant() };
      const toData = (v: DlgVariant) => ({
        fanlar: v.fanlar,
        doc: {
          ...v.docMeta,
          uslubiy: v.uslubiy,
          ilmiy: v.ilmiy,
          ustozShogird: v.ustozShogird,
          reyting: v.reyting,
        },
      });
      // Eski yuqori darajadagi fanlar/doc/stavka ni olib tashlaymiz (variants asosiy)
      const restData = { ...dlgRejaData };
      delete (restData as Record<string, unknown>).fanlar;
      delete (restData as Record<string, unknown>).doc;
      const res = await fetch(`/api/crud/rejalar?id=${viewRejaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...restData,
            stavka: dlgStavka,
            variants: {
              rate_1: toData(finalVariants.rate_1 ?? EMPTY_VARIANT),
              rate_0_5: toData(finalVariants.rate_0_5 ?? EMPTY_VARIANT),
              rate_0_25: toData(finalVariants.rate_0_25 ?? EMPTY_VARIANT),
            },
          },
        }),
      });
      if (res.ok) {
        toast.success("Saqlandi");
        setViewOpen(false);
        await loadRejaMap(teachers, oquvYili);
      } else {
        toast.error("Saqlashda xato");
      }
    } catch {
      toast.error("Saqlashda xato");
    } finally {
      setDlgSaving(false);
    }
  }

  function handleDialogClose(open: boolean) {
    setViewOpen(open);
  }

  // ==================== DERIVED VALUES ====================
  const newCount = teachers.filter((t) => !rejaMap.has(t.id)).length;
  const existingCount = teachers.length - newCount;
  // O'qituvchiga ruxsat etilgan stavkalar (dialog ochilgan o'qituvchi bo'yicha)
  const dlgAllowedStavkas = allowedStavkas(viewTeacher?.stavka);
  // Boshqa stavka variantiga biriktirilgan fanlar (ularni ham takror tanlamaymiz)
  const otherVariantFanIds = new Set<string>();
  Object.entries(dlgVariants)
    .filter(([rate]) => rate !== dlgStavka)
    .forEach(([, variant]) => variant.fanlar.forEach((fan) => {
      otherVariantFanIds.add(String(fan.id));
      if (isLegacyFan(fan)) otherVariantFanIds.add(`subject:${String(fan.id)}`);
    }));
  // Tanlash mumkin bo'lgan fanlar: kafedra fanlari − biriktirilganlar − boshqalarga tegishlilar
  // − boshqa stavka varianti − tanlangan semestrga mos kelganlar
  const availableFans = kafFans.filter(
    (f) => {
      const shareableSupervision = f.workloadKind === "md_ilmiy_rahbarlik" || f.workloadKind === "bmi_rahbarlik";
      return (
      !dlgFans.some((d) => d.id === f.id || (isLegacyFan(d) && d.id === f.subjectId)) &&
      (shareableSupervision || (!assignedElsewhere.has(String(f.id)) &&
        !assignedElsewhere.has(`subject:${String(f.subjectId ?? "")}`))) &&
      !otherVariantFanIds.has(String(f.id)) &&
      !otherVariantFanIds.has(`subject:${String(f.subjectId ?? "")}`) &&
      f.semestr === dlgSemestr
      );
    }
  );
  const normalizedFanSearch = fanSearch.trim().toLocaleLowerCase("uz");
  const filteredAvailableFans = availableFans.filter((fan) =>
    !normalizedFanSearch || fan.nomi.toLocaleLowerCase("uz").includes(normalizedFanSearch)
  );
  const groupedAvailableFans = EDUCATION_GROUPS.map((group) => ({
    ...group,
    fanlar: filteredAvailableFans.filter((fan) => fan.educationType === group.value),
  })).filter((group) => group.fanlar.length > 0);
  // Tanlangan semestrdagi biriktirilgan fanlar (jadvalda ko'rsatiladi)
  const dlgSemestrFans = dlgFans.filter((f) => f.semestr === dlgSemestr);
  const mergedDlgSemestrFans = Array.from(
    dlgSemestrFans.reduce((groups, fan) => {
      const key = fan.sourceRowKey || `single:${fan.id}`;
      const current = groups.get(key) ?? {
        key,
        nomi: fan.baseNomi || fan.nomi,
        soat: 0,
        ids: [] as string[],
        qismlar: [] as string[],
      };
      current.soat += fan.soat || 0;
      current.ids.push(fan.id);
      const turi = fan.lessonType === "maruza" ? "Ma'ruza"
        : fan.lessonType === "amaliyot" ? "Amaliyot"
        : fan.lessonType === "laboratoriya" ? "Laboratoriya"
        : fan.workloadKind === "md_ilmiy_rahbarlik" ? "MD rahbarlik"
        : fan.workloadKind === "bmi_rahbarlik" ? "BMI rahbarlik"
        : fan.nomi.split(":")[0];
      current.qismlar.push(`${turi}: ${fan.soat} soat`);
      groups.set(key, current);
      return groups;
    }, new Map<string, { key: string; nomi: string; soat: number; ids: string[]; qismlar: string[] }>()).values()
  );
  const dlgSemestrSoat = dlgSemestrFans.reduce((acc, f) => acc + (f.soat || 0), 0);
  // Stavka soat limiti hisob-kitobi (yillik — ikkala semestr birga)
  const dlgMaxSoat = STAVKA_MAX_SOAT[dlgStavka] ?? 0;
  const dlgTargetSoat = STAVKA_TARGET_SOAT[dlgStavka] ?? 0;
  const dlgTolerance = STAVKA_TOLERANCE[dlgStavka] ?? 0;
  const dlgUsedSoat = dlgFans.reduce((acc, f) => acc + (f.soat || 0), 0);
  const dlgLimitReached = dlgUsedSoat >= dlgMaxSoat;

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Yuklama shakllantirish
        </h1>
        <p className="text-muted-foreground mt-1">
          Kafedra bo&apos;yicha barcha o&apos;qituvchilarga avtomatik shaxsiy ish rejasi shakllantirish
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* OTM */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> OTM
              </Label>
              <Select value={selectedOtm} onValueChange={handleOtmChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="OTM tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {otmList.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.nomi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fakultet */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Landmark className="h-3 w-3" /> Fakultet
              </Label>
              <Select value={selectedFak} onValueChange={handleFakChange} disabled={!selectedOtm}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selectedOtm ? "Fakultet tanlang" : "Avval OTM tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {fakList.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.nomi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kafedra */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Library className="h-3 w-3" /> Kafedra
              </Label>
              <Select value={selectedKaf} onValueChange={handleKafChange} disabled={!selectedFak}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selectedFak ? "Kafedra tanlang" : "Avval fakultet tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {kafList.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.nomi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stavka */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Percent className="h-3 w-3" /> Stavka
              </Label>
              <Select value={stavka} onValueChange={handleStavkaChange} disabled={!selectedKaf}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Stavka tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {STAVKA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* O'quv yili */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" /> O&apos;quv yili
              </Label>
              <Select value={oquvYili} onValueChange={setOquvYili}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {!selectedKaf ? (
        <div className="text-center py-20 text-muted-foreground border rounded-lg bg-background">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-base font-medium">OTM, Fakultet va Kafedrani tanlang</p>
          <p className="text-sm mt-1 opacity-70">Tanlangandan so&apos;ng o&apos;qituvchilar ro&apos;yxati chiqadi</p>
        </div>
      ) : loadingTeachers ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border rounded-lg bg-background">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Bu kafedrada o&apos;qituvchi topilmadi</p>
        </div>
      ) : (
        <>
          {/* Summary badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Jami:</span>
              <span className="font-semibold text-foreground">{teachers.length} ta o&apos;qituvchi</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Yangi: {newCount} ta
            </Badge>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Mavjud: {existingCount} ta
            </Badge>
          </div>

          {/* Teachers table */}
          <div className="border rounded-lg bg-background overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead className="text-center">F.I.O</TableHead>
                  <TableHead className="text-center">Lavozim</TableHead>
                  <TableHead className="text-center">Ilmiy daraja</TableHead>
                  <TableHead className="text-center">Stavka</TableHead>
                  <TableHead className="text-center">Soat</TableHead>
                  <TableHead className="text-center w-[160px]">Yuklama</TableHead>
                  <TableHead className="text-center w-[150px]">Ko&apos;rish</TableHead>
                  <TableHead className="text-center w-[100px]">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher, i) => {
                  const rejaInfo = rejaMap.get(teacher.id);
                  const hasReja = !!rejaInfo;

                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-center">{teacher.fio}</TableCell>
                      <TableCell className="text-muted-foreground text-sm text-center">
                        {LAVOZIM_LABELS[teacher.lavozim] || teacher.lavozim || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm text-center">
                        {DARAJA_LABELS[teacher.ilmiyDaraja] || teacher.ilmiyDaraja || "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{STAVKA_LABELS[teacher.stavka] || teacher.stavka || "—"}</TableCell>

                      {/* Soat column */}
                      <TableCell className="text-center">
                        {hasReja ? (
                          <span className="font-semibold text-primary">
                            {rejaInfo.jamiSoat}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Yuklama: Shakllantirish tugmasi */}
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => handleShakllantirishOne(teacher)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Shakllantirish
                        </Button>
                      </TableCell>

                      {/* Ko'rish: har stavka uchun alohida (glazok + yozuv) */}
                      <TableCell className="text-center">
                        {hasReja ? (
                          <div className="flex flex-col items-center gap-1">
                            {([
                              { key: "rate_1", label: "1 stavka" },
                              { key: "rate_0_5", label: "0.5 stavka" },
                              { key: "rate_0_25", label: "0.25 stavka" },
                            ] as const).filter((s) => allowedStavkas(teacher.stavka).includes(s.key)).map((s) => (
                              <button
                                key={s.key}
                                title={`${s.label} yuklamasini ko'rish`}
                                className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                                onClick={() => {
                                  const rid = rejaMap.get(teacher.id)?.rejaId;
                                  if (rid) router.push(`/dashboard/admin/rejalar/${rid}?stavka=${s.key}`);
                                }}
                              >
                                <Eye className="h-4 w-4 shrink-0" />
                                <span>{s.label}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Amal: tahrirlash + o'chirish (faqat reja mavjud bo'lsa) */}
                      <TableCell className="text-center">
                        {hasReja ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Tahrirlash"
                              onClick={() => openView(teacher)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="O'chirish"
                              onClick={() => handleDeleteReja(teacher)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

        </>
      )}

      {/* ==================== SHAKLLANTIRISH DIALOG ==================== */}
      <Dialog open={viewOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              <Sparkles className="h-5 w-5 text-primary" />
              {viewTeacher?.fio} — yuklamasini shakllantirish
            </DialogTitle>
          </DialogHeader>

          {/* O'qituvchi haqida ma'lumotlar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-lg">
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted-foreground">F.I.O</p>
              <p className="font-semibold">{viewTeacher?.fio}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lavozim</p>
              <p className="text-sm font-medium">
                {viewTeacher ? LAVOZIM_LABELS[viewTeacher.lavozim] || viewTeacher.lavozim || "—" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ilmiy daraja</p>
              <p className="text-sm font-medium">
                {viewTeacher ? DARAJA_LABELS[viewTeacher.ilmiyDaraja] || viewTeacher.ilmiyDaraja || "—" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stavka</p>
              <p className="text-sm font-medium">
                {viewTeacher ? STAVKA_LABELS[viewTeacher.stavka] || viewTeacher.stavka || "—" : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">O&apos;quv yili</p>
              <p className="text-sm font-medium">{oquvYili}</p>
            </div>
          </div>

          {/* O'QUV ISHLARI sarlavhasi */}
          {!viewLoading && (
            <h2 className="text-center font-bold text-base pt-2">O&apos;QUV ISHLARI</h2>
          )}

          {/* Biriktirilgan fanlar */}
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">
                    Biriktirilgan fanlar
                    <span className="ml-2 text-muted-foreground">({dlgFans.length} ta)</span>
                  </p>
                  <span
                    className={`text-sm font-semibold ${dlgLimitReached ? "text-destructive" : "text-primary"}`}
                  >
                    {dlgUsedSoat} / {dlgTargetSoat} soat
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (±{dlgTolerance}, maksimum {dlgMaxSoat})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Stavka tanlash — o'qituvchiga ruxsat etilganlar (boshqasi bloklangan) */}
                  <div className="flex items-center gap-1 rounded-md border p-0.5">
                    <Button
                      size="sm"
                      variant={dlgStavka === "rate_1" ? "default" : "ghost"}
                      disabled={!dlgAllowedStavkas.includes("rate_1")}
                      title={!dlgAllowedStavkas.includes("rate_1") ? "O'qituvchi bu stavkada ishlamaydi" : undefined}
                      className={`h-7 px-3 ${dlgStavka === "rate_1" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => switchStavka("rate_1")}
                    >
                      1 stavka
                    </Button>
                    <Button
                      size="sm"
                      variant={dlgStavka === "rate_0_5" ? "default" : "ghost"}
                      disabled={!dlgAllowedStavkas.includes("rate_0_5")}
                      title={!dlgAllowedStavkas.includes("rate_0_5") ? "O'qituvchi bu stavkada ishlamaydi" : undefined}
                      className={`h-7 px-3 ${dlgStavka === "rate_0_5" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => switchStavka("rate_0_5")}
                    >
                      0.5 stavka
                    </Button>
                    <Button
                      size="sm"
                      variant={dlgStavka === "rate_0_25" ? "default" : "ghost"}
                      disabled={!dlgAllowedStavkas.includes("rate_0_25")}
                      title={!dlgAllowedStavkas.includes("rate_0_25") ? "O'qituvchi bu stavkada ishlamaydi" : undefined}
                      className={`h-7 px-3 ${dlgStavka === "rate_0_25" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => switchStavka("rate_0_25")}
                    >
                      0.25 stavka
                    </Button>
                  </div>
                  {/* Semestr tanlash — faqat bittasi */}
                  <div className="flex items-center gap-1 rounded-md border p-0.5">
                    <Button
                      size="sm"
                      variant={dlgSemestr === "kuzgi" ? "default" : "ghost"}
                      className={`h-7 px-3 ${dlgSemestr === "kuzgi" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => { setDlgSemestr("kuzgi"); setAddFanOpen(false); setFanSearch(""); setPendingSupervision(null); }}
                    >
                      Kuzgi
                    </Button>
                    <Button
                      size="sm"
                      variant={dlgSemestr === "bahorgi" ? "default" : "ghost"}
                      className={`h-7 px-3 ${dlgSemestr === "bahorgi" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => { setDlgSemestr("bahorgi"); setAddFanOpen(false); setFanSearch(""); setPendingSupervision(null); }}
                    >
                      Bahorgi
                    </Button>
                  </div>
                </div>
              </div>
              {dlgLimitReached && (
                <p className="text-xs text-destructive">
                  Soat limiti to&apos;ldi ({dlgMaxSoat} soat) — boshqa fan/DL/MD biriktirib bo&apos;lmaydi.
                </p>
              )}

              {/* Fanlar ro'yxati */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">#</TableHead>
                      <TableHead>Fan nomi</TableHead>
                      <TableHead className="w-[100px] text-center">Soat</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedDlgSemestrFans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                          {dlgSemestr === "kuzgi" ? "Kuzgi" : "Bahorgi"} semestrga hali fan biriktirilmagan. &quot;+ Fan qo&apos;shish&quot; orqali fan tanlang.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {mergedDlgSemestrFans.map((fan, i) => (
                          <TableRow key={fan.key}>
                            <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{fan.nomi}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{fan.qismlar.join(" · ")}</p>
                            </TableCell>
                            <TableCell className="text-center text-sm">{fan.soat}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => dlgRemoveFanGroup(fan.ids)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell colSpan={2} className="text-right text-sm">
                            Jami ({dlgSemestr === "kuzgi" ? "kuzgi" : "bahorgi"}):
                          </TableCell>
                          <TableCell className="text-center text-sm text-primary">{dlgSemestrSoat}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Jadval ostida: Fan qo'shish — doim markazda, ko'k */}
              <div className="flex justify-center">
                <Button
                  size="sm"
                  className="gap-1.5 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={dlgLimitReached}
                  onClick={() => { setAddFanOpen(true); setFanSearch(""); setPendingSupervision(null); setSupervisionStudentCount(""); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Fan qo&apos;shish
                </Button>
              </div>

              {/* Qidiruvli, ta'lim shakli bo'yicha guruhlangan fan tanlash */}
              {addFanOpen && (
                <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {pendingSupervision ? "Rahbarlik yuklamasini hisoblash" : "Yuklamadagi fanlardan tanlang"}
                  </Label>
                  {!pendingSupervision && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={fanSearch}
                        onChange={(event) => setFanSearch(event.target.value)}
                        placeholder="Fan nomi bo'yicha qidirish..."
                        className="h-10 rounded-xl pl-9"
                      />
                    </div>
                  )}
                  {pendingSupervision ? (
                    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background shadow-sm">
                      <div className="flex flex-col gap-4 border-b border-primary/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <Badge className="rounded-full px-2.5 py-0.5">
                                {pendingSupervision.workloadKind === "md_ilmiy_rahbarlik" ? "MD rahbarlik" : "BMI rahbarlik"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Talabalar bo‘yicha hisoblanadi</span>
                            </div>
                            <p className="text-sm font-semibold leading-5 sm:text-base">{pendingSupervision.baseNomi || pendingSupervision.nomi}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-xl border bg-background/80 px-3 py-2 text-sm shadow-sm">
                          <Calculator className="h-4 w-4 text-primary" />
                          <span className="text-muted-foreground">Formula:</span>
                          <strong>{pendingSupervision.hourPerStudent} soat × talaba</strong>
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(220px,320px)_1fr] sm:items-stretch sm:p-5">
                        <div className="space-y-2">
                          <Label htmlFor="supervision-student-count" className="text-sm font-semibold">Talabalar soni</Label>
                          <Input
                            id="supervision-student-count"
                            type="number"
                            min={1}
                            step={1}
                            autoFocus
                            value={supervisionStudentCount}
                            onChange={(event) => setSupervisionStudentCount(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") addSupervisionFan(); }}
                            placeholder="Masalan: 3 ta talaba"
                            className="h-12 rounded-xl border-primary/30 bg-background text-base font-medium shadow-sm focus-visible:ring-primary"
                          />
                          <p className="text-xs text-muted-foreground">Faqat musbat butun son kiriting</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-sm sm:px-5">
                          <div>
                            <p className="text-xs font-medium opacity-80">Hisoblangan jami yuklama</p>
                            <p className="mt-1 text-2xl font-bold tracking-tight">
                              {(Math.max(0, Math.trunc(Number(supervisionStudentCount) || 0)) * (pendingSupervision.hourPerStudent || 0)).toLocaleString()}
                              <span className="ml-1.5 text-sm font-semibold opacity-80">soat</span>
                            </p>
                          </div>
                          <Calculator className="h-8 w-8 opacity-40" />
                        </div>
                      </div>

                      <div className="flex flex-col-reverse gap-2 border-t border-primary/15 bg-background/50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => { setPendingSupervision(null); setSupervisionStudentCount(""); }}
                        >
                          Orqaga
                        </Button>
                        <Button size="sm" className="rounded-xl px-5" onClick={addSupervisionFan}>
                          Qo&apos;shish
                        </Button>
                      </div>
                    </div>
                  ) : (
                  <div className="max-h-[52vh] overflow-y-auto rounded-md border bg-background p-2">
                    {groupedAvailableFans.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {availableFans.length ? "Qidiruv bo'yicha fan topilmadi" : "Tanlash uchun fan qolmadi"}
                      </p>
                    ) : groupedAvailableFans.map((group) => (
                      <div key={group.value} className="mb-3 last:mb-0">
                        <div className="sticky top-0 z-10 flex items-center gap-3 bg-background py-2">
                          <Separator className="flex-1" />
                          <span className="whitespace-nowrap text-xs font-semibold text-primary">
                            {group.label}
                          </span>
                          <Separator className="flex-1" />
                        </div>
                        <div className="space-y-1">
                          {group.fanlar.map((fan) => (
                            <button
                              key={fan.id}
                              type="button"
                              onClick={() => chooseFan(fan)}
                              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span>
                                {fan.nomi}
                                {fan.groupCount && fan.groupCount > 1
                                  ? ` (${fan.groupIndex}-guruh)`
                                  : ""}
                              </span>
                              <span className="shrink-0 font-medium text-primary">
                                {fan.hourPerStudent ? `${fan.hourPerStudent} soat/talaba` : `${fan.soat} soat`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => { setAddFanOpen(false); setFanSearch(""); setPendingSupervision(null); setSupervisionStudentCount(""); }}
                    >
                      Bekor
                    </Button>
                  </div>
                </div>
              )}

              {/* Shaxsiy ish rejasi bo'limlari (shablon bilan bir xil) */}
              <SectionUslubiy rows={dlgUslubiy} setRows={setDlgUslubiy} />
              <SectionIlmiy rows={dlgIlmiy} setRows={setDlgIlmiy} />
              <SectionUstoz rows={dlgUstoz} setRows={setDlgUstoz} />
              <ReytingTable reyting={dlgReyting} setReyting={setDlgReyting} jamiSoat={dlgUsedSoat} />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Yopish
            </Button>
            <Button onClick={dlgSave} disabled={dlgSaving || viewLoading} className="gap-2">
              {dlgSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
