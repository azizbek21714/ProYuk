"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  Settings,
  ShieldCheck,
  Calculator,
  AlertTriangle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDateInput } from "@/lib/formatters";
import { useDashboard } from "@/contexts/dashboard-context";

// --- Types ---
interface YuklamaTuriRecord {
  id: string;
  bandRaqami: number;
  kod: string;
  nomi: string;
  formulaIfoda: string;
  hisobSoatbay: boolean;
  faol: boolean;
  normativlarSoni: number;
}

interface NormativRecord {
  id: string;
  yuklamaTuriId: string;
  otmProfil: string;
  koeffitsient: number;
  limitMin: number | null;
  limitMax: number | null;
  amalBoshi: string | null;
  amalOxiri: string | null;
  izoh: string | null;
  createdAt: string;
}

interface OverlapInfo {
  id: string;
  otmProfil: string;
  koeffitsient: number;
  amalBoshi: string | null;
  amalOxiri: string | null;
}

// --- Labels ---
const OTM_PROFIL_LABELS: Record<string, string> = {
  barcha: "Barcha",
  umumiy: "Umumiy OTM",
  tibbiyot: "Tibbiyot OTM",
  pedagogika: "Pedagogika OTM",
  harbiy: "Harbiy OTM",
};

// --- Schema ---
const normativSchema = z.object({
  otmProfil: z.string().min(1, "OTM profilni tanlang"),
  koeffitsient: z.number().positive("Musbat son kiriting"),
  limitMin: z.number().int().positive().nullable().optional(),
  limitMax: z.number().int().positive().nullable().optional(),
  amalBoshi: z.string().min(1, "Boshlanish sanasini kiriting"),
  amalOxiri: z.string().nullable().optional(),
  izoh: z.string().nullable().optional(),
});

type NormativFormData = z.infer<typeof normativSchema>;

const API = "/api/crud/normativlar";

