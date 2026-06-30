/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV, DossierStatus, RepairOrderLine, UserRole, WorkshopReservation } from "../types";
import { sanitizeFreeText } from "../field-validations";
import {
  getDossierQCStatus,
  isRepairOrderDone,
  normalizeRepairOrderStatus,
  invalidateQCAfterWorkshopChange,
} from "../sav-core";

export const WORKSHOP_TASK_DELETION_MESSAGES = {
  notFound: "Tâche atelier introuvable.",
  missingReason: "Motif obligatoire pour supprimer ou annuler une tâche atelier.",
  reserved: "Suppression impossible : la tâche est réservée. Libérez d’abord la réservation planning.",
  inProgress: "Suppression interdite : tâche en cours.",
  paused: "Suppression interdite : tâche suspendue. Reprendre ou annuler administrativement selon procédure.",
  blocked: "Suppression interdite : tâche bloquée. Lever le blocage ou annuler administrativement avec motif.",
  done: "Suppression physique interdite : tâche terminée. Utilisez l’annulation administrative avec motif.",
  cancelled: "Tâche déjà annulée administrativement.",
  qcValidated: "Suppression interdite : dossier passé au contrôle qualité. Toute modification atelier doit invalider le QC avec motif.",
  released: "Réservation atelier libérée : la tâche peut maintenant être supprimée si elle n’a pas démarré.",
} as const;

export interface WorkshopTaskDeletionReadiness {
  line?: RepairOrderLine;
  status?: ReturnType<typeof normalizeRepairOrderStatus>;
  canDeletePhysically: boolean;
  canCancelAdministratively: boolean;
  canReleaseReservation: boolean;
  activeReservationIds: string[];
  blockReason?: string;
}

export type WorkshopTaskMutationResult =
  | { ok: true; dossier: DossierSAV; reservations?: WorkshopReservation[]; message: string; line?: RepairOrderLine }
  | { ok: false; error: string };

function getTaskActiveReservations(
  dossierId: string,
  lineId: string,
  reservations: WorkshopReservation[] = []
): WorkshopReservation[] {
  return reservations.filter(reservation =>
    reservation.dossierId === dossierId &&
    reservation.status !== "ANNULEE" &&
    reservation.taskIds.includes(lineId)
  );
}

function hasTaskPlanningFields(line: RepairOrderLine): boolean {
  return Boolean(
    line.planningStart ||
    line.planningEnd ||
    line.planningDate ||
    line.plannedTechnicianId ||
    line.plannedBayId ||
    (line.planningSegments && line.planningSegments.length > 0)
  );
}

function removeTaskPlanningFields(line: RepairOrderLine): RepairOrderLine {
  const {
    planningStart,
    planningEnd,
    planningSegments,
    plannedTechnicianId,
    plannedBayId,
    planningDate,
    ...rest
  } = line;
  void planningStart;
  void planningEnd;
  void planningSegments;
  void plannedTechnicianId;
  void plannedBayId;
  void planningDate;
  return rest;
}

function calculateRepairProgress(lines: RepairOrderLine[]): number {
  if (lines.length === 0) return 0;
  return Math.round((lines.filter(isRepairOrderDone).length / lines.length) * 100);
}

function requireReason(reason: string): string | null {
  const safeReason = sanitizeFreeText(reason);
  return safeReason.length >= 5 ? safeReason : null;
}

function appendTaskHistory(line: RepairOrderLine, now: Date, message: string): RepairOrderLine {
  return {
    ...line,
    history: [`${now.toISOString()} - ${message}`, ...(line.history || [])],
  };
}

export function getWorkshopTaskDeletionReadiness(
  dossier: DossierSAV,
  lineId: string,
  reservations: WorkshopReservation[] = []
): WorkshopTaskDeletionReadiness {
  const line = dossier.ordresReparation.find(item => item.id === lineId);
  if (!line) {
    return {
      canDeletePhysically: false,
      canCancelAdministratively: false,
      canReleaseReservation: false,
      activeReservationIds: [],
      blockReason: WORKSHOP_TASK_DELETION_MESSAGES.notFound,
    };
  }

  const status = normalizeRepairOrderStatus(line.status);
  const activeReservations = getTaskActiveReservations(dossier.id, lineId, reservations);
  const canReleaseReservation = activeReservations.length > 0 || hasTaskPlanningFields(line);

  if (canReleaseReservation) {
    return {
      line,
      status,
      canDeletePhysically: false,
      canCancelAdministratively: false,
      canReleaseReservation: true,
      activeReservationIds: activeReservations.map(reservation => reservation.reservationId),
      blockReason: WORKSHOP_TASK_DELETION_MESSAGES.reserved,
    };
  }

  if (status === "in_progress") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: false, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.inProgress };
  }
  if (status === "paused") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: false, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.paused };
  }
  if (status === "blocked") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: false, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.blocked };
  }
  if (status === "done") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: true, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.done };
  }
  if (status === "cancelled") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: false, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.cancelled };
  }

  if (getDossierQCStatus(dossier).status === "conforme") {
    return { line, status, canDeletePhysically: false, canCancelAdministratively: false, canReleaseReservation: false, activeReservationIds: [], blockReason: WORKSHOP_TASK_DELETION_MESSAGES.qcValidated };
  }

  return {
    line,
    status,
    canDeletePhysically: true,
    canCancelAdministratively: false,
    canReleaseReservation: false,
    activeReservationIds: [],
  };
}

