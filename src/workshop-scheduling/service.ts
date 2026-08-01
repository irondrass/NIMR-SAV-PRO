import { resolveBackendRuntimeConfig } from "../data/backendMode";
import { createSupabaseRestClient, hasSupabaseUserSession, SupabaseClientLike } from "../data/supabaseProvider";
import {
  BookingConfirmationRequest,
  BookingConfirmationConflictResponse,
  BookingConfirmationResult,
  WorkshopBooking,
  WorkshopSchedulingSettings,
} from "./types";

export const WORKSHOP_BOOKINGS_STORAGE_KEY = "nimr-sav-pro-workshop-bookings-v2";
export const WORKSHOP_SETTINGS_STORAGE_KEY = "nimr-sav-pro-workshop-scheduling-settings-v1";

export interface WorkshopSchedulingGateway {
  canConfirmServerBooking: boolean;
  confirmBooking(request: BookingConfirmationRequest): Promise<BookingConfirmationResult>;
  saveSettings(settings: WorkshopSchedulingSettings): Promise<void>;
}

export class WorkshopBookingConflictError extends Error {
  readonly code: string;
  readonly alternatives: BookingConfirmationConflictResponse["alternatives"];

  constructor(result: BookingConfirmationConflictResponse) {
    super(result.message);
    this.name = "WorkshopBookingConflictError";
    this.code = result.code;
    this.alternatives = result.alternatives;
  }
}

export function createWorkshopSchedulingGateway(client?: SupabaseClientLike): WorkshopSchedulingGateway {
  const config = resolveBackendRuntimeConfig();
  const hasInjectedClient = Boolean(client);
  const backendClient = client ?? (config.backendEnabled ? createSupabaseRestClient(config) : undefined);
  return {
    canConfirmServerBooking: Boolean(config.backendEnabled && backendClient && (client || hasSupabaseUserSession())),
    async confirmBooking(request) {
      if (!config.backendEnabled || !backendClient || (!hasInjectedClient && !hasSupabaseUserSession())) {
        throw new Error("Connexion serveur requise : la reservation reste un brouillon local non confirme.");
      }
      return backendClient.request<BookingConfirmationResult>({
        table: "workshop_bookings",
        operation: "rpc",
        rpcName: "confirm_workshop_booking",
        payload: {
          p_task_id: request.taskId,
          p_start_at: request.start,
          p_end_at: request.end,
          p_employee_ids: request.employeeIds,
          p_material_resource_ids: request.materialResourceIds,
          p_operation_id: request.operationId,
          p_overbook: request.overbook,
          p_reason: request.reason ?? null,
        },
      });
    },
    async saveSettings(settings) {
      if (!config.backendEnabled || !backendClient || (!hasInjectedClient && !hasSupabaseUserSession())) {
        throw new Error("Session serveur requise pour enregistrer les parametres en base.");
      }
      await backendClient.request<unknown>({
        table: "app_settings",
        operation: "rpc",
        rpcName: "save_workshop_scheduling_settings",
        payload: { p_settings: settings },
      });
    },
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

export function loadWorkshopBookings(): WorkshopBooking[] {
  return readJson<WorkshopBooking[]>(WORKSHOP_BOOKINGS_STORAGE_KEY, []);
}

export function saveWorkshopBookings(bookings: WorkshopBooking[]): void {
  writeJson(WORKSHOP_BOOKINGS_STORAGE_KEY, bookings);
}

export function loadWorkshopSchedulingSettings(fallback: WorkshopSchedulingSettings): WorkshopSchedulingSettings {
  return readJson(WORKSHOP_SETTINGS_STORAGE_KEY, fallback);
}

export function saveWorkshopSchedulingSettings(settings: WorkshopSchedulingSettings): void {
  writeJson(WORKSHOP_SETTINGS_STORAGE_KEY, settings);
}

export async function persistWorkshopSchedulingSettings(
  settings: WorkshopSchedulingSettings,
  gateway = createWorkshopSchedulingGateway(),
): Promise<"server" | "local"> {
  saveWorkshopSchedulingSettings(settings);
  if (!gateway.canConfirmServerBooking) return "local";
  await gateway.saveSettings(settings);
  return "server";
}

export function createPendingBooking(
  request: BookingConfirmationRequest,
  workOrderId: string,
  vehicleId: string,
): WorkshopBooking {
  return {
    id: `local-${request.operationId}`,
    taskId: request.taskId,
    workOrderId,
    vehicleId,
    start: request.start,
    end: request.end,
    employeeIds: request.employeeIds,
    materialResourceIds: request.materialResourceIds,
    status: "local_pending",
    locked: false,
    overbooked: request.overbook,
    reason: request.reason,
    operationId: request.operationId,
    attempts: 0,
  };
}

export async function confirmPendingBooking(
  booking: WorkshopBooking,
  gateway = createWorkshopSchedulingGateway(),
): Promise<WorkshopBooking> {
  const result = await gateway.confirmBooking({
    taskId: booking.taskId,
    start: booking.start,
    end: booking.end,
    employeeIds: booking.employeeIds,
    materialResourceIds: booking.materialResourceIds,
    operationId: booking.operationId,
    overbook: booking.overbooked,
    reason: booking.reason,
  });
  if (result.status === "conflict") {
    throw new WorkshopBookingConflictError(result);
  }
  return {
    ...booking,
    id: result.bookingId,
    status: "server_confirmed",
    serverVersion: result.serverVersion,
    lastSyncAt: new Date().toISOString(),
    attempts: booking.attempts + 1,
    lastError: undefined,
  };
}
