"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Kunduzgi rejimni yoqish" : "Tungi rejimni yoqish";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      disabled={theme === null}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-9 w-[68px] shrink-0 items-center rounded-full border border-primary/30 bg-primary/15 p-1 shadow-sm transition-colors duration-300 hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70",
        className,
      )}
    >
      <Sun className="absolute left-2 h-4 w-4 text-primary" aria-hidden="true" />
      <Moon className="absolute right-2 h-4 w-4 text-primary" aria-hidden="true" />
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-300",
          isDark ? "translate-x-8" : "translate-x-0",
        )}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function ThemeToggleCorner() {
  return (
    <div className="fixed right-4 top-4 z-[60] sm:right-6 sm:top-6">
      <ThemeToggle />
    </div>
  );
}
