"use client";

// Shaxsiy ish rejasi jadval bo'limlari — ham Shakllantirish oynasida,
// ham hujjat (shablon) sahifasida ishlatiladi.

import { Plus, Trash2 } from "lucide-react";
import { localized, type TeacherLanguage } from "@/lib/teacher-i18n";

// ==================== TYPES ====================
export interface UslubiyRow {
  id: string; nomi: string; muddatReja: string; muddatAmalda: string;
  rejaBet: string; rejaSoat: string; amaldaBet: string; amaldaSoat: string;
  tashqariBet: string; tashqariSoat: string; reyting: string;
}
export interface IlmiyRow {
  id: string; nomi: string; muddatReja: string; muddatAmalda: string;
  respub: string; scopus: string; rejaSoat: string; amaldaSoat: string;
  tashqari: string; reyting: string;
}
export interface UstozRow {
  id: string; nomi: string; muddatReja: string; muddatAmalda: string;
  joy: string; rejaSoat: string; amaldaSoat: string; tashqari: string; reyting: string;
}
// Reyting jadvali — "{row}_{col}" kalitli qiymatlar
export type ReytingData = Record<string, string>;

export const uid = () => Math.random().toString(36).slice(2, 9);

export const REYTING_ROWS = [
  { key: "reja", label: "Reja" },
  { key: "amalda", label: "Amalda" },
  { key: "qoshimcha", label: "Qo'shimcha" },
  { key: "jarima", label: "Jarima" },
];
export const REYTING_COLS = [
  { key: "oquv", label: "O'quv ishlari" },
  { key: "uslubiy", label: "O'quv - uslubiy ishlar" },
  { key: "ilmiy", label: "Ilmiy - tadqiqot ishlari" },
  { key: "ustoz", label: "Ustoz - shogird ishlari" },
];

// ==================== Umumiy yacheykalar ====================
export function Cell({ v, onC, wide, readOnly = false }: { v: string; onC: (v: string) => void; wide?: boolean; readOnly?: boolean }) {
  return (
    <td className={`border border-black p-0 ${wide ? "min-w-[140px]" : ""}`}>
      <input
        value={v}
        readOnly={readOnly}
        onChange={(e) => onC(e.target.value)}
        className={`w-full outline-none bg-transparent text-[10px] py-1 ${wide ? "px-1" : "text-center"} ${readOnly ? "cursor-default" : ""}`}
      />
    </td>
  );
}
export function RemCell({ onR }: { onR: () => void }) {
  return (
    <td className="border border-black p-0 text-center" data-noexport>
      <button onClick={onR} className="text-red-500 hover:text-red-700 p-1">
        <Trash2 className="h-3 w-3" />
      </button>
    </td>
  );
}
export function SumRow({ colSpan, label, readOnly = false }: { colSpan: number; label: string; readOnly?: boolean }) {
  return (
    <tr className="font-bold bg-gray-50">
      <td colSpan={colSpan} className="border border-black p-1 text-center">{label}</td>
      {!readOnly && <td className="border border-black p-1" data-noexport></td>}
    </tr>
  );
}
export function AddRow({ colSpan, onClick, label }: { colSpan: number; onClick: () => void; label: string }) {
  return (
    <tr data-noexport>
      <td colSpan={colSpan} className="border border-black p-0.5">
        <button onClick={onClick} className="flex items-center gap-1 text-primary text-[10px] px-1 py-0.5 hover:underline">
          <Plus className="h-3 w-3" /> {label}
        </button>
      </td>
    </tr>
  );
}

