/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierStatus } from "./types";
import { sanitizeFreeText } from "./field-validations";

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  module: string;
  action: string;
  dossierId?: string;
  ancienStatut?: DossierStatus | string;
  nouveauStatut?: DossierStatus | string;
  commentaire?: string;
  source: string;
}

const STORAGE_KEY = "nimr-sav-pro-audit-trail-v1";

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
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return memoryAuditTrail;
  }
}

export function logAuditEvent(event: Omit<AuditTrailEntry, "id" | "timestamp">): AuditTrailEntry {
  const newEntry: AuditTrailEntry = {
    ...event,
    id: "audit_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
    timestamp: new Date().toISOString(),
    user: sanitizeFreeText(event.user),
    role: sanitizeFreeText(event.role),
    module: sanitizeFreeText(event.module),
    action: sanitizeFreeText(event.action),
    dossierId: event.dossierId ? sanitizeFreeText(event.dossierId) : undefined,
    commentaire: event.commentaire ? sanitizeFreeText(event.commentaire) : undefined,
    source: sanitizeFreeText(event.source),
  };

  if (isLocalStorageAvailable()) {
    try {
      const logs = getAuditTrail();
      logs.unshift(newEntry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to write to localStorage, falling back to memory", e);
      memoryAuditTrail.unshift(newEntry);
    }
  } else {
    memoryAuditTrail.unshift(newEntry);
  }

  return newEntry;
}

export function clearAuditTrail(): void {
  memoryAuditTrail = [];
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear localStorage", e);
    }
  }
}
