import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "@/locales/es";
import en from "@/locales/en";

export const LOCALE_STORAGE_KEY = "digitron-locale";
export type AppLocale = "es" | "en";

export function getDefaultLocale(): AppLocale {
  if (typeof window === "undefined") return "es";
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  if (lang.startsWith("en")) return "en";
  return "es";
}

export function getStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
  return null;
}

export function resolveInitialLocale(): AppLocale {
  if (typeof window === "undefined") return "es";
  return getStoredLocale() ?? getDefaultLocale();
}

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: resolveInitialLocale(),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

applyDocumentLocale(resolveInitialLocale());

export default i18n;