// ==================== 1. O'QUV - USLUBIY ISHLARI ====================
export function SectionUslubiy({ rows, setRows, readOnly = false, language = "uz" }: { rows: UslubiyRow[]; setRows: (r: UslubiyRow[]) => void; readOnly?: boolean; language?: TeacherLanguage }) {
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const upd = (id: string, key: keyof UslubiyRow, v: string) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const add = () => setRows([...rows, {
    id: uid(), nomi: "", muddatReja: "", muddatAmalda: "", rejaBet: "", rejaSoat: "",
    amaldaBet: "", amaldaSoat: "", tashqariBet: "", tashqariSoat: "", reyting: "",
  }]);
  const rem = (id: string) => setRows(rows.filter((r) => r.id !== id));
  return (
    <div className="pt-6">
      <h3 className="text-center font-bold mb-2 text-[12px]">1. {tr("O‘QUV-USLUBIY ISHLAR", "УЧЕБНО-МЕТОДИЧЕСКАЯ РАБОТА", "TEACHING AND METHODOLOGICAL WORK")}</h3>
      <table className="w-full border border-black border-collapse text-[10px]">
        <thead className="bg-gray-100">
          <tr>
            <th rowSpan={2} className="border border-black p-1 w-[28px]">№</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Bajariladigan ishlar", "Выполняемые работы", "Planned activities")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Muddat", "Срок", "Period")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Ish hajmi (Reja)", "Объём работы (План)", "Work volume (Plan)")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Ish hajmi (Amalda)", "Объём работы (Факт)", "Work volume (Actual)")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Rejadan tashqari", "Сверх плана", "Outside the plan")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("To‘plangan reyting ball", "Набранные рейтинговые баллы", "Rating points earned")}</th>
            {!readOnly && <th rowSpan={2} className="border border-black p-1 w-[24px]" data-noexport></th>}
          </tr>
          <tr>
            <th className="border border-black p-1">{tr("reja", "план", "plan")}</th>
            <th className="border border-black p-1">{tr("amalda", "факт", "actual")}</th>
            <th className="border border-black p-1">{tr("bet", "стр.", "pages")}</th>
            <th className="border border-black p-1">{tr("soat", "часы", "hours")}</th>
            <th className="border border-black p-1">{tr("bet", "стр.", "pages")}</th>
            <th className="border border-black p-1">{tr("soat", "часы", "hours")}</th>
            <th className="border border-black p-1">{tr("bet", "стр.", "pages")}</th>
            <th className="border border-black p-1">{tr("soat", "часы", "hours")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="border border-black p-1 text-center">{i + 1}</td>
              <Cell v={r.nomi} onC={(v) => upd(r.id, "nomi", v)} wide readOnly={readOnly} />
              <Cell v={r.muddatReja} onC={(v) => upd(r.id, "muddatReja", v)} readOnly={readOnly} />
              <Cell v={r.muddatAmalda} onC={(v) => upd(r.id, "muddatAmalda", v)} readOnly={readOnly} />
              <Cell v={r.rejaBet} onC={(v) => upd(r.id, "rejaBet", v)} readOnly={readOnly} />
              <Cell v={r.rejaSoat} onC={(v) => upd(r.id, "rejaSoat", v)} readOnly={readOnly} />
              <Cell v={r.amaldaBet} onC={(v) => upd(r.id, "amaldaBet", v)} readOnly={readOnly} />
              <Cell v={r.amaldaSoat} onC={(v) => upd(r.id, "amaldaSoat", v)} readOnly={readOnly} />
              <Cell v={r.tashqariBet} onC={(v) => upd(r.id, "tashqariBet", v)} readOnly={readOnly} />
              <Cell v={r.tashqariSoat} onC={(v) => upd(r.id, "tashqariSoat", v)} readOnly={readOnly} />
              <Cell v={r.reyting} onC={(v) => upd(r.id, "reyting", v)} readOnly={readOnly} />
              {!readOnly && <RemCell onR={() => rem(r.id)} />}
            </tr>
          ))}
          <SumRow colSpan={11} label={tr("Jami", "Итого", "Total")} readOnly={readOnly} />
          {!readOnly && <AddRow colSpan={12} onClick={add} label={tr("Ish qo‘shish", "Добавить работу", "Add activity")} />}
        </tbody>
      </table>
    </div>
  );
}

