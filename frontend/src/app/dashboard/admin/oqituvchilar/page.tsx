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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getPlanTeachingHours } from "@/lib/workload-hours";
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
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Users,
  Loader2,
  Landmark,
  Building2,
  GraduationCap,
  Filter,
  Percent,
} from "lucide-react";

// ==================== TYPES ====================
interface RefItem {
  id: string;
  nomi: string;
  otmId?: string;
  fakultetId?: string;
}

// Django Teacher model
interface TeacherRecord {
  id: number | string;
  full_name: string;
  position: string;
  degree: string;
  academic_title: string;
  speciality: string;
  rate: string;
  email: string;
  phone_number: string;
}

// ==================== OPTIONS (Django value -> Uzbek label) ====================
const POSITION_OPTIONS = [
  { value: "assistant", label: "Assistent" },
  { value: "teacher", label: "Stajyor-o'qituvchi" },
  { value: "senior_teacher", label: "Katta o'qituvchi" },
  { value: "associate_professor", label: "Dotsent" },
  { value: "professor", label: "Professor" },
];

const DEGREE_OPTIONS = [
  { value: "bachelor", label: "Bakalavr" },
  { value: "master", label: "Magistr" },
  { value: "phd", label: "PhD (fan nomzodi)" },
  { value: "dsc", label: "Fan doktori (DSc)" },
];

const TITLE_OPTIONS = [
  { value: "none", label: "Yo'q" },
  { value: "docent", label: "Dotsent" },
  { value: "professor", label: "Professor" },
  { value: "senior_researcher", label: "Katta ilmiy xodim" },
];

const SPECIALITY_OPTIONS = [
  { value: "computer_science", label: "Kompyuter ilmlari" },
  { value: "mathematics", label: "Matematika" },
  { value: "economics", label: "Iqtisodiyot" },
  { value: "engineering", label: "Muhandislik" },
  { value: "other", label: "Boshqa" },
];

const RATE_OPTIONS = [
  { value: "rate_1_5", label: "1.5 stavka" },
  { value: "rate_1", label: "1 stavka" },
  { value: "rate_0_5_ichki", label: "0.5 ichki stavka" },
  { value: "rate_0_5_tashqi", label: "0.5 stavka tashqi" },
  { value: "rate_0_25", label: "0.25 stavka" },
];

const POSITION_MAP: Record<string, string> = Object.fromEntries(
  POSITION_OPTIONS.map((o) => [o.value, o.label])
);
const DEGREE_MAP: Record<string, string> = Object.fromEntries(
  DEGREE_OPTIONS.map((o) => [o.value, o.label])
);
const TITLE_MAP: Record<string, string> = Object.fromEntries(
  TITLE_OPTIONS.map((o) => [o.value, o.label])
);
const SPECIALITY_MAP: Record<string, string> = Object.fromEntries(
  SPECIALITY_OPTIONS.map((o) => [o.value, o.label])
);
const RATE_MAP: Record<string, string> = {
  // Eski (legacy) qiymatlar — yangi formatga moslab ko'rsatiladi
  full_time: "1 stavka",
  part_time: "0.5 ichki stavka",
  hourly: "0.5 stavka tashqi",
  ...Object.fromEntries(RATE_OPTIONS.map((o) => [o.value, o.label])),
};

function workloadViews(rate: string): Array<{ key: "rate_1" | "rate_0_5" | "rate_0_25"; label: string }> {
  if (rate === "rate_1_5") {
    return [
      { key: "rate_1", label: "1 stavka" },
      { key: "rate_0_5", label: "0.5 stavka" },
    ];
  }
  if (rate === "rate_0_25") return [{ key: "rate_0_25", label: "0.25 stavka" }];
  if (rate.includes("0_5") || rate === "part_time" || rate === "hourly") {
    return [{ key: "rate_0_5", label: "0.5 stavka" }];
  }
  return [{ key: "rate_1", label: "1 stavka" }];
}

