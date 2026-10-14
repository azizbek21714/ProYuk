"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Landmark,
  ArrowUpDown,
  Loader2,
  ChevronDown,
  ChevronRight,
  Building2,
  BookOpen,
  GraduationCap,
  FolderTree,
  Layers,
  Clock,
  CalendarDays,
  X,
} from "lucide-react";

// --- Constants ---
const PROFIL_LABELS: Record<string, string> = {
  umumiy: "Umumiy",
  tibbiyot: "Tibbiyot",
  pedagogika: "Pedagogika",
  harbiy: "Harbiy",
};

// --- Types ---
interface OtmRecord {
  id: string;
  nomi: string;
  qisqaNomi: string;
  profil: string;
  createdAt: string;
}

interface FakultetRecord {
  id: string;
  nomi: string;
  otmId: string;
  createdAt: string;
}

interface KafedraRecord {
  id: string;
  nomi: string;
  yillikYuklama: number;
  fakultetId: string;
  fakultet: {
    id: string;
    nomi: string;
    otm: { nomi: string } | null;
  } | null;
}

interface FanRecord {
  id: string;
  nomi: string;
  kafedraId: string;
  kafedra: {
    id: string;
    nomi: string;
    fakultet: {
      id: string;
      nomi: string;
      otmId: string;
      otm: { id: string; nomi: string };
    } | null;
  } | null;
}

// --- Edit Dialog Types ---
interface EditKafedra {
  id: string | null;
  nomi: string;
  yillikYuklama: number;
  isNew: boolean;
}

interface EditFakultet {
  id: string | null;
  nomi: string;
  isNew: boolean;
  kafedralar: EditKafedra[];
}

// --- Schemas ---
const SEMESTR_OPTIONS: { value: string; label: string }[] = [
  { value: "tanlanmagan", label: "Tanlanmagan" },
  { value: "bahorgi", label: "Bahorgi" },
  { value: "kuzgi", label: "Kuzgi" },
];

const hierarchySchema = z.object({
  otmNomi: z.string().min(1, "OTM nomini kiriting"),
  otmQisqaNomi: z.string(),
  fakultetNomi: z.string().min(1, "Fakultet nomini kiriting"),
  kafedraNomi: z.string().min(1, "Kafedra nomini kiriting"),
  kafedraYillikYuklama: z.coerce
    .number()
    .min(0, "Soat 0 dan kam bo'lishi mumkin emas"),
  kafedraYillikYuklamaSemestr: z.string().optional(),
});

type HierarchyFormData = z.infer<typeof hierarchySchema>;

const API = "/api/crud/otm";
const HIERARCHY_API = "/api/crud/otm/hierarchy";

// --- Hierarchy tree types ---
interface HierarchyKafedra {
  id: string;
  nomi: string;
  yillikYuklama: number;
  fanlar: string[];
}

interface HierarchyFakultet {
  id: string;
  nomi: string;
  kafedralar: HierarchyKafedra[];
}

interface HierarchyOtm {
  id: string;
  nomi: string;
  qisqaNomi: string;
  profil: string;
  fakultetlar: HierarchyFakultet[];
}

