/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV, DossierStatus, RepairOrderLine, WorkshopReservation } from "./types";
import { normalizeRepairOrderStatus } from "./sav-core";

export type PlanningStepId =
  | "body-disassembly"
  | "quick-service"
  | "mechanical"
  | "electrical"
  | "preparation"
  | "paint"
  | "reassembly"
  | "finish"
  | "quality";

export interface PlanningStepDefinition {
  id: PlanningStepId;
  label: string;
  serviceType: string;
  keywords: string[];
}

export interface PlanningStepMapping {
  stepId: PlanningStepId;
  label: string;
  serviceType: string;
  needsConfirmation: boolean;
}

export interface PlanningStepLine {
  line: RepairOrderLine;
  reservedHours: number;
  reservation?: WorkshopReservation;
  isPlanned: boolean;
  isDurationValidated: boolean;
  needsConfirmation: boolean;
}

export interface PlanningStepSummary {
  stepId: PlanningStepId;
  label: string;
  serviceType: string;
  active: boolean;
  needsConfirmation: boolean;
  lines: PlanningStepLine[];
  estimatedHours: number;
  reservedHours: number;
  unvalidatedDurationCount: number;
  isFullyReserved: boolean;
  nextReservableLine?: RepairOrderLine;
  reschedulableLine?: RepairOrderLine;
}

export interface DossierPlanningOverview {
  steps: PlanningStepSummary[];
  totalEstimatedHours: number;
  totalReservedHours: number;
  remainingHours: number;
  workshopMarginHours: number;
  unvalidatedDurationCount: number;
  activeStepCount: number;
  reservedStepCount: number;
  unreservedStepCount: number;
  planningComplete: boolean;
}

export const PLANNING_STEP_DEFINITIONS: PlanningStepDefinition[] = [
  {
    id: "body-disassembly",
    label: "Tôlerie + démontage",
    serviceType: "Carrosserie",
    keywords: ["carrosserie", "choc", "pare-chocs", "parechocs", "aile", "tolerie", "tôlerie", "demontage", "démontage"],
  },
  {
    id: "quick-service",
    label: "Vidange / entretien rapide",
    serviceType: "Entretien rapide",
    keywords: ["vidange", "filtre", "entretien", "revision", "révision", "controle 2500", "contrôle 2500"],
  },
  {
    id: "mechanical",
    label: "Réparation mécanique",
    serviceType: "Mécanique",
    keywords: ["bruit moteur", "freinage", "frein", "suspension", "diagnostic mecanique", "diagnostic mécanique", "moteur", "mecanique", "mécanique"],
  },
  {
    id: "electrical",
    label: "Réparation électrique",
    serviceType: "Électricité / diagnostic",
    keywords: ["defaut electrique", "défaut électrique", "electrique", "électrique", "batterie", "capteur", "faisceau"],
  },
  {
    id: "preparation",
    label: "Préparation",
    serviceType: "Préparation peinture",
    keywords: ["preparation", "préparation", "poncage", "ponçage"],
  },
  {
    id: "paint",
    label: "Peinture + vernis",
    serviceType: "Peinture",
    keywords: ["peinture", "vernis"],
  },
  {
    id: "reassembly",
    label: "Remontage",
    serviceType: "Remontage",
    keywords: ["remontage", "ajustement"],
  },
  {
    id: "finish",
    label: "Finition + lavage",
    serviceType: "Finition",
    keywords: ["lavage", "finition", "preparation livraison", "préparation livraison"],
  },
  {
    id: "quality",
    label: "Contrôle qualité",
    serviceType: "Contrôle qualité",
    keywords: ["controle qualite", "contrôle qualité", "qc", "essai final"],
  },
];

const DEFAULT_PLANNING_STEP = PLANNING_STEP_DEFINITIONS.find(step => step.id === "mechanical")!;