export default function NormativlarPage() {
  const router = useRouter();
  const { profile } = useDashboard();

  // --- Admin-only gate ---
  useEffect(() => {
    if (profile && profile.role !== "admin") {
      toast.error("Sizda bu sahifani ko'rish huquqi yo'q");
      router.push("/dashboard/admin");
    }
  }, [profile, router]);

  // --- Data state ---
  const [yuklamaTurlari, setYuklamaTurlari] = useState<YuklamaTuriRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [normativlar, setNormativlar] = useState<NormativRecord[]>([]);
  const [loadingYuklama, setLoadingYuklama] = useState(true);
  const [loadingNormativ, setLoadingNormativ] = useState(false);

  // --- Dialog state ---
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null);

  // --- Overlap warning state ---
  const [overlapWarning, setOverlapWarning] = useState<{
    warning: string;
    overlapping: OverlapInfo[];
    pendingData: Record<string, unknown>;
  } | null>(null);

  const form = useForm<NormativFormData>({
    resolver: zodResolver(normativSchema),
    defaultValues: {
      otmProfil: "barcha",
      koeffitsient: 1.0,
      limitMin: null,
      limitMax: null,
      amalBoshi: new Date().toISOString().split("T")[0],
      amalOxiri: "",
      izoh: "",
    },
  });

  // --- Fetch yuklama turlari ---
  const fetchYuklamaTurlari = useCallback(async () => {
    setLoadingYuklama(true);
    try {
      const res = await fetch(`${API}?type=yuklama_turi`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setYuklamaTurlari(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      toast.error("Yuklama turlarini yuklashda xato");
      console.error(err);
    }
    setLoadingYuklama(false);
  }, []);

  // --- Fetch normativlar for selected yuklama turi ---
  const fetchNormativlar = useCallback(async (yuklamaTuriId: string) => {
    setLoadingNormativ(true);
    try {
      const res = await fetch(`${API}?type=normativ&yuklamaTuriId=${yuklamaTuriId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setNormativlar(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      toast.error("Normativlarni yuklashda xato");
      console.error(err);
    }
    setLoadingNormativ(false);
  }, []);

  useEffect(() => {
    fetchYuklamaTurlari();
  }, [fetchYuklamaTurlari]);

  // Auto-select first item
  useEffect(() => {
    if (yuklamaTurlari.length > 0 && !selectedId) {
      const firstActive = yuklamaTurlari.find((yt) => yt.faol);
      if (firstActive) {
        setSelectedId(firstActive.id);
        fetchNormativlar(firstActive.id);
      }
    }
  }, [yuklamaTurlari, selectedId, fetchNormativlar]);

  // --- Select handler ---
  function handleSelect(id: string) {
    setSelectedId(id);
    fetchNormativlar(id);
  }

  // --- Create / Update ---
  async function onSubmit(values: NormativFormData) {
    if (!selectedId) return;

    try {
      const payload = {
        yuklamaTuriId: selectedId,
        otmProfil: values.otmProfil,
        koeffitsient: values.koeffitsient,
        limitMin: values.limitMin || null,
        limitMax: values.limitMax || null,
        amalBoshi: values.amalBoshi,
        amalOxiri: values.amalOxiri || null,
        izoh: values.izoh || null,
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
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Xato");
        }

        // Check for overlap warning
        if (json.overlap) {
          setOverlapWarning({
            warning: json.warning,
            overlapping: json.overlapping,
            pendingData: payload,
          });
          return; // Don't close dialog yet
        }

        toast.success("Muvaffaqiyatli qo'shildi");
      }

      await fetchNormativlar(selectedId);
      await fetchYuklamaTurlari();
      setOpen(false);
      form.reset();
      setEditingId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  // --- Force create (after overlap warning) ---
  async function handleForceCreate() {
    if (!overlapWarning || !selectedId) return;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...overlapWarning.pendingData, force: true }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Normativ qo'shildi, eski normativning amal qilish muddati yangilandi");
      setOverlapWarning(null);
      setOpen(false);
      form.reset();
      setEditingId(null);
      await fetchNormativlar(selectedId);
      await fetchYuklamaTurlari();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  // --- Edit ---
  function handleEdit(item: NormativRecord) {
    setEditingId(item.id);
    form.setValue("otmProfil", item.otmProfil);
    form.setValue("koeffitsient", item.koeffitsient);
    form.setValue("limitMin", item.limitMin);
    form.setValue("limitMax", item.limitMax);
    form.setValue("amalBoshi", item.amalBoshi || "");
    form.setValue("amalOxiri", item.amalOxiri || "");
    form.setValue("izoh", item.izoh || "");
    setOpen(true);
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget || !selectedId) return;
    try {
      const res = await fetch(`${API}?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Xato");
      }
      toast.success("Muvaffaqiyatli o'chirildi");
      await fetchNormativlar(selectedId);
      await fetchYuklamaTurlari();
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "O'chirishda xato");
    }
  }

  // --- Open create dialog ---
  function handleCreate() {
    setEditingId(null);
    form.reset({
      otmProfil: "barcha",
      koeffitsient: 1.0,
      limitMin: null,
      limitMax: null,
      amalBoshi: new Date().toISOString().split("T")[0],
      amalOxiri: "",
      izoh: "",
    });
    setOpen(true);
  }

  const selectedYuklama = yuklamaTurlari.find((yt) => yt.id === selectedId);

  // --- Admin gate: don't render full UI if not admin ---
  if (profile && profile.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Normativlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            3076-son buyrug&apos;i bo&apos;yicha yuklama koeffitsientlari va limitlar
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN — Yuklama turlari list */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Yuklama turlari</h2>
              <Badge variant="secondary" className="ml-auto text-xs">
                {yuklamaTurlari.length}
              </Badge>
            </div>

            {loadingYuklama ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-280px)]">
                <div className="p-2 space-y-1">
                  {yuklamaTurlari.map((yt) => (
                    <button
                      key={yt.id}
                      onClick={() => handleSelect(yt.id)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        selectedId === yt.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      {/* Band raqami circle */}
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          selectedId === yt.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {yt.bandRaqami}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{yt.nomi}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {yt.kod}
                          </Badge>
                          <Badge
                            variant={yt.hisobSoatbay ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {yt.hisobSoatbay ? "Soatbay" : "Rejali"}
                          </Badge>
                        </div>
                      </div>

                      {/* Chevron + normativ count */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {yt.normativlarSoni}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            selectedId === yt.id ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — Normativlar table */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border bg-card">
            {/* Right column header */}
            <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold text-sm">Normativlar</h2>
                  {selectedYuklama && (
                    <p className="text-xs text-muted-foreground">
                      {selectedYuklama.nomi}{" "}
                      <span className="font-mono">({selectedYuklama.kod})</span>
                      {" — "}
                      {selectedYuklama.formulaIfoda}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!selectedId}
                size="sm"
                className="gap-2 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Yangi normativ
              </Button>
            </div>

            {/* Table or empty state */}
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">
                  Yuklama turini tanlang
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chap ustunda yuklama turini tanang, shunda normativlar ko&apos;rinadi.
                </p>
              </div>
            ) : loadingNormativ ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : normativlar.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                  <Settings className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium">
                  Hali normativlar qo&apos;shilmagan.
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  &quot;Yangi normativ&quot; tugmasini bosing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OTM profil</TableHead>
                      <TableHead className="text-center">Koeffitsient</TableHead>
                      <TableHead className="text-center">Min</TableHead>
                      <TableHead className="text-center">Max</TableHead>
                      <TableHead>Amal qiladi</TableHead>
                      <TableHead className="hidden lg:table-cell">Izoh</TableHead>
                      <TableHead className="w-24 text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {normativlar.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge
                            variant={
                              item.otmProfil === "barcha"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {OTM_PROFIL_LABELS[item.otmProfil] || item.otmProfil}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold text-primary">
                          {item.koeffitsient}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {item.limitMin ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {item.limitMax ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col">
                            <span>{formatDateInput(item.amalBoshi)}</span>
                            {item.amalOxiri && (
                              <span className="text-muted-foreground">
                                &rarr; {formatDateInput(item.amalOxiri)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                          {item.izoh || "\u2014"}
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
                              onClick={() => setDeleteTarget({id: item.id, name: `Normativ (${OTM_PROFIL_LABELS[item.otmProfil] || item.otmProfil}, k=${item.koeffitsient})`})}
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
          </div>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditingId(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Normativni tahrirlash" : "Yangi normativ qo'shish"}
            </DialogTitle>
            <DialogDescription>
              {selectedYuklama
                ? `${selectedYuklama.nomi} (${selectedYuklama.kod}) uchun normativ`
                : "Normativ ma'lumotlarini kiriting."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* OTM Profil */}
            <div className="space-y-2">
              <Label>OTM profil</Label>
              <Select
                value={form.watch("otmProfil")}
                onValueChange={(val) =>
                  form.setValue("otmProfil", val, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Profilni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcha">Barcha OTM</SelectItem>
                  <SelectItem value="umumiy">Umumiy OTM</SelectItem>
                  <SelectItem value="tibbiyot">Tibbiyot OTM</SelectItem>
                  <SelectItem value="pedagogika">Pedagogika OTM</SelectItem>
                  <SelectItem value="harbiy">Harbiy OTM</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.otmProfil && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.otmProfil.message}
                </p>
              )}
            </div>

            {/* Koeffitsient */}
            <div className="space-y-2">
              <Label htmlFor="koeffitsient">Koeffitsient</Label>
              <Input
                id="koeffitsient"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1.0"
                {...form.register("koeffitsient", { valueAsNumber: true })}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9.]/g, ''); }}
              />
              <p className="text-xs text-muted-foreground">
                Masalan: Bakalavr nazorati uchun 0.3
              </p>
              {form.formState.errors.koeffitsient && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.koeffitsient.message}
                </p>
              )}
            </div>

            {/* Limit Min / Max */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limitMin">Limit min</Label>
                <Input
                  id="limitMin"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Bo'sh"
                  {...form.register("limitMin", { setValueAs: (value) => value === "" ? null : Number(value) })}
                  onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                />
                <p className="text-xs text-muted-foreground">
                  Bo&apos;sh qoldirish mumkin
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limitMax">Limit max</Label>
                <Input
                  id="limitMax"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Bo'sh"
                  {...form.register("limitMax", { setValueAs: (value) => value === "" ? null : Number(value) })}
                  onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                />
                <p className="text-xs text-muted-foreground">
                  Bo&apos;sh qoldirish mumkin
                </p>
              </div>
            </div>

            <Separator />

            {/* Amal qilish — date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amalBoshi">Amal boshi</Label>
                <Input
                  id="amalBoshi"
                  type="date"
                  {...form.register("amalBoshi")}
                />
                {form.formState.errors.amalBoshi && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.amalBoshi.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amalOxiri">Amal oxiri</Label>
                <Input
                  id="amalOxiri"
                  type="date"
                  {...form.register("amalOxiri")}
                />
                <p className="text-xs text-muted-foreground">
                  Bo&apos;sh qoldirilsa — cheksiz
                </p>
              </div>
            </div>

            {/* Izoh */}
            <div className="space-y-2">
              <Label htmlFor="izoh">Izoh</Label>
              <Textarea
                id="izoh"
                placeholder="Qo'shimcha izoh..."
                rows={3}
                {...form.register("izoh")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                  form.reset();
                }}
              >
                Bekor qilish
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{editingId ? "Saqlanmoqda..." : "Qo'shilmoqda..."}</>
                ) : (
                  <>{editingId ? "Saqlash" : "Qo'shish"}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overlap Warning Dialog */}
      <Dialog
        open={!!overlapWarning}
        onOpenChange={(v) => {
          if (!v) setOverlapWarning(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Diqqat!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {overlapWarning?.warning}
            </DialogDescription>
          </DialogHeader>

          {overlapWarning && overlapWarning.overlapping.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Mavjud normativ(lar):
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                {overlapWarning.overlapping.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 text-xs text-yellow-700 dark:text-yellow-300"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {OTM_PROFIL_LABELS[o.otmProfil] || o.otmProfil}
                    </Badge>
                    <span className="font-mono">k = {o.koeffitsient}</span>
                    <span>
                      ({o.amalBoshi}
                      {o.amalOxiri ? ` → ${o.amalOxiri}` : " → ..."})
                    </span>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOverlapWarning(null)}
            >
              Bekor qilish
            </Button>
            <Button
              onClick={handleForceCreate}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Davom etish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => setDeleteTarget(v ? deleteTarget : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O&apos;chirishni tasdiqlash</AlertDialogTitle>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              O&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
