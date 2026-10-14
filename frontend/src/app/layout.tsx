import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const themeScript = `
  (() => {
    try {
      const savedTheme = localStorage.getItem("proyuk-theme");
      const theme = savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export const metadata: Metadata = {
  title: "ProYuk — Professor-o'qituvchilar yuklamasini hisoblash tizimi",
  description:
    "Oliy ta'lim muassasalari uchun professor-o'qituvchilar yuklamasini avtomatik hisoblash va boshqarish tizimi. O'zbekiston Respublikasi Oliy va o'rta ta'lim vazirligi 3076-son buyrug'iga asosan.",
  keywords: [
    "ProYuk",
    "yuklama",
    "o'qituvchi",
    "universitet",
    "Oliy ta'lim vazirligi",
    "3076",
    "shaxsiy ish reja",
  ],
  authors: [{ name: "ProYuk Team" }],
  icons: {
    icon: "/ustoz-logo.png",
  },
  openGraph: {
    title: "ProYuk — Professor-o'qituvchilar yuklamasini hisoblash tizimi",
    description:
      "Oliy ta'lim muassasalari uchun professor-o'qituvchilar yuklamasini avtomatik hisoblash va boshqarish tizimi.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
