"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type TeacherLanguage = "uz" | "ru" | "en";

const STORAGE_KEY = "teacher-language";
const CHANGE_EVENT = "teacher-language-change";

const messages = {
  uz: {
    language: "Tilni tanlash", logout: "Chiqish", logoutTitle: "Platformadan chiqish",
    logoutQuestion: "Rostdan ham tizimdan chiqmoqchimisiz?", no: "Yo‘q", yes: "Ha",
    user: "Foydalanuvchi", teacherRole: "O‘qituvchi", position: "Lavozim", footer: "O‘zbekiston Respublikasi OTV 3076-son buyrug‘iga asosan.",
    loadError: "Ma’lumotlarni yuklashda xato", profileMissing: "O‘qituvchi profil topilmadi",
    profileMissingText: "Sizning o‘qituvchi profilingiz hali tuzilmagan. Iltimos, kafedra mudiriga murojaat qiling.",
    planMissing: "Sizning yillik rejangiz hali yaratilmagan",
    planMissingText: "Kafedra mudiri sizning shaxsiy ish rejangizni tuzishi kerak. Shaxsiy ish reja yaratilgach, bu yerda ko‘rinadi.",
    draftInfo: "Sizning yillik rejangiz hali tasdiqlanmagan. Kafedra mudiri yoki dekan tomonidan tasdiqlanishi kerak.",
    approvedInfo: "Reja to‘liq tasdiqlangan. Barcha bosqichlar muvaffaqiyatli yakunlangan.",
    rejectedInfo: "Reja rad etilgan. Tuzatishlar kiritib qayta yuborish mumkin.", reason: "Sabab",
    annualWorkload: "Yillik yuklama", hours: "soat", normReached: "Me’yorga yetdi", hoursNeeded: "Yana {hours} soat kerak",
    semester1: "1-semestr", semester2: "2-semestr", completion: "Ijro foizi", comingSoon: "Tez orada joriy holatda",
    approval: "Tasdiqlash jarayoni", department: "Kafedra", dean: "Dekan", education: "O‘quv bo‘limi", approved: "Tasdiqlandi",
    rejectionReason: "Rad etish sababi", myWorkloads: "Mening yuklamalarim", workloadCount: "{count} ta yuklama",
    fullName: "FIO", chair: "Kafedra", rateExperience: "Stavka / Staj", rate: "stavka", year: "yil",
    assistant: "Assistent", trainee: "Stajyor-o‘qituvchi", senior: "Katta o‘qituvchi", docent: "Dotsent", professor: "Professor",
    none: "Yo‘q", bachelor: "Bakalavr", master: "Magistr", phd: "PhD", doctorScience: "Fan doktori", doctor: "Doktor",
    lowWorkload: "Umumiy yuklama {min} soatdan kam. Tavsiya etilgan minimum: {min} soat",
    lectureExperience: "Ilmiy darajasiz 3 yildan kam stajli o‘qituvchi ma’ruza o‘qiy olmaydi",
    lectureLimit: "Ilmiy darajasiz o‘qituvchi uchun ma’ruza yillik chegarasi 250 soat",
  },
  ru: {
    language: "Выбрать язык", logout: "Выйти", logoutTitle: "Выход из платформы",
    logoutQuestion: "Вы действительно хотите выйти из системы?", no: "Нет", yes: "Да",
    user: "Пользователь", teacherRole: "Преподаватель", position: "Должность", footer: "На основании приказа МВВО Республики Узбекистан №3076.",
    loadError: "Ошибка загрузки данных", profileMissing: "Профиль преподавателя не найден",
    profileMissingText: "Ваш профиль преподавателя ещё не создан. Обратитесь к заведующему кафедрой.",
    planMissing: "Ваш годовой план ещё не создан",
    planMissingText: "Заведующий кафедрой должен составить ваш индивидуальный план. После создания он появится здесь.",
    draftInfo: "Ваш годовой план ещё не утверждён. Его должен утвердить заведующий кафедрой или декан.",
    approvedInfo: "План полностью утверждён. Все этапы успешно завершены.",
    rejectedInfo: "План отклонён. Внесите исправления и отправьте его повторно.", reason: "Причина",
    annualWorkload: "Годовая нагрузка", hours: "часов", normReached: "Норма выполнена", hoursNeeded: "Осталось {hours} часов",
    semester1: "1-й семестр", semester2: "2-й семестр", completion: "Процент выполнения", comingSoon: "Данные о выполнении появятся позже",
    approval: "Процесс утверждения", department: "Кафедра", dean: "Декан", education: "Учебный отдел", approved: "Утверждено",
    rejectionReason: "Причина отклонения", myWorkloads: "Моя учебная нагрузка", workloadCount: "Нагрузок: {count}",
    fullName: "ФИО", chair: "Кафедра", rateExperience: "Ставка / Стаж", rate: "ставка", year: "лет",
    assistant: "Ассистент", trainee: "Преподаватель-стажёр", senior: "Старший преподаватель", docent: "Доцент", professor: "Профессор",
    none: "Нет", bachelor: "Бакалавр", master: "Магистр", phd: "PhD", doctorScience: "Доктор наук", doctor: "Доктор",
    lowWorkload: "Общая нагрузка меньше {min} часов. Рекомендуемый минимум: {min} часов",
    lectureExperience: "Преподаватель без учёной степени и со стажем менее 3 лет не может читать лекции",
    lectureLimit: "Годовой лимит лекций для преподавателя без учёной степени — 250 часов",
  },
  en: {
    language: "Select language", logout: "Sign out", logoutTitle: "Sign out of the platform",
    logoutQuestion: "Are you sure you want to sign out?", no: "No", yes: "Yes",
    user: "User", teacherRole: "Teacher", position: "Position", footer: "Based on Order No. 3076 of the Ministry of Higher Education of Uzbekistan.",
    loadError: "Failed to load data", profileMissing: "Teacher profile not found",
    profileMissingText: "Your teacher profile has not been created yet. Please contact the head of department.",
    planMissing: "Your annual plan has not been created yet",
    planMissingText: "The head of department must prepare your individual work plan. It will appear here once created.",
    draftInfo: "Your annual plan has not been approved yet. It must be approved by the head of department or dean.",
    approvedInfo: "The plan is fully approved. All stages have been completed successfully.",
    rejectedInfo: "The plan was rejected. You can correct it and submit it again.", reason: "Reason",
    annualWorkload: "Annual workload", hours: "hours", normReached: "Target reached", hoursNeeded: "{hours} more hours required",
    semester1: "Semester 1", semester2: "Semester 2", completion: "Completion", comingSoon: "Progress data will be available soon",
    approval: "Approval process", department: "Department", dean: "Dean", education: "Academic affairs", approved: "Approved",
    rejectionReason: "Rejection reason", myWorkloads: "My workloads", workloadCount: "{count} workloads",
    fullName: "Full name", chair: "Department", rateExperience: "Rate / Experience", rate: "rate", year: "years",
    assistant: "Assistant", trainee: "Trainee teacher", senior: "Senior teacher", docent: "Associate professor", professor: "Professor",
    none: "None", bachelor: "Bachelor", master: "Master", phd: "PhD", doctorScience: "Doctor of Science", doctor: "Doctor",
    lowWorkload: "Total workload is below {min} hours. Recommended minimum: {min} hours",
    lectureExperience: "A teacher without an academic degree and with less than 3 years of experience may not deliver lectures",
    lectureLimit: "The annual lecture limit for a teacher without an academic degree is 250 hours",
  },
} as const;

