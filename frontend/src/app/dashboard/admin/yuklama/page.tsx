"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Scale, RefreshCw, Filter, Plus, X, Loader2, Trash2, Landmark, Building2, Eye, Pencil, Library, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/contexts/dashboard-context";
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

// ==================== TYPES ====================
interface OtmItem {
  id: number;
  nomi: string;
  qisqaNomi: string;
}

interface FakultetItem {
  id: number;
  nomi: string;
  otmId: string;
}

interface KafedraItem {
  id: number;
  nomi: string;
  fakultetId: string;
  yillikYuklama: number;
}

interface FanItem {
  id: number;
  nomi: string;
}

// Django (name/faculty/otm) -> UI (nomi) normalizatsiya
const normFakItem = (x: Record<string, unknown>): FakultetItem => ({
  id: Number(x.id),
  nomi: String(x.nomi ?? x.name ?? ""),
  otmId: String(x.otmId ?? (typeof x.otm === "object" ? (x.otm as Record<string, unknown>)?.id : x.otm) ?? ""),
});
const normKafItem = (x: Record<string, unknown>): KafedraItem => ({
  id: Number(x.id),
  nomi: String(x.nomi ?? x.name ?? ""),
  fakultetId: String(x.fakultetId ?? (typeof x.fakultet === "object" ? (x.fakultet as Record<string, unknown>)?.id : x.faculty) ?? ""),
  yillikYuklama: Number(x.yillikYuklama ?? x.yillik_yuklama ?? 0) || 0,
});

// Saqlangan yuklama turi (API dan keladi)
interface SavedYuklamaQator {
  id: string;
  fanId: string | null;
  fanNomi: string;
  talimTuri: string;
  kurs: number;
  talimTili: string;
  semester: number | null;
  talabalarSoni: number;
  guruhlarSoni: number;
  potoklar: number;
  maruzaReja: number;
  maruzaJami: number;
  amaliyReja: number;
  amaliyJami: number;
  nazorat: number;
  kursLoyihasi: number;
  mdRahbarligi: number;
  dlRahbarligi: number;
  amaliyot: number;
  dakTaqriz: number;
  jami: number;
  semesterTuri: string;
  sortOrder: number;
}

interface SavedYuklama {
  id: string;
  kafedraId: string;
  oquvYili: string;
  jamiSoat: number;
  kafedra: {
    id: string;
    nomi: string;
    fakultet: {
      id: string;
      nomi: string;
      otmId: string;
      otm: { id: string; nomi: string; qisqaNomi: string } | null;
    } | null;
  };
  qatorlar: SavedYuklamaQator[];
}

const TALIM_TURI_OPTIONS = [
  { value: "bakalavr", label: "Kunduzgi" },
  { value: "magistr", label: "Magistr" },
  { value: "sirtqi", label: "Sirtqi" },
  { value: "2-ot", label: "Qo'shma ta'lim" },
  { value: "masofaviy", label: "Masofaviy" },
];

const TALIM_TURI_LABELS: Record<string, string> = {
  bakalavr: "Kunduzgi",
  magistr: "Magistr",
  sirtqi: "Sirtqi",
  "2-ot": "Qo'shma ta'lim",
  masofaviy: "Masofaviy",
};

// Nazorat ko'paytuvchisi: Sirtqi va 2-OT shakli uchun 1,
// qolgan ta'lim shakllari uchun 0.5.
// Nazorat = talabalarSoni × koeffitsient
const NAZORAT_KOIFICIENT: Record<string, number> = {
  bakalavr: 0.5,
  magistr: 0.5,
  sirtqi: 1,
  "2-ot": 0.5,
  masofaviy: 0.5,
};

// Nazoratni avtomatik hisoblash
function calcNazorat(row: YuklamaFormRow): number {
  const fanNomi = row.fanId.startsWith("__excel__")
    ? row.fanId.slice("__excel__".length).toLowerCase()
    : "";
  if (
    fanNomi.includes("ilmiy pedagogik ish") ||
    fanNomi.includes("magistr dissertatsiyasiga rahbarlik")
  ) {
    return 0;
  }
  const talabalar = parseFloat(row.talabalarSoni) || 0;
  const koeff = NAZORAT_KOIFICIENT[row.talimTuri] ?? 0.5;
  return Math.round(talabalar * koeff);
}

interface YuklamaRow {
  id: number;
  nomi: string;
  yillikYuklama: number;
  yuklamaData: {
    meta?: { title?: string };
    kuzgi?: Record<string, unknown>[];
    bahorgi?: Record<string, unknown>[];
    totals?: { yillik?: { jami?: number } };
  } | null;
  fakultet: {
    id: number;
    nomi: string;
    otm: {
      id: number;
      nomi: string;
      qisqaNomi: string;
    } | null;
  } | null;
}

interface YuklamaFormRow {
  fanId: string;
  talimTuri: string;
  kurs: string;
  talimTili: string;
  semester: string;
  talabalarSoni: string;
  guruhlarSoni: string;
  potoklar: string;
  maruzaReja: string;
  maruzaJami: string;
  amaliyReja: string;
  amaliyJami: string;
  laboratoriyaReja: string;
  laboratoriyaJami: string;
  nazorat: string;
  kursLoyihasi: string;
  mdRahbarligi: string;
  dlRahbarligi: string;
  amaliyot: string;
  dakTaqriz: string;
  jami: string;
}

const emptyRow: YuklamaFormRow = {
  fanId: "",
  talimTuri: "",
  kurs: "",
  talimTili: "",
  semester: "",
  talabalarSoni: "",
  guruhlarSoni: "",
  potoklar: "",
  maruzaReja: "",
  maruzaJami: "",
  amaliyReja: "",
  amaliyJami: "",
  laboratoriyaReja: "",
  laboratoriyaJami: "",
  nazorat: "",
  kursLoyihasi: "",
  mdRahbarligi: "",
  dlRahbarligi: "",
  amaliyot: "",
  dakTaqriz: "",
  jami: "",
};