// ==================== 2. ILMIY - TADQIQOT ISHLARI ====================
export function SectionIlmiy({ rows, setRows, readOnly = false, language = "uz" }: { rows: IlmiyRow[]; setRows: (r: IlmiyRow[]) => void; readOnly?: boolean; language?: TeacherLanguage }) {
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const upd = (id: string, key: keyof IlmiyRow, v: string) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const add = () => setRows([...rows, {
    id: uid(), nomi: "", muddatReja: "", muddatAmalda: "", respub: "", scopus: "",
    rejaSoat: "", amaldaSoat: "", tashqari: "", reyting: "",
  }]);
  const rem = (id: string) => setRows(rows.filter((r) => r.id !== id));
  return (
    <div className="pt-6">
      <h3 className="text-center font-bold mb-2 text-[12px]">2. {tr("ILMIY-TADQIQOT ISHLARI", "НАУЧНО-ИССЛЕДОВАТЕЛЬСКАЯ РАБОТА", "RESEARCH WORK")}</h3>
      <table className="w-full border border-black border-collapse text-[10px]">
        <thead className="bg-gray-100">
          <tr>
            <th rowSpan={2} className="border border-black p-1 w-[28px]">№</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Bajariladigan ishlar", "Выполняемые работы", "Planned activities")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Muddat", "Срок", "Period")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Ishning ijro belgisi", "Показатель выполнения", "Completion indicator")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Ish hajmi, soatda", "Объём работы, часы", "Work volume, hours")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Rejadan tashqari", "Сверх плана", "Outside the plan")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("To‘plangan reyting ball", "Набранные рейтинговые баллы", "Rating points earned")}</th>
            {!readOnly && <th rowSpan={2} className="border border-black p-1 w-[24px]" data-noexport></th>}
          </tr>
          <tr>
            <th className="border border-black p-1">{tr("Reja", "План", "Plan")}</th>
            <th className="border border-black p-1">{tr("amalda", "факт", "actual")}</th>
            <th className="border border-black p-1">Respub.</th>
            <th className="border border-black p-1">Scopus/WoS</th>
            <th className="border border-black p-1">{tr("reja", "план", "plan")}</th>
            <th className="border border-black p-1">{tr("amalda", "факт", "actual")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="border border-black p-1 text-center">{i + 1}</td>
              <Cell v={r.nomi} onC={(v) => upd(r.id, "nomi", v)} wide readOnly={readOnly} />
              <Cell v={r.muddatReja} onC={(v) => upd(r.id, "muddatReja", v)} readOnly={readOnly} />
              <Cell v={r.muddatAmalda} onC={(v) => upd(r.id, "muddatAmalda", v)} readOnly={readOnly} />
              <Cell v={r.respub} onC={(v) => upd(r.id, "respub", v)} readOnly={readOnly} />
              <Cell v={r.scopus} onC={(v) => upd(r.id, "scopus", v)} readOnly={readOnly} />
              <Cell v={r.rejaSoat} onC={(v) => upd(r.id, "rejaSoat", v)} readOnly={readOnly} />
              <Cell v={r.amaldaSoat} onC={(v) => upd(r.id, "amaldaSoat", v)} readOnly={readOnly} />
              <Cell v={r.tashqari} onC={(v) => upd(r.id, "tashqari", v)} readOnly={readOnly} />
              <Cell v={r.reyting} onC={(v) => upd(r.id, "reyting", v)} readOnly={readOnly} />
              {!readOnly && <RemCell onR={() => rem(r.id)} />}
            </tr>
          ))}
          <SumRow colSpan={10} label={tr("Jami", "Итого", "Total")} readOnly={readOnly} />
          {!readOnly && <AddRow colSpan={11} onClick={add} label={tr("Ish qo‘shish", "Добавить работу", "Add activity")} />}
        </tbody>
      </table>
    </div>
  );
}

