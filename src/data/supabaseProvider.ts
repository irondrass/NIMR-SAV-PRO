/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig, shouldAttemptSupabase } from "./backendMode";

export type SupabaseTableName =
  | "profiles"
  | "users_profile"
  | "user_roles"
  | "clients"
  | "vehicles"
  | "dossiers"
  | "repair_order_lines"
  | "workshop_tasks"
  | "workshop_bookings"
  | "technician_resources"
  | "reservations"
  | "workshop_reservations"
  | "quality_controls"
  | "deliveries"
  | "audit_logs"
  | "audit_events"
  | "file_metadata"
  | "file_attachments"
  | "app_settings";

export interface SupabaseRequest {
  table: SupabaseTableName;
  operation: "list" | "get" | "insert" | "update" | "delete" | "rpc";
  payload?: unknown;
  rpcName?: string;
}

export interface SupabaseClientLike {
  request<T>(request: SupabaseRequest): Promise<T>;
}

export interface SupabaseProviderOptions {
  config?: BackendRuntimeConfig;
  client?: SupabaseClientLike;
}

let runtimeAccessToken: string | null = null;

export function setSupabaseAccessToken(accessToken: string | null): void {
  runtimeAccessToken = accessToken?.trim() || null;
}

export function hasSupabaseUserSession(): boolean {
  return Boolean(runtimeAccessToken);
}

export const SUPABASE_BACKEND_TABLES: SupabaseTableName[] = [
  "profiles",
  "users_profile",
  "user_roles",
  "clients",
  "vehicles",
  "dossiers",
  "repair_order_lines",
  "workshop_tasks",
  "workshop_bookings",
  "technician_resources",
  "reservations",
  "workshop_reservations",
  "quality_controls",
  "deliveries",
  "audit_logs",
  "audit_events",
  "file_metadata",
  "file_attachments",
  "app_settings",
];

export const SUPABASE_EDGE_FUNCTIONS = [
  "validate_qc",
  "create_delivery",
  "reserve_workshop_tasks",
  "assign_task_resource",
  "create_audit_event",
  "drive-create-upload-session",
  "drive-confirm-upload",
  "drive-download",
  "drive-delete-metadata",
] as const;

export type SupabaseProviderErrorCode =
  | "backend-disabled"
  | "not-configured"
  | "missing-url"
  | "missing-anon-key"
  | "network-error"
  | "rls-error"
  | "session-expired";

export class SupabaseProviderError extends Error {
  code: SupabaseProviderErrorCode;
  status?: number;

  constructor(code: SupabaseProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = "SupabaseProviderError";
    this.code = code;
    this.status = status;
  }
}

export class BackendNotEnabledError extends SupabaseProviderError {
  constructor(mode: string) {
    super("backend-disabled", `Backend Supabase inactive for mode ${mode}.`);
    this.name = "BackendNotEnabledError";
  }
}

export function classifySupabaseResponse(status: number): SupabaseProviderErrorCode {
  if (status === 401) return "session-expired";
  if (status === 403) return "rls-error";
  return "network-error";
}