// ── Backend (snake_case) qatorlarini frontend shakliga o'girish ──
const sv = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const nv = (v: unknown) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? 0 : n; };
const normTalimTili = (raw: unknown): string => {
  const tl = sv(raw).toLowerCase();
  if (tl.includes("rus")) return "rus";
  if (tl.includes("ingl") || tl.includes("eng")) return "ingliz";
  if (tl.includes("qoraqa")) return "qoraqalpoq";
  return "uzbek";
};
const normTalimTuri = (raw: unknown): string => {
  const value = sv(raw).toLowerCase();
  if (value === "magistr") return "magistr";
  if (value === "sirtqi") return "sirtqi";
  if (value === "masofaviy") return "masofaviy";
  if (value === "2-ot" || value.includes("qo'shma") || value.includes("qoshma")) return "2-ot";
  return "bakalavr";
};
const backendRowToFormRow = (r: Record<string, unknown>): YuklamaFormRow => ({
  ...emptyRow,
  fanId: `__excel__${sv(r.fan_nomi)}`,
  talimTuri: normTalimTuri(r.talim_shakli),
  kurs: "1",
  talimTili: normTalimTili(r.talim_tili),
  semester: sv(r.semestr),
  talabalarSoni: sv(r.talabalar_soni),
  guruhlarSoni: sv(r.guruhlar_soni),
  potoklar: sv(r.patok) || "1",
  maruzaReja: sv(r.maruza_reja),
  maruzaJami: sv(r.maruza_jami),
  amaliyReja: sv(r.amaliy_reja),
  amaliyJami: sv(r.amaliy_jami),
  laboratoriyaReja: sv(r.laboratoriya_reja),
  laboratoriyaJami: sv(r.laboratoriya_jami),
  nazorat: sv(r.nazorat),
  kursLoyihasi: sv(r.kurs_loyihasi),
  mdRahbarligi: sv(r.md_ilmiy_rahbarlik),
  dlRahbarligi: sv(r.bmi_rahbarlik),
  amaliyot: sv(r.amaliyot),
  dakTaqriz: sv(r.dak_taqriz),
  jami: sv(r.jami),
});
const backendRowToQator = (r: Record<string, unknown>, semesterTuri: string, idx: number): SavedYuklamaQator => ({
  id: `${semesterTuri}-${idx}`,
  fanId: null,
  fanNomi: sv(r.fan_nomi),
  talimTuri: normTalimTuri(r.talim_shakli),
  kurs: 0,
  talimTili: normTalimTili(r.talim_tili),
  semester: r.semestr != null && r.semestr !== "" ? nv(r.semestr) : null,
  talabalarSoni: nv(r.talabalar_soni),
  guruhlarSoni: nv(r.guruhlar_soni),
  potoklar: nv(r.patok),
  maruzaReja: nv(r.maruza_reja),
  maruzaJami: nv(r.maruza_jami),
  amaliyReja: nv(r.amaliy_reja),
  amaliyJami: nv(r.amaliy_jami),
  nazorat: nv(r.nazorat),
  kursLoyihasi: nv(r.kurs_loyihasi),
  mdRahbarligi: nv(r.md_ilmiy_rahbarlik),
  dlRahbarligi: nv(r.bmi_rahbarlik),
  amaliyot: nv(r.amaliyot),
  dakTaqriz: nv(r.dak_taqriz),
  jami: nv(r.jami),
  semesterTuri,
  sortOrder: idx,
});

// Reja → Jami hisoblash: Jami = Reja × Potoklar (fallback, agar maruzaJami bo'sh bo'lsa)
function calcJamiMaruza(r: YuklamaFormRow): number {
  if (r.maruzaJami !== "") return parseFloat(r.maruzaJami) || 0;
  return (parseFloat(r.maruzaReja) || 0) * (parseFloat(r.potoklar) || 0);
}
function calcJamiAmaliy(r: YuklamaFormRow): number {
  if (r.amaliyJami !== "") return parseFloat(r.amaliyJami) || 0;
  return (parseFloat(r.amaliyReja) || 0) * (parseFloat(r.potoklar) || 0);
}
function calcJamiLab(r: YuklamaFormRow): number {
  if (r.laboratoriyaJami !== "") return parseFloat(r.laboratoriyaJami) || 0;
  return (parseFloat(r.laboratoriyaReja) || 0) * (parseFloat(r.potoklar) || 0);
}
function calcJami(r: YuklamaFormRow): number {
  return (
    calcJamiMaruza(r) +
    calcJamiAmaliy(r) +
    calcJamiLab(r) +
    calcNazorat(r) +
    (parseFloat(r.kursLoyihasi) || 0) +
    (parseFloat(r.mdRahbarligi) || 0) +
    (parseFloat(r.dlRahbarligi) || 0) +
    (parseFloat(r.amaliyot) || 0) +
    (parseFloat(r.dakTaqriz) || 0)
  );
}

const TALIM_TILI_OPTIONS = [
  { value: "uzbek", label: "O'zbek", short: "uz" },
  { value: "rus", label: "Rus", short: "ru" },
  { value: "ingliz", label: "Ingliz", short: "eng" },
  { value: "qoraqalpoq", label: "Qoraqalpoq", short: "qr" },
];

// Jadval sarlavhasini vertikal (tikka) yozish uchun
const VHEAD = "inline-block [writing-mode:vertical-rl] rotate-180 whitespace-nowrap leading-none py-1 mx-auto";

function formatTil(talimTili: string): string {
  if (!talimTili) return "—";
  const codes = talimTili.split(",");
  return codes.map(c => TALIM_TILI_OPTIONS.find(t => t.value === c)?.short || c).join("/");
}

const TALIM_TILI_LABELS: Record<string, string> = {
  uzbek: "O'zbek",
  rus: "Rus",
  ingliz: "Ingliz",
  qoraqalpoq: "Qoraqalpoq",
};

const SEMESTER_LABELS = ["Kuzgi semestr", "Bahorgi semestr"];

