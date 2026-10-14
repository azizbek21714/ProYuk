/**
 * Shared formatting utilities for ProYuk
 */

/**
 * Format a date string to Uzbek format: DD.MM.YYYY
 * Handles ISO strings, date inputs, and timestamp strings
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format a date input value (YYYY-MM-DD) to display format (DD.MM.YYYY)
 */
export function formatDateInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Format numbers with thousand separators (space as separator)
 * e.g., 1234 → "1 234", 12345 → "12 345"
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

/**
 * Format a number with unit, using thousand separators
 * e.g., formatSoat(1234) → "1 234 soat"
 */
export function formatSoat(num: number | null | undefined): string {
  return `${formatNumber(num)} soat`;
}

/**
 * Format a decimal number with comma as decimal separator
 * e.g., 1.5 → "1,50", 1 → "1,00"
 */
export function formatDecimal(num: number | null | undefined, decimals = 2): string {
  if (num == null) return "0";
  return num.toFixed(decimals).replace(".", ",");
}
