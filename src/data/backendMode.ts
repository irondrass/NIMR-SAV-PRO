/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BackendMode = "local-only" | "backend-ready" | "backend-enabled";

export interface BackendRuntimeConfig {
  mode: BackendMode;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  backendEnabled: boolean;
  backendReady: boolean;
  missing: string[];
  warnings: string[];
}

export const PUBLIC_BACKEND_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_BACKEND_MODE",
] as const;

export const FORBIDDEN_FRONTEND_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_PRIVATE_KEY",
] as const;

type BackendEnv = Record<string, string | undefined>;

function readImportMetaEnv(): BackendEnv {
  const meta = import.meta as unknown as { env?: BackendEnv };
  return meta.env ?? {};
}

function readProcessEnv(): BackendEnv {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as BackendEnv;
}

export function normalizeBackendMode(value?: string | null): BackendMode {
  if (value === "backend-ready" || value === "backend-enabled" || value === "local-only") {
    return value;
  }
  return "local-only";
}

export function resolveBackendRuntimeConfig(env: BackendEnv = { ...readProcessEnv(), ...readImportMetaEnv() }): BackendRuntimeConfig {
  const mode = normalizeBackendMode(env.VITE_BACKEND_MODE);
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || null;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || null;
  const missing: string[] = [];
  const warnings: string[] = [];

  if (mode === "backend-enabled") {
    if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  }

  for (const key of FORBIDDEN_FRONTEND_ENV_KEYS) {
    if (env[key]?.trim()) {
      warnings.push(`${key} must stay server-side and must not be exposed to Vite.`);
    }
  }

  const backendEnabled = mode === "backend-enabled" && missing.length === 0 && warnings.length === 0;
  return {
    mode,
    supabaseUrl,
    supabaseAnonKey,
    backendEnabled,
    backendReady: mode === "backend-ready" || backendEnabled,
    missing,
    warnings,
  };
}

export function shouldAttemptSupabase(config = resolveBackendRuntimeConfig()): boolean {
  return config.backendEnabled;
}

export function describeBackendMode(config = resolveBackendRuntimeConfig()): string {
  if (config.mode === "local-only") return "Mode local-only actif : aucun appel Supabase ni Google Drive.";
  if (config.mode === "backend-ready") return "Mode backend-ready : contrats presents, appels reseau inactifs.";
  if (config.backendEnabled) return "Mode backend-enabled : Supabase actif via variables publiques autorisees.";
  return `Mode backend-enabled incomplet : variables manquantes ${config.missing.join(", ") || "inconnues"}.`;
}
