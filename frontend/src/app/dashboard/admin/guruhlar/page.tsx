"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDashboard } from "@/contexts/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  GraduationCap,
  Loader2,
  Landmark,
  Building2,
  Filter,
  Users,
  BookOpen,
  Globe,
  CalendarDays,
} from "lucide-react";

// ==================== TYPES ====================
interface OtmItem {
  id: string;
  nomi: string;
  qisqaNomi: string;
}

interface FakultetItem {
  id: string;
  nomi: string;
  otmId: string;
}

interface KafedraItem {
  id: string;
  nomi: string;
  fakultetId: string;
}

interface GuruhRecord {
  id: string;
  kafedraId: string;
  nomi: string;
  talabaSoni: number;
  sirtqi: boolean;
  kurs: number;
  oquvYiliNomi: string;
  talimShakli: string;
  talimTili: string;
  createdAt: string;
  kafedra: {
    id: string;
    nomi: string;
    fakultet: {
      id: string;
      nomi: string;
      otmId: string;
      otm: { id: string; nomi: string; qisqaNomi?: string } | null;
    } | null;
  } | null;
}

// Django API dan keladigan xom guruh yozuvi (snake_case)
interface GuruhApiRow {
  id: string | number;
  department?: string | number | null;
  name?: string; nomi?: string;
  students?: number; talabaSoni?: number;
  study_format?: string; program_type?: string; course?: string;
  oquv_yili?: string; oquvYiliNomi?: string;
  study_language?: string; talimTili?: string;
  created_at?: string; createdAt?: string;
  kafedra?: {
    id: string | number; name?: string; nomi?: string;
    fakultet?: { id: string | number; name?: string; nomi?: string; otm_id?: string | number; otmId?: string | number } | null;
  } | null;
}

// ==================== CONSTANTS ====================
const TALIM_SHAKLI_OPTIONS = [
  { value: "bakalavr", label: "Bakalavr" },
  { value: "magistr", label: "Magistr" },
  { value: "sirtqi", label: "Sirtqi" },
  { value: "2-ot", label: "2-OT" },
  { value: "masofaviy", label: "Masofaviy" },
];

const TALIM_TILI_OPTIONS = [
  { value: "uz", label: "O'zbek" },
  { value: "ru", label: "Rus" },
  { value: "en", label: "Ingliz" },
];

const KURS_OPTIONS = [
  { value: "1", label: "1-kurs" },
  { value: "2", label: "2-kurs" },
  { value: "3", label: "3-kurs" },
  { value: "4", label: "4-kurs" },
];

// Ta'lim shakliga qarab mavjud kurslar
const KURS_BY_TALIM_SHAKLI: Record<string, number[]> = {
  bakalavr: [1, 2, 3, 4],
  magistr: [1, 2],
  sirtqi: [1, 2, 3, 4, 5],
  "2-ot": [2, 3, 4, 5],
  masofaviy: [1, 2, 3, 4],
};

const kursOptionsFor = (talimShakli: string): { value: string; label: string }[] =>
  (KURS_BY_TALIM_SHAKLI[talimShakli] ?? [1, 2, 3, 4]).map((k) => ({
    value: String(k),
    label: `${k}-kurs`,
  }));

// Django tekis (name/faculty/otm) -> UI shakliga (nomi + string id) normalizatsiya.
type RawRecord = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const normOtm = (x: RawRecord): OtmItem => ({ id: str(x.id), nomi: str(x.nomi ?? x.name), qisqaNomi: str(x.qisqaNomi ?? x.short_name) });
const normFak = (x: RawRecord): FakultetItem => ({
  id: str(x.id),
  nomi: str(x.nomi ?? x.name),
  otmId: str(x.otmId ?? (typeof x.otm === "object" ? (x.otm as RawRecord)?.id : x.otm)),
});
const normKaf = (x: RawRecord): KafedraItem => ({
  id: str(x.id),
  nomi: str(x.nomi ?? x.name),
  fakultetId: str(x.fakultetId ?? (typeof x.fakultet === "object" ? (x.fakultet as RawRecord)?.id : x.faculty)),
});