function normalizePlanningText(value: string): string {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatStepSearchText(line: RepairOrderLine): string {
  return [
    line.designation,
    line.operationCode,
    line.operationFamily,
    line.workshopZoneNote,
    line.chefNotes,
  ].filter(Boolean).join(" ");
}

export function mapRepairLineToPlanningStep(line: RepairOrderLine): PlanningStepMapping {
  const normalized = normalizePlanningText(formatStepSearchText(line));
  const matched = PLANNING_STEP_DEFINITIONS
    .flatMap((step, stepIndex) => step.keywords.map(keyword => ({
      step,
      stepIndex,
      normalizedKeyword: normalizePlanningText(keyword),
    })))
    .filter(candidate => normalized.includes(candidate.normalizedKeyword))
    .sort((left, right) =>
      right.normalizedKeyword.length - left.normalizedKeyword.length ||
      left.stepIndex - right.stepIndex
    )[0]?.step;

  const step = matched || DEFAULT_PLANNING_STEP;
  return {
    stepId: step.id,
    label: step.label,
    serviceType: step.serviceType,
    needsConfirmation: !matched,
  };
}

export function getRepairLinePlanningSegments(line: RepairOrderLine): Array<{ start: string; end: string }> {
  if (line.planningSegments && line.planningSegments.length > 0) return line.planningSegments;
  if (line.planningStart && line.planningEnd) return [{ start: line.planningStart, end: line.planningEnd }];
  return [];
}

function roundPlanningHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSegmentHours(segments: Array<{ start: string; end: string }>): number {
  return roundPlanningHours(segments.reduce((sum, segment) => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return sum;
    return sum + ((end.getTime() - start.getTime()) / 3600000);
  }, 0));
}

function findLineReservation(
  dossierId: string,
  lineId: string,
  reservations: WorkshopReservation[]
): WorkshopReservation | undefined {
  return reservations.find(reservation =>
    reservation.dossierId === dossierId &&
    reservation.status !== "ANNULEE" &&
    reservation.taskIds.includes(lineId)
  );
}

function isLineActiveForPlanning(line: RepairOrderLine): boolean {
  return normalizeRepairOrderStatus(line.status) !== "done";
}

export function buildDossierPlanningOverview(
  dossier: DossierSAV,
  reservations: WorkshopReservation[] = []
): DossierPlanningOverview {
  const mappedLines = dossier.ordresReparation
    .filter(isLineActiveForPlanning)
    .map(line => ({
      line,
      mapping: mapRepairLineToPlanningStep(line),
      reservation: findLineReservation(dossier.id, line.id, reservations),
    }));

  const steps = PLANNING_STEP_DEFINITIONS.map(definition => {
    const entries = mappedLines.filter(entry => entry.mapping.stepId === definition.id);
    const lines: PlanningStepLine[] = entries.map(entry => {
      const segments = getRepairLinePlanningSegments(entry.line);
      const segmentHours = getSegmentHours(segments);
      const reservationHours = entry.reservation?.totalHours && entry.reservation.totalHours > 0
        ? entry.reservation.totalHours
        : 0;
      const reservedHours = segmentHours > 0 ? segmentHours : reservationHours;
      const isPlanned = reservedHours > 0 || Boolean(entry.reservation);
      return {
        line: entry.line,
        reservedHours,
        reservation: entry.reservation,
        isPlanned,
        isDurationValidated: Boolean(entry.line.tempsEstime > 0 && entry.line.isEstimatedDurationValidated),
        needsConfirmation: entry.mapping.needsConfirmation,
      };
    });

    const estimatedHours = roundPlanningHours(lines.reduce((sum, item) =>
      item.isDurationValidated ? sum + item.line.tempsEstime : sum, 0
    ));
    const reservedHours = roundPlanningHours(lines.reduce((sum, item) => sum + item.reservedHours, 0));
    const unvalidatedDurationCount = lines.filter(item => !item.isDurationValidated).length;
    const active = lines.length > 0;
    const nextReservableLine = lines.find(item => item.isDurationValidated && !item.isPlanned)?.line;
    const reschedulableLine = lines.find(item => item.isDurationValidated && item.isPlanned)?.line;

    return {
      stepId: definition.id,
      label: definition.label,
      serviceType: definition.serviceType,
      active,
      needsConfirmation: lines.some(item => item.needsConfirmation),
      lines,
      estimatedHours,
      reservedHours,
      unvalidatedDurationCount,
      isFullyReserved: active && unvalidatedDurationCount === 0 && lines.every(item => item.isPlanned),
      nextReservableLine,
      reschedulableLine,
    };
  });

  const totalEstimatedHours = roundPlanningHours(steps.reduce((sum, step) => sum + step.estimatedHours, 0));
  const totalReservedHours = roundPlanningHours(steps.reduce((sum, step) => sum + step.reservedHours, 0));
  const remainingHours = roundPlanningHours(Math.max(0, totalEstimatedHours - totalReservedHours));
  const unvalidatedDurationCount = steps.reduce((sum, step) => sum + step.unvalidatedDurationCount, 0);
  const activeSteps = steps.filter(step => step.active);
  const reservedStepCount = activeSteps.filter(step => step.isFullyReserved).length;
  const unreservedStepCount = activeSteps.length - reservedStepCount;
  const planningComplete =
    activeSteps.length > 0 &&
    unvalidatedDurationCount === 0 &&
    totalEstimatedHours > 0 &&
    totalReservedHours >= totalEstimatedHours &&
    unreservedStepCount === 0;

  return {
    steps,
    totalEstimatedHours,
    totalReservedHours,
    remainingHours,
    workshopMarginHours: remainingHours,
    unvalidatedDurationCount,
    activeStepCount: activeSteps.length,
    reservedStepCount,
    unreservedStepCount,
    planningComplete,
  };
}

