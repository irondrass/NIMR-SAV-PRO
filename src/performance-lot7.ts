/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV, WorkshopReservation } from "./types";

export const DOSSIER_LIST_PAGE_SIZE = 100;
export const RESERVATION_NEEDS_RENDER_LIMIT = 60;
export const AUDIT_TRAIL_PAGE_SIZE = 50;

export interface DossierSearchIndexEntry {
  id: string;
  text: string;
}

export function buildDossierSearchIndex(dossiers: DossierSAV[]): Map<string, DossierSearchIndexEntry> {
  return new Map(dossiers.map(dossier => [
    dossier.id,
    {
      id: dossier.id,
      text: [
        dossier.id,
        dossier.clientNom,
        dossier.clientTelephone,
        dossier.vehiculeImmatriculation,
        dossier.vehiculeMarque,
        dossier.vehiculeModele,
        dossier.vehiculeVIN,
      ].join(" ").toLowerCase(),
    },
  ]));
}

export function matchesDossierSearch(index: Map<string, DossierSearchIndexEntry>, dossier: DossierSAV, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return index.get(dossier.id)?.text.includes(normalized) ?? false;
}

export function paginateItems<T>(items: T[], limit: number): { visibleItems: T[]; hiddenCount: number; total: number } {
  const normalizedLimit = Math.max(0, limit);
  return {
    visibleItems: items.slice(0, normalizedLimit),
    hiddenCount: Math.max(0, items.length - normalizedLimit),
    total: items.length,
  };
}

export function filterReservationsForGanttDate(
  reservations: WorkshopReservation[],
  selectedDateStr: string
): WorkshopReservation[] {
  return reservations.filter(reservation => {
    if (reservation.status !== "CRENEAU_PROPOSE" && reservation.status !== "RESERVATION_CONFIRMEE") {
      return false;
    }
    if (reservation.segments && reservation.segments.length > 0) {
      return reservation.segments.some(segment => segment.start.split("T")[0] === selectedDateStr);
    }
    return Boolean(reservation.startTime?.split("T")[0] === selectedDateStr);
  });
}

export function buildLatestReservationByDossier(reservations: WorkshopReservation[]): Map<string, WorkshopReservation> {
  const byDossier = new Map<string, WorkshopReservation>();
  for (const reservation of reservations) {
    byDossier.set(reservation.dossierId, reservation);
  }
  return byDossier;
}
