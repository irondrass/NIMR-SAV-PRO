/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig, shouldAttemptSupabase } from "./backendMode";

export type SupabaseTableName =
  | "users_profile"
  | "user_roles"
  | "clients"
  | "vehicles"
  | "dossiers"
  | "repair_order_lines"
  | "workshop_tasks"
  | "technician_resources"
  | "workshop_reservations"
  | "quality_controls"
  | "deliveries"
  | "audit_events"
  | "file_attachments"
  | "app_settings";

export interface SupabaseRequest {
  table: SupabaseTableName;
  operation: "list" | "get" | "insert" | "update" | "delete" | "rpc";
  payload?: unknown;
}

export interface SupabaseClientLike {
  request<T>(request: SupabaseRequest): Promise<T>;
}

export interface SupabaseProviderOptions {
  config?: BackendRuntimeConfig;
  client?: SupabaseClientLike;
}

export const SUPABASE_BACKEND_TABLES: SupabaseTableName[] = [
  "users_profile",
  "user_roles",
  "clients",
  "vehicles",
  "dossiers",
  "repair_order_lines",
  "workshop_tasks",
  "technician_resources",
  "workshop_reservations",
  "quality_controls",
  "deliveries",
  "audit_events",
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

export class BackendNotEnabledError extends Error {
  constructor(mode: string) {
    super(`Backend Supabase inactive for mode ${mode}.`);
    this.name = "BackendNotEnabledError";
  }
}

export function createSupabaseProvider(options: SupabaseProviderOptions = {}) {
  const config = options.config ?? resolveBackendRuntimeConfig();
  const client = options.client;

  const assertEnabled = () => {
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
