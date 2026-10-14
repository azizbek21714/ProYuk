"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Trash2, ClipboardList, ExternalLink, ArrowUpDown, Loader2,
  Building2, Landmark, Library, Users, RefreshCw, X,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { useDashboard } from "@/contexts/dashboard-context";

// ==================== TYPES ====================
interface OtmItem { id: string; nomi: string; }
interface FakultetItem { id: string; nomi: string; }
interface KafedraItem { id: string; nomi: string; }
interface OqituvchiItem { id: string; fio: string; }
interface FanItem { id: string; nomi: string; }

interface RejaRecord {
  id: string;
  oqituvchiId: string;
  oquvYiliNomi: string;
  status: string;
  jamiSoat: number;
  createdAt: string;
  updatedAt: string;
  oqituvchi: { id: string; fio: string; lavozim: string; kafedraNomi: string | null } | null;
}

// ==================== LABELS ====================
const STATUS_LABELS: Record<string, string> = {
  loyiha: "Loyiha",
  kafedra_tasdiqlagan: "Kafedra tasdiqlagan",
  dekan_tasdiqlagan: "Dekan tasdiqlagan",
  tasdiqlangan: "Tasdiqlangan",
  rad_etilgan: "Rad etilgan",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  loyiha: "secondary",
  kafedra_tasdiqlagan: "outline",
  dekan_tasdiqlagan: "outline",
  tasdiqlangan: "default",
  rad_etilgan: "destructive",
};

const LAVOZIM_LABELS: Record<string, string> = {
  professor: "Professor",
  dotsent: "Dotsent",
  katta_oqituvchi: "K.o'qituvchi",
  oqituvchi: "O'qituvchi",
  assistent: "Assistent",
};

const TALIM_TURI_OPTIONS = [
  { value: "bakalavr", label: "Bakalavr" },
  { value: "magistr", label: "Magistr" },
  { value: "sirtqi", label: "Sirtqi" },
  { value: "2-ot", label: "2-OT" },
  { value: "masofaviy", label: "Masofaviy" },
];

const KURS_BY_TALIM_TURI: Record<string, number[]> = {
  bakalavr: [1, 2, 3, 4],
  magistr: [1, 2],
  sirtqi: [1, 2, 3, 4, 5],
  "2-ot": [2, 3, 4, 5],
  masofaviy: [1, 2, 3, 4],
};

const NAZORAT_KOIFICIENT: Record<string, Record<number, number>> = {
  bakalavr:   { 3: 0.4, 4: 0.5 },
  magistr:    { 1: 0.4, 2: 0.5 },
  sirtqi:     { 3: 1,   4: 1,   5: 1 },
  "2-ot":     { 3: 1,   4: 1 },
  masofaviy:  { 3: 0.5, 4: 0.5 },
};

const TALIM_TILI_OPTIONS = [
  { value: "uzbek", label: "O'zbek", short: "uz" },
  { value: "rus", label: "Rus", short: "ru" },
  { value: "ingliz", label: "Ingliz", short: "eng" },
  { value: "qoraqalpoq", label: "Qoraqalpoq", short: "qr" },
];

const SEMESTER_LABELS = ["Kuzgi semestr", "Bahorgi semestr"];

// ==================== FORM ROW ====================
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
  nazorat: string;
  kursLoyihasi: string;
  mdRahbarligi: string;
  dlRahbarligi: string;
  amaliyot: string;
  dakTaqriz: string;
  jami: string;
}

const emptyRow: YuklamaFormRow = {
  fanId: "", talimTuri: "", kurs: "", talimTili: "", semester: "",
  talabalarSoni: "", guruhlarSoni: "", potoklar: "",
  maruzaReja: "", maruzaJami: "", amaliyReja: "", amaliyJami: "",
  nazorat: "", kursLoyihasi: "", mdRahbarligi: "", dlRahbarligi: "",
  amaliyot: "", dakTaqriz: "", jami: "",
};

function calcNazorat(row: YuklamaFormRow): number {
  const kurs = parseInt(row.kurs) || 0;
  const talabalar = parseFloat(row.talabalarSoni) || 0;
  const koeff = NAZORAT_KOIFICIENT[row.talimTuri]?.[kurs];
  if (koeff == null) return 0;
  return talabalar * koeff;
}

