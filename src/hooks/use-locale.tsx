import { useCallback, useEffect, useState } from "react";
import i18n, {
  applyDocumentLocale,
  getDefaultLocale,
  getStoredLocale,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from "@/lib/i18n";

export type { AppLocale };

export function useLocale() {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === "undefined") return "es";
    return getStoredLocale() ?? getDefaultLocale();
  });

  useEffect(() => {
    const stored = getStoredLocale() ?? getDefaultLocale();
    setLocaleState(stored);
    void i18n.changeLanguage(stored);
    applyDocumentLocale(stored);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    void i18n.changeLanguage(next);
    applyDocumentLocale(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  return { locale, setLocale };
}