// ==================== 3. USTOZ - SHOGIRD ISHLARI ====================
export function SectionUstoz({ rows, setRows, readOnly = false, language = "uz" }: { rows: UstozRow[]; setRows: (r: UstozRow[]) => void; readOnly?: boolean; language?: TeacherLanguage }) {
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const upd = (id: string, key: keyof UstozRow, v: string) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const add = () => setRows([...rows, {
    id: uid(), nomi: "", muddatReja: "", muddatAmalda: "", joy: "",
    rejaSoat: "", amaldaSoat: "", tashqari: "", reyting: "",
  }]);
  const rem = (id: string) => setRows(rows.filter((r) => r.id !== id));
  return (
    <div className="pt-6">
      <h3 className="text-center font-bold mb-2 text-[12px]">3. {tr("USTOZ-SHOGIRD ISHLARI", "НАСТАВНИЧЕСКАЯ РАБОТА", "MENTORING WORK")}</h3>
      <table className="w-full border border-black border-collapse text-[10px]">
        <thead className="bg-gray-100">
          <tr>
            <th rowSpan={2} className="border border-black p-1 w-[28px]">№</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Bajariladigan ishlar", "Выполняемые работы", "Planned activities")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Muddat", "Срок", "Period")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("O‘tkazish joyi", "Место проведения", "Venue")}</th>
            <th colSpan={2} className="border border-black p-1">{tr("Ish hajmi, soatda", "Объём работы, часы", "Work volume, hours")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Rejadan tashqari", "Сверх плана", "Outside the plan")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("To‘plangan reyting ball", "Набранные рейтинговые баллы", "Rating points earned")}</th>
            {!readOnly && <th rowSpan={2} className="border border-black p-1 w-[24px]" data-noexport></th>}
          </tr>
          <tr>
            <th className="border border-black p-1">{tr("Reja", "План", "Plan")}</th>
            <th className="border border-black p-1">{tr("Amalda", "Факт", "Actual")}</th>
            <th className="border border-black p-1">{tr("Reja", "План", "Plan")}</th>
            <th className="border border-black p-1">{tr("Amalda", "Факт", "Actual")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="border border-black p-1 text-center">{i + 1}</td>
              <Cell v={r.nomi} onC={(v) => upd(r.id, "nomi", v)} wide readOnly={readOnly} />
              <Cell v={r.muddatReja} onC={(v) => upd(r.id, "muddatReja", v)} readOnly={readOnly} />
              <Cell v={r.muddatAmalda} onC={(v) => upd(r.id, "muddatAmalda", v)} readOnly={readOnly} />
              <Cell v={r.joy} onC={(v) => upd(r.id, "joy", v)} readOnly={readOnly} />
              <Cell v={r.rejaSoat} onC={(v) => upd(r.id, "rejaSoat", v)} readOnly={readOnly} />
              <Cell v={r.amaldaSoat} onC={(v) => upd(r.id, "amaldaSoat", v)} readOnly={readOnly} />
              <Cell v={r.tashqari} onC={(v) => upd(r.id, "tashqari", v)} readOnly={readOnly} />
              <Cell v={r.reyting} onC={(v) => upd(r.id, "reyting", v)} readOnly={readOnly} />
              {!readOnly && <RemCell onR={() => rem(r.id)} />}
            </tr>
          ))}
          <SumRow colSpan={9} label={tr("Jami", "Итого", "Total")} readOnly={readOnly} />
          {!readOnly && <AddRow colSpan={10} onClick={add} label={tr("Ish qo‘shish", "Добавить работу", "Add activity")} />}
        </tbody>
      </table>
    </div>
  );
}

