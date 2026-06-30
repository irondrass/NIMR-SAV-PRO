/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierStatus } from "./types";
import { sanitizeFreeText } from "./field-validations";
import { STORAGE_KEYS } from "./storage-keys";

export type AuditTrailResult = "success" | "blocked" | "failed";
export type AuditTrailSource =
  | "reception"
  | "atelier"
  | "planning"
  | "qc"
  | "livraison"
  | "impression"
  | "system";

export interface AuditTrailEntry {
  id: string;
  date: string;
  timestamp: string;
  user: string;
  role: string;
  module?: string;
  action: string;
  dossierId?: string;
  dossierLabel?: string;
  ancienStatut?: DossierStatus | string;
  nouveauStatut?: DossierStatus | string;
  commentaire?: string;
  summary: string;
  result: AuditTrailResult;
  blockReason?: string;
  source: AuditTrailSource;
}

export const AUDIT_TRAIL_STORAGE_KEY = STORAGE_KEYS.auditLog;
export const MAX_AUDIT_TRAIL_ENTRIES = 100;

// Memory fallback for environments without localStorage (e.g. Node tests)
let memoryAuditTrail: AuditTrailEntry[] = [];

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function getAuditTrail(): AuditTrailEntry[] {
  if (!isLocalStorageAvailable()) {
    return memoryAuditTrail;
  }
  try {
    const raw = localStorage.getItem(AUDIT_TRAIL_STORAGE_KEY);
    return raw ? normalizeAuditEntries(JSON.parse(raw)) : [];
  } catch {
    return memoryAuditTrail;
  }
}

function normalizeSource(source?: string, module?: string, action?: string): AuditTrailSource {
  const value = `${source || ""} ${module || ""} ${action || ""}`.toLowerCase();
  if (value.includes("reception") || value.includes("création") || value.includes("creation")) return "reception";
  if (value.includes("planning") || value.includes("reservation") || value.includes("réservation")) return "planning";
  if (value.includes("qc") || value.includes("qualite") || value.includes("qualité")) return "qc";
  if (value.includes("livraison") || value.includes("delivery") || value.includes("restitution")) return "livraison";
  if (value.includes("print") || value.includes("impression")) return "impression";
  if (value.includes("atelier") || value.includes("workshop") || value.includes("tache") || value.includes("tâche")) return "atelier";
  return "system";
}

function normalizeAuditEntries(entries: unknown): AuditTrailEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(entry => entry && typeof entry === "object")
    .map(entry => {
      const item = entry as Partial<AuditTrailEntry>;
      const date = typeof item.date === "string" ? item.date : (typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString());
      const summary = item.summary || item.commentaire || item.action || "Action locale";
      const result: AuditTrailResult = item.result === "blocked" || item.result === "failed" ? item.result : "success";
      return {
        id: typeof item.id === "string" ? item.id : "audit_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
        date,
        timestamp: date,
        user: sanitizeFreeText(String(item.user || "")),
        role: sanitizeFreeText(String(item.role || "")),
        module: item.module ? sanitizeFreeText(String(item.module)) : undefined,
        action: sanitizeFreeText(String(item.action || "action_locale")),
        dossierId: item.dossierId ? sanitizeFreeText(String(item.dossierId)) : undefined,
        dossierLabel: item.dossierLabel ? sanitizeFreeText(String(item.dossierLabel)) : undefined,
        ancienStatut: item.ancienStatut,
        nouveauStatut: item.nouveauStatut,
        commentaire: item.commentaire ? sanitizeFreeText(String(item.commentaire)) : undefined,
        summary: sanitizeFreeText(String(summary)),
        result,
        blockReason: item.blockReason ? sanitizeFreeText(String(item.blockReason)) : undefined,
        source: normalizeSource(item.source, item.module, item.action),
      };
    })
    .slice(0, MAX_AUDIT_TRAIL_ENTRIES);
}

export function logAuditEvent(
  event: Omit<AuditTrailEntry, "id" | "timestamp" | "date" | "summary" | "result" | "source"> & {
    date?: string;
    timestamp?: string;
    summary?: string;
    result?: AuditTrailResult;
    source?: string;
  }
): AuditTrailEntry {
  const date = event.date || event.timestamp || new Date().toISOString();
  const summary = event.summary || event.commentaire || event.action;
  const newEntry: AuditTrailEntry = {
    ...event,
    id: "audit_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
    date,
    timestamp: date,
    user: sanitizeFreeText(event.user),
    role: sanitizeFreeText(event.role),
    module: event.module ? sanitizeFreeText(event.module) : undefined,
    action: sanitizeFreeText(event.action),
    dossierId: event.dossierId ? sanitizeFreeText(event.dossierId) : undefined,
    dossierLabel: event.dossierLabel ? sanitizeFreeText(event.dossierLabel) : undefined,
    commentaire: event.commentaire ? sanitizeFreeText(event.commentaire) : undefined,
    summary: sanitizeFreeText(summary),
    result: event.result || "success",
    blockReason: event.blockReason ? sanitizeFreeText(event.blockReason) : undefined,
    source: normalizeSource(event.source, event.module, event.action),
  };

  if (isLocalStorageAvailable()) {
    try {
      const logs = [newEntry, ...getAuditTrail()].slice(0, MAX_AUDIT_TRAIL_ENTRIES);
      localStorage.setItem(AUDIT_TRAIL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to write to localStorage, falling back to memory", e);
      memoryAuditTrail = [newEntry, ...memoryAuditTrail].slice(0, MAX_AUDIT_TRAIL_ENTRIES);
    }
  } else {
    memoryAuditTrail = [newEntry, ...memoryAuditTrail].slice(0, MAX_AUDIT_TRAIL_ENTRIES);
  }

  return newEntry;
}

export function clearAuditTrail(): void {
  memoryAuditTrail = [];
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(AUDIT_TRAIL_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear localStorage", e);
    }
  }
}
