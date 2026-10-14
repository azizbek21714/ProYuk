"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  FileText,
  Filter,
  GraduationCap,
  Building2,
  Library,
  Users,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Sparkles,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";

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
}

interface OqituvchiRecord {
  id: string;
  fio: string;
  kafedraId: string;
  lavozim: string;
  ilmiyDaraja: string;
  ilmiyUnvon: string;
}

interface DlMdBiriktirmaRecord {
  id: string;
  kafedraId: string;
  oqituvchiId: string;
  tur: string;
  talimShakli: string;
  talabaSoni: number;
  soatBirligi: number;
  jamiSoat: number;
  createdAt: string;
  updatedAt: string;
  oqituvchi: OqituvchiRecord | null;
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

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const TALIM_SHAKLI_OPTIONS: { value: string; label: string }[] = [
  { value: "bakalavr", label: "Bakalavr" },
  { value: "magistr", label: "Magistr" },
];

const TALIM_SHAKLI_LABELS: Record<string, string> = {
  bakalavr: "Bakalavr",
  magistr: "Magistr",
};

const TUR_OPTIONS: { value: string; label: string; soat: number }[] = [
  { value: "dl", label: "DL (Diplom loyiha)", soat: 28 },
  { value: "md", label: "MD (Magistrlik dissertasiyasi)", soat: 50 },
];

const TUR_LABELS: Record<string, string> = {
  dl: "DL",
  md: "MD",
};

const TUR_COLORS: Record<string, string> = {
  dl: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
  md: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export default function DlMdPage() {
  // --- Lists ---
  const [otmList, setOtmList] = useState<OtmRecord[]>([]);
  const [fakultetList, setFakultetList] = useState<FakultetRecord[]>([]);
  const [kafedraList, setKafedraList] = useState<KafedraRecord[]>([]);
  const [oqituvchiList, setOqituvchiList] = useState<OqituvchiRecord[]>([]);
  const [biriktirmaList, setBiriktirmaList] = useState<DlMdBiriktirmaRecord[]>([]);

  // --- Form state ---
  const [formOtm, setFormOtm] = useState("");
  const [formFakList, setFormFakList] = useState<FakultetRecord[]>([]);
  const [formFakultet, setFormFakultet] = useState("");
  const [formKafList, setFormKafList] = useState<KafedraRecord[]>([]);
  const [formKafedra, setFormKafedra] = useState("");
  const [formOqituvchi, setFormOqituvchi] = useState("");
  const [formTur, setFormTur] = useState("");
  const [formTalimShakli, setFormTalimShakli] = useState("");
  const [formSemestr, setFormSemestr] = useState<"kuzgi" | "bahorgi">("kuzgi");
  const [formTalabaSoni, setFormTalabaSoni] = useState("");

  // --- Filter state ---
  const [filterOtm, setFilterOtm] = useState("");
  const [filterFakultet, setFilterFakultet] = useState("");
  const [filterKafedra, setFilterKafedra] = useState("");
  const [filterTalimShakli, setFilterTalimShakli] = useState("");

  // --- Editing state ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTalabaSoni, setEditTalabaSoni] = useState("");

  // --- Loading ---
  const [loadingOtm, setLoadingOtm] = useState(true);
  const [loadingFakultet, setLoadingFakultet] = useState(false);
  const [loadingKafedra, setLoadingKafedra] = useState(false);
  const [loadingOqituvchi, setLoadingOqituvchi] = useState(false);
  const [loadingBiriktirma, setLoadingBiriktirma] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Filter lists ---
  const [filterFakList, setFilterFakList] = useState<FakultetRecord[]>([]);
  const [filterKafList, setFilterKafList] = useState<KafedraRecord[]>([]);

  // ─── Fetch functions ───────────────────────
  const fetchOtmList = useCallback(async () => {
    setLoadingOtm(true);
    try {
      const res = await fetch("/api/crud/otm");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      setOtmList(list.map((o: Record<string, unknown>) => ({
        id: String(o.id),
        nomi: String(o.nomi ?? o.name ?? o.qisqaNomi ?? o.short_name ?? ""),
      })));
    } catch (err) {
      toast.error("OTM ro'yxatini yuklashda xato");
      console.error(err);
    }
    setLoadingOtm(false);
  }, []);

  const fetchFakultetList = useCallback(async (otmId: string) => {
    setLoadingFakultet(true);
    try {
      const res = await fetch(`/api/crud/fakultetlar?otmId=${otmId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      return list.map((f: Record<string, unknown>) => ({
        id: String(f.id),
        nomi: String(f.nomi ?? f.name ?? ""),
        otmId: String(f.otmId ?? f.otm ?? otmId),
      }));
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoadingFakultet(false);
    }
  }, []);

  const fetchKafedraList = useCallback(async (fakultetId: string) => {
    setLoadingKafedra(true);
    try {
      const res = await fetch(`/api/crud/kafedralar?fakultetId=${fakultetId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      return list.map((k: Record<string, unknown>) => ({
        id: String(k.id),
        nomi: String(k.nomi ?? k.name ?? ""),
        fakultetId: String(k.fakultetId ?? k.fakultet ?? k.faculty ?? fakultetId),
      }));
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoadingKafedra(false);
    }
  }, []);

  const fetchOqituvchiList = useCallback(async (kafedraId: string) => {
    setLoadingOqituvchi(true);
    try {
      const res = await fetch(`/api/crud/oqituvchilar?kafedraId=${kafedraId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      const list = Array.isArray(json) ? json : (json.results ?? []);
      setOqituvchiList(list.map((t: Record<string, unknown>) => ({
        id: String(t.id),
        fio: String(t.fio ?? t.full_name ?? ""),
        kafedraId: String(kafedraId),
        lavozim: String(t.lavozim ?? t.position ?? ""),
        ilmiyDaraja: String(t.ilmiyDaraja ?? t.degree ?? ""),
        ilmiyUnvon: String(t.ilmiyUnvon ?? t.academic_title ?? ""),
      })));
    } catch (err) {
      toast.error("O'qituvchilar ro'yxatini yuklashda xato");
      console.error(err);
    }
    setLoadingOqituvchi(false);
  }, []);

  const fetchBiriktirmaList = useCallback(async () => {
    setLoadingBiriktirma(true);
    try {
      const res = await fetch("/api/crud/dl-md");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setBiriktirmaList(Array.isArray(json) ? json : (json.results ?? []));
    } catch (err) {
      toast.error("DL/MD biriktmalarini yuklashda xato");
      console.error(err);
    }
    setLoadingBiriktirma(false);
  }, []);

  // ─── Form cascading effects ────────────────
  // Form OTM change
  useEffect(() => {
    if (formOtm) {
      fetchFakultetList(formOtm).then((list) => {
        setFormFakList(list);
      });
    } else {
      setFormFakList([]);
    }
    setFormFakultet("");
    setFormKafList([]);
    setFormKafedra("");
    setOqituvchiList([]);
    setFormOqituvchi("");
  }, [formOtm, fetchFakultetList]);

  // Form Fakultet change
  useEffect(() => {
    if (formFakultet) {
      fetchKafedraList(formFakultet).then((list) => {
        setFormKafList(list);
      });
    } else {
      setFormKafList([]);
    }
    setFormKafedra("");
    setOqituvchiList([]);
    setFormOqituvchi("");
  }, [formFakultet, fetchKafedraList]);

  // Form Kafedra change
  useEffect(() => {
    if (formKafedra) {
      fetchOqituvchiList(formKafedra);
    } else {
      setOqituvchiList([]);
    }
    setFormOqituvchi("");
  }, [formKafedra, fetchOqituvchiList]);

  // Form Tur change → auto set talim shakli
  useEffect(() => {
    if (formTur === "dl") {
      setFormTalimShakli("bakalavr");
    } else if (formTur === "md") {
      setFormTalimShakli("magistr");
    }
  }, [formTur]);

  // ─── Filter cascading effects ──────────────
  useEffect(() => {
    if (filterOtm) {
      fetchFakultetList(filterOtm).then((list) => setFilterFakList(list));
    } else {
      setFilterFakList([]);
    }
    setFilterFakultet("");
    setFilterKafList([]);
    setFilterKafedra("");
  }, [filterOtm, fetchFakultetList]);

  useEffect(() => {
    if (filterFakultet) {
      fetchKafedraList(filterFakultet).then((list) => setFilterKafList(list));
    } else {
      setFilterKafList([]);
    }
    setFilterKafedra("");
  }, [filterFakultet, fetchKafedraList]);

  // ─── Initial load ──────────────────────────
  useEffect(() => {
    fetchOtmList();
    fetchBiriktirmaList();
  }, [fetchOtmList, fetchBiriktirmaList]);

  // ─── Computed values ───────────────────────
  const filteredData = useMemo(() => {
    return biriktirmaList.filter((item) => {
      if (filterKafedra && item.kafedraId !== filterKafedra) return false;
      if (filterFakultet && !item.kafedra?.fakultet) return false;
      if (filterFakultet && item.kafedra?.fakultet?.id !== filterFakultet) return false;
      if (filterOtm && !item.kafedra?.fakultet?.otm) return false;
      if (filterOtm && item.kafedra?.fakultet?.otm?.id !== filterOtm) return false;
      if (filterTalimShakli && item.talimShakli !== filterTalimShakli) return false;
      return true;
    });
  }, [biriktirmaList, filterKafedra, filterFakultet, filterOtm, filterTalimShakli]);

  const formSoatBirligi = useMemo(() => {
    if (!formTur) return 0;
    return formTur === "dl" ? 28 : 50;
  }, [formTur]);

  const formJamiSoat = useMemo(() => {
    const soni = parseInt(formTalabaSoni, 10) || 0;
    return soni * formSoatBirligi;
  }, [formTalabaSoni, formSoatBirligi]);

  // ─── CRUD handlers ─────────────────────────
  async function handleSave() {
    if (!formKafedra || !formOqituvchi || !formTur) {
      toast.error("Kafedra, o'qituvchi va tur (DL/MD) tanlash majburiy");
      return;
    }
    const talabaSoni = parseInt(formTalabaSoni, 10);
    if (!talabaSoni || talabaSoni <= 0) {
      toast.error("Talabalar soni 0 dan katta bo'lishi kerak");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/crud/dl-md", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kafedraId: formKafedra,
          oqituvchiId: formOqituvchi,
          tur: formTur,
          talimShakli: formTalimShakli,
          semestr: formSemestr,
          talabaSoni,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      toast.success("Biriktirma muvaffaqiyatli qo'shildi");
      // Reset form
      setFormOtm("");
      setFormFakultet("");
      setFormKafedra("");
      setFormOqituvchi("");
      setFormTur("");
      setFormTalimShakli("");
      setFormSemestr("kuzgi");
      setFormTalabaSoni("");
      setFormFakList([]);
      setFormKafList([]);
      setOqituvchiList([]);
      fetchBiriktirmaList();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xato";
      toast.error(msg);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Ushbu biriktirmani o'chirishni xohlaysizmi?")) return;
    try {
      const res = await fetch(`/api/crud/dl-md?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      toast.success("Biriktirma o'chirildi");
      fetchBiriktirmaList();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xato";
      toast.error(msg);
    }
  }

  async function handleEditSave(id: string) {
    const talabaSoni = parseInt(editTalabaSoni, 10);
    if (!talabaSoni || talabaSoni <= 0) {
      toast.error("Talabalar soni 0 dan katta bo'lishi kerak");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/crud/dl-md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, talabaSoni }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      toast.success("Yangilandi");
      setEditingId(null);
      setEditTalabaSoni("");
      fetchBiriktirmaList();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xato";
      toast.error(msg);
    }
    setSaving(false);
  }

  function startEdit(item: DlMdBiriktirmaRecord) {
    setEditingId(item.id);
    setEditTalabaSoni(String(item.talabaSoni));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTalabaSoni("");
  }

  // ─── Total hours ───────────────────────────
  const totalJamiSoat = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.jamiSoat, 0);
  }, [filteredData]);

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
          <SelectTrigger id={id} className={`w-full ${disabled && !loading ? "opacity-50" : ""}`}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yuklanmoqda...
              </span>
            ) : (
              <SelectValue placeholder={placeholder} />
            )}
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
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
            <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            DL / MD biriktirish
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Diplom loyiha (DL) va Magistrlik dissertasiyasi (MD) biriktmalarini boshqarish.
            DL — 28 soat/talaba, MD — 50 soat/talaba
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm shrink-0">
          <Filter className="h-3.5 w-3.5" />
          {filteredData.length} ta biriktirma
        </Badge>
      </div>

