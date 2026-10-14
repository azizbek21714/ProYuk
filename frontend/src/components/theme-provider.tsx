"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "proyuk-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme);
    setThemeState(nextTheme);

    // Some mobile browsers can block storage (for example in strict/private
    // modes). Theme switching must still work even when it cannot be saved.
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the theme active for the current page session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  useEffect(() => {
    const initialTheme: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const frame = window.requestAnimationFrame(() => setThemeState(initialTheme));

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || (event.newValue !== "light" && event.newValue !== "dark")) {
        return;
      }
      applyTheme(event.newValue);
      setThemeState(event.newValue);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