function calcJamiMaruza(r: YuklamaFormRow): number {
  if (r.maruzaJami !== "") return parseFloat(r.maruzaJami) || 0;
  return (parseFloat(r.maruzaReja) || 0) * (parseFloat(r.potoklar) || 0);
}

function calcJamiAmaliy(r: YuklamaFormRow): number {
  if (r.amaliyJami !== "") return parseFloat(r.amaliyJami) || 0;
  return (parseFloat(r.amaliyReja) || 0) * (parseFloat(r.potoklar) || 0);
}

function calcJami(r: YuklamaFormRow): number {
  return (
    calcJamiMaruza(r) + calcJamiAmaliy(r) + calcNazorat(r) +
    (parseFloat(r.kursLoyihasi) || 0) + (parseFloat(r.mdRahbarligi) || 0) +
    (parseFloat(r.dlRahbarligi) || 0) + (parseFloat(r.amaliyot) || 0) +
    (parseFloat(r.dakTaqriz) || 0)
  );
}

function formatTil(talimTili: string): string {
  if (!talimTili) return "\u2014";
  const codes = talimTili.split(",");
  return codes.map((c) => TALIM_TILI_OPTIONS.find((t) => t.value === c.trim())?.short || c.trim()).join("/");
}

// ==================== SCHEMA ====================
const rejaSchema = z.object({
  oqituvchiId: z.string().min(1, "O'qituvchini tanlang"),
  oquvYiliNomi: z.string().min(1, "O'quv yilini tanlang"),
});

type RejaFormData = z.infer<typeof rejaSchema>;

const API = "/api/crud/rejalar";

function InfoPill({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium text-sm truncate">{value || "\u2014"}</p>
    </div>
  );
}