      {/* ─── Biriktirish Form ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Yangi biriktirish
          </CardTitle>
          <CardDescription>
            OTM, fakultet, kafedra, o&apos;qituvchi va ta&apos;lim shaklini tanlab, talabalar sonini kiriting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* 1. OTM */}
            <SelectField
              id="form-otm"
              label="OTM ni tanlang"
              icon={Building2}
              value={formOtm}
              onValueChange={setFormOtm}
              disabled={loadingOtm}
              loading={loadingOtm}
              placeholder="OTM tanlang..."
            >
              {otmList.map((otm) => (
                <SelectItem key={otm.id} value={otm.id}>
                  {otm.nomi}
                </SelectItem>
              ))}
            </SelectField>

            {/* 2. Fakultet */}
            <SelectField
              id="form-fakultet"
              label="Fakultetni tanlang"
              icon={GraduationCap}
              value={formFakultet}
              onValueChange={setFormFakultet}
              disabled={!formOtm}
              loading={loadingFakultet}
              placeholder="Avval OTM tanlang..."
            >
              {formFakList.map((fak) => (
                <SelectItem key={fak.id} value={fak.id}>
                  {fak.nomi}
                </SelectItem>
              ))}
            </SelectField>

            {/* 3. Kafedra */}
            <SelectField
              id="form-kafedra"
              label="Kafedrani tanlang"
              icon={Library}
              value={formKafedra}
              onValueChange={setFormKafedra}
              disabled={!formFakultet}
              loading={loadingKafedra}
              placeholder="Avval fakultet tanlang..."
            >
              {formKafList.map((kaf) => (
                <SelectItem key={kaf.id} value={kaf.id}>
                  {kaf.nomi}
                </SelectItem>
              ))}
            </SelectField>

