"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { TeacherLanguage as AdminLanguage } from "@/lib/teacher-i18n";

export type { AdminLanguage };

const STORAGE_KEY = "admin-language";
const CHANGE_EVENT = "admin-language-change";

const messages = {
  uz: {
    language: "Tilni tanlash", dashboard: "Boshqaruv paneli", university: "OTM",
    teachers: "O‘qituvchilar", subjects: "Fanlar", dlmd: "DL/MD", groups: "Guruhlar", workload: "Yuklama",
    workloadBuilder: "Yuklama shakllantirish", norms: "Normativlar", menu: "Menyu", navigation: "Navigatsiya",
    user: "Foydalanuvchi", admin: "Administrator", education: "O‘quv bo‘limi", dean: "Dekan",
    departmentHead: "Kafedra mudiri", position: "Lavozim", logout: "Chiqish",
    logoutTitle: "Platformadan chiqish", logoutQuestion: "Rostdan ham tizimdan chiqmoqchimisiz?",
    no: "Yo‘q", yes: "Ha", footer: "O‘zbekiston Respublikasi OTV 3076-son buyrug‘iga asosan.",
  },
  ru: {
    language: "Выбрать язык", dashboard: "Панель управления", university: "ВУЗ",
    teachers: "Преподаватели", subjects: "Дисциплины", dlmd: "ДП/МД", groups: "Группы", workload: "Учебная нагрузка",
    workloadBuilder: "Формирование нагрузки", norms: "Нормативы", menu: "Меню", navigation: "Навигация",
    user: "Пользователь", admin: "Администратор", education: "Учебный отдел", dean: "Декан",
    departmentHead: "Заведующий кафедрой", position: "Должность", logout: "Выйти",
    logoutTitle: "Выход из платформы", logoutQuestion: "Вы действительно хотите выйти из системы?",
    no: "Нет", yes: "Да", footer: "На основании приказа МВВО Республики Узбекистан №3076.",
  },
  en: {
    language: "Select language", dashboard: "Dashboard", university: "University",
    teachers: "Teachers", subjects: "Subjects", dlmd: "DP/MD", groups: "Groups", workload: "Workload",
    workloadBuilder: "Workload planning", norms: "Standards", menu: "Menu", navigation: "Navigation",
    user: "User", admin: "Administrator", education: "Academic affairs", dean: "Dean",
    departmentHead: "Head of department", position: "Position", logout: "Sign out",
    logoutTitle: "Sign out of the platform", logoutQuestion: "Are you sure you want to sign out?",
    no: "No", yes: "Yes", footer: "Based on Order No. 3076 of the Ministry of Higher Education of Uzbekistan.",
  },
} as const;

export type AdminMessageKey = keyof typeof messages.uz;

function snapshot(): AdminLanguage {
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "ru" || value === "en" ? value : "uz";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function setAdminLanguage(language: AdminLanguage) {
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAdminI18n() {
  const language = useSyncExternalStore(subscribe, snapshot, () => "uz" as AdminLanguage);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const t = useCallback((key: AdminMessageKey) => messages[language][key], [language]);
  return { language, t };
}