// ==================== PAGE ====================
export default function RejalarPage() {
  const router = useRouter();
  const { academicYears, activeAcademicYear } = useDashboard();

  const [data, setData] = useState<RejaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Create form visibility
  const [open, setOpen] = useState(false);
  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null);

  // --- Cascading selects state ---
  const [otmList, setOtmList] = useState<OtmItem[]>([]);
  const [formOtmId, setFormOtmId] = useState("");
  const [formFakList, setFormFakList] = useState<FakultetItem[]>([]);
  const [formFakId, setFormFakId] = useState("");
  const [formKafList, setFormKafList] = useState<KafedraItem[]>([]);
  const [formKafId, setFormKafId] = useState("");
  const [formOqituvchiList, setFormOqituvchiList] = useState<OqituvchiItem[]>([]);
  const [formOqituvchiId, setFormOqituvchiId] = useState("");
  const [formOquvYili, setFormOquvYili] = useState(activeAcademicYear);
  const [loadingOtm, setLoadingOtm] = useState(false);
  const [loadingFak, setLoadingFak] = useState(false);
  const [loadingKaf, setLoadingKaf] = useState(false);
  const [loadingOqituvchi, setLoadingOqituvchi] = useState(false);

  // --- Editable template state ---
  const [formRowsKuz, setFormRowsKuz] = useState<YuklamaFormRow[]>([]);
  const [formRowsBaho, setFormRowsBaho] = useState<YuklamaFormRow[]>([]);
  const [activeSemester, setActiveSemester] = useState(0);
  const [formFanList, setFormFanList] = useState<FanItem[]>([]);
  const [tilDropdownOpen, setTilDropdownOpen] = useState<number | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  const form = useForm<RejaFormData>({
    resolver: zodResolver(rejaSchema),
    defaultValues: { oqituvchiId: "", oquvYiliNomi: activeAcademicYear },
  });

  // --- Editable table helpers ---
  const currentRows = activeSemester === 0 ? formRowsKuz : formRowsBaho;
  const setCurrentRows = activeSemester === 0 ? setFormRowsKuz : setFormRowsBaho;

  const jamiKuz = useMemo(() => formRowsKuz.reduce((s, r) => s + calcJami(r), 0), [formRowsKuz]);
  const jamiBaho = useMemo(() => formRowsBaho.reduce((s, r) => s + calcJami(r), 0), [formRowsBaho]);
  const jamiBarcha = jamiKuz + jamiBaho;

  const colSum = useMemo(() => ({
    maruza: currentRows.reduce((s, r) => s + calcJamiMaruza(r), 0),
    amaliy: currentRows.reduce((s, r) => s + calcJamiAmaliy(r), 0),
    nazorat: currentRows.reduce((s, r) => s + calcNazorat(r), 0),
    kursLoyihasi: currentRows.reduce((s, r) => s + (parseFloat(r.kursLoyihasi) || 0), 0),
    md: currentRows.reduce((s, r) => s + (parseFloat(r.mdRahbarligi) || 0), 0),
    dl: currentRows.reduce((s, r) => s + (parseFloat(r.dlRahbarligi) || 0), 0),
    amaliyot: currentRows.reduce((s, r) => s + (parseFloat(r.amaliyot) || 0), 0),
    dakTaqriz: currentRows.reduce((s, r) => s + (parseFloat(r.dakTaqriz) || 0), 0),
  }), [currentRows]);

  // --- Fetch data ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setData(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      toast.error("Ma'lumotlarni yuklashda xato");
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Cascading fetches ---
  async function fetchOtmList() {
    setLoadingOtm(true);
    try {
      const res = await fetch("/api/crud/otm");
      if (res.ok) {
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : (raw.results ?? []);
        setOtmList(list);
        if (list.length === 0) toast.info("OTM ro'yxati bo'sh. Avval OTM qo'shing.");
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error("OTM ro'yxatini yuklashda xato: " + (errData.error || res.statusText));
      }
    } catch (err) {
      console.error("fetchOtmList xato:", err);
      toast.error("OTM ro'yxatini yuklashda xato");
    }
    setLoadingOtm(false);
  }

  async function handleOtmChange(otmId: string) {
    setFormOtmId(otmId);
    setFormFakId("");
    setFormKafId("");
    setFormOqituvchiId("");
    setFormFakList([]);
    setFormKafList([]);
    setFormOqituvchiList([]);
    if (otmId) {
      setLoadingFak(true);
      try {
        const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
        if (res.ok) {
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (raw.results ?? []);
          setFormFakList(list);
          if (list.length === 0) toast.info("Ushbu OTMda fakultetlar topilmadi.");
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error("Fakultetlarni yuklashda xato: " + (errData.error || res.statusText));
        }
      } catch (err) {
        console.error("handleOtmChange xato:", err);
        toast.error("Fakultetlarni yuklashda xato");
      }
      setLoadingFak(false);
    }
  }

  async function handleFakChange(fakId: string) {
    setFormFakId(fakId);
    setFormKafId("");
    setFormOqituvchiId("");
    setFormKafList([]);
    setFormOqituvchiList([]);
    if (fakId) {
      setLoadingKaf(true);
      try {
        const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakId}`);
        if (res.ok) {
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (raw.results ?? []);
          setFormKafList(list);
          if (list.length === 0) toast.info("Ushbu fakultetda kafedralar topilmadi.");
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error("Kafedralarni yuklashda xato: " + (errData.error || res.statusText));
        }
      } catch (err) {
        console.error("handleFakChange xato:", err);
        toast.error("Kafedralarni yuklashda xato");
      }
      setLoadingKaf(false);
    }
  }

  async function handleKafChange(kafId: string) {
    setFormKafId(kafId);
    setFormOqituvchiId("");
    setFormOqituvchiList([]);
    setFormFanList([]);
    if (kafId) {
      setLoadingOqituvchi(true);
      try {
        const [oqRes, fanRes] = await Promise.all([
          fetch(`/api/crud/oqituvchilar?kafedraId=${kafId}`),
          fetch(`/api/crud/fanlar?kafedraId=${kafId}`),
        ]);
        if (oqRes.ok) {
          const raw = await oqRes.json();
          const list = Array.isArray(raw) ? raw : (raw.results ?? []);
          console.log("Oqituvchilar API javobi (kafedraId=" + kafId + "):", list);
          const mapped = list.map((o: { id: string; fio: string }) => ({ id: o.id, fio: o.fio }));
          console.log("Mapped oqituvchilar:", mapped);
          setFormOqituvchiList(mapped);
          if (mapped.length === 0) {
            toast.info("Ushbu kafedrada o'qituvchilar topilmadi. O'qituvchilar bo'limidan avval qo'shing.");
          }
        } else {
          const errData = await oqRes.json().catch(() => ({}));
          console.error("Oqituvchilar API xato:", oqRes.status, errData);
          toast.error("O'qituvchilarni yuklashda xato: " + (errData.error || oqRes.statusText));
        }
        if (fanRes.ok) { const d = await fanRes.json(); setFormFanList(Array.isArray(d) ? d : (d.results ?? [])); }
      } catch (err) {
        console.error("handleKafChange xato:", err);
        toast.error("Ma'lumotlarni yuklashda xato");
      }
      setLoadingOqituvchi(false);
    }
  }

  // --- Open editable template when o'qituvchi is selected ---
  useEffect(() => {
    if (!formOqituvchiId || !formKafId) {
      setTemplateOpen(false);
      return;
    }
    // Always open the template
    setTemplateOpen(true);
    setActiveSemester(0);
  }, [formOqituvchiId, formKafId]);

  // --- Row management ---
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
        if (field === "maruzaReja" || field === "potoklar") {
          u.maruzaJami = String((parseFloat(u.maruzaReja) || 0) * (parseFloat(u.potoklar) || 0));
        }
        if (field === "amaliyReja" || field === "potoklar") {
          u.amaliyJami = String((parseFloat(u.amaliyReja) || 0) * (parseFloat(u.potoklar) || 0));
        }
        if (field === "talabalarSoni" || field === "talimTuri" || field === "kurs") {
          u.nazorat = String(calcNazorat(u));
        }
        if (field !== "jami") {
          u.jami = String(
            calcJamiMaruza(u) + calcJamiAmaliy(u) + calcNazorat(u) +
            (parseFloat(u.kursLoyihasi) || 0) + (parseFloat(u.mdRahbarligi) || 0) +
            (parseFloat(u.dlRahbarligi) || 0) + (parseFloat(u.amaliyot) || 0) +
            (parseFloat(u.dakTaqriz) || 0)
          );
        }
        return u;
      })
    );
  }

  function toggleTilDropdown(idx: number) {
    setTilDropdownOpen(prev => prev === idx ? null : idx);
  }

  // --- Sort ---
  function handleSort(field: string) {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // --- Filter + Sort + Paginate ---
  const sorted = [...data].sort((a, b) => {
    if (!sortField) return 0;
    const av = sortField === "oqituvchiFio" ? a.oqituvchi?.fio ?? "" : sortField === "statusLabel" ? STATUS_LABELS[a.status] ?? a.status : a[sortField as keyof RejaRecord];
    const bv = sortField === "oqituvchiFio" ? b.oqituvchi?.fio ?? "" : sortField === "statusLabel" ? STATUS_LABELS[b.status] ?? b.status : b[sortField as keyof RejaRecord];
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const filtered = sorted.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.oqituvchi?.fio.toLowerCase().includes(q) ||
      (item.oquvYiliNomi ?? "").toLowerCase().includes(q) ||
      (item.oqituvchi?.kafedraNomi ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  // --- Dialog open/close ---
  function openCreateDialog() {
    setFormOtmId("");
    setFormFakId("");
    setFormKafId("");
    setFormOqituvchiId("");
    setFormOquvYili(activeAcademicYear);
    setFormFakList([]);
    setFormKafList([]);
    setFormOqituvchiList([]);
    setFormFanList([]);
    setFormRowsKuz([]);
    setFormRowsBaho([]);
    setActiveSemester(0);
    setTemplateOpen(false);
    form.reset({ oqituvchiId: "", oquvYiliNomi: activeAcademicYear });
    setOpen(true);
    fetchOtmList();
  }

  // --- Create from template ---
  async function onSubmitFromTemplate() {
    if (!formOqituvchiId) {
      toast.error("O'qituvchini tanlang");
      return;
    }
    setTemplateSaving(true);
    try {
      const totalHours = jamiBarcha;
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oqituvchiId: formOqituvchiId, oquvYiliNomi: formOquvYili, jamiSoat: totalHours }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      toast.success("Reja muvaffaqiyatli yaratildi");
      await fetchData();
      setTemplateOpen(false);
      setOpen(false);
      router.push(`/dashboard/admin/rejalar/${json.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setTemplateSaving(false);
    }
  }

  // --- Create (fallback) ---
  async function onSubmit() {
    if (!formOqituvchiId) {
      toast.error("O'qituvchini tanlang");
      return;
    }
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oqituvchiId: formOqituvchiId, oquvYiliNomi: formOquvYili, jamiSoat: jamiBarcha }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      toast.success("Reja muvaffaqiyatli yaratildi");
      await fetchData();
      setOpen(false);
      router.push(`/dashboard/admin/rejalar/${json.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Muvaffaqiyatli o'chirildi");
      await fetchData();
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "O'chirishda xato");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shaxsiy rejalar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O&apos;qituvchilar shaxsiy ish rejalarini boshqarish
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Yangi reja yaratish
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="FIO, kafedra yoki o'quv yili bo'yicha qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Hali rejalar yo&apos;q.</h3>
            <p className="mt-1 text-sm text-muted-foreground">Yangi reja yaratish tugmasini bosing.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer" onClick={() => handleSort("oqituvchiFio")}>
                        O&apos;qituvchi <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Lavozim</TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer" onClick={() => handleSort("oquvYiliNomi")}>
                        O&apos;quv yili <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer" onClick={() => handleSort("statusLabel")}>
                        Status <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer" onClick={() => handleSort("jamiSoat")}>
                        Jami soat <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-24 text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{(page - 1) * pageSize + idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.oqituvchi?.fio || "\u2014"}</p>
                          {item.oqituvchi?.kafedraNomi && (
                            <p className="text-xs text-muted-foreground">{item.oqituvchi.kafedraNomi}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {LAVOZIM_LABELS[item.oqituvchi?.lavozim || "oqituvchi"] || item.oqituvchi?.lavozim || "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.oquvYiliNomi}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[item.status] || "secondary"}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold">
                        {formatNumber(item.jamiSoat)} soat
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/dashboard/admin/rejalar/${item.id}`)}>
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Ochish</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({id: item.id, name: `${item.oqituvchi?.fio || "Noma'lum"} - ${item.oquvYiliNomi}`})}>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">Jami {filtered.length} ta, {page}/{totalPages} sahifa</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Keyingi</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== YANGI REJA YARATISH — BUTUN SAHIFA FORMA ==================== */}
      {open && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-primary/5">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Yangi reja yaratish</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                OTM, fakultet, kafedra va o&apos;qituvchini tanlang. O&apos;qituvchi tanlanganda shablon jadvali ochiladi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setOpen(false); form.reset(); setTemplateOpen(false); }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Bekor qilish
              </Button>
            </div>
          </div>

          {/* Cascading selects — gorizontal butun kenglik */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-5 gap-4">
              {/* OTM */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  OTM
                </Label>
                <Select value={formOtmId} onValueChange={handleOtmChange} disabled={loadingOtm}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="OTM tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {otmList.map((otm) => (
                      <SelectItem key={otm.id} value={otm.id}>
                        {otm.nomi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fakultet */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-primary" />
                  Fakultet
                </Label>
                <Select value={formFakId} onValueChange={handleFakChange} disabled={!formOtmId || loadingFak}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder={formOtmId ? "Fakultet tanlang" : "Avval OTM tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formFakList.map((fak) => (
                      <SelectItem key={fak.id} value={fak.id}>
                        {fak.nomi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kafedra */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Library className="h-3.5 w-3.5 text-primary" />
                  Kafedra
                </Label>
                <Select value={formKafId} onValueChange={handleKafChange} disabled={!formFakId || loadingKaf}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder={formFakId ? "Kafedra tanlang" : "Avval fakultet tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formKafList.map((kaf) => (
                      <SelectItem key={kaf.id} value={kaf.id}>
                        {kaf.nomi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* O'qituvchi */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  O&apos;qituvchi
                </Label>
                <Select value={formOqituvchiId} onValueChange={setFormOqituvchiId} disabled={!formKafId || loadingOqituvchi}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder={formKafId ? "O'qituvchi tanlang" : "Avval kafedra tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formOqituvchiList.map((oq) => (
                      <SelectItem key={oq.id} value={oq.id}>
                        {oq.fio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* O'quv yili */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  O&apos;quv yili
                </Label>
                <Select value={formOquvYili} onValueChange={setFormOquvYili}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="O'quv yili" />
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
        </div>
      )}

      {/* ==================== SHABLON JADVAL (Full-page overlay) ==================== */}
      {templateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setTemplateOpen(false)} />
          <div className="relative bg-background w-full max-w-[98vw] mx-2 my-4 overflow-hidden shadow-2xl rounded-xl flex flex-col max-h-[96vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-3 bg-primary/5">
              <div>
                <h2 className="text-lg font-bold">Shaxsiy ish reja — {formOqituvchiList.find((o) => o.id === formOqituvchiId)?.fio || ""}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Jadvalni to&apos;ldiring va saqlang</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setTemplateOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Top info panel */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-6 py-3 border-b bg-muted/20">
              <InfoPill label="OTM" value={otmList.find((o) => o.id === formOtmId)?.nomi} />
              <InfoPill label="Fakultet" value={formFakList.find((f) => f.id === formFakId)?.nomi} />
              <InfoPill label="Kafedra" value={formKafList.find((k) => k.id === formKafId)?.nomi} />
              <InfoPill label="O'qituvchi" value={formOqituvchiList.find((o) => o.id === formOqituvchiId)?.fio} />
              <InfoPill label="O'quv yili" value={formOquvYili} />
            </div>

            {/* Semester tabs */}
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

            {/* ===== JADVAL ===== */}
            <div className="px-4 pb-4 flex-1 overflow-auto">
              <div className="rounded-lg overflow-x-auto" onClick={() => setTilDropdownOpen(null)}>
                <Table className="text-xs table-grid">
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-[36px] text-center p-1.5" rowSpan={2}>T/r</TableHead>
                      <TableHead className="w-[140px] p-1.5" rowSpan={2}>Fan nomi</TableHead>
                      <TableHead className="w-[95px] p-1.5 text-center" rowSpan={2}>Ta&apos;lim turi</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Kurs</TableHead>
                      <TableHead className="w-[85px] p-1.5 text-center" rowSpan={2}>Ta&apos;lim tili</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Semestr</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Talabalar</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Guruhlar</TableHead>
                      <TableHead className="w-[60px] p-1.5 text-center" rowSpan={2}>Potoklar</TableHead>
                      <TableHead className="w-[120px] p-1.5 text-center" colSpan={2}>Ma&apos;ruza</TableHead>
                      <TableHead className="w-[130px] p-1.5 text-center" colSpan={2}>Amaliy mashg&apos;ulot</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Nazorat</TableHead>
                      <TableHead className="w-[72px] p-1.5 text-center" rowSpan={2}>Kurs loyihasi</TableHead>
                      <TableHead className="w-[72px] p-1.5 text-center" rowSpan={2}>MD rahbarligi</TableHead>
                      <TableHead className="w-[72px] p-1.5 text-center" rowSpan={2}>DL rahbarli</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center" rowSpan={2}>Amaliyot</TableHead>
                      <TableHead className="w-[72px] p-1.5 text-center" rowSpan={2}>DAK, Taqriz</TableHead>
                      <TableHead className="w-[65px] p-1.5 text-center font-bold" rowSpan={2}>Jami</TableHead>
                      <TableHead className="w-[32px] p-1" rowSpan={2}></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-[55px] p-1 text-center">Reja</TableHead>
                      <TableHead className="w-[55px] p-1 text-center">Jami</TableHead>
                      <TableHead className="w-[60px] p-1 text-center">Reja</TableHead>
                      <TableHead className="w-[60px] p-1 text-center">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center text-muted-foreground p-1">{idx + 1}</TableCell>

                        {/* Fan nomi */}
                        <TableCell className="p-1">
                          <Select value={row.fanId} onValueChange={(v) => updateRow(idx, "fanId", v)}>
                            <SelectTrigger className="h-7 text-[11px] truncate">
                              <SelectValue placeholder="Fan tanlang" />
                            </SelectTrigger>
                            <SelectContent>
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
                            onValueChange={(v) => {
                              updateRow(idx, "talimTuri", v);
                              updateRow(idx, "kurs", "");
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] truncate">
                              <SelectValue placeholder="Ta'lim turi" />
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

                        {/* Kurs */}
                        <TableCell className="p-1">
                          <Select value={row.kurs} onValueChange={(v) => updateRow(idx, "kurs", v)} disabled={!row.talimTuri}>
                            <SelectTrigger className="h-7 text-[11px] truncate">
                              <SelectValue placeholder="Kurs" />
                            </SelectTrigger>
                            <SelectContent>
                              {row.talimTuri && KURS_BY_TALIM_TURI[row.talimTuri]?.map((k) => (
                                <SelectItem key={k} value={String(k)}>
                                  {k}-kurs
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
                              className="h-7 w-full text-[11px] text-center rounded cursor-pointer hover:bg-muted/50 border border-transparent hover:border-primary/30"
                              onClick={() => toggleTilDropdown(idx)}
                            >
                              {formatTil(row.talimTili) || "Til tanlang"}
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
                                        onChange={(e) => {
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
                          <Input className="h-7 text-[11px] text-center" placeholder="—" value={row.semester} onChange={(e) => updateRow(idx, "semester", e.target.value)} />
                        </TableCell>

                        {/* Talabalar */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.talabalarSoni} onChange={(e) => updateRow(idx, "talabalarSoni", e.target.value)} />
                        </TableCell>

                        {/* Guruhlar */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.guruhlarSoni} onChange={(e) => updateRow(idx, "guruhlarSoni", e.target.value)} />
                        </TableCell>

                        {/* Potoklar */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.potoklar} onChange={(e) => updateRow(idx, "potoklar", e.target.value)} />
                        </TableCell>

                        {/* Ma'ruza Reja */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.maruzaReja} onChange={(e) => updateRow(idx, "maruzaReja", e.target.value)} />
                        </TableCell>
                        {/* Ma'ruza Jami */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.maruzaJami} onChange={(e) => updateRow(idx, "maruzaJami", e.target.value)} />
                        </TableCell>

                        {/* Amaliy Reja */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.amaliyReja} onChange={(e) => updateRow(idx, "amaliyReja", e.target.value)} />
                        </TableCell>
                        {/* Amaliy Jami */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.amaliyJami} onChange={(e) => updateRow(idx, "amaliyJami", e.target.value)} />
                        </TableCell>

                        {/* Nazorat */}
                        <TableCell className="p-1 bg-primary/5">
                          <span className="text-[11px] font-medium text-center block">{calcNazorat(row) || "0"}</span>
                        </TableCell>

                        {/* Kurs loyihasi */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.kursLoyihasi} onChange={(e) => updateRow(idx, "kursLoyihasi", e.target.value)} />
                        </TableCell>

                        {/* MD rahbarligi */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.mdRahbarligi} onChange={(e) => updateRow(idx, "mdRahbarligi", e.target.value)} />
                        </TableCell>

                        {/* DL rahbarli */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.dlRahbarligi} onChange={(e) => updateRow(idx, "dlRahbarligi", e.target.value)} />
                        </TableCell>

                        {/* Amaliyot */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.amaliyot} onChange={(e) => updateRow(idx, "amaliyot", e.target.value)} />
                        </TableCell>

                        {/* DAK, Taqriz */}
                        <TableCell className="p-1">
                          <Input className="h-7 text-[11px] text-center" placeholder="0" value={row.dakTaqriz} onChange={(e) => updateRow(idx, "dakTaqriz", e.target.value)} />
                        </TableCell>

                        {/* Jami */}
                        <TableCell className="p-1 text-center bg-primary/5">
                          <span className="text-[11px] font-bold text-primary">{calcJami(row) || "0"}</span>
                        </TableCell>

                        {/* O'chirish */}
                        <TableCell className="p-0.5">
                          {currentRows.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeRow(idx)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Jami qator */}
                    {currentRows.length > 0 && (
                      <TableRow className="bg-primary/5 font-semibold">
                        <TableCell className="p-1 text-center" colSpan={10}>
                          <span className="text-xs font-bold">{SEMESTER_LABELS[activeSemester]} bo&apos;yicha jami:</span>
                        </TableCell>
                        <TableCell className="p-1 text-center text-[11px]">{colSum.maruza.toLocaleString()}</TableCell>
                        <TableCell className="p-1 text-center text-[11px]"></TableCell>
                        <TableCell className="p-1 text-center text-[11px]">{colSum.amaliy.toLocaleString()}</TableCell>
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
                <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Qator qo&apos;shish
                </Button>
              </div>
            </div>

            {/* Footer */}
            <Separator />
            <div className="flex items-center justify-between px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Umumiy soat: <span className="font-bold text-primary">{jamiBarcha.toLocaleString()} soat</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setTemplateOpen(false)}>
                  Bekor qilish
                </Button>
                <Button
                  onClick={onSubmitFromTemplate}
                  disabled={templateSaving}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {templateSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saqlanmoqda...
                    </>
                  ) : (
                    "Reja yaratish"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => setDeleteTarget(v ? deleteTarget : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O&apos;chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" ni o'chirishga ishonchingiz komilmi? Barcha yuklamalar ham o'chiriladi.`
                : "Bu amalni qaytarib bo'lmaydi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">O&apos;chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
