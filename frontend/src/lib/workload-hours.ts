type WorkloadRow = {
  id?: string | number;
  jami?: string | number;
};

type WorkloadContainer = {
  fanlar?: Array<{ soat?: string | number }>;
  doc?: { oquvIshlari?: WorkloadRow[] };
};

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function containerTeachingHours(container: WorkloadContainer): number {
  const documentRows = container.doc?.oquvIshlari;
  if (Array.isArray(documentRows) && documentRows.length > 0) {
    return documentRows.reduce((total, row) => {
      if (String(row.id ?? "").startsWith("dlmd-")) return total;
      return total + numeric(row.jami);
    }, 0);
  }

  return (Array.isArray(container.fanlar) ? container.fanlar : [])
    .reduce((total, fan) => total + numeric(fan.soat), 0);
}

/** Rejadagi fan soatlari. DL/MD bu qiymatga keyin alohida qo'shiladi. */
export function getPlanTeachingHours(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const plan = data as WorkloadContainer & { variants?: Record<string, WorkloadContainer> };
  if (plan.variants && typeof plan.variants === "object") {
    return Object.values(plan.variants).reduce(
      (total, variant) => total + containerTeachingHours(variant),
      0,
    );
  }
  return containerTeachingHours(plan);
}
