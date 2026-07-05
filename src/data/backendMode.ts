/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BackendMode = "local-only" | "backend-ready" | "backend-enabled";
export type BackendRuntimeEnvironment = "local" | "staging" | "production";

export interface BackendRuntimeConfig {
  mode: BackendMode;
  environment: BackendRuntimeEnvironment;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseConfigured: boolean;
  backendEnabled: boolean;
  backendReady: boolean;
  productionBlocked: boolean;
  authProvider: "local" | "supabase";
  googleDriveStatus: "not-configured" | "staging-ready" | "active";
  missing: string[];
  warnings: string[];
  errors: string[];
}

export const PUBLIC_BACKEND_ENV_KEYS = [
  "VITE_NIMR_BACKEND_MODE",
  "VITE_NIMR_ENV",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  // Legacy alias kept so previous local checks and deployments remain stable.
  "VITE_BACKEND_MODE",
] as const;

export const FORBIDDEN_FRONTEND_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

type BackendEnv = Record<string, string | undefined>;

declare global {
  interface Window {
    __NIMR_RUNTIME_ENV__?: BackendEnv;
  }
}

function readImportMetaEnv(): BackendEnv {
  const meta = import.meta as unknown as { env?: BackendEnv };
  return meta.env ?? {};
}

function readProcessEnv(): BackendEnv {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as BackendEnv;
}

function readWindowRuntimeEnv(): BackendEnv {
  if (typeof window === "undefined") return {};
  return window.__NIMR_RUNTIME_ENV__ ?? {};
}

export function normalizeBackendMode(value?: string | null): BackendMode {
  if (value === "backend-ready" || value === "backend-enabled" || value === "local-only") {
    return value;
  }
  return "local-only";
}

export function normalizeBackendRuntimeEnvironment(value?: string | null): BackendRuntimeEnvironment {
  if (value === "staging" || value === "production" || value === "local") return value;
  return "local";
}

export function resolveBackendRuntimeConfig(env: BackendEnv = { ...readProcessEnv(), ...readImportMetaEnv(), ...readWindowRuntimeEnv() }): BackendRuntimeConfig {
  const mode = normalizeBackendMode(env.VITE_NIMR_BACKEND_MODE ?? env.VITE_BACKEND_MODE);
  const environment = normalizeBackendRuntimeEnvironment(env.VITE_NIMR_ENV);
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || null;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || null;
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (mode === "backend-enabled") {
    if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  }

  if (environment === "production") {
    errors.push("Production réelle non autorisée tant que Supabase réel, RLS réel, Edge Functions et Google Drive OAuth réel ne sont pas validés.");
  }

  for (const key of FORBIDDEN_FRONTEND_ENV_KEYS) {
    if (env[key]?.trim()) {
      warnings.push(`${key} must stay server-side and must not be exposed to Vite.`);
    }
  }

  const productionBlocked = environment === "production";
  const backendEnabled = mode === "backend-enabled" && supabaseConfigured && missing.length === 0 && warnings.length === 0 && !productionBlocked;
  const googleDriveStatus = backendEnabled && environment === "staging" ? "staging-ready" : "not-configured";
  return {
    mode,
    environment,
    supabaseUrl,
    supabaseAnonKey,
    supabaseConfigured,
    backendEnabled,
    backendReady: !productionBlocked && (mode === "backend-ready" || backendEnabled),
    productionBlocked,
    authProvider: backendEnabled ? "supabase" : "local",
    googleDriveStatus,
    missing,
    warnings,
    errors,
  };
}

export function shouldAttemptSupabase(config = resolveBackendRuntimeConfig()): boolean {
  return config.backendEnabled;
}

export function describeBackendMode(config = resolveBackendRuntimeConfig()): string {
  if (config.productionBlocked) return "Production réelle non autorisée.";
  if (config.mode === "local-only") return "Mode local-only actif : aucun appel Supabase ni Google Drive.";
  if (config.mode === "backend-ready") return "Mode backend-ready : contrats presents, appels reseau inactifs.";
  if (config.backendEnabled) return "Mode backend-enabled : Supabase actif via variables publiques autorisees.";
  return `Mode backend-enabled incomplet : variables manquantes ${config.missing.join(", ") || "inconnues"}.`;
}
