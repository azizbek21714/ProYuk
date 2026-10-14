"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Trash2, Save, FileText, Printer, Loader2 } from "lucide-react";
import {
  SectionUslubiy, SectionIlmiy, SectionUstoz, ReytingTable,
  REYTING_ROWS, REYTING_COLS,
  type UslubiyRow, type IlmiyRow, type UstozRow, type ReytingData,
} from "@/components/reja/sections";
import { localizeEntityName, localizePersonName, localized, useTeacherI18n } from "@/lib/teacher-i18n";

// ==================== TYPES ====================
interface OqituvchiInfo {
  fio: string;
  lavozim: string;
  ilmiyDaraja: string;
  stavka: string;
  kafedraNomi: string;
  fakultetNomi: string;
  otmNomi: string;
  otmQisqaNomi: string;
}

interface SavedFan {
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
  nomi: string;
  soat: number;
  semestr: "kuzgi" | "bahorgi";
}

// O'quv ishlari qatori - 13 ta soat ustuni
interface OquvRow {
  id: string;
  fanId?: string;
  fanIds?: string[];
  nomi: string;
  semestr: "kuzgi" | "bahorgi";
  maruza: string;
  amaliy: string;
  lab: string;
  maslahat: string;
  nazorat: string;
  taqriz: string;
  kursIshi: string;
  mdBitiruv: string;
  kursHimoya: string;
  amaliyot: string;
  qaytaTopshirish: string;
  jami: string;
  reyting: string;
}

interface RejaDoc {
  dekan: string;
  bayonnomaYil: string;
  bayonnomaSana: string;
  bayonnomaRaqam: string;
  oquvIshlari: OquvRow[];
  uslubiy: UslubiyRow[];
  ilmiy: IlmiyRow[];
  ustozShogird: UstozRow[];
  reyting: ReytingData;
  xulosaKafedra: string;
  xulosaKengash: string;
}

interface RejaData {
  fanlar?: SavedFan[];
  stavka?: "rate_1" | "rate_0_5" | "rate_0_25";
  doc?: Partial<RejaDoc>;
  [k: string]: unknown;
}

interface RejaDetail {
  id: string;
  oqituvchiId: string;
  oquvYiliNomi: string;
  status: string;
  jamiSoat: number;
  kafedraId: number | null;
  oqituvchi: OqituvchiInfo | null;
  data: RejaData | null;
}

// ==================== LABELS ====================
// Titulda "assistenti Jo'rayev ..." ko'rinishida ishlatish uchun
const LAVOZIM_GEN: Record<string, string> = {
  professor: "professori",
  associate_professor: "dotsenti",
  senior_teacher: "katta o'qituvchisi",
  teacher: "stajyor-o'qituvchisi",
  assistant: "assistenti",
};
const STAVKA_LABEL: Record<string, string> = {
  rate_1: "1 stavka",
  rate_0_5: "0.5 stavka",
  rate_0_25: "0.25 stavka",
};

// O'quv ishlari turi (soat) - ustunlar
const OQUV_COLS: { key: keyof OquvRow; label: string }[] = [
  { key: "maruza", label: "Ma'ruza" },
  { key: "amaliy", label: "Amaliy mashg'ulot" },
  { key: "lab", label: "Laboratoriya ishi" },
  { key: "nazorat", label: "Nazorat" },
  { key: "kursIshi", label: "Kurs ishi" },
  { key: "mdBitiruv", label: "MD va Bitiruv ishi" },
  { key: "kursHimoya", label: "Kurs ishi himoyasi" },
  { key: "amaliyot", label: "Amaliyot" },
  { key: "qaytaTopshirish", label: "Qayta topshirish" },
  { key: "jami", label: "Jami" },
];
// Yig'indi hisoblanadigan ustunlar (Jami/Amalda qatorlari uchun)
const SUM_COLS = OQUV_COLS.map((c) => c.key) as (keyof OquvRow)[];