export function releasePlanningStepReservation(
  dossier: DossierSAV,
  reservations: WorkshopReservation[],
  stepId: PlanningStepId,
  now: Date = new Date()
): { dossier: DossierSAV; reservations: WorkshopReservation[]; releasedTaskIds: string[] } {
  const overview = buildDossierPlanningOverview(dossier, reservations);
  const step = overview.steps.find(item => item.stepId === stepId);
  const releasedTaskIds = step?.lines
    .filter(item => item.isPlanned)
    .map(item => item.line.id) || [];

  if (releasedTaskIds.length === 0) {
    return { dossier, reservations, releasedTaskIds: [] };
  }

  const releasedSet = new Set(releasedTaskIds);
  const updatedLines = dossier.ordresReparation.map(line => {
    if (!releasedSet.has(line.id)) return line;
    const {
      planningStart,
      planningEnd,
      planningSegments,
      plannedTechnicianId,
      plannedBayId,
      planningDate,
      ...rest
    } = line;
    return rest;
  });

  const stillHasPlanning = updatedLines.some(line => getRepairLinePlanningSegments(line).length > 0);
  const updatedDossier: DossierSAV = {
    ...dossier,
    ordresReparation: updatedLines,
    statut: stillHasPlanning ? dossier.statut : DossierStatus.VEHICULE_RECU,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: `Étape ${step?.label || stepId} libérée du planning atelier.`,
    historiqueLogs: [
      `${now.toISOString()} - Étape ${step?.label || stepId} libérée du planning atelier.`,
      ...(dossier.historiqueLogs || []),
    ],
  };

  const updatedReservations = reservations.map(reservation => {
    if (reservation.dossierId !== dossier.id || !reservation.taskIds.some(taskId => releasedSet.has(taskId))) {
      return reservation;
    }
    return {
      ...reservation,
      status: "ANNULEE" as const,
      history: [
        ...(reservation.history || []),
        `${now.toISOString()} - Réservation libérée depuis l'onglet RDV & Planning.`,
      ],
    };
  });

  return {
    dossier: updatedDossier,
    reservations: updatedReservations,
    releasedTaskIds,
  };
}