// ==================== PAGE ====================
export default function YuklamaPage() {
  const { academicYears, activeAcademicYear } = useDashboard();
  const [data, setData] = useState<YuklamaRow[]>([]);
  const [otmList, setOtmList] = useState<OtmItem[]>([]);
  const [selectedOtm, setSelectedOtm] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // --- Create Dialog state ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOtmId, setFormOtmId] = useState("");
  const [formFakId, setFormFakId] = useState("");
  const [formKafId, setFormKafId] = useState("");
  const [formFakList, setFormFakList] = useState<FakultetItem[]>([]);
  const [formKafList, setFormKafList] = useState<KafedraItem[]>([]);
  const [formFanList, setFormFanList] = useState<FanItem[]>([]);
  const [formOquvYili, setFormOquvYili] = useState(activeAcademicYear);

  useEffect(() => setFormOquvYili(activeAcademicYear), [activeAcademicYear]);
  const [activeSemester, setActiveSemester] = useState(0);
  const [formRowsKuz, setFormRowsKuz] = useState<YuklamaFormRow[]>([]);
  const [formRowsBaho, setFormRowsBaho] = useState<YuklamaFormRow[]>([]);

  const [editingYuklamaId, setEditingYuklamaId] = useState<string | null>(null);
  const [tilDropdownOpen, setTilDropdownOpen] = useState<number | null>(null);
  function toggleTilDropdown(idx: number) {
    setTilDropdownOpen(prev => prev === idx ? null : idx);
  }

  // --- Excel upload state ---
  const [excelData, setExcelData] = useState<{ fileName: string; kuz: YuklamaFormRow[]; baho: YuklamaFormRow[]; yillikJami: number } | null>(null);
  // Yuklangan Excel fayl — saqlashda backendga (save=true) qayta yuboriladi
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Delete Confirm Dialog state ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // --- View Dialog state ---
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewData, setViewData] = useState<SavedYuklama | null>(null);
  const [viewSemester, setViewSemester] = useState(0);

  const currentRows = activeSemester === 0 ? formRowsKuz : formRowsBaho;
  const setCurrentRows = activeSemester === 0 ? setFormRowsKuz : setFormRowsBaho;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [kafRes, otmRes, fakRes] = await Promise.all([
        fetch("/api/crud/kafedralar"),
        fetch("/api/crud/otm"),
        fetch("/api/crud/fakultetlar"),
      ]);
      if (!kafRes.ok || !otmRes.ok || !fakRes.ok) throw new Error("Xato");
      const [kafJson, otmJson, fakJson] = await Promise.all([
        kafRes.json(), otmRes.json(), fakRes.json(),
      ]);
      const toList = (d: unknown): Record<string, unknown>[] => {
        const rows = Array.isArray(d) ? d : (d as Record<string, unknown>)?.results;
        return Array.isArray(rows) ? rows : [];
      };

      // Django returns flat snake_case (name, faculty, otm). Normalize to the
      // UI shape (nomi + nested fakultet→otm chain). Tolerate either naming.
      const otmArr = toList(otmJson);
      const fakArr = toList(fakJson);
      const kafArr = toList(kafJson);

      const normOtm = (o: Record<string, unknown>): OtmItem => ({
        id: Number(o.id),
        nomi: String(o.nomi ?? o.name ?? ""),
        qisqaNomi: String(o.qisqaNomi ?? o.short_name ?? ""),
      });
      const otmById = new Map<number, OtmItem>(otmArr.map((o) => [Number(o.id), normOtm(o)]));
      const fakById = new Map<number, { id: number; nomi: string; otmId: number }>(
        fakArr.map((f) => [Number(f.id), {
          id: Number(f.id),
          nomi: String(f.nomi ?? f.name ?? ""),
          otmId: Number(typeof f.otm === "object" ? (f.otm as Record<string, unknown>)?.id : (f.otm ?? f.otmId ?? f.otm_id)),
        }]),
      );

      const normalized: YuklamaRow[] = kafArr.map((k) => {
        const fakId = Number(typeof k.fakultet === "object" ? (k.fakultet as Record<string, unknown> | null)?.id : (k.faculty ?? k.fakultetId ?? k.fakultet_id));
        const fak = fakById.get(fakId);
        const otm = fak ? otmById.get(fak.otmId) ?? null : null;
        return {
          id: Number(k.id),
          nomi: String(k.nomi ?? k.name ?? ""),
          yillikYuklama: Number(k.yillikYuklama ?? k.yillik_yuklama ?? 0) || 0,
          yuklamaData: (k.yuklama_data && typeof k.yuklama_data === "object" && Object.keys(k.yuklama_data).length)
            ? k.yuklama_data as YuklamaRow["yuklamaData"] : null,
          fakultet: fak
            ? { id: fak.id, nomi: fak.nomi, otm: otm ? { id: otm.id, nomi: otm.nomi, qisqaNomi: otm.qisqaNomi } : null }
            : null,
        };
      });

      setData(normalized);
      setOtmList(otmArr.map(normOtm));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    if (selectedOtm === "all") return data;
    return data.filter((k) => k.fakultet?.otm?.id === Number(selectedOtm));
  }, [data, selectedOtm]);

  // ==================== Cascading ====================
  async function handleFormOtmChange(otmId: string) {
    setFormOtmId(otmId);
    setFormFakId("");
    setFormKafId("");
    setFormFakList([]);
    setFormKafList([]);
    setFormFanList([]);
    if (otmId) {
      const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
      if (res.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d?.results ?? []);
        setFormFakList(list.map(normFakItem));
      }
    }
  }

  async function handleFormFakChange(fakId: string) {
    setFormFakId(fakId);
    setFormKafId("");
    setFormKafList([]);
    setFormFanList([]);
    if (fakId) {
      const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakId}`);
      if (res.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d?.results ?? []);
        setFormKafList(list.map(normKafItem));
      }
    }
  }

  async function handleFormKafChange(kafId: string) {
    setFormKafId(kafId);
    setFormFanList([]);
    if (kafId) {
      // Django sahifalaydi (20 tadan) — barcha sahifalarni yig'ib olamiz
      const rawFans: { id: number; nomi?: string; name?: string }[] = [];
      let page = 1;
      while (page <= 200) {
        const fanRes = await fetch(`/api/crud/fanlar?kafedraId=${kafId}&page=${page}`);
        if (!fanRes.ok) break;
        const fanJson = await fanRes.json();
        if (Array.isArray(fanJson)) { rawFans.push(...fanJson); break; }
        rawFans.push(...(fanJson.results ?? []));
        if (!fanJson.next || (fanJson.results ?? []).length === 0) break;
        page++;
      }
      // Django `name` -> `nomi` normalizatsiya
      const fans: FanItem[] = rawFans.map((f) => ({ id: f.id, nomi: f.nomi ?? f.name ?? "" }));
      setFormFanList(fans);

      // If we have excel data, match fan names to real IDs
      if (excelData) {
        function matchRows(rows: YuklamaFormRow[]): YuklamaFormRow[] {
          return rows.map(r => {
            if (!r.fanId.startsWith("__excel__")) return r;
            const rawName = r.fanId.replace("__excel__", "").toLowerCase();
            const matched = fans.find(f => {
              const n = (f.nomi || "").toLowerCase();
              return n !== "" && (n.includes(rawName) || rawName.includes(n));
            });
            // Mos kelsa real fan id; aks holda Excel nomini saqlab qolamiz (ko'rinishi uchun)
            return matched ? { ...r, fanId: String(matched.id) } : r;
          });
        }
        setFormRowsKuz(matchRows(excelData.kuz));
        setFormRowsBaho(matchRows(excelData.baho));
      } else {
        setFormRowsKuz([]);
        setFormRowsBaho([]);
      }
    } else {
      setFormRowsKuz([]);
      setFormRowsBaho([]);
    }
  }

  // ==================== Row management ====================
  function addRow() {
    setCurrentRows((prev: YuklamaFormRow[]) => [...prev, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setCurrentRows((prev: YuklamaFormRow[]) => prev.filter((_: YuklamaFormRow, i: number) => i !== index));
  }

  function updateRow(index: number, field: keyof YuklamaFormRow, value: string) {
    setCurrentRows((prev: YuklamaFormRow[]) =>
      prev.map((r: YuklamaFormRow, i: number) => {
        if (i !== index) return r;
        const u = { ...r, [field]: value };

        // Auto-calc maruzaJami when maruzaReja or potoklar changes
        if (field === "maruzaReja" || field === "potoklar") {
          u.maruzaJami = String((parseFloat(u.maruzaReja) || 0) * (parseFloat(u.potoklar) || 0));
        }
        // Auto-calc amaliyJami when amaliyReja or potoklar changes
        if (field === "amaliyReja" || field === "potoklar") {
          u.amaliyJami = String((parseFloat(u.amaliyReja) || 0) * (parseFloat(u.potoklar) || 0));
        }
        // Auto-calc nazorat when talabalarSoni or talimTuri changes
        if (field === "talabalarSoni" || field === "talimTuri") {
          u.nazorat = String(calcNazorat(u));
        }
        // Auto-calc jami when any numeric field changes (except jami itself)
        if (field !== "jami") {
          u.jami = String(
            calcJamiMaruza(u) +
            calcJamiAmaliy(u) +
            calcNazorat(u) +
            (parseFloat(u.kursLoyihasi) || 0) +
            (parseFloat(u.mdRahbarligi) || 0) +
            (parseFloat(u.dlRahbarligi) || 0) +
            (parseFloat(u.amaliyot) || 0) +
            (parseFloat(u.dakTaqriz) || 0)
          );
        }
        return u;
      })
    );
  }

  function openCreateDialog() {
    setFormOtmId("");
    setFormFakId("");
    setFormKafId("");
    setFormFakList([]);
    setFormKafList([]);
    setFormFanList([]);
    setFormOquvYili(activeAcademicYear);
    setActiveSemester(0);
    setFormRowsKuz(excelData ? excelData.kuz : []);
    setFormRowsBaho(excelData ? excelData.baho : []);
    setEditingYuklamaId(null);
    setDialogOpen(true);
  }

  // Excel faylni backend endpointiga yuboradi (/api/crud/yuklama-excel/),
  // u "O'QUV YUKLAMASI HAJMI" formatini o'qib, kuzgi/bahorgi + jami qaytaradi.
  async function handleFileUpload(file: File) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      toast.error("Faqat Excel fayllari (.xlsx, .xlsm, .xls) qabul qilinadi");
      return;
    }
    setExcelLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/crud/yuklama-excel/", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Faylni o'qishda xato");

      const kuzRows: YuklamaFormRow[] = (data.kuzgi || []).map(backendRowToFormRow);
      const bahoRows: YuklamaFormRow[] = (data.bahorgi || []).map(backendRowToFormRow);

      // Yillik jami: backend totals dan, bo'lmasa qatorlar yig'indisidan
      const sumJami = (rows: YuklamaFormRow[]) =>
        rows.reduce((sum, r) => sum + (parseFloat(r.jami) || 0), 0);
      const yillikJami =
        Number(data.totals?.yillik?.jami) || sumJami(kuzRows) + sumJami(bahoRows);

      setUploadedFile(file); // saqlashda backendga qayta yuboriladi
      setExcelData({ fileName: file.name, kuz: kuzRows, baho: bahoRows, yillikJami });

      const warn = Array.isArray(data.warnings) && data.warnings.length ? `  ⚠ ${data.warnings[0]}` : "";
      toast.success(`"${file.name}" — ${kuzRows.length} kuzgi + ${bahoRows.length} bahorgi qator${warn}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Faylni o'qishda xato yuz berdi");
    } finally {
      setExcelLoading(false);
    }
  }

  async function openEditDialog(kafedraId: string) {
    const kafedra = data.find(k => String(k.id) === kafedraId);
    if (!kafedra?.fakultet?.otm) {
      toast.error("Kafedra ma'lumotlari topilmadi");
      return;
    }

    const saved = kafedra.yuklamaData;
    const savedKuz = saved?.kuzgi ?? [];
    const savedBaho = saved?.bahorgi ?? [];
    if (!saved || (savedKuz.length === 0 && savedBaho.length === 0)) {
      toast.error("Saqlangan yuklama topilmadi");
      return;
    }

    try {
      const otmId = String(kafedra.fakultet.otm.id);
      const fakId = String(kafedra.fakultet.id);

      setFormOtmId(otmId);
      setFormFakId(fakId);
      setFormKafId(kafedraId);
      setEditingYuklamaId(kafedraId);

      const [fakRes, kafRes, fanRes] = await Promise.all([
        fetch(`/api/crud/fakultetlar?otmId=${otmId}`),
        fetch(`/api/crud/kafedralar?fakultetId=${fakId}`),
        fetch(`/api/crud/fanlar?kafedraId=${kafedraId}`),
      ]);
      const tl = (d: unknown): Record<string, unknown>[] => {
        const rows = Array.isArray(d) ? d : (d as Record<string, unknown>)?.results;
        return Array.isArray(rows) ? rows : [];
      };
      if (fakRes.ok) setFormFakList(tl(await fakRes.json()).map(normFakItem));
      if (kafRes.ok) setFormKafList(tl(await kafRes.json()).map(normKafItem));
      if (fanRes.ok) setFormFanList(tl(await fanRes.json()).map((fan) => ({ id: Number(fan.id), nomi: String(fan.nomi ?? fan.name ?? "") })));

      // Saqlangan qatorlarni ko'rsatish uchun formaga yuklaymiz (snake_case -> form)
      setFormRowsKuz(savedKuz.map(backendRowToFormRow));
      setFormRowsBaho(savedBaho.map(backendRowToFormRow));
      setUploadedFile(null); // yangilash uchun faylni qayta yuklash kerak
      setActiveSemester(0);
      setDialogOpen(true);
    } catch {
      toast.error("Yuklamani yuklashda xato");
    }
  }

  // ==================== SUBMIT (backend save: save=true + department_id) ====================
  async function handleSubmit() {
    if (!formKafId) {
      toast.error("Kafedrani tanlang");
      return;
    }
    if (!uploadedFile) {
      toast.error("Avval Excel faylni yuklang");
      return;
    }

    setSubmitting(true);
    try {
      // Faylni backendga yuboramiz — u Subjectlar (fanlar) ni kafedraga bog'lab
      // yaratadi, yuklama_data va yillik_yuklamani saqlaydi.
      const fd = new FormData();
      fd.append("file", uploadedFile);
      fd.append("save", "true");
      fd.append("department_id", formKafId);
      const res = await fetch("/api/crud/yuklama-excel/", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Xato");

      // Saqlangan yuklamadan fanlarni "Fanlar" bo'limida shakllantirish (dedup bilan)
      let fanMsg = "";
      try {
        const fr = await fetch("/api/crud/fanlar-shakllantir/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ departmentId: formKafId }),
        });
        if (fr.ok) {
          const fj = await fr.json();
          const total = (fj.created ?? 0) + (fj.updated ?? 0);
          if (total > 0) fanMsg = ` — ${total} ta fan "Fanlar" bo'limida shakllandi`;
        }
      } catch (e) {
        console.error("Fanlarni shakllantirishda xato:", e);
      }

      toast.success(`Yuklama saqlandi${fanMsg}`);
      setDialogOpen(false);
      setUploadedFile(null);
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setSubmitting(false);
    }
  }

  // ==================== VIEW ====================
  function openDeleteConfirm(kafedraId: string) {
    setDeleteTargetId(kafedraId);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleteConfirmOpen(false);
    try {
      // Backend bitta amalda: kafedra yuklamasi + barcha fanlar (Subject) + Yuklama yozuvlarini o'chiradi
      const res = await fetch(`/api/crud/fanlar-shakllantir/?department_id=${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || "O'chirishda xato");
      }
      const out = await res.json().catch(() => ({}));
      toast.success(`Yuklama o'chirildi (${out.deleted_subjects ?? 0} ta fan ham o'chirildi)`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirishda xato");
    } finally {
      setDeleteTargetId(null);
    }
  }

  function openViewDialog(kafedraId: string) {
    setViewLoading(true);
    setViewSemester(0);
    setViewData(null);
    setViewOpen(true);

    const kafedra = data.find((k) => String(k.id) === kafedraId);
    const saved = kafedra?.yuklamaData;
    const kuzgi = saved?.kuzgi ?? [];
    const bahorgi = saved?.bahorgi ?? [];
    if (kafedra && saved && (kuzgi.length > 0 || bahorgi.length > 0)) {
      const qatorlar: SavedYuklamaQator[] = [
        ...kuzgi.map((r, i) => backendRowToQator(r, "kuzgi", i)),
        ...bahorgi.map((r, i) => backendRowToQator(r, "bahorgi", i)),
      ];
      setViewData({
        id: kafedraId,
        kafedraId,
        oquvYili: "",
        jamiSoat: kafedra.yillikYuklama || 0,
        kafedra: {
          id: String(kafedra.id),
          nomi: kafedra.nomi,
          fakultet: kafedra.fakultet
            ? {
                id: String(kafedra.fakultet.id),
                nomi: kafedra.fakultet.nomi,
                otmId: kafedra.fakultet.otm ? String(kafedra.fakultet.otm.id) : "",
                otm: kafedra.fakultet.otm
                  ? { id: String(kafedra.fakultet.otm.id), nomi: kafedra.fakultet.otm.nomi, qisqaNomi: kafedra.fakultet.otm.qisqaNomi }
                  : null,
              }
            : null,
        },
        qatorlar,
      });
    } else {
      setViewData(null);
    }
    setViewLoading(false);
  }

  // ==================== Summary ====================
  const jamiKuz = useMemo(() => formRowsKuz.reduce((s, r) => s + calcJami(r), 0), [formRowsKuz]);
  const jamiBaho = useMemo(() => formRowsBaho.reduce((s, r) => s + calcJami(r), 0), [formRowsBaho]);
  const jamiBarcha = jamiKuz + jamiBaho;

  // Column summaries for active semester
  const colSum = useMemo(() => {
    const rows = currentRows;
    return {
      maruza: rows.reduce((s, r) => s + calcJamiMaruza(r), 0),
      amaliy: rows.reduce((s, r) => s + calcJamiAmaliy(r), 0),
      lab: rows.reduce((s, r) => s + calcJamiLab(r), 0),
      nazorat: rows.reduce((s, r) => s + calcNazorat(r), 0),
      kursLoyihasi: rows.reduce((s, r) => s + (parseFloat(r.kursLoyihasi) || 0), 0),
      md: rows.reduce((s, r) => s + (parseFloat(r.mdRahbarligi) || 0), 0),
      dl: rows.reduce((s, r) => s + (parseFloat(r.dlRahbarligi) || 0), 0),
      amaliyot: rows.reduce((s, r) => s + (parseFloat(r.amaliyot) || 0), 0),
      dakTaqriz: rows.reduce((s, r) => s + (parseFloat(r.dakTaqriz) || 0), 0),
    };
  }, [currentRows]);

  // View dialog qatorlar by semester
  const viewKuzRows = useMemo(
    () => viewData?.qatorlar.filter((q) => q.semesterTuri === "kuzgi") || [],
    [viewData]
  );
  const viewBahoRows = useMemo(
    () => viewData?.qatorlar.filter((q) => q.semesterTuri === "bahorgi") || [],
    [viewData]
  );
  const viewCurrentRows = viewSemester === 0 ? viewKuzRows : viewBahoRows;

  const viewColSum = useMemo(() => {
    return {
      maruza: viewCurrentRows.reduce((s, r) => s + r.maruzaJami, 0),
      amaliy: viewCurrentRows.reduce((s, r) => s + r.amaliyJami, 0),
      nazorat: viewCurrentRows.reduce((s, r) => s + r.nazorat, 0),
      kursLoyihasi: viewCurrentRows.reduce((s, r) => s + r.kursLoyihasi, 0),
      md: viewCurrentRows.reduce((s, r) => s + r.mdRahbarligi, 0),
      dl: viewCurrentRows.reduce((s, r) => s + r.dlRahbarligi, 0),
      amaliyot: viewCurrentRows.reduce((s, r) => s + r.amaliyot, 0),
      dakTaqriz: viewCurrentRows.reduce((s, r) => s + r.dakTaqriz, 0),
    };
  }, [viewCurrentRows]);

  const viewJamiKuz = useMemo(() => viewKuzRows.reduce((s, r) => s + r.jami, 0), [viewKuzRows]);
  const viewJamiBaho = useMemo(() => viewBahoRows.reduce((s, r) => s + r.jami, 0), [viewBahoRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ==================== RENDER: Main page ====================
  return (
    <div className="space-y-6">
      {/* Sahifa sarlavhasi */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-6 w-6" />
          Yuklama
        </h1>
        <p className="text-muted-foreground mt-1">
          OTM lardagi barcha kafedralarning yillik yuklamasi
        </p>
      </div>

      {/* Excel yuklash maydoni */}
      <div className="flex flex-col items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
            e.target.value = "";
          }}
        />
        <div
          className={`w-full max-w-lg border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            excelData
              ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
          }`}
          onClick={() => !excelLoading && fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFileUpload(f);
          }}
        >
          {excelLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Fayl o&apos;qilmoqda...</p>
            </div>
          ) : excelData ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <p className="font-medium text-sm">{excelData.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {excelData.kuz.length} kuzgi + {excelData.baho.length} bahorgi qator o&apos;qildi
              </p>
              <p className="text-xs text-primary">Boshqa fayl tanlash uchun bosing</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-sm">Faylni yuborish</p>
              <p className="text-xs text-muted-foreground">
                Excel faylni bu yerga tashlang yoki bosib tanlang (.xlsx, .xls)
              </p>
            </div>
          )}
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Yuklama yaratish
        </Button>
      </div>

      {/* OTM bo'yicha filtr */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={selectedOtm} onValueChange={setSelectedOtm}>
          <SelectTrigger className="w-full sm:w-[300px] truncate">
            <SelectValue placeholder="OTM tanlang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha OTM lar</SelectItem>
            {otmList.map((otm) => (
              <SelectItem key={otm.id} value={String(otm.id)}>
                {otm.nomi}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kafedralar jadvali */}
      {filteredData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-background">
          <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Hech qanday kafedra topilmadi</p>
          <p className="text-sm mt-1">
            Avval OTM va kafedralarni kiritishingiz kerak
          </p>
        </div>
      ) : (
        <div className="border rounded-lg bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="text-center">Kafedra nomi</TableHead>
                <TableHead className="text-center">OTM</TableHead>
                <TableHead className="text-center">Yuklama soati</TableHead>
                <TableHead className="w-[150px] text-center">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((kafedra, index) => (
                <TableRow key={kafedra.id}>
                  <TableCell className="text-muted-foreground text-center">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium text-center">
                    {kafedra.nomi}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">
                    {kafedra.fakultet?.otm?.qisqaNomi || kafedra.fakultet?.otm?.nomi || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={(kafedra.yillikYuklama ?? 0) > 0 ? "default" : "outline"}>
                      {(kafedra.yillikYuklama ?? 0).toLocaleString()} soat
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 disabled:opacity-30"
                        title={kafedra.yillikYuklama > 0 ? "Tahrirlash" : "Yuklama mavjud emas"}
                        disabled={kafedra.yillikYuklama <= 0}
                        onClick={() => openEditDialog(String(kafedra.id))}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 disabled:opacity-30"
                        title={kafedra.yillikYuklama > 0 ? "Ko'rish" : "Yuklama mavjud emas"}
                        disabled={kafedra.yillikYuklama <= 0}
                        onClick={() => openViewDialog(String(kafedra.id))}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30 disabled:hover:text-destructive"
                        title={kafedra.yillikYuklama > 0 ? "O'chirish" : "Yuklama mavjud emas"}
                        disabled={kafedra.yillikYuklama <= 0}
                        onClick={() => openDeleteConfirm(String(kafedra.id))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Yangilash tugmasi */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Yangilash
        </Button>
      </div>

      {/* ==================== YUKLAMA YARATISH DIALOG ==================== */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDialogOpen(false)} />
          <div className="relative bg-background w-full max-w-[98vw] mx-2 my-4 overflow-hidden shadow-2xl rounded-xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b px-6 py-3 bg-primary/5">
              <h2 className="text-lg font-bold">
                {editingYuklamaId ? "Yuklama tahrirlash" : "Yuklama yaratish"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* ===== YUQORI PANEL ===== */}
            <div className="border-b px-6 py-4 bg-muted/20">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* OTM */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <Building2 className="h-3 w-3" />
                    OTM
                  </Label>
                  <Select value={formOtmId} onValueChange={handleFormOtmChange}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="OTM tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {otmList.map((otm) => (
                        <SelectItem key={otm.id} value={String(otm.id)}>
                          {otm.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fakultet */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <Landmark className="h-3 w-3" />
                    Fakultet
                  </Label>
                  <Select value={formFakId} onValueChange={handleFormFakChange} disabled={!formOtmId}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder={formOtmId ? "Fakultet tanlang" : "Avval OTM tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formFakList.map((fak) => (
                        <SelectItem key={fak.id} value={String(fak.id)}>
                          {fak.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Kafedra */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <Library className="h-3 w-3" />
                    Kafedra
                  </Label>
                  <Select value={formKafId} onValueChange={handleFormKafChange} disabled={!formFakId}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder={formFakId ? "Kafedra tanlang" : "Avval fakultet tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formKafList.map((kaf) => (
                        <SelectItem key={kaf.id} value={String(kaf.id)}>
                          {kaf.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* O'quv yili */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <RefreshCw className="h-3 w-3" />
                    O&apos;quv yili
                  </Label>
                  <Select value={formOquvYili} onValueChange={setFormOquvYili}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="O&apos;quv yili" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((yil) => (
                        <SelectItem key={yil} value={yil}>
                          {yil}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ===== SEMESTER TABS ===== */}
            {formKafId && (
              <div className="px-6 pt-4 pb-2 flex items-center gap-4 flex-wrap">
                {SEMESTER_LABELS.map((label, idx) => (
                  <Button
                    key={label}
                    variant={activeSemester === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveSemester(idx)}
                    className="gap-1.5"
                  >
                    {label}
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                      {idx === 0 ? formRowsKuz.length : formRowsBaho.length} ta fan
                    </Badge>
                  </Button>
                ))}

                <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Kuzgi: <strong className="text-foreground">{jamiKuz.toLocaleString()}</strong> soat</span>
                  <span>Bahorgi: <strong className="text-foreground">{jamiBaho.toLocaleString()}</strong> soat</span>
                  <span className="text-primary font-bold">Jami: {jamiBarcha.toLocaleString()} soat</span>
                </div>
              </div>
            )}

            {/* ===== JADVAL ===== */}
            {formKafId && (
              <div className="px-4 pb-4">
                <div className="rounded-lg overflow-x-auto" onClick={() => setTilDropdownOpen(null)}>
                  <Table className="text-xs table-grid">
                    <TableHeader>
                      {/* Qator 1: Asosiy sarlavhalar */}
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="w-[40px] text-center p-1.5" rowSpan={2}>T/r</TableHead>
                        <TableHead className="w-[240px] p-1.5 text-center" rowSpan={2}>Fan nomi</TableHead>
                        <TableHead className="w-[95px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Ta&apos;lim turi</span></TableHead>
                        <TableHead className="w-[64px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Ta&apos;lim tili</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Semestr</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Talabalar soni</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Guruhlar soni</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Patoklar</span></TableHead>
                        <TableHead className="p-1.5 text-center whitespace-normal leading-tight" colSpan={2}>Ma&apos;ruza</TableHead>
                        <TableHead className="p-1.5 text-center whitespace-normal leading-tight" colSpan={2}>Amaliy<br />mashg&apos;ulot</TableHead>
                        <TableHead className="p-1.5 text-center whitespace-normal leading-tight" colSpan={2}>Labratoriya<br />mashg&apos;uloti</TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Nazorat</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Kurs loyihasi</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>MD ilmiy rahbarlik</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>BMI rahbarlik</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>Amaliyot</span></TableHead>
                        <TableHead className="w-[58px] p-1 text-center" rowSpan={2}><span className={VHEAD}>DAK, Taqriz</span></TableHead>
                        <TableHead className="w-[64px] p-1 text-center font-bold" rowSpan={2}><span className={VHEAD}>Jami</span></TableHead>
                        <TableHead className="w-[36px] p-1" rowSpan={2}></TableHead>
                      </TableRow>
                      {/* Qator 2: Reja / Jami pastki sarlavhalar */}
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="w-[58px] p-1 text-center">Reja</TableHead>
                        <TableHead className="w-[58px] p-1 text-center">Jami</TableHead>
                        <TableHead className="w-[58px] p-1 text-center">Reja</TableHead>
                        <TableHead className="w-[58px] p-1 text-center">Jami</TableHead>
                        <TableHead className="w-[58px] p-1 text-center">Reja</TableHead>
                        <TableHead className="w-[58px] p-1 text-center">Jami</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRows.map((row, idx) => {
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-center text-muted-foreground p-1">{idx + 1}</TableCell>

                            {/* Fan nomi */}
                            <TableCell className="p-1 w-[240px] max-w-[240px]">
                              <Select
                                value={row.fanId}
                                onValueChange={(v) => updateRow(idx, "fanId", v)}
                              >
                                <SelectTrigger className="h-auto min-h-7 py-1 text-[11px] justify-center text-center w-full !whitespace-normal [&>span]:line-clamp-none [&>svg]:shrink-0">
                                  {/* Radix SelectValue ro'yxatda bo'lmagan qiymat matnini ko'rsatmaydi —
                                      shuning uchun fan nomini bevosita chiqaramiz */}
                                  <span className="whitespace-normal break-words text-center leading-tight min-w-0">
                                    {row.fanId?.startsWith("__excel__")
                                      ? row.fanId.slice("__excel__".length)
                                      : (formFanList.find((f) => String(f.id) === row.fanId)?.nomi || "Fan tanlang")}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {/* Excel'dan kelgan fan nomi (real fanlar ro'yxatida bo'lmasligi mumkin) */}
                                  {row.fanId?.startsWith("__excel__") &&
                                    !formFanList.some((f) => String(f.id) === row.fanId) && (
                                      <SelectItem value={row.fanId}>
                                        {row.fanId.slice("__excel__".length)}
                                      </SelectItem>
                                    )}
                                  {formFanList.map((f) => (
                                    <SelectItem key={f.id} value={String(f.id)}>
                                      {f.nomi}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Ta'lim turi */}
                            <TableCell className="p-1">
                              <Select
                                value={row.talimTuri}
                                onValueChange={(v) => updateRow(idx, "talimTuri", v)}
                              >
                                <SelectTrigger className="h-7 text-[11px] truncate justify-center text-center">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TALIM_TURI_OPTIONS.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Ta'lim tili */}
                            <TableCell className="p-1 relative">
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="h-7 w-full text-[10px] text-center rounded cursor-pointer hover:bg-muted/50 border border-transparent hover:border-primary/30"
                                  onClick={() => toggleTilDropdown(idx)}
                                >
                                  {formatTil(row.talimTili) || "—"}
                                </button>
                                {tilDropdownOpen === idx && (
                                  <div className="absolute top-full left-0 z-50 mt-1 bg-background border rounded-md shadow-lg p-1 min-w-[120px]">
                                    {TALIM_TILI_OPTIONS.map(t => {
                                      const codes = row.talimTili ? row.talimTili.split(",") : [];
                                      const checked = codes.includes(t.value);
                                      return (
                                        <label key={t.value} className="flex items-center gap-1.5 px-2 py-1 text-[11px] cursor-pointer hover:bg-muted/50 rounded">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                              const newCodes = checked
                                                ? codes.filter(c => c !== t.value)
                                                : [...codes, t.value];
                                              updateRow(idx, "talimTili", newCodes.join(","));
                                            }}
                                            className="h-3.5 w-3.5 accent-primary"
                                          />
                                          <span>{t.label}</span>
                                          <span className="text-muted-foreground ml-auto text-[10px]">({t.short})</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Semestr */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="—" value={row.semester} onChange={(e) => updateRow(idx, "semester", e.target.value)} />
                            </TableCell>

                            {/* Talabalar soni */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.talabalarSoni} onChange={(e) => updateRow(idx, "talabalarSoni", e.target.value)} />
                            </TableCell>

                            {/* Guruhlar soni */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.guruhlarSoni} onChange={(e) => updateRow(idx, "guruhlarSoni", e.target.value)} />
                            </TableCell>

                            {/* Potoklar */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.potoklar} onChange={(e) => updateRow(idx, "potoklar", e.target.value)} />
                            </TableCell>

                            {/* Ma'ruza Reja */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.maruzaReja} onChange={(e) => updateRow(idx, "maruzaReja", e.target.value)} />
                            </TableCell>
                            {/* Ma'ruza Jami */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.maruzaJami} onChange={(e) => updateRow(idx, "maruzaJami", e.target.value)} />
                            </TableCell>

                            {/* Amaliy Reja */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.amaliyReja} onChange={(e) => updateRow(idx, "amaliyReja", e.target.value)} />
                            </TableCell>
                            {/* Amaliy Jami */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.amaliyJami} onChange={(e) => updateRow(idx, "amaliyJami", e.target.value)} />
                            </TableCell>

                            {/* Laboratoriya Reja */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.laboratoriyaReja} onChange={(e) => updateRow(idx, "laboratoriyaReja", e.target.value)} />
                            </TableCell>
                            {/* Laboratoriya Jami */}
                            <TableCell className="p-1">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.laboratoriyaJami} onChange={(e) => updateRow(idx, "laboratoriyaJami", e.target.value)} />
                            </TableCell>

                            {/* Nazorat (avtomatik: talabalar × koeffitsient) */}
                            <TableCell className="p-1 bg-primary/5">
                              <span className="text-[11px] font-medium text-center block">{calcNazorat(row) || "0"}</span>
                            </TableCell>

                            {/* Kurs loyihasi */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.kursLoyihasi} onChange={(e) => updateRow(idx, "kursLoyihasi", e.target.value)} />
                            </TableCell>

                            {/* MD rahbarligi */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.mdRahbarligi} onChange={(e) => updateRow(idx, "mdRahbarligi", e.target.value)} />
                            </TableCell>

                            {/* DL rahbarli */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.dlRahbarligi} onChange={(e) => updateRow(idx, "dlRahbarligi", e.target.value)} />
                            </TableCell>

                            {/* Amaliyot */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.amaliyot} onChange={(e) => updateRow(idx, "amaliyot", e.target.value)} />
                            </TableCell>

                            {/* DAK, Taqriz */}
                            <TableCell className="p-1 ">
                              <Input className="h-7 text-[10px] text-center px-0.5" placeholder="0" value={row.dakTaqriz} onChange={(e) => updateRow(idx, "dakTaqriz", e.target.value)} />
                            </TableCell>

                            {/* Jami (avtomatik hisoblash) */}
                            <TableCell className="p-1 text-center bg-primary/5">
                              <span className="text-[11px] font-bold text-primary">{calcJami(row) || "0"}</span>
                            </TableCell>

                            {/* O'chirish */}
                            <TableCell className="p-0.5 text-center">
                              {currentRows.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 mx-auto text-destructive hover:text-destructive"
                                  onClick={() => removeRow(idx)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Jami qator */}
                      {currentRows.length > 0 && (
                        <TableRow className="bg-primary/5 font-semibold">
                          <TableCell className="p-1 text-center" colSpan={8}>
                            <span className="text-xs font-bold">{SEMESTER_LABELS[activeSemester]} bo&apos;yicha jami:</span>
                          </TableCell>
                          <TableCell className="p-1 text-center text-[11px]"></TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.maruza.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]"></TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.amaliy.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]"></TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.lab.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.nazorat.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.kursLoyihasi.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.md.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.dl.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.amaliyot.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">{colSum.dakTaqriz.toLocaleString()}</TableCell>
                          <TableCell className="p-1 text-center text-[11px]">
                            <span className="font-bold text-primary">
                              {(activeSemester === 0 ? jamiKuz : jamiBaho).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="p-0.5"></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Qator qo'shish */}
                <div className="flex items-center justify-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Qator qo&apos;shish
                  </Button>
                </div>
              </div>
            )}

            {/* Kafedra tanlanmagan */}
            {!formKafId && (
              <div className="text-center py-16 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Yuklama yaratish uchun OTM, Fakultet va Kafedrani tanlang</p>
              </div>
            )}

            {/* Dialog Footer */}
            <Separator />
            <div className="flex items-center justify-between px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Kafedra yillik yuklamasi: <span className="font-bold text-primary">{jamiBarcha.toLocaleString()} soat</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !formKafId}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saqlanmoqda...
                    </>
                  ) : (
                    "Saqlash"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== YUKLAMANI KO'RISH DIALOG ==================== */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewOpen(false)} />
          <div className="relative bg-background w-full max-w-[98vw] mx-2 my-4 overflow-hidden shadow-2xl rounded-xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b px-6 py-3 bg-primary/5">
              <h2 className="text-lg font-bold">Yuklamani ko&apos;rish</h2>
              <Button variant="ghost" size="icon" onClick={() => setViewOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {viewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewData ? (
              <>
                {/* Yuqori panel */}
                <div className="border-b px-6 py-4 bg-muted/20">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1 text-center">
                      <span className="text-xs text-muted-foreground">Kafedra</span>
                      <p className="text-sm font-semibold">{viewData.kafedra?.nomi || "—"}</p>
                    </div>
                    <div className="space-y-1 text-center">
                      <span className="text-xs text-muted-foreground">OTM</span>
                      <p className="text-sm font-semibold">{viewData.kafedra?.fakultet?.otm?.nomi || "—"}</p>
                    </div>
                    <div className="space-y-1 text-center">
                      <span className="text-xs text-muted-foreground">Fakultet</span>
                      <p className="text-sm font-semibold">{viewData.kafedra?.fakultet?.nomi || "—"}</p>
                    </div>
                    <div className="space-y-1 text-center">
                      <span className="text-xs text-muted-foreground">O&apos;quv yili</span>
                      <p className="text-sm font-semibold">{viewData.oquvYili}</p>
                    </div>
                  </div>
                </div>

                {/* Semester Tabs */}
                <div className="px-6 pt-4 pb-2 flex items-center gap-4 flex-wrap">
                  {SEMESTER_LABELS.map((label, idx) => (
                    <Button
                      key={label}
                      variant={viewSemester === idx ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewSemester(idx)}
                      className="gap-1.5"
                    >
                      {label}
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                        {idx === 0 ? viewKuzRows.length : viewBahoRows.length} ta fan
                      </Badge>
                    </Button>
                  ))}

                  <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Kuzgi: <strong className="text-foreground">{viewJamiKuz.toLocaleString()}</strong> soat</span>
                    <span>Bahorgi: <strong className="text-foreground">{viewJamiBaho.toLocaleString()}</strong> soat</span>
                    <span className="text-primary font-bold">Jami: {(viewJamiKuz + viewJamiBaho).toLocaleString()} soat</span>
                  </div>
                </div>

                {/* Jadval */}
                <div className="px-4 pb-4">
                  <div className="rounded-lg overflow-x-auto">
                    <Table className="text-xs table-grid">
                      <TableHeader>
                        {/* Qator 1: Asosiy sarlavhalar */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableHead className="w-[36px] text-center p-1.5" rowSpan={2}>T/r</TableHead>
                          <TableHead className="w-[280px] p-1.5 text-center" rowSpan={2}>Fan nomi</TableHead>
                          <TableHead className="w-[85px] p-1.5 text-center" rowSpan={2}>Ta&apos;lim turi</TableHead>
                          <TableHead className="w-[80px] p-1.5 text-center" rowSpan={2}>Ta&apos;lim tili</TableHead>
                          <TableHead className="w-[56px] p-1.5 text-center" rowSpan={2}>Sem.</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center" rowSpan={2}>Talabalar</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center" rowSpan={2}>Guruhlar</TableHead>
                          <TableHead className="w-[56px] p-1.5 text-center" rowSpan={2}>Potoklar</TableHead>
                          <TableHead className="w-[110px] p-1.5 text-center " colSpan={2}>Ma&apos;ruza</TableHead>
                          <TableHead className="w-[120px] p-1.5 text-center " colSpan={2}>Amaliy mashg&apos;ulot</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center " rowSpan={2}>Nazorat</TableHead>
                          <TableHead className="w-[65px] p-1.5 text-center " rowSpan={2}>Kurs loyihasi</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center " rowSpan={2}>MD rahbarligi</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center " rowSpan={2}>DL rahbarli</TableHead>
                          <TableHead className="w-[55px] p-1.5 text-center " rowSpan={2}>Amaliyot</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center " rowSpan={2}>DAK, Taqriz</TableHead>
                          <TableHead className="w-[60px] p-1.5 text-center  font-bold" rowSpan={2}>Jami</TableHead>
                        </TableRow>
                        {/* Qator 2: Reja / Jami pastki sarlavhalar */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableHead className="w-[55px] p-1 text-center">Reja</TableHead>
                          <TableHead className="w-[55px] p-1 text-center">Jami</TableHead>
                          <TableHead className="w-[60px] p-1 text-center ">Reja</TableHead>
                          <TableHead className="w-[60px] p-1 text-center">Jami</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewCurrentRows.map((q, idx) => (
                          <TableRow key={`${q.semesterTuri}-${q.sortOrder ?? idx}`}>
                            <TableCell className="text-center text-muted-foreground p-1">{idx + 1}</TableCell>
                            <TableCell className="p-1 font-medium text-center w-[280px] max-w-[280px] whitespace-normal break-words leading-tight">{q.fanNomi}</TableCell>
                            <TableCell className="p-1 text-center">{TALIM_TURI_LABELS[q.talimTuri] || q.talimTuri}</TableCell>
                            <TableCell className="p-1 text-center">{formatTil(q.talimTili)}</TableCell>
                            <TableCell className="p-1 text-center">{q.semester || "—"}</TableCell>
                            <TableCell className="p-1 text-center">{q.talabalarSoni}</TableCell>
                            <TableCell className="p-1 text-center">{q.guruhlarSoni}</TableCell>
                            <TableCell className="p-1 text-center">{q.potoklar}</TableCell>
                            <TableCell className="p-1 text-center ">{q.maruzaReja}</TableCell>
                            <TableCell className="p-1 text-center">{q.maruzaJami || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.amaliyReja}</TableCell>
                            <TableCell className="p-1 text-center">{q.amaliyJami || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.nazorat || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.kursLoyihasi || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.mdRahbarligi || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.dlRahbarligi || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.amaliyot || "—"}</TableCell>
                            <TableCell className="p-1 text-center ">{q.dakTaqriz || "—"}</TableCell>
                            <TableCell className="p-1 text-center  bg-primary/5 font-bold text-primary">{q.jami}</TableCell>
                          </TableRow>
                        ))}

                        {/* Jami qator */}
                        {viewCurrentRows.length > 0 && (
                          <TableRow className="bg-primary/5 font-semibold">
                            <TableCell className="p-1 text-center" colSpan={9}>
                              <span className="text-xs font-bold">{SEMESTER_LABELS[viewSemester]} bo&apos;yicha jami:</span>
                            </TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.maruza.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px]"></TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.amaliy.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.nazorat.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.kursLoyihasi.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.md.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.dl.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.amaliyot.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">{viewColSum.dakTaqriz.toLocaleString()}</TableCell>
                            <TableCell className="p-1 text-center text-[11px] ">
                              <span className="font-bold text-primary">
                                {(viewSemester === 0 ? viewJamiKuz : viewJamiBaho).toLocaleString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Bu kafedrada saqlangan yuklama topilmadi</p>
              </div>
            )}

            {/* Footer */}
            <Separator />
            <div className="flex items-center justify-end px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>
                Yopish
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ==================== O'CHIRISH TASDIQLASH DIALOG ==================== */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative bg-background w-full max-w-md mx-4 shadow-2xl rounded-xl border">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Yuklamani o&apos;chirish</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Ushbu kafedraning yuklamasini o&apos;chirmoqchimisiz? Bu amalni qaytarib bo&apos;lmaydi.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setDeleteConfirmOpen(false); setDeleteTargetId(null); }}
                  className="min-w-[100px]"
                >
                  Bekor qilish
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  className="min-w-[100px]"
                >
                  O&apos;chirish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