function assertSupabaseConfig(config: BackendRuntimeConfig) {
  if (!config.supabaseUrl) {
    throw new SupabaseProviderError("missing-url", "VITE_SUPABASE_URL is required when backend-enabled is requested.");
  }
  if (!config.supabaseAnonKey) {
    throw new SupabaseProviderError("missing-anon-key", "VITE_SUPABASE_ANON_KEY is required when backend-enabled is requested.");
  }
  if (!config.supabaseConfigured) {
    throw new SupabaseProviderError("not-configured", "Supabase is not configured for this runtime.");
  }
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value.replace(/"/g, ""));
}

export function createSupabaseRestClient(
  config = resolveBackendRuntimeConfig(),
  getAccessToken: () => string | null = () => runtimeAccessToken,
): SupabaseClientLike {
  assertSupabaseConfig(config);
  const supabaseUrl = config.supabaseUrl!.replace(/\/$/, "");
  const anonKey = config.supabaseAnonKey!;

  const send = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set("apikey", anonKey);
    headers.set("authorization", `Bearer ${getAccessToken() ?? anonKey}`);
    headers.set("content-type", "application/json");
    headers.set("accept", "application/json");

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}${path}`, { ...init, headers });
    } catch (error) {
      throw new SupabaseProviderError("network-error", error instanceof Error ? error.message : "Supabase network error.");
    }

    if (!response.ok) {
      const code = classifySupabaseResponse(response.status);
      throw new SupabaseProviderError(code, `Supabase request failed with HTTP ${response.status}.`, response.status);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  };

  return {
    async request<T>(request: SupabaseRequest): Promise<T> {
      const tablePath = `/rest/v1/${request.table}`;
      if (request.operation === "list") {
        return send<T>(`${tablePath}?select=*`);
      }
      if (request.operation === "get") {
        const id = (request.payload as { id?: string } | undefined)?.id ?? "";
        const rows = await send<T[]>(`${tablePath}?id=eq.${encodeFilterValue(id)}&select=*&limit=1`);
        return (rows[0] ?? null) as T;
      }
      if (request.operation === "insert") {
        return send<T>(tablePath, { method: "POST", body: JSON.stringify(request.payload) });
      }
      if (request.operation === "update") {
        const payload = request.payload as { id?: string; patch?: unknown };
        return send<T>(`${tablePath}?id=eq.${encodeFilterValue(payload.id ?? "")}`, {
          method: "PATCH",
          body: JSON.stringify(payload.patch ?? {}),
        });
      }
      if (request.operation === "delete") {
        const id = (request.payload as { id?: string } | undefined)?.id ?? "";
        await send<void>(`${tablePath}?id=eq.${encodeFilterValue(id)}`, { method: "DELETE" });
        return true as T;
      }
      const rpcName = request.rpcName?.replace(/[^a-z0-9_]/gi, "");
      if (!rpcName) {
        throw new SupabaseProviderError("not-configured", "A valid RPC name is required.");
      }
      return send<T>(`/rest/v1/rpc/${rpcName}`, { method: "POST", body: JSON.stringify(request.payload ?? {}) });
    },
  };
}

export function createSupabaseProvider(options: SupabaseProviderOptions = {}) {
  const config = options.config ?? resolveBackendRuntimeConfig();
  const client = options.client ?? (config.backendEnabled ? createSupabaseRestClient(config) : undefined);

  const assertEnabled = () => {
    if (config.mode === "backend-enabled") assertSupabaseConfig(config);
    if (!shouldAttemptSupabase(config) || !client) {
      throw new BackendNotEnabledError(config.mode);
    }
  };

  return {
    mode: config.mode,
    backendEnabled: config.backendEnabled,
    tables: SUPABASE_BACKEND_TABLES,
    edgeFunctions: SUPABASE_EDGE_FUNCTIONS,
    async list<T>(table: SupabaseTableName): Promise<T[]> {
      assertEnabled();
      return client!.request<T[]>({ table, operation: "list" });
    },
    async getById<T>(table: SupabaseTableName, id: string): Promise<T | null> {
      assertEnabled();
      return client!.request<T | null>({ table, operation: "get", payload: { id } });
    },
    async insert<T>(table: SupabaseTableName, value: T): Promise<T> {
      assertEnabled();
      return client!.request<T>({ table, operation: "insert", payload: value });
    },
    async update<T>(table: SupabaseTableName, id: string, patch: Partial<T>): Promise<T> {
      assertEnabled();
      return client!.request<T>({ table, operation: "update", payload: { id, patch } });
    },
    async remove(table: SupabaseTableName, id: string): Promise<boolean> {
      assertEnabled();
      return client!.request<boolean>({ table, operation: "delete", payload: { id } });
    },
  };
}
