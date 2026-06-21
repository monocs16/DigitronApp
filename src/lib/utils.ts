import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(n: number): string {
  return n.toFixed(2);
}

/** Locale-aware date only (e.g. 6/20/2026), using the runtime default locale. */
export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString();
}

/** Locale-aware date and time, using the runtime default locale. */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString();
}