const num = (v: string | number | undefined) => Number(v) || 0;
const uid = () => Math.random().toString(36).slice(2, 9);
const savedFanRowKey = (fan: SavedFan) => {
  if (fan.sourceRowKey) return fan.sourceRowKey;
  const match = String(fan.id).match(/^lesson:[^:]+:(kuzgi|bahorgi):(\d+):/);
  return match ? `${match[1]}:${match[2]}` : `single:${fan.id}`;
};
const savedFanBaseName = (fan: SavedFan) => fan.baseNomi || fan.nomi
  .replace(/^(Ma'ruza|Amaliyot|Laboratoriya|MD ilmiy rahbarlik|BMI rahbarlik):\s*/i, "")
  .replace(/\s+—\s+\d+\s+talaba$/i, "");

// Stavka bo'yicha alohida yuklama (variant) ni reja.data dan oladi.
// Eski (variantsiz) ma'lumotlar uchun yuqori darajadagi fanlar/doc data.stavka ga tegishli deb olinadi.
function getVariant(
  data: RejaData | null | undefined,
  stavka: string
): { fanlar: SavedFan[]; doc: Partial<RejaDoc> } {
  const variants = (data as { variants?: Record<string, { fanlar?: SavedFan[]; doc?: Partial<RejaDoc> }> })?.variants;
  const v = variants?.[stavka];
  if (v && typeof v === "object") {
    return { fanlar: Array.isArray(v.fanlar) ? v.fanlar : [], doc: (v.doc as Partial<RejaDoc>) || {} };
  }
  const legacyStavka = data?.stavka || "rate_1";
  if (stavka === legacyStavka) {
    return {
      fanlar: Array.isArray(data?.fanlar) ? data!.fanlar! : [],
      doc: (data?.doc as Partial<RejaDoc>) || {},
    };
  }
  return { fanlar: [], doc: {} };
}
// Word/HTML eksport uchun matnni xavfsizlash
const ESC = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function emptyOquvRow(semestr: "kuzgi" | "bahorgi", nomi = ""): OquvRow {
  return {
    id: uid(), nomi, semestr,
    maruza: "", amaliy: "", lab: "", maslahat: "", nazorat: "", taqriz: "",
    kursIshi: "", mdBitiruv: "", kursHimoya: "", amaliyot: "",
    qaytaTopshirish: "", jami: "", reyting: "",
  };
}

// ==================== PAGE ====================
export default function RejaShablonPage() {
  const params = useParams();
  const teacherMode = usePathname().startsWith("/dashboard/teacher/");
  const { language: selectedLanguage } = useTeacherI18n();
  const language = teacherMode ? selectedLanguage : "uz";
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rejaId = params.id as string;
  // Qaysi stavka uchun yuklama (1 stavka yoki 0.5 stavka)
  const requestedStavka = searchParams.get("stavka");
  const stavka: "rate_1" | "rate_0_5" | "rate_0_25" =
    requestedStavka === "rate_0_5" || requestedStavka === "rate_0_25" ? requestedStavka : "rate_1";

  const [reja, setReja] = useState<RejaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [doc, setDoc] = useState<RejaDoc>({
    dekan: "", bayonnomaYil: "202_", bayonnomaSana: "", bayonnomaRaqam: "",
    oquvIshlari: [], uslubiy: [], ilmiy: [], ustozShogird: [], reyting: {},
    xulosaKafedra: "", xulosaKengash: "",
  });

  // --- Reja yuklash ---
  const fetchReja = useCallback(async () => {
    setLoading(true);
    try {
      const detailUrl = teacherMode
        ? `/api/teacher/dashboard?document=1&rejaId=${encodeURIComponent(rejaId)}`
        : `/api/crud/rejalar?id=${rejaId}`;
      const res = await fetch(detailUrl);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xato");
      setReja(json);

      const variant = getVariant(json.data, stavka);
      const savedDoc = variant.doc as Partial<RejaDoc>;
      const savedFanlar: SavedFan[] = variant.fanlar;

      // O'qituvchiga biriktirilgan DL/MD (diplom/dissertatsiya rahbarligi)
      const dlmdRows: OquvRow[] = [];
      try {
        const dr = await fetch(`/api/crud/dl-md?oqituvchiId=${json.oqituvchiId}`);
        if (dr.ok) {
          const dj = await dr.json();
          const items = Array.isArray(dj) ? dj : (dj.results ?? []);
          for (const it of items) {
            if (it.oquvYili && String(it.oquvYili) !== String(json.oquvYiliNomi)) continue;
            const turLabel = String(it.tur).toLowerCase() === "md" ? "MD (Magistrlik dissertatsiyasi)" : "DL (Diplom loyiha)";
            const sem: "kuzgi" | "bahorgi" = String(it.semestr) === "kuzgi" ? "kuzgi" : "bahorgi";
            const row = emptyOquvRow(sem, `${turLabel} rahbarligi — ${it.talabaSoni ?? 0} talaba`);
            row.id = `dlmd-${it.id ?? uid()}`; // DL/MD qatorini belgilash (sinxronlash uchun)
            row.mdBitiruv = it.jamiSoat ? String(it.jamiSoat) : "";
            row.jami = it.jamiSoat ? String(it.jamiSoat) : "";
            dlmdRows.push(row);
          }
        }
      } catch { /* ixtiyoriy */ }

      // O'quv ishlari - saqlangani bo'lmasa, biriktirilgan fanlar + DL/MD dan tuziladi
      let oquvIshlari: OquvRow[] = Array.isArray(savedDoc.oquvIshlari) ? savedDoc.oquvIshlari : [];
      if (oquvIshlari.length === 0 && (savedFanlar.length > 0 || dlmdRows.length > 0)) {
        // Kafedra fanlaridan ma'ruza/amaliy/lab soatlarini olamiz (prefill)
        const breakdown = new Map<string, { maruza: number; amaliy: number; lab: number }>();
        if (json.kafedraId) {
          try {
            let page = 1;
            while (page <= 200) {
              const fr = await fetch(`/api/crud/fanlar?kafedraId=${json.kafedraId}&page=${page}`);
              if (!fr.ok) break;
              const fj = await fr.json();
              const rows = Array.isArray(fj) ? fj : (fj.results ?? []);
              for (const r of rows) {
                breakdown.set(String(r.id), {
                  maruza: num(r.maruza_hours), amaliy: num(r.amaliyot_hours), lab: num(r.laboratoriya_hours),
                });
              }
              if (!fj.next || rows.length === 0) break;
              page++;
            }
          } catch { /* ixtiyoriy */ }
        }
        const mergedRows = new Map<string, OquvRow>();
        for (const f of savedFanlar) {
          const b = breakdown.get(String(f.subjectId ?? f.id));
          const key = savedFanRowKey(f);
          const row = mergedRows.get(key) ?? emptyOquvRow(f.semestr, savedFanBaseName(f));
          row.fanId ??= String(f.id);
          row.fanIds = [...(row.fanIds ?? []), String(f.id)];
          const addHour = (field: keyof OquvRow, value: number) => {
            row[field] = String(num(row[field] as string) + value) as never;
          };
          if (f.lessonType === "maruza") {
            addHour("maruza", f.soat);
          } else if (f.lessonType === "amaliyot") {
            addHour("amaliy", f.soat);
          } else if (f.lessonType === "laboratoriya") {
            addHour("lab", f.soat);
          } else if (f.workloadKind) {
            if (f.workloadKind === "nazorat") addHour("nazorat", f.soat);
            if (f.workloadKind === "kurs_loyihasi") addHour("kursIshi", f.soat);
            if (f.workloadKind === "md_ilmiy_rahbarlik" || f.workloadKind === "bmi_rahbarlik") addHour("mdBitiruv", f.soat);
            if (f.workloadKind === "amaliyot") addHour("amaliyot", f.soat);
            if (f.workloadKind === "dak_taqriz") addHour("taqriz", f.soat);
          } else {
            row.maruza = b?.maruza ? String(b.maruza) : "";
            row.amaliy = b?.amaliy ? String(b.amaliy) : "";
            row.lab = b?.lab ? String(b.lab) : "";
          }
          addHour("jami", f.soat);
          mergedRows.set(key, row);
        }
        oquvIshlari = Array.from(mergedRows.values());
      }
      // DL/MD rahbarligi qatorlarini HAR DOIM sinxronlaymiz:
      // eski "dlmd-" qatorlarni olib tashlab, joriy biriktirmalarni qo'shamiz
      // (shu sabab saqlangan rejada ham DL/MD soatlari ko'rinadi)
      oquvIshlari = oquvIshlari
        .filter((r) => !String(r.id).startsWith("dlmd-"))
        .concat(dlmdRows);

      // Eski saqlangan hujjat qatorlariga ham tegishli fan id sini qayta bog'laymiz.
      // Shunda admin "Jami" soatini tahrirlaganda aynan shu fan yuklamasi yangilanadi.
      const unmatchedFans = [...savedFanlar];
      oquvIshlari = oquvIshlari.map((row) => {
        if (String(row.id).startsWith("dlmd-")) return row;
        if (Array.isArray(row.fanIds) && row.fanIds.length > 0) {
          const wanted = new Set(row.fanIds.map(String));
          const matchedIds = unmatchedFans
            .filter((fan) => wanted.has(String(fan.id)))
            .map((fan) => String(fan.id));
          for (let index = unmatchedFans.length - 1; index >= 0; index--) {
            if (wanted.has(String(unmatchedFans[index].id))) unmatchedFans.splice(index, 1);
          }
          return { ...row, fanId: matchedIds[0] ?? row.fanId, fanIds: matchedIds.length ? matchedIds : row.fanIds };
        }
        const matchIndex = unmatchedFans.findIndex((fan) =>
          (row.fanId && String(fan.id) === String(row.fanId)) ||
          (!row.fanId && fan.nomi === row.nomi && fan.semestr === row.semestr)
        );
        if (matchIndex < 0) return row;
        const [fan] = unmatchedFans.splice(matchIndex, 1);
        return { ...row, fanId: String(fan.id), fanIds: [String(fan.id)] };
      });

      setDoc({
        dekan: savedDoc.dekan ?? "",
        bayonnomaYil: savedDoc.bayonnomaYil ?? "202_",
        bayonnomaSana: savedDoc.bayonnomaSana ?? "",
        bayonnomaRaqam: savedDoc.bayonnomaRaqam ?? "",
        oquvIshlari,
        uslubiy: Array.isArray(savedDoc.uslubiy) ? savedDoc.uslubiy : [],
        ilmiy: Array.isArray(savedDoc.ilmiy) ? savedDoc.ilmiy : [],
        ustozShogird: Array.isArray(savedDoc.ustozShogird) ? savedDoc.ustozShogird : [],
        reyting: savedDoc.reyting && typeof savedDoc.reyting === "object" ? savedDoc.reyting : {},
        xulosaKafedra: savedDoc.xulosaKafedra ?? "",
        xulosaKengash: savedDoc.xulosaKengash ?? "",
      });
    } catch (err) {
      toast.error(tr("Rejani yuklashda xato", "Ошибка загрузки плана", "Failed to load the plan"));
      console.error(err);
    }
    setLoading(false);
  }, [rejaId, stavka, teacherMode]);

  useEffect(() => { fetchReja(); }, [fetchReja]);

  const kuzgiRows = doc.oquvIshlari.filter((r) => r.semestr === "kuzgi");
  const bahorgiRows = doc.oquvIshlari.filter((r) => r.semestr === "bahorgi");

  // --- Soat yig'indilari: O'QUV ISHLARI jadvalidagi "Jami" ustuni bo'yicha
  //     (fanlar + DL/MD rahbarlik soatlari birga) ---
  const fanKuzgiSoat = kuzgiRows.reduce((a, r) => a + num(r.jami), 0);
  const fanBahorgiSoat = bahorgiRows.reduce((a, r) => a + num(r.jami), 0);
  const fanJamiSoat = fanKuzgiSoat + fanBahorgiSoat;

  function colSum(rows: OquvRow[], key: keyof OquvRow) {
    return rows.reduce((a, r) => a + num(r[key] as string), 0);
  }

  // --- O'quv ishlari qator amallari ---
  function updateOquvRow(id: string, key: keyof OquvRow, value: string) {
    setDoc((prev) => ({
      ...prev,
      oquvIshlari: prev.oquvIshlari.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    }));
  }
  function addOquvRow(semestr: "kuzgi" | "bahorgi") {
    setDoc((prev) => ({ ...prev, oquvIshlari: [...prev.oquvIshlari, emptyOquvRow(semestr)] }));
  }
  function removeOquvRow(id: string) {
    setDoc((prev) => ({ ...prev, oquvIshlari: prev.oquvIshlari.filter((r) => r.id !== id) }));
  }

  // --- Saqlash ---
  async function handleSave() {
    if (!reja) return;
    setSaving(true);
    try {
      // O'quv ishlari jadvalidagi tahrirlarni asosiy fan yuklamalariga ham yozamiz.
      // Dashboard va o'qituvchilar jadvali aynan shu ro'yxatdan hisoblaydi.
      const prevData = reja.data || {};
      const prevVariants = (prevData as { variants?: Record<string, unknown> }).variants || {};
      const previousFans = getVariant(prevData, stavka).fanlar;
      const unmatchedFans = [...previousFans];
      const syncedFans = doc.oquvIshlari
        .filter((row) => !String(row.id).startsWith("dlmd-"))
        .filter((row) => row.nomi.trim() || num(row.jami) > 0)
        .flatMap((row) => {
          const wantedIds = new Set((row.fanIds?.length ? row.fanIds : row.fanId ? [row.fanId] : []).map(String));
          let matched = unmatchedFans.filter((fan) => wantedIds.has(String(fan.id)));
          if (matched.length === 0) {
            const matchIndex = unmatchedFans.findIndex((fan) =>
              (!row.fanId && fan.nomi === row.nomi && fan.semestr === row.semestr)
            );
            if (matchIndex >= 0) matched = [unmatchedFans[matchIndex]];
          }
          if (matched.length > 0) {
            const matchedIds = new Set(matched.map((fan) => String(fan.id)));
            for (let index = unmatchedFans.length - 1; index >= 0; index--) {
              if (matchedIds.has(String(unmatchedFans[index].id))) unmatchedFans.splice(index, 1);
            }
            const typeCount = (fan: SavedFan) => matched.filter((other) =>
              other.lessonType === fan.lessonType && other.workloadKind === fan.workloadKind
            ).length || 1;
            const rowHours = (fan: SavedFan) => {
              if (fan.lessonType === "maruza") return num(row.maruza) / typeCount(fan);
              if (fan.lessonType === "amaliyot") return num(row.amaliy) / typeCount(fan);
              if (fan.lessonType === "laboratoriya") return num(row.lab) / typeCount(fan);
              if (fan.workloadKind === "nazorat") return num(row.nazorat) / typeCount(fan);
              if (fan.workloadKind === "kurs_loyihasi") return num(row.kursIshi) / typeCount(fan);
              if (fan.workloadKind === "md_ilmiy_rahbarlik" || fan.workloadKind === "bmi_rahbarlik") return num(row.mdBitiruv) / typeCount(fan);
              if (fan.workloadKind === "amaliyot") return num(row.amaliyot) / typeCount(fan);
              if (fan.workloadKind === "dak_taqriz") return num(row.taqriz) / typeCount(fan);
              return num(row.jami) / matched.length;
            };
            return matched.map((previous) => ({ ...previous, soat: rowHours(previous), semestr: row.semestr }));
          }
          return [{
            id: `manual-${row.id}`,
            nomi: row.nomi,
            soat: num(row.jami),
            semestr: row.semestr,
          }];
        });
      const newData = {
        ...prevData,
        variants: {
          ...prevVariants,
          [stavka]: { fanlar: syncedFans, doc },
        },
      };
      const editableDoc: Partial<RejaDoc> = { ...doc };
      delete editableDoc.oquvIshlari;
      const res = await fetch(teacherMode ? "/api/teacher/dashboard" : `/api/crud/rejalar?id=${rejaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherMode ? {
          action: "save_personal_plan",
          rejaId,
          activeStavka: stavka,
          variants: { [stavka]: editableDoc },
        } : { data: newData }),
      });
      if (res.ok) {
        toast.success(tr("Shablon saqlandi", "Шаблон сохранён", "Template saved"));
        setReja((prev) => (prev ? { ...prev, data: newData } : prev));
      } else {
        toast.error(tr("Saqlashda xato", "Ошибка сохранения", "Failed to save"));
      }
    } catch {
      toast.error(tr("Saqlashda xato", "Ошибка сохранения", "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  // --- Word eksport: inline-stilli (Word Tailwind klasslarini tushunmaydi) ---
  function buildWordHtml(): string {
    const o2 = reja?.oqituvchi;
    const fak = ESC(o2?.fakultetNomi || "—");
    const kaf = ESC(o2?.kafedraNomi || "—");
    const fioE = ESC(o2?.fio || "—");
    const otm = ESC(o2?.otmNomi || "OLIY TA'LIM MUASSASASI");
    const lavGen = o2 ? (LAVOZIM_GEN[o2.lavozim] || o2.lavozim) : "";
    const stavkaLbl = STAVKA_LABEL[stavka] || "1 stavka";

    const C = "border:1px solid #000;padding:2px 4px;font-family:Cambria,'Times New Roman',serif;font-size:10pt;vertical-align:middle;";
    const TB = "border-collapse:collapse;width:100%;font-family:Cambria,'Times New Roman',serif;font-size:10pt;margin-top:6px;";
    const TC = "text-align:center;";
    const B = "font-weight:bold;";

    // ----- TITUL (14pt) -----
    // Titul kataklari va matni 14pt
    const PL14 = "padding:2px 6px;font-family:Cambria,'Times New Roman',serif;font-size:14pt;";
    const TFS = "font-family:Cambria,serif;font-size:14pt;";

    // Tashqi jadval Word'da A4 ish maydonining to'liq balandligini ishonchli saqlaydi.
    let h = `<table class="title-page" style="border-collapse:collapse;width:100%;height:26.8cm;table-layout:fixed;border:none;line-height:150%;mso-line-height-rule:auto;${TFS}"><tbody>
      <tr><td style="border:none;text-align:center;vertical-align:top;font-weight:bold;padding-top:4px;">
        <p style="margin:2px 0">O'ZBEKISTON RESPUBLIKASI</p>
        <p style="margin:2px 0">OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI</p>
        <p style="margin:2px 0">${otm}</p>
      </td></tr>
      <tr><td style="border:none;vertical-align:middle;">
        <table style="border-collapse:collapse;width:100%;border:none;"><tr>
          <td style="${PL14}width:50%;border:none;"></td>
          <td style="${PL14}${TC}vertical-align:top;border:none;">
            <p style="margin:0;${B}">TASDIQLAYMAN</p>
            <p style="margin:0">&laquo;${fak}&raquo; fakulteti</p>
            <p style="margin:14px 0 0 0">dekani _________ ${ESC(doc.dekan)}</p>
            <p style="margin:0;font-size:8pt">(imzo)</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="border:none;text-align:center;vertical-align:middle;">
        <p style="margin:1px 0"><b>${fak}</b> fakulteti</p>
        <p style="margin:1px 0"><b>${kaf}</b> kafedrasi</p>
        <p style="margin:1px 0">${ESC(lavGen)} <b><u>${fioE}</u></b></p>
        <p style="margin:1px 0">${ESC(yil)} o'quv yiliga</p>
      </td></tr>
      <tr><td style="border:none;text-align:center;vertical-align:middle;">
        <p style="margin:0;font-size:22pt;${B}font-family:Cambria,serif;">SHAXSIY ISH REJASI</p>
        <p style="margin:0;${TFS}">(${ESC(stavkaLbl)})</p>
      </td></tr>
      <tr><td style="border:none;vertical-align:middle;">
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="${PL14}text-align:right">O'qituvchining ${ESC(yil)} o'quv yilidagi o'quv yuklamasi</td><td style="${PL14}${TC}${B}text-decoration:underline;width:70px">${fanJamiSoat}</td><td style="${PL14}width:55px">soat:</td></tr>
          <tr><td style="${PL14}border:none;text-align:right">kuzgi semestrda</td><td style="${PL14}border:none;${TC}${B}">${fanKuzgiSoat}</td><td style="${PL14}border:none;">soat:</td></tr>
          <tr><td style="${PL14}border:none;text-align:right">bahorgi semestrda</td><td style="${PL14}border:none;${TC}${B}">${fanBahorgiSoat}</td><td style="${PL14}border:none;">soat:</td></tr>
        </table>
      </td></tr>
      <tr><td style="border:none;text-align:center;vertical-align:middle;">
        <p style="margin:0">Reja kafedra majlisida muhokama qilindi va tasdiqlandi</p>
        <p style="margin:0">(${ESC(doc.bayonnomaYil)} yil ${ESC(doc.bayonnomaSana || "_______")}, ${ESC(doc.bayonnomaRaqam || "____")}-sonli bayonnoma)</p>
      </td></tr>
      <tr><td style="border:none;vertical-align:middle;">
        <p style="text-align:right;margin:0;">Kafedra mudiri _____________</p>
        <p style="text-align:right;margin:0;font-size:9pt;">(imzo)</p>
        <p style="text-align:right;margin:18px 0 0;">O'qituvchi _____________</p>
        <p style="text-align:right;margin:0;font-size:9pt;">(imzo)</p>
      </td></tr>
      <tr><td style="border:none;text-align:center;vertical-align:bottom;font-weight:bold;padding-bottom:4px;">TOSHKENT ${ESC(String(yil).split("-")[0] || "2025")}</td></tr>
    </tbody></table>`;

    // ----- O'QUV ISHLARI -----
    h += `<p style="text-align:center;${B}margin-top:18px;font-family:Cambria,serif;font-size:10pt;page-break-before:always;">O'QUV ISHLARI</p>`;
    // Word tik (rotated) matnni CSS bilan ishonchli chiqarmaydi — shuning uchun
    // har bir sarlavhani 90° aylantirilgan RASM (PNG) sifatida joylashtiramiz.
    // Bu ekrandagi vertikal ko'rinishga mos keladi va istalgan Word versiyasida ishlaydi.
    const vImg = (label: string): { url: string; w: number; h: number } => {
      const fontPx = 13; // ~10pt
      const probe = document.createElement("canvas").getContext("2d");
      if (probe) probe.font = `bold ${fontPx}px Cambria, 'Times New Roman', serif`;
      const textW = probe ? probe.measureText(label).width : label.length * 7;
      const pad = 6;
      const w = fontPx + 6;            // tor kenglik
      const h = Math.ceil(textW) + pad * 2;
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        ctx.font = `bold ${fontPx}px Cambria, 'Times New Roman', serif`;
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.translate(w / 2, h / 2); // rasm markazi
        ctx.rotate(-Math.PI / 2); // pastdan yuqoriga o'qiladi (ekrandagidek)
        ctx.fillText(label, 0, 0); // markazlangan — kesilmaydi
      }
      return { url: cv.toDataURL("image/png"), w, h };
    };
    const headerImgs = OQUV_COLS.map((c) => vImg(c.label));
    const maxHeadH = Math.max(...headerImgs.map((x) => x.h));
    const vhead = OQUV_COLS.map((c, i) => {
      const im = headerImgs[i];
      return `<th style="${C}${TC}vertical-align:bottom;width:${im.w + 6}px;height:${maxHeadH}px;"><img src="${im.url}" width="${im.w}" height="${im.h}" style="display:block;margin:0 auto;"/></th>`;
    }).join("");
    const oRow = (idx: number, r: OquvRow) =>
          `<tr><td style="${C}${TC}">${idx}</td><td style="${C}word-wrap:break-word;overflow-wrap:break-word;height:32px;line-height:14px;overflow:hidden;">${ESC(r.nomi)}</td>` +
      OQUV_COLS.map((c) => `<td style="${C}${TC}">${ESC(r[c.key] as string)}</td>`).join("") + `</tr>`;
    const oSum = (label: string, rows: OquvRow[]) => {
      const s = (k: keyof OquvRow) => rows.reduce((a, x) => a + (Number(x[k] as string) || 0), 0);
      return `<tr><td colspan="2" style="${C}${TC}${B}">${label} (Reja)</td>` +
        SUM_COLS.map((k) => `<td style="${C}${TC}${B}">${s(k) || ""}</td>`).join("") + `</tr>` +
        `<tr><td colspan="2" style="${C}${TC}${B}">${label} (Amalda)</td>` + SUM_COLS.map(() => `<td style="${C}"></td>`).join("") + `</tr>`;
    };
    h += `<table style="${TB}table-layout:fixed;">
      <tr><th rowspan="2" style="${C}${TC}width:24px;">№</th><th rowspan="2" style="${C}${TC}width:260px;">O'quv ishlari nomi, fakultet, guruh, (talabalar soni)</th>
      <th colspan="${OQUV_COLS.length}" style="${C}${TC}">O'quv ishlari turi (soat)</th></tr>
      <tr>${vhead}</tr>
      <tr><td colspan="${OQUV_COLS.length + 2}" style="${C}${TC}${B}background:#eee;">Kuzgi semestr</td></tr>
      ${kuzgiRows.map((r, i) => oRow(i + 1, r)).join("")}
      ${oSum("Jami", kuzgiRows)}
      <tr><td colspan="${OQUV_COLS.length + 2}" style="${C}${TC}${B}background:#eee;">Bahorgi semestr</td></tr>
      ${bahorgiRows.map((r, i) => oRow(i + 1, r)).join("")}
      ${oSum("Jami", bahorgiRows)}
      <tr><td colspan="2" style="${C}${TC}${B}">O'quv yilida hammasi (Reja)</td>
      ${SUM_COLS.map((k) => `<td style="${C}${TC}${B}">${(colSum(kuzgiRows, k) + colSum(bahorgiRows, k)) || ""}</td>`).join("")}</tr>
      <tr><td colspan="2" style="${C}${TC}${B}">O'quv yilida hammasi (Amalda)</td>${SUM_COLS.map(() => `<td style="${C}"></td>`).join("")}</tr>
      </table>`;

    // ----- Yordamchi: oddiy bo'lim jadvali -----
    const simpleTable = (
      title: string,
      head1: string,
      head2: string,
      rowsHtml: string,
      jamiCols: number
    ) =>
      `<p style="${B}margin-top:16px;font-family:Cambria,serif;font-size:10pt">${title}</p>` +
      `<table style="${TB}"><tr>${head1}</tr>${head2 ? `<tr>${head2}</tr>` : ""}${rowsHtml}` +
      `<tr><td colspan="${jamiCols}" style="${C}${TC}${B}">Jami</td></tr></table>`;

    // 1. Uslubiy
    const usH1 = `<th rowspan="2" style="${C}">№</th><th rowspan="2" style="${C}">Bajariladigan ishlar</th>` +
      `<th colspan="2" style="${C}">Muddat</th><th colspan="2" style="${C}">Ish hajmi (Reja)</th>` +
      `<th colspan="2" style="${C}">Ish hajmi (Amalda)</th><th colspan="2" style="${C}">Rejadan tashqari</th>` +
      `<th rowspan="2" style="${C}">To'plangan reyting ball</th>`;
    const usH2 = ["reja", "amalda", "bet", "Soat", "bet", "soat", "bet", "Soat"].map((x) => `<th style="${C}">${x}</th>`).join("");
    const usRows = doc.uslubiy.map((r, i) =>
      `<tr><td style="${C}${TC}">${i + 1}</td><td style="${C}">${ESC(r.nomi)}</td>` +
      [r.muddatReja, r.muddatAmalda, r.rejaBet, r.rejaSoat, r.amaldaBet, r.amaldaSoat, r.tashqariBet, r.tashqariSoat, r.reyting]
        .map((v) => `<td style="${C}${TC}">${ESC(v)}</td>`).join("") + `</tr>`).join("");
    h += simpleTable("1. O'QUV - USLUBIY ISHLARI", usH1, usH2, usRows, 11);

    // 2. Ilmiy
    const ilH1 = `<th rowspan="2" style="${C}">№</th><th rowspan="2" style="${C}">Bajariladigan ishlar</th>` +
      `<th colspan="2" style="${C}">Muddat</th><th colspan="2" style="${C}">Ishning ijro belgisi</th>` +
      `<th colspan="2" style="${C}">Ish hajmi, soatda</th><th rowspan="2" style="${C}">Rejadan tashqari</th>` +
      `<th rowspan="2" style="${C}">To'plangan reyting ball</th>`;
    const ilH2 = ["Reja", "amalda", "Respub.", "Scopus/WoS", "reja", "amalda"].map((x) => `<th style="${C}">${x}</th>`).join("");
    const ilRows = doc.ilmiy.map((r, i) =>
      `<tr><td style="${C}${TC}">${i + 1}</td><td style="${C}">${ESC(r.nomi)}</td>` +
      [r.muddatReja, r.muddatAmalda, r.respub, r.scopus, r.rejaSoat, r.amaldaSoat, r.tashqari, r.reyting]
        .map((v) => `<td style="${C}${TC}">${ESC(v)}</td>`).join("") + `</tr>`).join("");
    h += simpleTable("2. ILMIY - TADQIQOT ISHLARI", ilH1, ilH2, ilRows, 10);

    // 3. Ustoz-shogird
    const ustH1 = `<th rowspan="2" style="${C}">№</th><th rowspan="2" style="${C}">Bajariladigan ishlar</th>` +
      `<th colspan="2" style="${C}">Muddat</th><th rowspan="2" style="${C}">O'tkazish joyi</th>` +
      `<th colspan="2" style="${C}">Ish hajmi, soatda</th><th rowspan="2" style="${C}">Rejadan tashqari</th>` +
      `<th rowspan="2" style="${C}">To'plangan reyting ball</th>`;
    const ustH2 = ["Reja", "Amalda", "Reja", "Amalda"].map((x) => `<th style="${C}">${x}</th>`).join("");
    const ustRows = doc.ustozShogird.map((r, i) =>
      `<tr><td style="${C}${TC}">${i + 1}</td><td style="${C}">${ESC(r.nomi)}</td>` +
      [r.muddatReja, r.muddatAmalda, r.joy, r.rejaSoat, r.amaldaSoat, r.tashqari, r.reyting]
        .map((v) => `<td style="${C}${TC}">${ESC(v)}</td>`).join("") + `</tr>`).join("");
    h += simpleTable("3. USTOZ - SHOGIRD ISHLARI", ustH1, ustH2, ustRows, 9);

    // Reyting
    const rv = (row: string, col: string) => row === "reja" && col === "oquv" ? fanJamiSoat : Number(doc.reyting[`${row}_${col}`]) || 0;
    const rowJ = (row: string) => REYTING_COLS.reduce((a, c) => a + rv(row, c.key), 0);
    const colJ = (col: string) => REYTING_ROWS.reduce((a, r) => a + rv(r.key, col), 0);
    const grand = REYTING_ROWS.reduce((a, r) => a + rowJ(r.key), 0);
    h += `<p style="text-align:center;${B}margin-top:16px;font-family:Cambria,serif;font-size:10pt">O'QITUVCHI O'QUV YILI DAVOMIDA TO'PLAGAN REYTING BALLARI</p>`;
    h += `<table style="${TB}">
      <tr><th rowspan="2" style="${C}">Reyting ballari</th><th colspan="4" style="${C}">Faoliyat turi</th><th rowspan="2" style="${C}">Jami</th></tr>
      <tr>${REYTING_COLS.map((c) => `<th style="${C}">${ESC(c.label)}</th>`).join("")}</tr>
      ${REYTING_ROWS.map((r) => `<tr><td style="${C}${B}">${ESC(r.label)}</td>` +
        REYTING_COLS.map((c) => `<td style="${C}${TC}">${rv(r.key, c.key) || ""}</td>`).join("") +
        `<td style="${C}${TC}${B}">${rowJ(r.key) || ""}</td></tr>`).join("")}
      <tr><td style="${C}${B}">Jami</td>${REYTING_COLS.map((c) => `<td style="${C}${TC}${B}">${colJ(c.key) || ""}</td>`).join("")}<td style="${C}${TC}${B}">${grand || ""}</td></tr>
      </table>`;

    // Xulosa + imzolar
    h += `<p style="margin-top:18px;font-family:Cambria,serif;font-size:10pt">Kafedra yig'ilishining xulosasi: ${ESC(doc.xulosaKafedra)}</p>`;
    h += `<p style="font-family:Cambria,serif;font-size:10pt">Fakultet ilmiy kengashi qarori: ${ESC(doc.xulosaKengash)}</p>`;
    h += `<table style="width:100%;margin-top:30px;font-family:Cambria,serif;font-size:10pt"><tr>
      <td style="${TC}">O'qituvchi _________<br><span style="font-size:8pt">(imzo)</span></td>
      <td style="${TC}">Kafedra mudiri _________<br><span style="font-size:8pt">(imzo)</span></td>
      <td style="${TC}">Fakultet dekani _________<br><span style="font-size:8pt">(imzo)</span></td></tr></table>`;

    return h;
  }

  function exportWord() {
    setExporting(true);
    try {
      const fio = reja?.oqituvchi?.fio || "oqituvchi";
      const head =
        "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' " +
        "xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>" +
        "<style>@page{size:A4 portrait;margin:1.2cm}body{font-family:Cambria,'Times New Roman',serif;font-size:10pt}</style>" +
        "</head><body>";
      const html = head + buildWordHtml() + "</body></html>";
      const blob = new Blob(["﻿", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Shaxsiy_ish_rejasi_${fio.replace(/\s+/g, "_")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tr("Word fayl yuklab olindi", "Файл Word загружен", "Word file downloaded"));
    } catch (e) {
      console.error(e);
      toast.error(tr("Word eksportda xato", "Ошибка экспорта Word", "Word export failed"));
    }
    setExporting(false);
  }

  function exportPdf() {
    // Brauzer print oynasi orqali "PDF saqlash"
    window.print();
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }
  if (!reja) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-medium">{tr("Reja topilmadi", "План не найден", "Plan not found")}</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>{tr("Orqaga", "Назад", "Back")}</Button>
      </div>
    );
  }

  const o = reja.oqituvchi;
  const localizedPositions: Record<string, string> = language === "ru" ? {
    professor: "профессор", associate_professor: "доцент", senior_teacher: "старший преподаватель",
    teacher: "преподаватель-стажёр", assistant: "ассистент",
  } : language === "en" ? {
    professor: "professor", associate_professor: "associate professor", senior_teacher: "senior teacher",
    teacher: "trainee teacher", assistant: "assistant",
  } : LAVOZIM_GEN;
  const lavozimGen = o ? (localizedPositions[o.lavozim] || o.lavozim) : "";
  const yil = reja.oquvYiliNomi;
  const localizedFio = localizePersonName(o?.fio, language) || "—";
  const localizedOtm = localizeEntityName(o?.otmNomi, language);
  const localizedFaculty = localizeEntityName(o?.fakultetNomi, language) || "—";
  const localizedDepartment = localizeEntityName(o?.kafedraNomi, language) || "—";
  const oquvLabel = (key: keyof OquvRow, fallback: string) => ({
    maruza: tr("Ma’ruza", "Лекции", "Lectures"),
    amaliy: tr("Amaliy mashg‘ulot", "Практические занятия", "Practical classes"),
    lab: tr("Laboratoriya ishi", "Лабораторные работы", "Laboratory work"),
    nazorat: tr("Nazorat", "Контроль", "Assessment"),
    kursIshi: tr("Kurs ishi", "Курсовая работа", "Coursework"),
    mdBitiruv: tr("MD va Bitiruv ishi", "МД и выпускная работа", "Master’s and graduation work"),
    kursHimoya: tr("Kurs ishi himoyasi", "Защита курсовой работы", "Coursework defence"),
    amaliyot: tr("Amaliyot", "Практика", "Internship"),
    qaytaTopshirish: tr("Qayta topshirish", "Пересдача", "Retake"),
    jami: tr("Jami", "Итого", "Total"),
  } as Partial<Record<keyof OquvRow, string>>)[key] || fallback;

  return (
    <div className="space-y-4">
      {/* ===== Toolbar (chop etishda yashirinadi) ===== */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden" data-noexport>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{o?.fio ? localizedFio : tr("O‘qituvchi", "Преподаватель", "Teacher")}</h1>
            <p className="text-sm text-muted-foreground">{tr("Shaxsiy ish rejasi", "Индивидуальный план работы", "Individual work plan")} - {yil}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportWord} disabled={exporting}>
            <FileText className="h-4 w-4" /> Word
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPdf} disabled={exporting}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tr("Saqlash", "Сохранить", "Save")}
          </Button>
        </div>
      </div>

      {/* ===== HUJJAT ===== */}
      <div id="reja-doc" className="mx-auto max-w-[900px] bg-white text-black border rounded-lg p-8 sm:p-12 space-y-3 leading-relaxed">
        {/* ---------- TITUL (14pt) ---------- */}
        <div className="titul space-y-3">
        <div className="text-center font-bold uppercase space-y-0.5">
          <p>{tr("O‘ZBEKISTON RESPUBLIKASI", "РЕСПУБЛИКА УЗБЕКИСТАН", "REPUBLIC OF UZBEKISTAN")}</p>
          <p>{tr("OLIY TA’LIM, FAN VA INNOVATSIYALAR VAZIRLIGI", "МИНИСТЕРСТВО ВЫСШЕГО ОБРАЗОВАНИЯ, НАУКИ И ИННОВАЦИЙ", "MINISTRY OF HIGHER EDUCATION, SCIENCE AND INNOVATION")}</p>
          <p>{localizedOtm || tr("OLIY TA’LIM MUASSASASI", "ВЫСШЕЕ УЧЕБНОЕ ЗАВЕДЕНИЕ", "HIGHER EDUCATION INSTITUTION")}</p>
        </div>

        {/* TASDIQLAYMAN bloki (chegarasiz, o'ng tomonda) */}
        <div className="flex justify-end my-3">
          <div className="w-[55%] text-center space-y-1">
            <p className="font-bold">{tr("TASDIQLAYMAN", "УТВЕРЖДАЮ", "APPROVED BY")}</p>
            <p>&laquo;{localizedFaculty}&raquo; {tr("fakulteti", "факультет", "faculty")}</p>
            <p className="pt-4 flex items-end justify-center gap-1 flex-wrap">
              {tr("dekani", "декан", "dean")}
              <span className="inline-block border-b border-black min-w-[70px]" />
              <input
                value={doc.dekan}
                onChange={(e) => setDoc({ ...doc, dekan: e.target.value })}
                placeholder="F.I.O"
                className="border-b border-black outline-none text-center w-[120px] bg-transparent print:border-0"
              />
            </p>
            <p className="text-gray-500" style={{ fontSize: "9pt" }}>({tr("imzo", "подпись", "signature")})</p>
          </div>
        </div>

        {/* O'qituvchi ma'lumotlari */}
        <div className="text-center space-y-0.5 pt-3">
          <p><span className="font-bold">{localizedFaculty}</span> {tr("fakulteti", "факультет", "faculty")}</p>
          <p><span className="font-bold">{localizedDepartment}</span> {tr("kafedrasi", "кафедра", "department")}</p>
          <p>{lavozimGen} <span className="font-bold underline">{localizedFio}</span></p>
          <p>{yil} {tr("o‘quv yiliga", "учебный год", "academic year")}</p>
        </div>

        <div className="text-center pt-3">
          <h1 className="text-2xl font-bold tracking-wide">{tr("SHAXSIY ISH REJASI", "ИНДИВИДУАЛЬНЫЙ ПЛАН РАБОТЫ", "INDIVIDUAL WORK PLAN")}</h1>
          <p>({stavka.replace("rate_", "").replace("_", ".")} {tr("stavka", "ставка", "rate")})</p>
        </div>

        {/* Yuklama soatlari - barcha soatlar o'ng tomonda bir ustunda tik */}
        <div className="pt-2">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="px-2 py-1 text-right">{tr(`O‘qituvchining ${yil} o‘quv yilidagi o‘quv yuklamasi`, `Учебная нагрузка преподавателя на ${yil} учебный год`, `Teacher workload for the ${yil} academic year`)}</td>
                <td className="px-2 py-1 font-bold underline text-center w-[70px]">{fanJamiSoat}</td>
                <td className="px-2 py-1 w-[55px]">{tr("soat", "часов", "hours")}:</td>
              </tr>
              <tr>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1 text-right">{tr("kuzgi semestrda", "в осеннем семестре", "in the fall semester")}</td>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1 font-bold text-center">{fanKuzgiSoat}</td>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1">{tr("soat", "часов", "hours")}:</td>
              </tr>
              <tr>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1 text-right">{tr("bahorgi semestrda", "в весеннем семестре", "in the spring semester")}</td>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1 font-bold text-center">{fanBahorgiSoat}</td>
                <td className="border border-dashed border-gray-500 print:border-0 px-2 py-1">{tr("soat", "часов", "hours")}:</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-center pt-2 space-y-1">
          <p>{tr("Reja kafedra majlisida muhokama qilindi va tasdiqlandi", "План обсуждён и утверждён на заседании кафедры", "The plan was discussed and approved at the department meeting")}</p>
          <p className="flex items-center justify-center gap-1 flex-wrap">
            (
            <input value={doc.bayonnomaYil} onChange={(e) => setDoc({ ...doc, bayonnomaYil: e.target.value })}
              className="border-b border-black outline-none text-center w-[50px] bg-transparent print:border-0" />
            {tr("yil", "год", "year")}
            <input value={doc.bayonnomaSana} onChange={(e) => setDoc({ ...doc, bayonnomaSana: e.target.value })}
              placeholder="___" className="border-b border-black outline-none text-center w-[80px] bg-transparent print:border-0" />
            ,
            <input value={doc.bayonnomaRaqam} onChange={(e) => setDoc({ ...doc, bayonnomaRaqam: e.target.value })}
              placeholder="__" className="border-b border-black outline-none text-center w-[50px] bg-transparent print:border-0" />
            {tr("-sonli bayonnoma)", "— протокол)", "— minutes)")}
          </p>
        </div>

        <div className="flex justify-end pt-8">
          <div className="text-center">
            <p>{tr("Kafedra mudiri", "Заведующий кафедрой", "Head of department")} <span className="inline-block border-b border-black min-w-[100px]" /></p>
            <p className="text-gray-500" style={{ fontSize: "9pt" }}>({tr("imzo", "подпись", "signature")})</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="text-center">
            <p>{tr("O‘qituvchi", "Преподаватель", "Teacher")} <span className="inline-block border-b border-black min-w-[100px]" /></p>
            <p className="text-gray-500" style={{ fontSize: "9pt" }}>({tr("imzo", "подпись", "signature")})</p>
          </div>
        </div>

        <p className="text-center font-bold pt-6">TOSHKENT {String(yil).split("-")[0] || "2025"}</p>
        </div>
        {/* ---------- TITUL tugadi ---------- */}

        {/* ---------- O'QUV ISHLARI (yangi sahifadan — titul alohida listda) ---------- */}
        <div className="pt-6 break-before-page">
          <h2 className="text-center font-bold mb-2">{tr("O‘QUV ISHLARI", "УЧЕБНАЯ РАБОТА", "TEACHING WORK")}</h2>
          <div className="overflow-visible">
            <table className="w-full table-fixed border border-black border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-black p-1 w-[28px]">№</th>
                  <th rowSpan={2} className="w-[42%] border border-black p-1">
                    {tr("O‘quv ishlari nomi, fakultet, guruh (talabalar soni)", "Наименование учебной работы, факультет, группа (число студентов)", "Teaching activity, faculty, group (number of students)")}
                  </th>
                  <th colSpan={OQUV_COLS.length} className="border border-black p-1">
                    {tr("O‘quv ishlari turi (soat)", "Вид учебной работы (часы)", "Type of teaching work (hours)")}
                  </th>
                  {!teacherMode && <th rowSpan={2} className="border border-black p-1 w-[24px]" data-noexport></th>}
                </tr>
                <tr>
                  {OQUV_COLS.map((c) => (
                    <th key={c.key} className="border border-black p-1 align-bottom" style={{ minWidth: 26 }}>
                      <span className="inline-block [writing-mode:vertical-rl] rotate-180 whitespace-nowrap py-1">
                        {oquvLabel(c.key, c.label)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Kuzgi semestr */}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={OQUV_COLS.length + (teacherMode ? 2 : 3)} className="border border-black p-1 text-center">{tr("Kuzgi semestr", "Осенний семестр", "Fall semester")}</td>
                </tr>
                {kuzgiRows.map((r, i) => (
                  <OquvDataRow key={r.id} idx={i + 1} row={r} onChange={updateOquvRow} onRemove={removeOquvRow} readOnly={teacherMode} />
                ))}
                {!teacherMode && (
                  <tr data-noexport>
                    <td colSpan={OQUV_COLS.length + 3} className="border border-black p-0.5">
                      <button onClick={() => addOquvRow("kuzgi")} className="flex items-center gap-1 text-primary px-1 py-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Kuzgi semestrga fan qo&apos;shish
                      </button>
                    </td>
                  </tr>
                )}
                <OquvSumRows label={tr("Jami", "Итого", "Total")} actualLabel={tr("Amalda", "Факт", "Actual")} rows={kuzgiRows} readOnly={teacherMode} />

                {/* Bahorgi semestr */}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={OQUV_COLS.length + (teacherMode ? 2 : 3)} className="border border-black p-1 text-center">{tr("Bahorgi semestr", "Весенний семестр", "Spring semester")}</td>
                </tr>
                {bahorgiRows.map((r, i) => (
                  <OquvDataRow key={r.id} idx={i + 1} row={r} onChange={updateOquvRow} onRemove={removeOquvRow} readOnly={teacherMode} />
                ))}
                {!teacherMode && (
                  <tr data-noexport>
                    <td colSpan={OQUV_COLS.length + 3} className="border border-black p-0.5">
                      <button onClick={() => addOquvRow("bahorgi")} className="flex items-center gap-1 text-primary px-1 py-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Bahorgi semestrga fan qo&apos;shish
                      </button>
                    </td>
                  </tr>
                )}
                <OquvSumRows label={tr("Jami", "Итого", "Total")} actualLabel={tr("Amalda", "Факт", "Actual")} rows={bahorgiRows} readOnly={teacherMode} />

                {/* O'quv yilida hammasi */}
                <tr className="font-bold">
                  <td colSpan={2} className="border border-black p-1 text-center">{tr("O‘quv yilida hammasi (Reja)", "Всего за учебный год (План)", "Academic year total (Plan)")}</td>
                  {SUM_COLS.map((k) => (
                    <td key={k} className="border border-black p-1 text-center">
                      {colSum(kuzgiRows, k) + colSum(bahorgiRows, k) || ""}
                    </td>
                  ))}
                  {!teacherMode && <td className="border border-black p-1" data-noexport></td>}
                </tr>
                <tr className="font-bold">
                  <td colSpan={2} className="border border-black p-1 text-center">{tr("O‘quv yilida hammasi (Amalda)", "Всего за учебный год (Факт)", "Academic year total (Actual)")}</td>
                  {SUM_COLS.map((k) => (<td key={k} className="border border-black p-1"></td>))}
                  {!teacherMode && <td className="border border-black p-1" data-noexport></td>}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- 1. O'QUV - USLUBIY ISHLARI ---------- */}
        <SectionUslubiy rows={doc.uslubiy} setRows={(rows) => setDoc({ ...doc, uslubiy: rows })} language={language} />

        {/* ---------- 2. ILMIY - TADQIQOT ISHLARI ---------- */}
        <SectionIlmiy rows={doc.ilmiy} setRows={(rows) => setDoc({ ...doc, ilmiy: rows })} language={language} />

        {/* ---------- 3. USTOZ - SHOGIRD ISHLARI ---------- */}
        <SectionUstoz rows={doc.ustozShogird} setRows={(rows) => setDoc({ ...doc, ustozShogird: rows })} language={language} />

        {/* ---------- REYTING JAMLAMASI ---------- */}
        <ReytingTable
          reyting={doc.reyting}
          setReyting={(r) => setDoc({ ...doc, reyting: r })}
          jamiSoat={fanJamiSoat}
          language={language}
        />

        {/* Xulosalar + imzolar */}
        <div className="pt-6 space-y-3">
          <div>
            <p>{tr("Kafedra yig‘ilishining xulosasi:", "Заключение заседания кафедры:", "Department meeting conclusion:")}</p>
            <textarea
              value={doc.xulosaKafedra}
              onChange={(e) => setDoc({ ...doc, xulosaKafedra: e.target.value })}
              rows={2}
              className="w-full border-b border-black outline-none bg-transparent resize-none print:border-0"
            />
          </div>
          <div>
            <p>{tr("Fakultet ilmiy kengashi qarori:", "Решение учёного совета факультета:", "Faculty academic council decision:")}</p>
            <textarea
              value={doc.xulosaKengash}
              onChange={(e) => setDoc({ ...doc, xulosaKengash: e.target.value })}
              rows={2}
              className="w-full border-b border-black outline-none bg-transparent resize-none print:border-0"
            />
          </div>
          <div className="flex justify-between pt-8 text-center">
            <div>{tr("O‘qituvchi", "Преподаватель", "Teacher")} <span className="inline-block border-b border-black min-w-[90px]" /><p className="text-xs">({tr("imzo", "подпись", "signature")})</p></div>
            <div>{tr("Kafedra mudiri", "Заведующий кафедрой", "Head of department")} <span className="inline-block border-b border-black min-w-[90px]" /><p className="text-xs">({tr("imzo", "подпись", "signature")})</p></div>
            <div>{tr("Fakultet dekani", "Декан факультета", "Faculty dean")} <span className="inline-block border-b border-black min-w-[90px]" /><p className="text-xs">({tr("imzo", "подпись", "signature")})</p></div>
          </div>
        </div>
      </div>

      {/* Shrift: Cambria 10pt + chop etish CSS */}
      <style jsx global>{`
        #reja-doc,
        #reja-doc p,
        #reja-doc span,
        #reja-doc table,
        #reja-doc th,
        #reja-doc td,
        #reja-doc input,
        #reja-doc textarea,
        #reja-doc button {
          font-family: "Cambria", "Times New Roman", Georgia, serif !important;
        }
        #reja-doc {
          font-size: 10pt;
        }
        #reja-doc p,
        #reja-doc table,
        #reja-doc th,
        #reja-doc td,
        #reja-doc input,
        #reja-doc textarea {
          font-size: 10pt;
        }
        /* Titul (1-list) shriftlari 14pt */
        #reja-doc .titul,
        #reja-doc .titul p,
        #reja-doc .titul td,
        #reja-doc .titul span,
        #reja-doc .titul input {
          font-size: 14pt;
        }
        #reja-doc .titul {
          line-height: 1.5;
        }
        @media print {
          @page { size: A4 portrait; margin: 1.2cm; }
          html, body { background: white !important; }
          /* Faqat hujjat chop etilsin — ilova paneli/yon menyu yashirinadi */
          body * { visibility: hidden !important; }
          #reja-doc, #reja-doc * { visibility: visible !important; }
          #reja-doc {
            position: absolute !important;
            left: 0; top: 0;
            width: 100% !important;
            max-width: 100% !important;
            border: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            font-size: 9pt;
          }
          #reja-doc table { font-size: 9pt; }
          #reja-doc tr, #reja-doc table { page-break-inside: auto; }
          [data-noexport] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ==================== O'QUV ISHLARI DATA ROW ====================
function OquvDataRow({
  idx, row, onChange, onRemove, readOnly = false,
}: {
  idx: number; row: OquvRow;
  onChange: (id: string, key: keyof OquvRow, value: string) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <tr>
      <td className="border border-black p-1 text-center align-middle">{idx}</td>
      <td className="border border-black p-0.5 align-middle">
        <textarea
          value={row.nomi}
          readOnly={readOnly}
          onChange={(e) => onChange(row.id, "nomi", e.target.value)}
          rows={1}
          className="min-h-5 max-h-10 w-full [field-sizing:content] overflow-hidden bg-transparent leading-5 outline-none resize-none"
          placeholder="Fan nomi, fakultet, guruh, (talabalar soni)"
        />
      </td>
      {OQUV_COLS.map((c) => (
        <td key={c.key} className="border border-black p-0 align-middle">
          <input
            value={row[c.key] as string}
            readOnly={readOnly}
            onChange={(e) => onChange(row.id, c.key, e.target.value)}
            className="w-full text-center outline-none bg-transparent py-1"
          />
        </td>
      ))}
      {!readOnly && (
        <td className="border border-black p-0 text-center" data-noexport>
          <button onClick={() => onRemove(row.id)} className="text-red-500 hover:text-red-700 p-1">
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      )}
    </tr>
  );
}

// O'quv ishlari "Jami | Reja/Amalda" qatorlari
function OquvSumRows({ label, actualLabel = "Amalda", rows, readOnly = false }: { label: string; actualLabel?: string; rows: OquvRow[]; readOnly?: boolean }) {
  const sum = (key: keyof OquvRow) => rows.reduce((a, r) => a + (Number(r[key] as string) || 0), 0);
  return (
    <>
      <tr className="font-bold bg-gray-50">
        <td colSpan={2} className="border border-black p-1 text-center">{label} (Reja)</td>
        {SUM_COLS.map((k) => (
          <td key={k} className="border border-black p-1 text-center">{sum(k) || ""}</td>
        ))}
        {!readOnly && <td className="border border-black p-1" data-noexport></td>}
      </tr>
      <tr className="font-bold bg-gray-50">
        <td colSpan={2} className="border border-black p-1 text-center">{label} ({actualLabel})</td>
        {SUM_COLS.map((k) => (<td key={k} className="border border-black p-1"></td>))}
        {!readOnly && <td className="border border-black p-1" data-noexport></td>}
      </tr>
    </>
  );
}