const TALIM_SHAKLI_MAP: Record<string, string> = Object.fromEntries(
  TALIM_SHAKLI_OPTIONS.map((o) => [o.value, o.label])
);

// talimShakli <-> Django (program_type + study_format)
function talimShakliToDjango(t: string): { program_type: string; study_format: string } {
  switch (t) {
    case "magistr": return { program_type: "master", study_format: "full_time" };
    case "sirtqi": return { program_type: "bachelor", study_format: "part_time" };
    case "2-ot": return { program_type: "bachelor", study_format: "evening" };
    case "masofaviy": return { program_type: "bachelor", study_format: "distance" };
    default: return { program_type: "bachelor", study_format: "full_time" };
  }
}
function djangoToTalimShakli(programType: string, studyFormat: string): string {
  if (programType === "master") return "magistr";
  if (studyFormat === "part_time") return "sirtqi";
  if (studyFormat === "evening") return "2-ot";
  if (studyFormat === "distance") return "masofaviy";
  return "bakalavr";
}
const numFromChoice = (v: unknown): number => {
  const m = String(v ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
const TALIM_TILI_MAP: Record<string, string> = Object.fromEntries(
  TALIM_TILI_OPTIONS.map((o) => [o.value, o.label])
);

// ==================== SCHEMA ====================
const guruhSchema = z.object({
  kafedraId: z.string().min(1, "Kafedrani tanlang"),
  nomi: z.string().min(1, "Guruh nomini kiriting"),
  talabaSoni: z.number().int().min(1, "Kamida 1 talaba"),
  oquvYiliNomi: z.string().min(1, "O'quv yilini kiriting"),
  talimShakli: z.string().min(1, "Ta'lim shaklini tanlang"),
  talimTili: z.string().min(1, "Ta'lim tilini tanlang"),
  kurs: z.number().int().min(1).max(5),
});

type GuruhFormData = z.infer<typeof guruhSchema>;

const API = "/api/crud/guruhlar";

// ==================== PAGE ====================
export default function GuruhlarPage() {
  const { academicYears, activeAcademicYear } = useDashboard();
  const oquvYiliOptions = academicYears.map((value) => ({ value, label: value }));
  // --- Cascading filter state ---
  const [otmList, setOtmList] = useState<OtmItem[]>([]);
  const [fakultetList, setFakultetList] = useState<FakultetItem[]>([]);
  const [kafedraList, setKafedraList] = useState<KafedraItem[]>([]);
  const [filterOtm, setFilterOtm] = useState("");
  const [filterFak, setFilterFak] = useState("");
  const [filterKaf, setFilterKaf] = useState("");
  const [filterTalimShakli, setFilterTalimShakli] = useState("");
  const [filterKurs, setFilterKurs] = useState("");

  // --- Table state ---
  const [data, setData] = useState<GuruhRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // --- Form state ---
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form cascade
  const [formOtmId, setFormOtmId] = useState("");
  const [formFakId, setFormFakId] = useState("");
  const [formFakList, setFormFakList] = useState<FakultetItem[]>([]);
  const [formKafList, setFormKafList] = useState<KafedraItem[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<GuruhFormData>({
    resolver: zodResolver(guruhSchema),
    defaultValues: {
      kafedraId: "",
      nomi: "",
      talabaSoni: 25,
      oquvYiliNomi: activeAcademicYear,
      talimShakli: "bakalavr",
      talimTili: "uz",
      kurs: 1,
    },
  });

  // ==================== FETCH ====================
  const fetchOtmList = useCallback(async () => {
    try {
      const res = await fetch("/api/crud/otm");
      const json = await res.json();
      if (res.ok) {
        const list = Array.isArray(json) ? json : (json.results ?? []);
        setOtmList(list.map(normOtm));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchFakultetList = useCallback(async (otmId: string) => {
    try {
      const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
      const json = await res.json();
      if (res.ok) {
        const list = Array.isArray(json) ? json : (json.results ?? []);
        return list.map(normFak);
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  }, []);

  const fetchKafedraList = useCallback(async (fakId: string) => {
    try {
      const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakId}`);
      const json = await res.json();
      if (res.ok) {
        const list = Array.isArray(json) ? json : (json.results ?? []);
        return list.map(normKaf);
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterKaf) params.set("kafedraId", filterKaf);
      else if (filterFak) params.set("fakultetId", filterFak);
      else if (filterOtm) params.set("otmId", filterOtm);
      if (filterTalimShakli) params.set("talimShakli", filterTalimShakli);
      if (filterKurs) params.set("kurs", filterKurs);

      const url = params.toString() ? `${API}?${params.toString()}` : API;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const rawList = Array.isArray(json) ? json : (json.results ?? []);
      // Django (snake_case) -> GuruhRecord (UI shakli)
      const normalized: GuruhRecord[] = rawList.map((g: GuruhApiRow) => ({
        id: String(g.id),
        kafedraId: g.department != null ? String(g.department) : "",
        nomi: g.nomi ?? g.name ?? "",
        talabaSoni: Number(g.talabaSoni ?? g.students ?? 0),
        sirtqi: g.study_format === "part_time",
        kurs: numFromChoice(g.course),
        oquvYiliNomi: g.oquvYiliNomi ?? g.oquv_yili ?? "",
        talimShakli: djangoToTalimShakli(g.program_type ?? "", g.study_format ?? ""),
        talimTili: g.talimTili ?? g.study_language ?? "uz",
        createdAt: g.createdAt ?? g.created_at ?? "",
        kafedra: g.kafedra
          ? {
              id: String(g.kafedra.id),
              nomi: g.kafedra.nomi ?? g.kafedra.name ?? "",
              fakultet: g.kafedra.fakultet
                ? {
                    id: String(g.kafedra.fakultet.id),
                    nomi: g.kafedra.fakultet.nomi ?? g.kafedra.fakultet.name ?? "",
                    otmId: String(g.kafedra.fakultet.otmId ?? g.kafedra.fakultet.otm_id ?? ""),
                    otm: null,
                  }
                : null,
            }
          : null,
      }));
      setData(normalized);
    } catch (err) {
      toast.error("Ma'lumotlarni yuklashda xato");
      console.error(err);
    }
    setLoading(false);
  }, [filterOtm, filterFak, filterKaf, filterTalimShakli, filterKurs]);

  useEffect(() => {
    fetchOtmList();
  }, [fetchOtmList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // ==================== FILTER CASCADE ====================
  async function handleFilterOtmChange(otmId: string) {
    setFilterOtm(otmId);
    setFilterFak("");
    setFilterKaf("");
    setFakultetList([]);
    setKafedraList([]);
    if (otmId) {
      const faks = await fetchFakultetList(otmId);
      setFakultetList(faks);
    }
  }

  async function handleFilterFakChange(fakId: string) {
    setFilterFak(fakId);
    setFilterKaf("");
    setKafedraList([]);
    if (fakId) {
      const kafs = await fetchKafedraList(fakId);
      setKafedraList(kafs);
    }
  }

  function handleFilterKafChange(kafId: string) {
    setFilterKaf(kafId);
  }

  // ==================== FORM CASCADE ====================
  async function handleFormOtmChange(otmId: string) {
    setFormOtmId(otmId);
    setFormFakId("");
    form.setValue("kafedraId", "");
    setFormFakList([]);
    setFormKafList([]);
    if (otmId) {
      const faks = await fetchFakultetList(otmId);
      setFormFakList(faks);
    }
  }

  async function handleFormFakChange(fakId: string) {
    setFormFakId(fakId);
    form.setValue("kafedraId", "");
    setFormKafList([]);
    if (fakId) {
      const kafs = await fetchKafedraList(fakId);
      setFormKafList(kafs);
    }
  }

  function handleFormKafChange(kafId: string) {
    form.setValue("kafedraId", kafId, { shouldValidate: true });
  }

  // ==================== CRUD ====================
  function openCreateDialog() {
    setEditingId(null);
    form.reset({
      kafedraId: "",
      nomi: "",
      talabaSoni: 25,
      oquvYiliNomi: activeAcademicYear,
      talimShakli: "bakalavr",
      talimTili: "uz",
      kurs: 1,
    });
    setFormOtmId(filterOtm);
    setFormFakId(filterFak);
    setFormFakList(fakultetList);
    setFormKafList(kafedraList);
    setFormOpen(true);
  }

  async function openEditDialog(item: GuruhRecord) {
    setEditingId(item.id);
    form.setValue("nomi", item.nomi);
    form.setValue("talabaSoni", item.talabaSoni);
    form.setValue("oquvYiliNomi", item.oquvYiliNomi);
    form.setValue("talimShakli", item.talimShakli || "bakalavr");
    form.setValue("talimTili", item.talimTili || "uz");
    form.setValue("kurs", item.kurs);

    const otmId = item.kafedra?.fakultet?.otmId || "";
    const fakId = item.kafedra?.fakultet?.id || "";
    setFormOtmId(otmId);
    setFormFakId(fakId);

    if (otmId) {
      const faks = await fetchFakultetList(otmId);
      setFormFakList(faks);
      if (fakId) {
        const kafs = await fetchKafedraList(fakId);
        setFormKafList(kafs);
      }
    }

    form.setValue("kafedraId", item.kafedraId);
    setFormOpen(true);
  }

  async function onSubmit(values: GuruhFormData) {
    setSubmitting(true);
    try {
      const { program_type, study_format } = talimShakliToDjango(values.talimShakli);
      const payload = {
        name: values.nomi,
        department: Number(values.kafedraId),
        course: `course_${values.kurs}`,
        program_type,
        study_format,
        study_language: values.talimTili,
        oquv_yili: values.oquvYiliNomi,
        students: values.talabaSoni,
      };

      if (editingId) {
        const res = await fetch(API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Xato");
        }
        toast.success("Muvaffaqiyatli tahrirlandi");
      } else {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Xato");
        }
        toast.success("Muvaffaqiyatli qo'shildi");
      }
      await fetchData();
      closeForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Muvaffaqiyatli o'chirildi");
      await fetchData();
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "O'chirishda xato");
    } finally {
      setDeleting(false);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    form.reset();
    setFormOtmId("");
    setFormFakId("");
    setFormFakList([]);
    setFormKafList([]);
  }

  // ==================== FILTER + PAGINATE ====================
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter(
      (item) =>
        (item.nomi ?? "").toLowerCase().includes(s) ||
        item.oquvYiliNomi?.toLowerCase().includes(s) ||
        (TALIM_SHAKLI_MAP[item.talimShakli] || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // ==================== STATS ====================
  const stats = useMemo(() => {
    const total = data.length;
    const bakalavr = data.filter((d) => d.talimShakli === "bakalavr").length;
    const magistr = data.filter((d) => d.talimShakli === "magistr").length;
    const sirtqi = data.filter((d) => d.talimShakli === "sirtqi").length;
    const sirtqi2ot = data.filter((d) => d.talimShakli === "2-ot").length;
    const masofaviy = data.filter((d) => d.talimShakli === "masofaviy").length;
    return { total, bakalavr, magistr, sirtqi, sirtqi2ot, masofaviy };
  }, [data]);

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* ======== HEADER ======== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Guruhlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guruhlarni boshqarish va filtrlash
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          <Plus className="h-4 w-4" />
          Yangi qo&apos;shish
        </Button>
      </div>

      {/* ======== STATS BAR ======== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jami</p>
              <p className="text-lg font-semibold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bakalavr</p>
              <p className="text-lg font-semibold">{stats.bakalavr}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Magistr</p>
              <p className="text-lg font-semibold">{stats.magistr}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
              <Globe className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sirtqi</p>
              <p className="text-lg font-semibold">{stats.sirtqi}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10">
              <CalendarDays className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">2-OT</p>
              <p className="text-lg font-semibold">{stats.sirtqi2ot}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500/10">
              <Landmark className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Masofaviy</p>
              <p className="text-lg font-semibold">{stats.masofaviy}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======== FILTER SECTION ======== */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Guruhlarni topish
          </h2>
          {(filterOtm || filterTalimShakli) && (
            <Badge variant="secondary" className="text-xs">
              {filteredData.length} ta topildi
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* OTM */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Landmark className="h-3 w-3 text-primary" /> OTM
            </Label>
            <Select value={filterOtm} onValueChange={handleFilterOtmChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="OTM ni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {otmList.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nomi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fakultet */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Building2 className="h-3 w-3 text-primary" /> Fakultet
            </Label>
            <Select
              value={filterFak}
              onValueChange={handleFilterFakChange}
              disabled={!filterOtm}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Fakultetni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {fakultetList.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nomi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kafedra */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <GraduationCap className="h-3 w-3 text-primary" /> Kafedra
            </Label>
            <Select
              value={filterKaf}
              onValueChange={handleFilterKafChange}
              disabled={!filterFak}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kafedrani tanlang" />
              </SelectTrigger>
              <SelectContent>
                {kafedraList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nomi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ta'lim shakli */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <BookOpen className="h-3 w-3 text-primary" /> Ta&apos;lim shakli
            </Label>
            <Select
              value={filterTalimShakli}
              onValueChange={setFilterTalimShakli}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tanlang" />
              </SelectTrigger>
              <SelectContent>
                {TALIM_SHAKLI_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kurs */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <CalendarDays className="h-3 w-3 text-primary" /> Kurs
            </Label>
            <Select
              value={filterKurs}
              onValueChange={setFilterKurs}
              disabled={!filterTalimShakli}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tanlang" />
              </SelectTrigger>
              <SelectContent>
                {KURS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ======== SEARCH ======== */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Guruh nomi bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ======== TABLE ======== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">
              {filterOtm || filterTalimShakli
                ? "Guruhlar topilmadi."
                : "Hali guruhlar qo'shilmagan."}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filterOtm || filterTalimShakli
                ? "Boshqa filtrlarni tanlang yoki yangi qo'shing."
                : "Yangi qo'shish tugmasini bosing."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="text-center">Guruh nomi</TableHead>
                    <TableHead className="hidden md:table-cell text-center">
                      Kurs
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-center">
                      Ta&apos;lim shakli
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-center">
                      Ta&apos;lim tili
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-center">
                      Talaba soni
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-center">
                      OTM
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-center">
                      Fakultet
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-center">
                      Kafedra
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-center">
                      O&apos;quv yili
                    </TableHead>
                    <TableHead className="w-24 text-center">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground text-center">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-center max-w-[200px] truncate">
                        {item.nomi}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center text-muted-foreground">
                        {item.kurs}-kurs
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <Badge variant="secondary">
                          {TALIM_SHAKLI_MAP[item.talimShakli] || item.talimShakli || "Bakalavr"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        <Badge variant="outline">
                          {TALIM_TILI_MAP[item.talimTili] || item.talimTili || "Uz"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center text-muted-foreground">
                        {item.talabaSoni} ta
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-muted-foreground">
                        {(() => { const o = otmList.find((x) => x.id === item.kafedra?.fakultet?.otmId); return o?.qisqaNomi || o?.nomi || "\u2014"; })()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-muted-foreground">
                        {item.kafedra?.fakultet?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center text-muted-foreground">
                        {item.kafedra?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center text-muted-foreground">
                        {item.oquvYiliNomi || "\u2014"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Tahrirlash</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({ id: item.id, name: item.nomi })
                            }
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Jami {filteredData.length} ta, {page}/{totalPages} sahifa
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Oldingi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Keyingi
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ======== FORM DIALOG ======== */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeForm}
          />
          <div className="relative bg-background rounded-xl border shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                {editingId
                  ? "Guruhni tahrirlash"
                  : "Yangi guruh qo'shish"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingId
                  ? "Guruh ma'lumotlarini o'zgartiring."
                  : "Yangi guruh ma'lumotlarini kiriting."}
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Cascading selects: OTM → Fakultet → Kafedra (gorizontal) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Landmark className="h-3 w-3 text-primary" /> OTM
                  </Label>
                  <Select value={formOtmId} onValueChange={handleFormOtmChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="OTM ni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {otmList.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Building2 className="h-3 w-3 text-primary" /> Fakultet
                  </Label>
                  <Select
                    value={formFakId}
                    onValueChange={handleFormFakChange}
                    disabled={!formOtmId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Fakultetni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {formFakList.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <GraduationCap className="h-3 w-3 text-primary" /> Kafedra
                  </Label>
                  <Select
                    value={form.watch("kafedraId")}
                    onValueChange={handleFormKafChange}
                    disabled={!formFakId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kafedrani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {formKafList.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.nomi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.kafedraId && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.kafedraId.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Ta'lim shakli, Ta'lim tili, Kurs (gorizontal) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <BookOpen className="h-3 w-3 text-primary" /> Ta&apos;lim shakli
                  </Label>
                  <Select
                    value={form.watch("talimShakli")}
                    onValueChange={(val) => {
                      form.setValue("talimShakli", val, { shouldValidate: true });
                      // Tanlangan ta'lim shaklida mavjud bo'lmagan kursni tuzatish
                      const allowed = KURS_BY_TALIM_SHAKLI[val] ?? [1, 2, 3, 4];
                      if (!allowed.includes(form.getValues("kurs"))) {
                        form.setValue("kurs", allowed[0], { shouldValidate: true });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {TALIM_SHAKLI_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Globe className="h-3 w-3 text-primary" /> Ta&apos;lim tili
                  </Label>
                  <Select
                    value={form.watch("talimTili")}
                    onValueChange={(val) =>
                      form.setValue("talimTili", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {TALIM_TILI_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarDays className="h-3 w-3 text-primary" /> Kurs
                  </Label>
                  <Select
                    value={String(form.watch("kurs"))}
                    onValueChange={(val) =>
                      form.setValue("kurs", parseInt(val, 10), { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {kursOptionsFor(form.watch("talimShakli")).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Guruh nomi, Talabalar soni, O'quv yili (gorizontal) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="nomi">Guruh nomi</Label>
                  <Input
                    id="nomi"
                    placeholder="Masalan: 201-21"
                    {...form.register("nomi")}
                  />
                  {form.formState.errors.nomi && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.nomi.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="talabaSoni">Talabalar soni</Label>
                  <Input
                    id="talabaSoni"
                    type="number"
                    min={1}
                    step={1}
                    {...form.register("talabaSoni", { valueAsNumber: true })}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, "");
                    }}
                  />
                  {form.formState.errors.talabaSoni && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.talabaSoni.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarDays className="h-3 w-3 text-primary" /> O&apos;quv yili
                  </Label>
                  <Select
                    value={form.watch("oquvYiliNomi")}
                    onValueChange={(val) =>
                      form.setValue("oquvYiliNomi", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {oquvYiliOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.oquvYiliNomi && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.oquvYiliNomi.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Bekor qilish
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {editingId ? "Saqlanmoqda..." : "Qo'shilmoqda..."}
                    </>
                  ) : (
                    <>{editingId ? "Saqlash" : "Qo'shish"}</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======== DELETE CONFIRMATION ======== */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => setDeleteTarget(v ? deleteTarget : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              O&apos;chirishni tasdiqlash
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" ni o'chirishga ishonchingiz komilmi? Bu amalni qaytarib bo'lmaydi.`
                : "Bu amalni qaytarib bo'lmaydi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  O&apos;chirilmoqda...
                </>
              ) : (
                "O'chirish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