export function releaseWorkshopTaskReservation(
  dossier: DossierSAV,
  reservations: WorkshopReservation[],
  lineId: string,
  now: Date = new Date()
): WorkshopTaskMutationResult {
  const line = dossier.ordresReparation.find(item => item.id === lineId);
  if (!line) return { ok: false, error: WORKSHOP_TASK_DELETION_MESSAGES.notFound };

  const readiness = getWorkshopTaskDeletionReadiness(dossier, lineId, reservations);
  if (!readiness.canReleaseReservation) {
    return { ok: false, error: "Aucune réservation active à libérer pour cette tâche." };
  }

  const timestamp = now.toISOString();
  const updatedLines = dossier.ordresReparation.map(item =>
    item.id === lineId
      ? appendTaskHistory(removeTaskPlanningFields(item), now, "Réservation planning libérée.")
      : item
  );
  const stillHasPlanning = updatedLines.some(hasTaskPlanningFields);
  const updatedDossier: DossierSAV = {
    ...dossier,
    ordresReparation: updatedLines,
    statut: stillHasPlanning ? dossier.statut : DossierStatus.VEHICULE_RECU,
    dateDernierStatut: timestamp,
    prochaineActionRecommended: `Réserver ou supprimer la tâche atelier "${line.designation}".`,
    historiqueLogs: [
      `${timestamp} - Réservation tâche "${line.designation}" libérée du planning atelier.`,
      ...(dossier.historiqueLogs || []),
    ],
  };

  const updatedReservations = reservations.map(reservation => {
    if (
      reservation.dossierId !== dossier.id ||
      reservation.status === "ANNULEE" ||
      !reservation.taskIds.includes(lineId)
    ) {
      return reservation;
    }
    return {
      ...reservation,
      status: "ANNULEE" as const,
      history: [
        ...(reservation.history || []),
        `${timestamp} - Réservation libérée avant suppression/annulation de tâche.`,
      ],
    };
  });

  return {
    ok: true,
    dossier: updatedDossier,
    reservations: updatedReservations,
    message: WORKSHOP_TASK_DELETION_MESSAGES.released,
    line: updatedLines.find(item => item.id === lineId),
  };
}

export function deleteWorkshopTask(
  dossier: DossierSAV,
  reservations: WorkshopReservation[],
  lineId: string,
  reason: string,
  userRole: UserRole | string = UserRole.CHEF_ATELIER,
  now: Date = new Date()
): WorkshopTaskMutationResult {
  const readiness = getWorkshopTaskDeletionReadiness(dossier, lineId, reservations);
  if (!readiness.canDeletePhysically || !readiness.line) {
    return { ok: false, error: readiness.blockReason || WORKSHOP_TASK_DELETION_MESSAGES.notFound };
  }

  const safeReason = requireReason(reason);
  if (!safeReason) return { ok: false, error: WORKSHOP_TASK_DELETION_MESSAGES.missingReason };

  const timestamp = now.toISOString();
  const nextLines = dossier.ordresReparation.filter(line => line.id !== lineId);
  const updatedDossier: DossierSAV = {
    ...dossier,
    ordresReparation: nextLines,
    avancementGlobal: calculateRepairProgress(nextLines),
    dateDernierStatut: timestamp,
    historiqueLogs: [
      `${timestamp} - Tâche atelier supprimée par ${userRole}: ${readiness.line.designation}. Motif: ${safeReason}`,
      ...(dossier.historiqueLogs || []),
    ],
  };

  return {
    ok: true,
    dossier: updatedDossier,
    reservations,
    message: "Tâche atelier supprimée.",
  };
}

export function cancelWorkshopTaskAdministratively(
  dossier: DossierSAV,
  reservations: WorkshopReservation[],
  lineId: string,
  reason: string,
  userRole: UserRole | string = UserRole.CHEF_ATELIER,
  now: Date = new Date()
): WorkshopTaskMutationResult {
  const readiness = getWorkshopTaskDeletionReadiness(dossier, lineId, reservations);
  if (!readiness.canCancelAdministratively || !readiness.line) {
    return { ok: false, error: readiness.blockReason || WORKSHOP_TASK_DELETION_MESSAGES.notFound };
  }

  const safeReason = requireReason(reason);
  if (!safeReason) return { ok: false, error: WORKSHOP_TASK_DELETION_MESSAGES.missingReason };

  const timestamp = now.toISOString();
  const cancelledLine = appendTaskHistory({
    ...readiness.line,
    status: "cancelled",
    cancelledAt: timestamp,
    cancelledBy: String(userRole),
    cancellationReason: safeReason,
  }, now, `Annulée par Chef Atelier. Motif: ${safeReason}`);

  const nextLines = dossier.ordresReparation.map(line => line.id === lineId ? cancelledLine : line);
  const allTerminal = nextLines.length > 0 && nextLines.every(isRepairOrderDone);
  const updatedBeforeQc: DossierSAV = {
    ...dossier,
    ordresReparation: nextLines,
    avancementGlobal: calculateRepairProgress(nextLines),
    statut: allTerminal ? DossierStatus.CONTROLE_QUALITE : dossier.statut,
    prochaineActionRecommended: allTerminal
      ? "Lancer ou refaire le contrôle qualité avant restitution client."
      : dossier.prochaineActionRecommended,
    dateDernierStatut: timestamp,
    historiqueLogs: [
      `${timestamp} - Annulée par Chef Atelier: ${readiness.line.designation}. Motif: ${safeReason}`,
      ...(dossier.historiqueLogs || []),
    ],
  };

  const updatedDossier = invalidateQCAfterWorkshopChange(
    updatedBeforeQc,
    `Annulation administrative de la tâche "${readiness.line.designation}": ${safeReason}`,
    userRole,
    now
  );

  return {
    ok: true,
    dossier: updatedDossier,
    reservations,
    message: "Tâche annulée administrativement.",
    line: cancelledLine,
  };
}

