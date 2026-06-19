/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierPriority, DossierSAV, DossierStatus } from "./types";
import { normalizeRepairOrderStatus } from "./sav-core";

export type AgingAlertScope = "dashboard" | "chef-atelier" | "reception";
export type AgingAlertKind = "task-active" | "dossier-blocked" | "ready-delivery" | "immobilized";

export interface AgingAlert {
  kind: AgingAlertKind;
  dossierId: string;
  title: string;
  detail: string;
  ageHours: number;
  scopes: AgingAlertScope[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function buildAgingAlerts(dossiers: DossierSAV[], now = new Date()): AgingAlert[] {
  const alerts: AgingAlert[] = [];

  for (const dossier of dossiers) {
    const lastStatusAt = parseDate(dossier.dateDernierStatut) || parseDate(dossier.dateReception) || now;
    const receptionAt = parseDate(dossier.dateReception) || lastStatusAt;

    for (const line of dossier.ordresReparation) {
      if (normalizeRepairOrderStatus(line.status) !== "in_progress") continue;
      const taskStart = extractLatestTaskStart(line.history) || lastStatusAt;
      const ageHours = diffHours(taskStart, now);
      if (ageHours > 4) {
        alerts.push({
          kind: "task-active",
          dossierId: dossier.id,
          title: "Tâche active > 4h",
          detail: `${line.designation} sans pause ni clôture depuis ${formatHours(ageHours)}.`,
          ageHours,
          scopes: ["dashboard", "chef-atelier"],
        });
      }
    }

    if (dossier.statut === DossierStatus.BLOQUE) {
      const ageHours = diffHours(lastStatusAt, now);
      if (ageHours > 24) {
        alerts.push({
          kind: "dossier-blocked",
          dossierId: dossier.id,
          title: "Dossier bloqué > 24h",
          detail: `${dossier.bloqueRaison || "Blocage atelier"} depuis ${formatHours(ageHours)}.`,
          ageHours,
          scopes: ["dashboard", "chef-atelier", "reception"],
        });
      }
    }

    if (dossier.statut === DossierStatus.PRET_A_LIVRER) {
      const ageHours = diffHours(lastStatusAt, now);
      if (ageHours > 24) {
        alerts.push({
          kind: "ready-delivery",
          dossierId: dossier.id,
          title: "Prêt à livrer > 24h",
          detail: `${dossier.vehiculeMarque} ${dossier.vehiculeModele} attend restitution client.`,
          ageHours,
          scopes: ["dashboard", "reception"],
        });
      }
    }

    if (dossier.priorite === DossierPriority.VEHICULE_IMMOBILISE) {
      const ageHours = diffHours(receptionAt, now);
      if (ageHours > 72 && ![DossierStatus.LIVRE, DossierStatus.NON_RETIRE, DossierStatus.CLOTURE, DossierStatus.PRET_FACTURATION].includes(dossier.statut)) {
        alerts.push({
          kind: "immobilized",
          dossierId: dossier.id,
          title: "Véhicule immobilisé > 3 jours",
          detail: `${dossier.clientNom} · ${dossier.vehiculeImmatriculation}.`,
          ageHours,
          scopes: ["dashboard", "chef-atelier"],
        });
      }
    }
  }

  return alerts.sort((a, b) => b.ageHours - a.ageHours);
}

export function filterAgingAlerts(alerts: AgingAlert[], scope: AgingAlertScope): AgingAlert[] {
  return alerts.filter(alert => alert.scopes.includes(scope));
}

function extractLatestTaskStart(history?: string[]): Date | null {
  if (!history) return null;
  for (const entry of history) {
    if (!/démarrée|demarree|reprise/i.test(entry)) continue;
    const parsed = parseDate(entry.slice(0, 24));
    if (parsed) return parsed;
  }
  return null;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffHours(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / HOUR_MS);
}

function formatHours(hours: number): string {
  if (hours >= 24) return `${Math.floor(hours / 24)}j ${Math.floor(hours % 24)}h`;
  return `${Math.floor(hours)}h`;
}