// ==================== REYTING JAMLAMASI ====================
export function ReytingTable({
  reyting, setReyting, jamiSoat, readOnly = false, language = "uz",
}: {
  reyting: ReytingData;
  setReyting: (r: ReytingData) => void;
  jamiSoat: number;
  readOnly?: boolean;
  language?: TeacherLanguage;
}) {
  const tr = (uz: string, ru: string, en: string) => localized(language, uz, ru, en);
  const ratingRows = [
    { key: "reja", label: tr("Reja", "План", "Plan") },
    { key: "amalda", label: tr("Amalda", "Факт", "Actual") },
    { key: "qoshimcha", label: tr("Qo‘shimcha", "Дополнительно", "Additional") },
    { key: "jarima", label: tr("Jarima", "Штраф", "Penalty") },
  ];
  const ratingCols = [
    { key: "oquv", label: tr("O‘quv ishlari", "Учебная работа", "Teaching work") },
    { key: "uslubiy", label: tr("O‘quv-uslubiy ishlar", "Учебно-методическая работа", "Teaching and methodological work") },
    { key: "ilmiy", label: tr("Ilmiy-tadqiqot ishlari", "Научно-исследовательская работа", "Research work") },
    { key: "ustoz", label: tr("Ustoz-shogird ishlari", "Наставническая работа", "Mentoring work") },
  ];
  // Reja qatorining "O'quv ishlari" katagi avtomatik = jami soat
  const cell = (row: string, col: string): number => {
    if (row === "reja" && col === "oquv") return jamiSoat;
    return Number(reyting[`${row}_${col}`]) || 0;
  };
  const rowJami = (row: string) => ratingCols.reduce((a, c) => a + cell(row, c.key), 0);
  const colJami = (col: string) => ratingRows.reduce((a, r) => a + cell(r.key, col), 0);
  const grand = ratingRows.reduce((a, r) => a + rowJami(r.key), 0);
  const upd = (row: string, col: string, v: string) =>
    setReyting({ ...reyting, [`${row}_${col}`]: v });

  return (
    <div className="pt-6">
      <h3 className="text-center font-bold mb-2 text-[12px]">
        {tr("O‘QITUVCHINING O‘QUV YILI DAVOMIDA TO‘PLAGAN REYTING BALLARI", "РЕЙТИНГОВЫЕ БАЛЛЫ, НАБРАННЫЕ ПРЕПОДАВАТЕЛЕМ ЗА УЧЕБНЫЙ ГОД", "RATING POINTS EARNED BY THE TEACHER DURING THE ACADEMIC YEAR")}
      </h3>
      <table className="w-full border border-black border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="border border-black p-1">{tr("Reyting ballari", "Рейтинговые баллы", "Rating points")}</th>
            <th colSpan={4} className="border border-black p-1">{tr("Faoliyat turi", "Вид деятельности", "Activity type")}</th>
            <th rowSpan={2} className="border border-black p-1">{tr("Jami", "Итого", "Total")}</th>
          </tr>
          <tr className="bg-gray-100">
            {ratingCols.map((c) => (
              <th key={c.key} className="border border-black p-1">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ratingRows.map((r) => (
            <tr key={r.key}>
              <td className="border border-black p-1 font-medium">{r.label}</td>
              {ratingCols.map((c) => (
                <td key={c.key} className="border border-black p-0.5">
                  {r.key === "reja" && c.key === "oquv" ? (
                    <div className="text-center font-bold">{jamiSoat}</div>
                  ) : (
                    <input
                      value={reyting[`${r.key}_${c.key}`] ?? ""}
                      readOnly={readOnly}
                      onChange={(e) => upd(r.key, c.key, e.target.value)}
                      className="w-full text-center outline-none bg-transparent"
                    />
                  )}
                </td>
              ))}
              <td className="border border-black p-1 text-center font-bold">{rowJami(r.key) || ""}</td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-50">
            <td className="border border-black p-1">{tr("Jami", "Итого", "Total")}</td>
            {ratingCols.map((c) => (
              <td key={c.key} className="border border-black p-1 text-center">{colJami(c.key) || ""}</td>
            ))}
            <td className="border border-black p-1 text-center">{grand || ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
