import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_FILE = join(__dirname, "../.supabase-status.json");

export type E2eSupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const DEFAULT_API_URL = "http://127.0.0.1:55321";

/** Reads Supabase connection info written by e2e/global-setup.ts (or env fallback). */
export function loadE2eSupabaseEnv(): E2eSupabaseEnv {
  if (existsSync(STATUS_FILE)) {
    const parsed = JSON.parse(readFileSync(STATUS_FILE, "utf8")) as Partial<E2eSupabaseEnv> & {
      apiUrl?: string;
      serviceRoleKey?: string;
      anonKey?: string;
    };
    if (parsed.apiUrl && parsed.serviceRoleKey) {
      return {
        apiUrl: parsed.apiUrl,
        serviceRoleKey: parsed.serviceRoleKey,
        anonKey: parsed.anonKey ?? "",
      };
    }
  }

  return {
    apiUrl: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? DEFAULT_API_URL,
    anonKey:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}