export default function OtmPage() {
  // --- OTM table state ---
  const [data, setData] = useState<OtmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Edit dialog state ---
  const [editOtmNomi, setEditOtmNomi] = useState("");
  const [editOtmQisqaNomi, setEditOtmQisqaNomi] = useState("");
  const [editFakultetlar, setEditFakultetlar] = useState<EditFakultet[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // --- Hierarchy dialog state ---
  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [hierarchySubmitting, setHierarchySubmitting] = useState(false);

  // --- Hierarchy view state ---
  const [expandedOtmIds, setExpandedOtmIds] = useState<Set<string>>(new Set());
  const [expandedFakIds, setExpandedFakIds] = useState<Set<string>>(new Set());
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyData, setHierarchyData] = useState<HierarchyOtm[]>([]);
  const [showHierarchy, setShowHierarchy] = useState(true);

  const pageSize = 10;

  const hierarchyForm = useForm<z.input<typeof hierarchySchema>, unknown, HierarchyFormData>({
    resolver: zodResolver(hierarchySchema),
    defaultValues: {
      otmNomi: "",
      otmQisqaNomi: "",
      fakultetNomi: "",
      kafedraNomi: "",
      kafedraYillikYuklama: 0,
      kafedraYillikYuklamaSemestr: "tanlanmagan",
    },
  });

  // --- Fetch flat OTM list (table uchun) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
       
      const list: any[] = Array.isArray(json) ? json : (json.results ?? []);
      const flat: OtmRecord[] = list.map((item) => ({
        id: item.id,
        nomi: item.nomi || item.name || "",
        qisqaNomi: item.qisqaNomi || item.short_name || "",
        profil: item.profil || item.profile || "",
        createdAt: item.createdAt || item.created_at || "",
      }));
      setData(flat);
    } catch (err) {
      toast.error("Ma'lumotlarni yuklashda xato");
      console.error(err);
    }
    setLoading(false);
  }, []);

  // --- Fetch hierarchy (GET /api/crud/otm/hierarchy/) ---
  const fetchHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    try {
      const res = await fetch("/api/crud/otm/hierarchy");
      const json = await res.json();
      console.log("[hierarchy] raw:", JSON.stringify(json).slice(0, 600));
      if (!res.ok) throw new Error(json.error || "Xato");
       
      const list: any[] = Array.isArray(json) ? json : (json.results ?? []);
       
      const tree: HierarchyOtm[] = list.map((otm: any) => ({
        id: otm.id,
        nomi: otm.nomi || otm.name || "",
        qisqaNomi: otm.qisqaNomi || otm.short_name || "",
        profil: otm.profil || otm.profile || "",
         
        fakultetlar: (otm.fakultetlar ?? []).map((fak: any) => ({
          id: fak.id,
          nomi: fak.nomi || fak.name || String(fak.id),
           
          kafedralar: (fak.kafedralar ?? []).map((kaf: any) => ({
            id: kaf.id,
            nomi: kaf.nomi || kaf.name || String(kaf.id),
            yillikYuklama: kaf.yillik_yuklama ?? kaf.yillikYuklama ?? kaf.yearly_load ?? 0,
            fanlar: (kaf.fanlar ?? []).map((f: any) => f.nomi || f.name || f),
          })),
        })),
      }));
      console.log("[tree] sample:", JSON.stringify(tree[0]));
      setHierarchyData(tree);
    } catch (err) {
      console.error("Hierarchy fetch error:", err);
    }
    setHierarchyLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchHierarchy(); }, [fetchHierarchy]);

  // --- Sort ---
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // --- Filter + Sort + Paginate ---
  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField as keyof OtmRecord] ?? "";
    const bVal = b[sortField as keyof OtmRecord] ?? "";
    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredData = sortedData.filter((item) =>
    (item.nomi ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  // --- Edit (existing OTM) - fetch fakultetlar & kafedralar ---
  async function handleEdit(item: OtmRecord) {
    setEditingId(item.id);
    setEditOtmNomi(item.nomi);
    setEditOtmQisqaNomi(item.qisqaNomi || "");
    setEditFakultetlar([]);
    setEditLoading(true);
    setOpen(true);

    try {
      // Fetch all fakultetlar for this OTM
      const fakRes = await fetch(`/api/crud/fakultetlar?otmId=${item.id}`);
      const fakRaw = await fakRes.json();
      const fakultetlar: FakultetRecord[] = Array.isArray(fakRaw) ? fakRaw : (fakRaw.results ?? []);

      // Fetch kafedralar for each fakultet in parallel
      const fakWithKafedralar: EditFakultet[] = await Promise.all(
        fakultetlar.map(async (fak) => {
          try {
            const kafRes = await fetch(
              `/api/crud/kafedralar?fakultetId=${fak.id}`
            );
            const kafRaw = await kafRes.json();
            const kafedralar: KafedraRecord[] = Array.isArray(kafRaw) ? kafRaw : (kafRaw.results ?? []);
            return {
              id: fak.id,
              nomi: fak.nomi,
              isNew: false,
              kafedralar: kafedralar.map((kaf) => ({
                id: kaf.id,
                nomi: kaf.nomi,
                yillikYuklama: kaf.yillikYuklama || 0,
                isNew: false,
              })),
            };
          } catch {
            return {
              id: fak.id,
              nomi: fak.nomi,
              isNew: false,
              kafedralar: [],
            };
          }
        })
      );

      setEditFakultetlar(fakWithKafedralar);
    } catch (err) {
      toast.error("Fakultetlarni yuklashda xato");
      console.error(err);
    }
    setEditLoading(false);
  }

  // --- Edit dialog save ---
  async function handleEditSave() {
    if (!editingId || !editOtmNomi.trim()) {
      toast.error("OTM nomini kiriting");
      return;
    }

    setEditSaving(true);
    try {
      // 1. Update OTM name and qisqa nomi
      const otmRes = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          nomi: editOtmNomi,
          qisqaNomi: editOtmQisqaNomi,
        }),
      });
      if (!otmRes.ok) {
        const json = await otmRes.json();
        throw new Error(json.error || "OTMni saqlashda xato");
      }

      // 2. Save each fakultet and its kafedralar
      for (const fak of editFakultetlar) {
        if (!fak.nomi.trim() && fak.isNew) continue; // skip empty new fakultetlar

        if (fak.isNew) {
          // POST new fakultet
          const fakRes = await fetch("/api/crud/fakultetlar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nomi: fak.nomi, otmId: editingId }),
          });
          if (!fakRes.ok) {
            const json = await fakRes.json();
            throw new Error(json.error || "Fakultet qo'shishda xato");
          }
          const newFak = await fakRes.json();

          // Save new kafedralar for the new fakultet
          for (const kaf of fak.kafedralar) {
            if (!kaf.nomi.trim() && kaf.isNew) continue;
            if (kaf.isNew) {
              const kafRes = await fetch("/api/crud/kafedralar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nomi: kaf.nomi,
                  yillikYuklama: kaf.yillikYuklama,
                  fakultetId: newFak.id,
                }),
              });
              if (!kafRes.ok) {
                const json = await kafRes.json();
                throw new Error(json.error || "Kafedra qo'shishda xato");
              }
            }
          }
        } else {
          // PUT existing fakultet
          const fakRes = await fetch("/api/crud/fakultetlar", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: fak.id, nomi: fak.nomi }),
          });
          if (!fakRes.ok) {
            const json = await fakRes.json();
            throw new Error(json.error || "Fakultetni saqlashda xato");
          }

          // Save kafedralar for existing fakultet
          for (const kaf of fak.kafedralar) {
            if (!kaf.nomi.trim() && kaf.isNew) continue;
            if (kaf.isNew) {
              const kafRes = await fetch("/api/crud/kafedralar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nomi: kaf.nomi,
                  yillikYuklama: kaf.yillikYuklama,
                  fakultetId: fak.id,
                }),
              });
              if (!kafRes.ok) {
                const json = await kafRes.json();
                throw new Error(json.error || "Kafedra qo'shishda xato");
              }
            } else {
              // PUT existing kafedra
              const kafRes = await fetch("/api/crud/kafedralar", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: kaf.id,
                  nomi: kaf.nomi,
                  yillikYuklama: kaf.yillikYuklama,
                }),
              });
              if (!kafRes.ok) {
                const json = await kafRes.json();
                throw new Error(json.error || "Kafedrani saqlashda xato");
              }
            }
          }
        }
      }

      toast.success("Muvaffaqiyatli saqlandi");
      await fetchData();
      setOpen(false);
      setEditingId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setEditSaving(false);
    }
  }

  // --- Edit helpers ---
  function addEditFakultet() {
    setEditFakultetlar((prev) => [
      ...prev,
      { id: null, nomi: "", isNew: true, kafedralar: [] },
    ]);
  }

  function removeEditFakultet(fakIndex: number) {
    setEditFakultetlar((prev) => prev.filter((_, i) => i !== fakIndex));
  }

  function updateEditFakultetNomi(fakIndex: number, nomi: string) {
    setEditFakultetlar((prev) =>
      prev.map((fak, i) => (i === fakIndex ? { ...fak, nomi } : fak))
    );
  }

  function addEditKafedra(fakIndex: number) {
    setEditFakultetlar((prev) =>
      prev.map((fak, i) =>
        i === fakIndex
          ? {
              ...fak,
              kafedralar: [
                ...fak.kafedralar,
                { id: null, nomi: "", yillikYuklama: 0, isNew: true },
              ],
            }
          : fak
      )
    );
  }

  function removeEditKafedra(fakIndex: number, kafIndex: number) {
    setEditFakultetlar((prev) =>
      prev.map((fak, i) =>
        i === fakIndex
          ? {
              ...fak,
              kafedralar: fak.kafedralar.filter((_, j) => j !== kafIndex),
            }
          : fak
      )
    );
  }

  function updateEditKafedra(
    fakIndex: number,
    kafIndex: number,
    field: "nomi" | "yillikYuklama",
    value: string | number
  ) {
    setEditFakultetlar((prev) =>
      prev.map((fak, i) =>
        i === fakIndex
          ? {
              ...fak,
              kafedralar: fak.kafedralar.map((kaf, j) =>
                j === kafIndex ? { ...kaf, [field]: value } : kaf
              ),
            }
          : fak
      )
    );
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || json.detail || `Xato: ${res.status}`);
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

  // --- Hierarchy form submit ---
  async function onHierarchySubmit(values: HierarchyFormData) {
    setHierarchySubmitting(true);
    try {
      const res = await fetch(HIERARCHY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Muvaffaqiyatli qo'shildi");
      await fetchData();
      setHierarchyOpen(false);
      hierarchyForm.reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setHierarchySubmitting(false);
    }
  }

  // --- Toggle expanded OTM ---
  function toggleOtm(id: string) {
    setExpandedOtmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleFak(id: string) {
    setExpandedFakIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // --- Stats ---
  const totalFakultetlar = useMemo(
    () => hierarchyData.reduce((sum, o) => sum + o.fakultetlar.length, 0),
    [hierarchyData]
  );
  const totalKafedralar = useMemo(
    () =>
      hierarchyData.reduce(
        (sum, o) =>
          sum +
          o.fakultetlar.reduce((s, f) => s + f.kafedralar.length, 0),
        0
      ),
    [hierarchyData]
  );
  const totalFanlar = useMemo(
    () =>
      hierarchyData.reduce(
        (sum, o) =>
          sum +
          o.fakultetlar.reduce(
            (s, f) =>
              s + f.kafedralar.reduce((ss, k) => ss + k.fanlar.length, 0),
            0
          ),
        0
      ),
    [hierarchyData]
  );

  // OTM bo'yicha yillik yuklama (soat) — barcha kafedralar yig'indisi
  const otmYuklamaMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const otm of hierarchyData) {
      map[String(otm.id)] = otm.fakultetlar.reduce(
        (s, f) => s + f.kafedralar.reduce((ss, k) => ss + (k.yillikYuklama || 0), 0),
        0
      );
    }
    return map;
  }, [hierarchyData]);

  return (
    <div className="space-y-6">
      {/* ======== A) Header Section ======== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            OTM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Oliy ta&apos;lim muassasalari va ma&apos;lumotlar boshqarish
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => {
              hierarchyForm.reset();
              setHierarchyOpen(true);
            }}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            OTM qo&apos;shish
          </Button>
        </div>
      </div>

      {/* ======== Stats bar ======== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">OTM</p>
              <p className="text-lg font-semibold">{data.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fakultetlar</p>
              <p className="text-lg font-semibold">{totalFakultetlar}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kafedralar</p>
              <p className="text-lg font-semibold">{totalKafedralar}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fanlar</p>
              <p className="text-lg font-semibold">{totalFanlar}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======== Search ======== */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="OTM nomi bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ======== B) Existing OTM Table ======== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Landmark className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">
              Hali OTM qo&apos;shilmagan.
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Yangi qo&apos;shish tugmasini bosing.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="text-center">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => handleSort("nomi")}
                    >
                      OTM nomi
                      {sortField === "nomi" && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">Qisqa nomi</TableHead>
                  <TableHead className="text-center">Yillik yuklama</TableHead>
                  <TableHead className="w-24 text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-center">
                      {(page - 1) * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate text-center">{item.nomi}</TableCell>
                    <TableCell className="text-muted-foreground text-center">
                      {item.qisqaNomi || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={(otmYuklamaMap[String(item.id)] ?? 0) > 0 ? "default" : "secondary"}>
                        {(otmYuklamaMap[String(item.id)] ?? 0).toLocaleString()} soat
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(item)}
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

      {/* ======== E) Hierarchy View ======== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Collapsible open={showHierarchy} onOpenChange={setShowHierarchy}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">
                Ierarxiya ko&apos;rinishi
              </h2>
              <Badge variant="secondary" className="text-xs">
                OTM → Fakultet → Kafedra → Fan
              </Badge>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {showHierarchy ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-xs">
                  {showHierarchy ? "Yopish" : "Ochish"}
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4">
              {hierarchyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : hierarchyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Hali ierarxiya ma&apos;lumotlari mavjud emas.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {hierarchyData.map((otm) => (
                    <div key={otm.id} className="space-y-0.5">
                      {/* OTM level */}
                      <button
                        onClick={() => toggleOtm(otm.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                      >
                        {expandedOtmIds.has(otm.id) ? (
                          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <Landmark className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-sm flex-1">
                          {otm.nomi}
                          {otm.qisqaNomi && (
                            <span className="font-normal text-muted-foreground ml-2 text-xs">
                              ({otm.qisqaNomi})
                            </span>
                          )}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {PROFIL_LABELS[otm.profil] || otm.profil}
                        </Badge>
                        {otm.fakultetlar.length > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {otm.fakultetlar.length} fak.
                          </span>
                        )}
                      </button>

                      {/* Fakultet level */}
                      {expandedOtmIds.has(otm.id) && (
                        <div className="ml-6 space-y-0.5">
                          {otm.fakultetlar.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground italic">
                              Fakultetlar mavjud emas
                            </div>
                          ) : (
                            otm.fakultetlar.map((fak) => (
                              <div key={fak.id}>
                                <button
                                  onClick={() => toggleFak(fak.id)}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left"
                                >
                                  {expandedFakIds.has(fak.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="text-sm font-medium flex-1">
                                    {fak.nomi}
                                  </span>
                                  {fak.kafedralar.length > 0 && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {fak.kafedralar.length} kaf.
                                    </span>
                                  )}
                                </button>

                                {/* Kafedra level */}
                                {expandedFakIds.has(fak.id) && (
                                  <div className="ml-6 space-y-0.5">
                                    {fak.kafedralar.length === 0 ? (
                                      <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
                                        Kafedralar mavjud emas
                                      </div>
                                    ) : (
                                      fak.kafedralar.map((kaf) => (
                                        <div key={kaf.id}>
                                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/60 transition-colors">
                                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-sm flex-1">
                                              {kaf.nomi}
                                            </span>
                                            {kaf.yillikYuklama > 0 && (
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] font-mono shrink-0"
                                              >
                                                <Clock className="h-2.5 w-2.5 mr-1" />
                                                {kaf.yillikYuklama.toLocaleString()}{" "}
                                                soat
                                              </Badge>
                                            )}
                                            {kaf.fanlar.length > 0 && (
                                              <span className="text-xs text-muted-foreground shrink-0">
                                                {kaf.fanlar.length} fan
                                              </span>
                                            )}
                                          </div>
                                          {/* Fan level */}
                                          {kaf.fanlar.length > 0 && (
                                            <div className="ml-6 space-y-0.5">
                                              {kaf.fanlar.map((fan, fIdx) => (
                                                <div
                                                  key={fIdx}
                                                  className="flex items-center gap-2 px-3 py-1 rounded-md text-xs text-muted-foreground"
                                                >
                                                  <BookOpen className="h-3 w-3 shrink-0" />
                                                  <span>{fan}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ======== OTM Edit Dialog (with Fakultetlar & Kafedralar) ======== */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditingId(null);
            setEditOtmNomi("");
            setEditOtmQisqaNomi("");
            setEditFakultetlar([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>OTMni tahrirlash</DialogTitle>
            <DialogDescription>
              OTM nomi, fakultet va kafedra ma&apos;lumotlarini
              o&apos;zgartiring.
            </DialogDescription>
          </DialogHeader>

          {editLoading ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Ma&apos;lumotlar yuklanmoqda...
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
              {/* OTM name fields */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-otmNomi" className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-primary" />
                    OTM nomi
                  </Label>
                  <Input
                    id="edit-otmNomi"
                    placeholder="Masalan: Toshkent Davlat Universiteti"
                    value={editOtmNomi}
                    onChange={(e) => setEditOtmNomi(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-otmQisqaNomi">Qisqa nomi</Label>
                  <Input
                    id="edit-otmQisqaNomi"
                    placeholder="Masalan: TDU"
                    value={editOtmQisqaNomi}
                    onChange={(e) => setEditOtmQisqaNomi(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Fakultetlar section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    Fakultetlar
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {editFakultetlar.length}
                    </Badge>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={addEditFakultet}
                  >
                    <Plus className="h-3 w-3" />
                    Fakultet qo&apos;shish
                  </Button>
                </div>

                {editFakultetlar.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                    Hali fakultet qo&apos;shilmagan. &quot;Fakultet
                    qo&apos;shish&quot; tugmasini bosing.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {editFakultetlar.map((fak, fakIdx) => (
                      <div
                        key={fak.id || `new-fak-${fakIdx}`}
                        className="rounded-lg border bg-muted/30 p-3 space-y-3"
                      >
                        {/* Fakultet header + name */}
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-primary mt-2.5 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-medium">
                              Fakultet {fakIdx + 1}
                              {fak.isNew && (
                                <Badge
                                  variant="secondary"
                                  className="ml-1.5 text-[10px]"
                                >
                                  Yangi
                                </Badge>
                              )}
                            </Label>
                            <Input
                              placeholder="Fakultet nomini kiriting..."
                              value={fak.nomi}
                              onChange={(e) =>
                                updateEditFakultetNomi(fakIdx, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key.length === 1 &&
                                  /[0-9]/.test(e.key)
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            />
                          </div>
                          {fak.isNew && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-6"
                              onClick={() => removeEditFakultet(fakIdx)}
                            >
                              <X className="h-3.5 w-3.5" />
                              <span className="sr-only">
                                Fakultetni o&apos;chirish
                              </span>
                            </Button>
                          )}
                        </div>

                        {/* Kafedralar for this fakultet */}
                        <div className="ml-6 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium flex items-center gap-1">
                              <GraduationCap className="h-3 w-3 text-muted-foreground" />
                              Kafedralar
                              <Badge
                                variant="outline"
                                className="text-[10px] ml-1"
                              >
                                {fak.kafedralar.length}
                              </Badge>
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 text-[11px] px-2"
                              onClick={() => addEditKafedra(fakIdx)}
                            >
                              <Plus className="h-2.5 w-2.5" />
                              Kafedra
                            </Button>
                          </div>

                          {fak.kafedralar.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-md">
                              Kafedra yo&apos;q
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {fak.kafedralar.map((kaf, kafIdx) => (
                                <div
                                  key={kaf.id || `new-kaf-${fakIdx}-${kafIdx}`}
                                  className="flex items-start gap-2 rounded-md border bg-background p-2"
                                >
                                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground mt-2.5 shrink-0" />
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground">
                                        Kafedra nomi
                                        {kaf.isNew && (
                                          <Badge
                                            variant="secondary"
                                            className="ml-1 text-[9px] px-1 py-0"
                                          >
                                            Yangi
                                          </Badge>
                                        )}
                                      </Label>
                                      <Input
                                        placeholder="Kafedra nomini kiriting..."
                                        className="h-8 text-sm"
                                        value={kaf.nomi}
                                        onChange={(e) =>
                                          updateEditKafedra(
                                            fakIdx,
                                            kafIdx,
                                            "nomi",
                                            e.target.value
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (
                                            e.key.length === 1 &&
                                            /[0-9]/.test(e.key)
                                          ) {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" />
                                        Yillik yuklama (soat)
                                      </Label>
                                      <Input
                                        type="number"
                                        placeholder="0"
                                        className="h-8 text-sm"
                                        value={kaf.yillikYuklama || ""}
                                        onChange={(e) =>
                                          updateEditKafedra(
                                            fakIdx,
                                            kafIdx,
                                            "yillikYuklama",
                                            Number(e.target.value) || 0
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (
                                            e.key.length === 1 &&
                                            !/[0-9]/.test(e.key) &&
                                            e.key !== "." &&
                                            e.key !== "-"
                                          ) {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {kaf.isNew && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 mt-5"
                                      onClick={() =>
                                        removeEditKafedra(fakIdx, kafIdx)
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                      <span className="sr-only">
                                        Kafedrani o&apos;chirish
                                      </span>
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditingId(null);
                setEditOtmNomi("");
                setEditOtmQisqaNomi("");
                setEditFakultetlar([]);
              }}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              disabled={editSaving || editLoading || !editOtmNomi.trim()}
              onClick={handleEditSave}
            >
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saqlanmoqda...
                </>
              ) : (
                "Saqlash"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== C) Hierarchy "OTM qo'shish" Dialog ======== */}
      <Dialog
        open={hierarchyOpen}
        onOpenChange={(v) => {
          setHierarchyOpen(v);
          if (!v) {
            hierarchyForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="sm:text-center">
            <DialogTitle>OTM qo&apos;shish</DialogTitle>
            <DialogDescription>
              OTM, fakultet va kafedra ma&apos;lumotlarini kiriting.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={hierarchyForm.handleSubmit(onHierarchySubmit)}
            className="space-y-4"
          >
            {/* Field 1: OTM nomi */}
            <div className="space-y-2">
              <Label
                htmlFor="h-otmNomi"
                className="flex items-center gap-1.5"
              >
                <Landmark className="h-3.5 w-3.5 text-primary" />
                OTM nomi
              </Label>
              <Input
                id="h-otmNomi"
                placeholder="Masalan: Toshkent Davlat Universiteti"
                {...hierarchyForm.register("otmNomi")}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {hierarchyForm.formState.errors.otmNomi && (
                <p className="text-sm text-destructive">
                  {hierarchyForm.formState.errors.otmNomi.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="h-otmQisqaNomi"
                className="flex items-center gap-1.5"
              >
                OTM qisqa nomi
              </Label>
              <Input
                id="h-otmQisqaNomi"
                placeholder="Masalan: TDU"
                {...hierarchyForm.register("otmQisqaNomi")}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>

            <Separator />

            {/* Field 2: Fakultet nomi */}
            <div className="space-y-2">
              <Label
                htmlFor="h-fakultetNomi"
                className="flex items-center gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Fakultet nomi
              </Label>
              <Input
                id="h-fakultetNomi"
                placeholder="Masalan: Matematika fakulteti"
                {...hierarchyForm.register("fakultetNomi")}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {hierarchyForm.formState.errors.fakultetNomi && (
                <p className="text-sm text-destructive">
                  {hierarchyForm.formState.errors.fakultetNomi.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Field 3: Kafedra nomi */}
            <div className="space-y-2">
              <Label
                htmlFor="h-kafedraNomi"
                className="flex items-center gap-1.5"
              >
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                Kafedra nomi
              </Label>
              <Input
                id="h-kafedraNomi"
                placeholder="Masalan: Algebra kafedrasi"
                {...hierarchyForm.register("kafedraNomi")}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {hierarchyForm.formState.errors.kafedraNomi && (
                <p className="text-sm text-destructive">
                  {hierarchyForm.formState.errors.kafedraNomi.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setHierarchyOpen(false);
                  hierarchyForm.reset();
                }}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                disabled={hierarchySubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {hierarchySubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saqlanmoqda...
                  </>
                ) : (
                  "Saqlash"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======== Delete Confirmation Dialog ======== */}
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