            {/* 4. O'qituvchi */}
            <SelectField
              id="form-oqituvchi"
              label="O'qituvchini tanlang"
              icon={Users}
              value={formOqituvchi}
              onValueChange={setFormOqituvchi}
              disabled={!formKafedra}
              loading={loadingOqituvchi}
              placeholder="Avval kafedra tanlang..."
            >
              {oqituvchiList.map((oq) => (
                <SelectItem key={oq.id} value={oq.id}>
                  {oq.fio}
                </SelectItem>
              ))}
            </SelectField>

            {/* 5. Tur (DL/MD) */}
            <SelectField
              id="form-tur"
              label="Tur"
              icon={FileText}
              value={formTur}
              onValueChange={setFormTur}
              disabled={false}
              placeholder="Tur tanlang..."
            >
              {TUR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} — {opt.soat} soat/talaba
                </SelectItem>
              ))}
            </SelectField>

            {/* 5.1. Semestr (Kuzgi/Bahorgi) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Semestr
              </Label>
              <div className="flex items-center gap-1 rounded-md border p-0.5 h-9">
                <Button
                  type="button"
                  size="sm"
                  variant={formSemestr === "kuzgi" ? "default" : "ghost"}
                  className={`h-7 flex-1 ${formSemestr === "kuzgi" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  onClick={() => setFormSemestr("kuzgi")}
                >
                  Kuzgi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={formSemestr === "bahorgi" ? "default" : "ghost"}
                  className={`h-7 flex-1 ${formSemestr === "bahorgi" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  onClick={() => setFormSemestr("bahorgi")}
                >
                  Bahorgi
                </Button>
              </div>
            </div>

            {/* 6. Talabalar soni */}
            <div className="space-y-1.5">
              <Label htmlFor="form-talabaSoni" className="text-sm font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Talabalar soni
              </Label>
              <Input
                id="form-talabaSoni"
                type="number"
                min={1}
                value={formTalabaSoni}
                onChange={(e) => setFormTalabaSoni(e.target.value)}
                placeholder="Talabalar soni..."
                onKeyDown={(e) => {
                  if (!/[\d]/.test(e.key) && e.key !== "Backspace" && e.key !== "Tab" && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Delete") {
                    e.preventDefault();
                  }
                }}
              />
            </div>

            {/* 7. Hisoblangan soat (readonly) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Hisoblangan soat
              </Label>
              <Input
                readOnly
                value={formJamiSoat > 0 ? `${formatNumber(formJamiSoat)} soat (${formatNumber(parseInt(formTalabaSoni, 10) || 0)} x ${formSoatBirligi})` : ""}
                placeholder={
                  !formTur || !formTalabaSoni
                    ? "Tur va talabalar sonini kiriting"
                    : "Hisoblash"
                }
                className="bg-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!formKafedra || !formOqituvchi || !formTur || !formTalabaSoni || saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Saqlash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Filter + Table ──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Biriktmalar jadvali
          </CardTitle>
          <CardDescription>
            Barcha DL/MD biriktmalar. Umumiy: {formatNumber(totalJamiSoat)} soat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SelectField
              id="filter-otm"
              label="OTM"
              icon={Building2}
              value={filterOtm}
              onValueChange={setFilterOtm}
              placeholder="Barchasi"
            >
              {otmList.map((otm) => (
                <SelectItem key={otm.id} value={otm.id}>
                  {otm.nomi}
                </SelectItem>
              ))}
            </SelectField>

            <SelectField
              id="filter-fakultet"
              label="Fakultet"
              icon={GraduationCap}
              value={filterFakultet}
              onValueChange={setFilterFakultet}
              disabled={!filterOtm}
              placeholder={!filterOtm ? "Avval OTM tanlang" : "Barchasi"}
            >
              {filterFakList.map((fak) => (
                <SelectItem key={fak.id} value={fak.id}>
                  {fak.nomi}
                </SelectItem>
              ))}
            </SelectField>

            <SelectField
              id="filter-kafedra"
              label="Kafedra"
              icon={Library}
              value={filterKafedra}
              onValueChange={setFilterKafedra}
              disabled={!filterFakultet}
              placeholder={!filterFakultet ? "Avval fakultet tanlang" : "Barchasi"}
            >
              {filterKafList.map((kaf) => (
                <SelectItem key={kaf.id} value={kaf.id}>
                  {kaf.nomi}
                </SelectItem>
              ))}
            </SelectField>

            <SelectField
              id="filter-talimShakli"
              label="Ta'lim shakli"
              icon={GraduationCap}
              value={filterTalimShakli}
              onValueChange={setFilterTalimShakli}
              placeholder="Barchasi"
            >
              {TALIM_SHAKLI_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectField>
          </div>

          {/* Table */}
          {loadingBiriktirma ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Biriktmalar topilmadi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hali DL/MD biriktirilmagan yoki filter bo&apos;yicha natija yo&apos;q
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="text-center">Tur</TableHead>
                    <TableHead className="min-w-[180px] text-center">O&apos;qituvchi</TableHead>
                    <TableHead className="min-w-[120px] text-center">Kafedra</TableHead>
                    <TableHead className="text-center">Fakultet</TableHead>
                    <TableHead className="text-center">OTM</TableHead>
                    <TableHead className="text-center">Ta&apos;lim shakli</TableHead>
                    <TableHead className="text-center">Talabalar</TableHead>
                    <TableHead className="text-center">Soat/talaba</TableHead>
                    <TableHead className="text-center font-bold">Jami soat</TableHead>
                    <TableHead className="w-24 text-center">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-center text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs font-medium ${TUR_COLORS[item.tur]}`}>
                          {TUR_LABELS[item.tur] || item.tur}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-center">
                        {item.oqituvchi?.fio || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                        {item.kafedra?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                        {item.kafedra?.fakultet?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                        {item.kafedra?.fakultet?.otm?.qisqaNomi || item.kafedra?.fakultet?.otm?.nomi || "\u2014"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {TALIM_SHAKLI_LABELS[item.talimShakli] || item.talimShakli}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === item.id ? (
                          <Input
                            type="number"
                            min={1}
                            value={editTalabaSoni}
                            onChange={(e) => setEditTalabaSoni(e.target.value)}
                            className="w-20 h-8 text-center text-sm"
                            onKeyDown={(e) => {
                              if (!/[\d]/.test(e.key) && e.key !== "Backspace" && e.key !== "Tab" && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Delete" && e.key !== "Enter") {
                                e.preventDefault();
                              }
                              if (e.key === "Enter") handleEditSave(item.id);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{item.talabaSoni}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.soatBirligi}
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(item.jamiSoat)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {editingId === item.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => handleEditSave(item.id)}
                                disabled={saving}
                              >
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={cancelEdit}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {filteredData.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Jami: {formatNumber(totalJamiSoat)} soat ({filteredData.length} ta biriktirma)
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