// ==================== SCHEMA (Django field names) ====================
const teacherSchema = z.object({
  full_name: z.string().min(1, "F.I.O ni kiriting"),
  position: z.string().min(1, "Lavozimni tanlang"),
  degree: z.string().min(1, "Ilmiy darajani tanlang"),
  academic_title: z.string().min(1, "Ilmiy unvoni tanlang"),
  speciality: z.string().min(1, "Mutaxassislikni tanlang"),
  rate: z.string().min(1, "Stavkani tanlang"),
  email: z.string(),
  phone_number: z.string(),
  kafedra: z.string().min(1, "Kafedrani tanlang"),
});

type TeacherFormData = z.infer<typeof teacherSchema>;

const API = "/api/crud/oqituvchilar";

// ==================== PAGE ====================
export default function OqituvchilarPage() {
  const router = useRouter();
  // --- Reference lists ---
  const [otmList, setOtmList] = useState<RefItem[]>([]);
  const [fakultetList, setFakultetList] = useState<RefItem[]>([]);
  const [kafedraList, setKafedraList] = useState<RefItem[]>([]);

  const [selectedOtmId, setSelectedOtmId] = useState("");
  const [selectedFakId, setSelectedFakId] = useState("");
  const [selectedKafId, setSelectedKafId] = useState("");
  const [filterRate, setFilterRate] = useState("all");

  // --- Table state ---
  const [data, setData] = useState<TeacherRecord[]>([]);
  const [yuklamaMap, setYuklamaMap] = useState<Map<string, number>>(new Map()); // o'qituvchi id -> biriktirilgan fanlar jami soati
  const [rejaIdMap, setRejaIdMap] = useState<Map<string, string>>(new Map()); // o'qituvchi id -> reja id (shablonni ko'rish uchun)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // --- Form / dialog state ---
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKafId, setEditKafId] = useState(""); // kafedra teacher currently belongs to
  const [submitting, setSubmitting] = useState(false);

  // Form cascade (for add/edit dialog)
  const [formOtmId, setFormOtmId] = useState("");
  const [formFakId, setFormFakId] = useState("");
  const [formFakList, setFormFakList] = useState<RefItem[]>([]);
  const [formKafList, setFormKafList] = useState<RefItem[]>([]);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 10;

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      full_name: "",
      position: "teacher",
      degree: "bachelor",
      academic_title: "none",
      speciality: "other",
      rate: "rate_1",
      email: "",
      phone_number: "",
      kafedra: "",
    },
  });

   
  const norm = (x: any): RefItem => ({
    ...x,
    id: String(x.id),
    nomi: x.nomi || x.name || "",
  });

  // ==================== FETCH reference data ====================
  const fetchOtmList = useCallback(async () => {
    try {
      const res = await fetch("/api/crud/otm");
      const json = await res.json();
      if (res.ok) {
        const list = Array.isArray(json) ? json : (json.results ?? []);
        setOtmList(list.map(norm));
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
         
        return list.map((x: any) => ({
          ...norm(x),
          otmId: String(
            x.otmId ?? x.otm_id ?? x.department ?? (typeof x.otm === "object" ? x.otm?.id : x.otm) ?? otmId
          ),
        })) as RefItem[];
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
         
        return list.map((x: any) => ({
          ...norm(x),
          fakultetId: String(
            x.fakultetId ?? x.fakultet_id ?? x.faculty ?? (typeof x.fakultet === "object" ? x.fakultet?.id : x.fakultet) ?? fakId
          ),
        })) as RefItem[];
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  }, []);

  // Read a kafedra's current teacher id list (M2M)
  async function getKafedraTeacherIds(kafId: string): Promise<number[]> {
    const res = await fetch(`/api/crud/kafedralar?id=${kafId}`);
    const kaf = await res.json();
     
    return (kaf.teachers ?? []).map((t: any) =>
      Number(typeof t === "object" ? t.id : t)
    );
  }

  // Write a kafedra's teacher id list (M2M) via partial update
  async function setKafedraTeachers(kafId: string, ids: number[]) {
    await fetch("/api/crud/kafedralar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: kafId, teachers: ids }),
    });
  }

  // --- Fetch oqituvchilar (filter by kafedra M2M if a kafedra is selected) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      let list: TeacherRecord[] = Array.isArray(json)
        ? json
        : (json.results ?? []);

      if (selectedKafId) {
        const kres = await fetch(`/api/crud/kafedralar?id=${selectedKafId}`);
        const kaf = await kres.json();
         
        const ids = (kaf.teachers ?? []).map((t: any) =>
          String(typeof t === "object" ? t.id : t)
        );
        list = list.filter((t) => ids.includes(String(t.id)));
      }
      setData(list);
    } catch (err) {
      toast.error("Ma'lumotlarni yuklashda xato");
      console.error(err);
    }
    setLoading(false);
  }, [selectedKafId]);

  // --- Har bir o'qituvchiga biriktirilgan fanlar jami soatini (rejalardan) yuklaydi ---
  const fetchYuklamaMap = useCallback(async () => {
    try {
      const map = new Map<string, number>();
      const rmap = new Map<string, string>();
      let page = 1;
      while (page <= 200) {
        const res = await fetch(`/api/crud/rejalar?page=${page}`);
        if (!res.ok) break;
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json.results ?? []);
        for (const reja of rows) {
          const soat = getPlanTeachingHours(reja.data);
          const tid = String(reja.oqituvchiId);
          map.set(tid, (map.get(tid) || 0) + soat);
          rmap.set(tid, String(reja.id));
        }
        if (Array.isArray(json) || !json.next || rows.length === 0) break;
        page++;
      }
      // DL/MD biriktirma soatlarini ham qo'shamiz (o'qituvchi bo'yicha)
      try {
        let dp = 1;
        while (dp <= 200) {
          const dr = await fetch(`/api/crud/dl-md?page=${dp}`);
          if (!dr.ok) break;
          const dj = await dr.json();
          const drows = Array.isArray(dj) ? dj : (dj.results ?? []);
          for (const it of drows) {
            const tid = String(it.oqituvchiId);
            map.set(tid, (map.get(tid) || 0) + (Number(it.jamiSoat) || 0));
          }
          if (Array.isArray(dj) || !dj.next || drows.length === 0) break;
          dp++;
        }
      } catch { /* e'tiborsiz */ }
      setYuklamaMap(map);
      setRejaIdMap(rmap);
    } catch (err) {
      console.error("Yuklama soatlarini yuklashda xato:", err);
    }
  }, []);

  useEffect(() => {
    fetchOtmList();
  }, [fetchOtmList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchYuklamaMap();
  }, [fetchYuklamaMap]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  // ==================== Cascading: Main filter selects ====================
  async function handleOtmChange(otmId: string) {
    setSelectedOtmId(otmId);
    setSelectedFakId("");
    setSelectedKafId("");
    setFakultetList([]);
    setKafedraList([]);
    if (otmId) {
      const faks = await fetchFakultetList(otmId);
      setFakultetList(faks);
    }
  }

  async function handleFakChange(fakId: string) {
    setSelectedFakId(fakId);
    setSelectedKafId("");
    setKafedraList([]);
    if (fakId) {
      const kafs = await fetchKafedraList(fakId);
      setKafedraList(kafs);
    }
  }

  function handleKafChange(kafId: string) {
    setSelectedKafId(kafId);
    setFilterRate("all");
  }

  // ==================== Cascading: Form dialog selects ====================
  async function handleFormOtmChange(otmId: string) {
    setFormOtmId(otmId);
    setFormFakId("");
    form.setValue("kafedra", "");
    setFormFakList([]);
    setFormKafList([]);
    if (otmId) {
      const faks = await fetchFakultetList(otmId);
      setFormFakList(faks);
    }
  }

  async function handleFormFakChange(fakId: string) {
    setFormFakId(fakId);
    form.setValue("kafedra", "");
    setFormKafList([]);
    if (fakId) {
      const kafs = await fetchKafedraList(fakId);
      setFormKafList(kafs);
    }
  }

  function handleFormKafChange(kafId: string) {
    form.setValue("kafedra", kafId, { shouldValidate: true });
  }

  // ==================== Filter + Paginate ====================
  const filteredData = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((item) => {
      // Stavka bo'yicha filtr
      if (filterRate !== "all" && item.rate !== filterRate) return false;
      if (!s) return true;
      return (
        (item.full_name ?? "").toLowerCase().includes(s) ||
        (SPECIALITY_MAP[item.speciality] || "").toLowerCase().includes(s) ||
        (item.email ?? "").toLowerCase().includes(s) ||
        (item.phone_number ?? "").includes(s) ||
        (POSITION_MAP[item.position] || "").toLowerCase().includes(s)
      );
    });
  }, [data, search, filterRate]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // ==================== CRUD ====================
  function openCreateDialog() {
    setEditingId(null);
    setEditKafId("");
    form.reset({
      full_name: "",
      position: "teacher",
      degree: "bachelor",
      academic_title: "none",
      speciality: "other",
      rate: "rate_1",
      email: "",
      phone_number: "",
      kafedra: selectedKafId || "",
    });
    // Prefill cascade from the active filter
    setFormOtmId(selectedOtmId);
    setFormFakId(selectedFakId);
    setFormFakList(fakultetList);
    setFormKafList(kafedraList);
    setFormMode("create");
  }

  function openEditDialog(item: TeacherRecord) {
    setEditingId(String(item.id));
    setEditKafId(selectedKafId); // current kafedra known only in filtered view
    form.reset({
      full_name: item.full_name || "",
      position: item.position || "teacher",
      degree: item.degree || "bachelor",
      academic_title: item.academic_title || "none",
      speciality: item.speciality || "other",
      rate: RATE_OPTIONS.some((o) => o.value === item.rate) ? item.rate : "rate_1",
      email: item.email || "",
      phone_number: item.phone_number || "",
      kafedra: selectedKafId || "",
    });
    // Prefill cascade from the active filter
    setFormOtmId(selectedOtmId);
    setFormFakId(selectedFakId);
    setFormFakList(fakultetList);
    setFormKafList(kafedraList);
    setFormMode("edit");
  }

  async function onSubmit(values: TeacherFormData) {
    setSubmitting(true);
    try {
      const payload = {
        full_name: values.full_name,
        position: values.position,
        degree: values.degree,
        academic_title: values.academic_title,
        speciality: values.speciality,
        rate: values.rate,
        email: values.email || "",
        phone_number: values.phone_number || "",
      };

      let teacherId: number;
      if (editingId) {
        const res = await fetch(API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Xato");
        teacherId = Number(editingId);
      } else {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Xato");
        teacherId = Number(json.id);
      }

      // --- Kafedra (M2M) binding ---
      const newKafId = values.kafedra;
      if (newKafId) {
        const ids = await getKafedraTeacherIds(newKafId);
        if (!ids.includes(teacherId)) {
          await setKafedraTeachers(newKafId, [...ids, teacherId]);
        }
      }
      // If editing and kafedra changed, unbind from the old one
      if (editingId && editKafId && editKafId !== newKafId) {
        const oldIds = await getKafedraTeacherIds(editKafId);
        await setKafedraTeachers(
          editKafId,
          oldIds.filter((i) => i !== teacherId)
        );
      }

      toast.success(
        editingId ? "Muvaffaqiyatli tahrirlandi" : "Muvaffaqiyatli qo'shildi"
      );
      await fetchData();
      setFormMode("closed");
      setEditingId(null);
      setEditKafId("");
      form.reset();
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
    setFormMode("closed");
    setEditingId(null);
    setEditKafId("");
    form.reset();
    setFormOtmId("");
    setFormFakId("");
    setFormFakList([]);
    setFormKafList([]);
  }

  // ==================== Stats ====================
  const stats = useMemo(() => {
    const total = data.length;
    const professors = data.filter((d) => d.position === "professor").length;
    const dotsents = data.filter((d) => d.position === "associate_professor").length;
    const kattaOqituvchi = data.filter((d) => d.position === "senior_teacher").length;
    const oqituvchi = data.filter((d) => d.position === "teacher").length;
    const assistent = data.filter((d) => d.position === "assistant").length;
    return { total, professors, dotsents, kattaOqituvchi, oqituvchi, assistent };
  }, [data]);

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* ======== HEADER ======== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            O&apos;qituvchilar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O&apos;qituvchilarni boshqarish va qidirish
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
              <p className="text-xs text-muted-foreground">Professor</p>
              <p className="text-lg font-semibold">{stats.professors}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
              <GraduationCap className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dotsent</p>
              <p className="text-lg font-semibold">{stats.dotsents}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10">
              <GraduationCap className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Katta o&apos;qituvchi</p>
              <p className="text-lg font-semibold">{stats.kattaOqituvchi}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10">
              <GraduationCap className="h-4 w-4 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">O&apos;qituvchi</p>
              <p className="text-lg font-semibold">{stats.oqituvchi}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
              <GraduationCap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assistent</p>
              <p className="text-lg font-semibold">{stats.assistent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======== HORIZONTAL CASCADING SELECTS ======== */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            O&apos;qituvchilarni topish
          </h2>
          {selectedKafId && (
            <Badge variant="secondary" className="text-xs">
              {filteredData.length} ta topildi
            </Badge>
          )}
        </div>
        {/* OTM → Fakultet → Kafedra → Stavka — gorizontal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* OTM select */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Landmark className="h-3 w-3 text-primary" />
              OTM
            </Label>
            <Select value={selectedOtmId} onValueChange={handleOtmChange}>
              <SelectTrigger className="w-full h-10">
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

          {/* Fakultet select */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Building2 className="h-3 w-3 text-primary" />
              Fakultet
            </Label>
            <Select
              value={selectedFakId}
              onValueChange={handleFakChange}
              disabled={!selectedOtmId}
            >
              <SelectTrigger className="w-full h-10">
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

          {/* Kafedra select */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <GraduationCap className="h-3 w-3 text-primary" />
              Kafedra
            </Label>
            <Select
              value={selectedKafId}
              onValueChange={handleKafChange}
              disabled={!selectedFakId}
            >
              <SelectTrigger className="w-full h-10">
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

          {/* Stavka select */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Percent className="h-3 w-3 text-primary" />
              Stavka
            </Label>
            <Select
              value={filterRate}
              onValueChange={setFilterRate}
              disabled={!selectedKafId}
            >
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Stavka tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                {RATE_OPTIONS.map((o) => (
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
          placeholder="FIO, mutaxassislik, pochta yoki tel bo'yicha qidirish..."
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
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">
              {selectedKafId
                ? "Ushbu kafedrada o'qituvchilar topilmadi."
                : "O'qituvchilar topilmadi."}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedKafId
                ? "Boshqa kafedrani tanlang yoki yangi qo'shing."
                : "Yangi qo'shish uchun yuqoridagi tugmani bosing."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="text-center">FIO</TableHead>
                    <TableHead className="hidden md:table-cell text-center">
                      Lavozim
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-center">
                      Ilmiy daraja
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-center">
                      Ilmiy unvon
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-center">
                      Mutaxassislik
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-center">
                      Tel
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-center">
                      Pochta
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-center">
                      Stavka
                    </TableHead>
                    <TableHead className="text-center">Yuklama soati</TableHead>
                    <TableHead className="w-32 text-center">Ko&apos;rish</TableHead>
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
                        {item.full_name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <Badge variant="secondary">
                          {POSITION_MAP[item.position] || item.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-muted-foreground">
                        {DEGREE_MAP[item.degree] || item.degree}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-muted-foreground">
                        {TITLE_MAP[item.academic_title] || item.academic_title}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center text-muted-foreground">
                        {SPECIALITY_MAP[item.speciality] || item.speciality || "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center text-muted-foreground">
                        {item.phone_number || "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center text-muted-foreground">
                        {item.email || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {RATE_MAP[item.rate] || item.rate}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {yuklamaMap.get(String(item.id)) ? (
                          <span className="font-semibold text-primary">
                            {yuklamaMap.get(String(item.id))} soat
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {rejaIdMap.get(String(item.id)) ? (
                          <div className="flex flex-col items-center gap-1">
                            {workloadViews(item.rate).map((view) => (
                              <button
                                key={view.key}
                                type="button"
                                title={`${view.label} yuklamasini ko'rish`}
                                className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                                onClick={() => router.push(
                                  `/dashboard/admin/rejalar/${rejaIdMap.get(String(item.id))}?stavka=${view.key}`
                                )}
                              >
                                <Eye className="h-4 w-4 shrink-0" />
                                <span>{view.label}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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
                              setDeleteTarget({
                                id: String(item.id),
                                name: item.full_name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">
                              O&apos;chirish
                            </span>
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

      {/* ======== FORM DIALOG (Add / Edit) ======== */}
      {formMode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeForm}
          />
          <div className="relative bg-background rounded-xl border shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {formMode === "edit"
                  ? "O'qituvchini tahrirlash"
                  : "Yangi o'qituvchi qo'shish"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {formMode === "edit"
                  ? "O'qituvchi ma'lumotlarini o'zgartiring."
                  : "Yangi o'qituvchi ma'lumotlarini kiriting."}
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* ===== Cascading selects: OTM → Fakultet → Kafedra (gorizontal) ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Landmark className="h-3 w-3 text-primary" />
                    OTM
                  </Label>
                  <Select
                    value={formOtmId}
                    onValueChange={handleFormOtmChange}
                  >
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
                    <Building2 className="h-3 w-3 text-primary" />
                    Fakultet
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
                    <GraduationCap className="h-3 w-3 text-primary" />
                    Kafedra
                  </Label>
                  <Select
                    value={form.watch("kafedra")}
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
                  {form.formState.errors.kafedra && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.kafedra.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* ===== FIO ===== */}
              <div className="space-y-1.5">
                <Label htmlFor="full_name">F.I.O</Label>
                <Input
                  id="full_name"
                  placeholder="Masalan: Karimov Karim Karimovich"
                  {...form.register("full_name")}
                  onKeyDown={(e) => {
                    if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              {/* ===== Lavozim, Ilmiy daraja, Ilmiy unvon ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Lavozim</Label>
                  <Select
                    value={form.watch("position")}
                    onValueChange={(val) =>
                      form.setValue("position", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Ilmiy daraja</Label>
                  <Select
                    value={form.watch("degree")}
                    onValueChange={(val) =>
                      form.setValue("degree", val, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEGREE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Ilmiy unvon</Label>
                  <Select
                    value={form.watch("academic_title")}
                    onValueChange={(val) =>
                      form.setValue("academic_title", val, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ===== Mutaxassislik + Stavka ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Mutaxassisligi</Label>
                  <Select
                    value={form.watch("speciality")}
                    onValueChange={(val) =>
                      form.setValue("speciality", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Stavka</Label>
                  <Select
                    value={form.watch("rate")}
                    onValueChange={(val) =>
                      form.setValue("rate", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ===== Pochta, Tel ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Pochta (email)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@mail.com"
                    {...form.register("email")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone_number">Tel raqam</Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    {...form.register("phone_number")}
                  />
                </div>
              </div>

              <Separator />

              {/* ===== Buttons ===== */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                >
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
                      {formMode === "edit"
                        ? "Saqlanmoqda..."
                        : "Qo'shilmoqda..."}
                    </>
                  ) : (
                    <>{formMode === "edit" ? "Saqlash" : "Qo'shish"}</>
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
