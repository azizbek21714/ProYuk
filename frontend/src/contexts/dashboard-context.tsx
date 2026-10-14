"use client";
import { createContext, useContext, useEffect, useState } from "react";

export interface ProfileData {
  id: string;
  email: string;
  fio: string;
  role: string;
  lavozim?: string;
  kafedraId?: string | null;
}

// O'qituvchi lavozimi (o'qituvchilar bo'limidagi bilan bir xil)
export const LAVOZIM_LABELS: Record<string, string> = {
  professor: "Professor",
  associate_professor: "Dotsent",
  senior_teacher: "Katta o'qituvchi",
  teacher: "Stajyor-o'qituvchi",
  assistant: "Assistent",
};

interface DashboardContextType {
  profile: ProfileData | null;
  academicYears: string[];
  activeAcademicYear: string;
}

function calculatedAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

const DashboardContext = createContext<DashboardContextType>({
  profile: null,
  academicYears: [calculatedAcademicYear()],
  activeAcademicYear: calculatedAcademicYear(),
});

export function DashboardProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: ProfileData | null;
}) {
  const fallback = calculatedAcademicYear();
  const [academicYears, setAcademicYears] = useState<string[]>([fallback]);
  const [activeAcademicYear, setActiveAcademicYear] = useState(fallback);

  useEffect(() => {
    fetch("/api/crud/academic-years")
      .then((response) => response.ok ? response.json() : [])
      .then((records: Array<{ name: string; is_active: boolean }>) => {
        if (!Array.isArray(records) || records.length === 0) return;
        setAcademicYears(records.map((item) => item.name));
        setActiveAcademicYear(records.find((item) => item.is_active)?.name || records[0].name);
      })
      .catch(() => undefined);
  }, []);

  return (
    <DashboardContext.Provider value={{ profile, academicYears, activeAcademicYear }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}

export const ROLE_LABELS: Record<string, string> = {
  oqituvchi: "O'qituvchi",
  kafedra_mudiri: "Kafedra mudiri",
  dekan: "Dekan",
  oquv_bolimi: "O'quv bo'limi",
  admin: "Admin",
};