export type TeacherMessageKey = keyof typeof messages.uz;

function snapshot(): TeacherLanguage {
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

export function setTeacherLanguage(language: TeacherLanguage) {
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTeacherI18n() {
  const language = useSyncExternalStore(subscribe, snapshot, () => "uz" as TeacherLanguage);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const t = useCallback((key: TeacherMessageKey, values?: Record<string, string | number>) => {
    let value: string = messages[language][key];
    Object.entries(values || {}).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
  }, [language]);
  return { language, t };
}

export function localized(language: TeacherLanguage, uz: string, ru: string, en: string) {
  return language === "ru" ? ru : language === "en" ? en : uz;
}

const entityTranslations: Record<string, { ru: string; en: string }> = {
  "multimedia texnologiyalari": {
    ru: "Мультимедийные технологии",
    en: "Multimedia Technologies",
  },
  "kompyuter injiniringi": {
    ru: "Компьютерная инженерия",
    en: "Computer Engineering",
  },
  "matematika": { ru: "Математика", en: "Mathematics" },
  "kompyuter ilmlari": { ru: "Компьютерные науки", en: "Computer Science" },
  "muhandislik": { ru: "Инженерия", en: "Engineering" },
  "boshqa": { ru: "Другое", en: "Other" },
  "muhammad al-xorazmiy nomidagi toshkent axborot texnologiyalari universiteti": {
    ru: "Ташкентский университет информационных технологий имени Мухаммада аль-Хорезми",
    en: "Tashkent University of Information Technologies named after Muhammad al-Khwarizmi",
  },
};

export function localizeEntityName(value: string | null | undefined, language: TeacherLanguage) {
  if (!value || language === "uz") return value || "";
  const translated = entityTranslations[value.trim().toLocaleLowerCase("uz")];
  return translated?.[language] || value;
}

const cyrillicPairs: Array<[string, string]> = [
  ["O‘", "У"], ["o‘", "у"], ["O'", "У"], ["o'", "у"],
  ["G‘", "Г"], ["g‘", "г"], ["G'", "Г"], ["g'", "г"],
  ["Sh", "Ш"], ["sh", "ш"], ["Ch", "Ч"], ["ch", "ч"],
  ["Yo", "Ё"], ["yo", "ё"], ["Yu", "Ю"], ["yu", "ю"], ["Ya", "Я"], ["ya", "я"],
  ["Ye", "Е"], ["ye", "е"],
];

const cyrillicLetters: Record<string, string> = {
  A: "А", B: "Б", D: "Д", E: "Е", F: "Ф", G: "Г", H: "Х", I: "И", J: "Ж",
  K: "К", L: "Л", M: "М", N: "Н", O: "О", P: "П", Q: "К", R: "Р", S: "С",
  T: "Т", U: "У", V: "В", X: "Х", Y: "Й", Z: "З",
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с",
  t: "т", u: "у", v: "в", x: "х", y: "й", z: "з",
};

export function localizePersonName(value: string | null | undefined, language: TeacherLanguage) {
  if (!value || language === "uz") return value || "";
  const normalized = value.replace(/[‘’ʻʼ`]/g, "'");
  if (language === "en") {
    return normalized
      .replaceAll("O'g'li", "Ogli").replaceAll("o'g'li", "ogli")
      .replaceAll("O'", "U").replaceAll("o'", "u")
      .replaceAll("G'", "G").replaceAll("g'", "g")
      .replaceAll("X", "Kh").replaceAll("x", "kh")
      .replaceAll("Ayev", "Aev").replaceAll("ayev", "aev")
      .replaceAll("Yev", "Ev").replaceAll("yev", "ev");
  }
  let result = normalized.replaceAll("O'g'li", "Угли").replaceAll("o'g'li", "угли");
  result = result.replaceAll("Ayev", "Аев").replaceAll("ayev", "аев");
  result = result.replaceAll("Yev", "Аев").replaceAll("yev", "аев");
  cyrillicPairs.forEach(([latin, cyrillic]) => { result = result.replaceAll(latin, cyrillic); });
  return Array.from(result, (letter) => cyrillicLetters[letter] || letter).join("");
}
