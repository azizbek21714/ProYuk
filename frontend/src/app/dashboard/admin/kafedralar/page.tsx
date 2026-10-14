"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  ArrowUpDown,
  Loader2,
} from "lucide-react";

// --- Types ---
interface KafedraRecord {
  id: string;
  fakultetId: string;
  nomi: string;
  createdAt: string;
  fakultet: { id: string; nomi: string; otm: { nomi: string } } | null;
}

interface OtmOption {
  id: string;
  nomi: string;
}

interface FakultetOption {
  id: string;
  nomi: string;
  otmId: string;
}

// --- Schema ---
const kafedraSchema = z.object({
  nomi: z.string().min(1, "Kafedra nomini kiriting"),
  fakultetId: z.string().min(1, "Fakultetni tanlang"),
});

type KafedraFormData = z.infer<typeof kafedraSchema>;

const API = "/api/crud/kafedralar";
const OTM_API = "/api/crud/otm";
const FAKULTET_API = "/api/crud/fakultetlar";

export default function KafedralarPage() {
  const [data, setData] = useState<KafedraRecord[]>([]);
  const [otmList, setOtmList] = useState<OtmOption[]>([]);
  const [fakultetList, setFakultetList] = useState<FakultetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Cascading select state (dialog)
  const [selectedOtmId, setSelectedOtmId] = useState("");
  const [fakultetLoading, setFakultetLoading] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 10;

  const form = useForm<KafedraFormData>({
    resolver: zodResolver(kafedraSchema),
    defaultValues: {
      nomi: "",
      fakultetId: "",
    },
  });

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

  // --- Fetch OTM list ---
  const fetchOtmList = useCallback(async () => {
    try {
      const res = await fetch(OTM_API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setOtmList(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      console.error(err);
    }
  }, []);

  // --- Fetch Fakultet list by OTM ---
  const fetchFakultetList = useCallback(async (otmId: string) => {
    if (!otmId) {
      setFakultetList([]);
      return;
    }
    setFakultetLoading(true);
    try {
      const res = await fetch(`${FAKULTET_API}?otmId=${otmId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setFakultetList(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      console.error(err);
      setFakultetList([]);
    } finally {
      setFakultetLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchOtmList();
  }, [fetchData, fetchOtmList]);

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
    const aVal =
      sortField === "fakultetNomi"
        ? a.fakultet?.nomi ?? ""
        : sortField === "otmNomi"
          ? a.fakultet?.otm?.nomi ?? ""
          : a[sortField as keyof KafedraRecord] ?? "";
    const bVal =
      sortField === "fakultetNomi"
        ? b.fakultet?.nomi ?? ""
        : sortField === "otmNomi"
          ? b.fakultet?.otm?.nomi ?? ""
          : b[sortField as keyof KafedraRecord] ?? "";
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

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  // --- Create / Update ---
  async function onSubmit(values: KafedraFormData) {
    try {
      // Django FK field nomi "fakultet", shuning uchun fakultetId → fakultet
      const payload = { nomi: values.nomi, fakultet: values.fakultetId };

      if (editingId) {
        const res = await fetch(API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || json.detail || JSON.stringify(json));
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
          throw new Error(json.error || json.detail || JSON.stringify(json));
        }
        toast.success("Muvaffaqiyatli qo'shildi");
      }
      await fetchData();
      setOpen(false);
      form.reset();
      setEditingId(null);
      setSelectedOtmId("");
      setFakultetList([]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  // --- Edit ---
  function handleEdit(item: KafedraRecord) {
    setEditingId(item.id);
    form.setValue("nomi", item.nomi);
    form.setValue("fakultetId", item.fakultet?.id || "");

    // Pre-populate cascading selects: find the OTM from the fakultet
    if (item.fakultet) {
      // Find the otmId from fakultetList by matching the fakultet's otm relation
      // We need to fetch fakultetlar to get otmId, or derive from the data
      const otmId = findOtmIdForFakultet(item.fakultet.id);
      setSelectedOtmId(otmId);
      if (otmId) {
        fetchFakultetList(otmId);
      }
    } else {
      setSelectedOtmId("");
      setFakultetList([]);
    }

    setOpen(true);
  }

  // Helper: find the otmId that a fakultet belongs to using the fetched data
  function findOtmIdForFakultet(fakultetId: string): string {
    // Search in existing data for any kafedra with the same fakultetId
    // that has a fakultet relation with otm info
    const match = data.find(
      (k) => k.fakultetId === fakultetId && k.fakultet
    );
    if (match?.fakultet) {
      // Find the OTM from otmList by matching the otm nomi
      const otm = otmList.find(
        (o) => o.nomi === match.fakultet!.otm.nomi
      );
      return otm?.id || "";
    }
    // Fallback: fetch all fakultetlar and find it
    return "";
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
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
    } finally {
      setDeleting(false);
    }
  }

  // --- Open create dialog ---
  function handleCreate() {
    setEditingId(null);
    form.reset({ nomi: "", fakultetId: "" });
    setSelectedOtmId("");
    setFakultetList([]);
    setOpen(true);
  }

  // --- OTM change handler in dialog ---
  function handleOtmChange(otmId: string) {
    setSelectedOtmId(otmId);
    form.setValue("fakultetId", "", { shouldValidate: false });
    fetchFakultetList(otmId);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Kafedralar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kafedralarni boshqarish
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Yangi qo&apos;shish
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kafedra nomi bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">
              Hali kafedra qo&apos;shilmagan.
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Yangi qo&apos;shish tugmasini bosing.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => handleSort("nomi")}
                      >
                        Kafedra nomi
                        {sortField === "nomi" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => handleSort("fakultetNomi")}
                      >
                        Fakultet
                        {sortField === "fakultetNomi" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => handleSort("otmNomi")}
                      >
                        OTM
                        {sortField === "otmNomi" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-24 text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.nomi}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.fakultet?.nomi || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.fakultet?.otm?.nomi || "—"}
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
                            onClick={() => setDeleteTarget({ id: item.id, name: item.nomi })}
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

      {/* Create / Edit Dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditingId(null);
            form.reset();
            setSelectedOtmId("");
            setFakultetList([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Kafedrani tahrirlash" : "Yangi kafedra qo'shish"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Kafedra ma'lumotlarini o'zgartiring."
                : "Yangi kafedra ma'lumotlarini kiriting."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Kafedra nomi */}
            <div className="space-y-2">
              <Label htmlFor="nomi">Kafedra nomi</Label>
              <Input
                id="nomi"
                placeholder="Masalan: Kompyuter fanlari kafedrasi"
                {...form.register("nomi")}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {form.formState.errors.nomi && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.nomi.message}
                </p>
              )}
            </div>

            {/* OTM tanlash */}
            <div className="space-y-2">
              <Label>OTM ni tanlang</Label>
              <Select
                value={selectedOtmId}
                onValueChange={handleOtmChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="OTMni tanlang" />
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

            {/* Fakultet tanlash */}
            <div className="space-y-2">
              <Label>Fakultetni tanlang</Label>
              <Select
                value={form.watch("fakultetId")}
                onValueChange={(val) =>
                  form.setValue("fakultetId", val, { shouldValidate: true })
                }
                disabled={!selectedOtmId || fakultetLoading}
              >
                <SelectTrigger>
                  {fakultetLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Yuklanmoqda...
                    </span>
                  ) : (
                    <SelectValue placeholder={
                      !selectedOtmId
                        ? "Avval OTMni tanlang"
                        : "Fakultetni tanlang"
                    } />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {fakultetList.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Fakultet topilmadi
                    </SelectItem>
                  ) : (
                    fakultetList.map((fak) => (
                      <SelectItem key={fak.id} value={fak.id}>
                        {fak.nomi}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.fakultetId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fakultetId.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                  form.reset();
                  setSelectedOtmId("");
                  setFakultetList([]);
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
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />O&apos;chirilmoqda...</> : "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
