/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 6K-F — Operational workshop task intake helpers.
 */

import { DossierSAV, QuoteLine, RepairOrderLine, WorkshopReservation } from "./types";
import { parseQuoteText } from "./quote-import";
import {
  buildDossierPlanningOverview,
  mapRepairLineToPlanningStep,
  PLANNING_STEP_DEFINITIONS,
  PlanningStepId,
} from "./workshop-planning-steps";

export type WorkshopTaskPriority = "basse" | "normale" | "haute" | "urgente";

export interface ManualWorkshopTaskInput {
  label: string;
  shortDescription?: string;
  stageId: PlanningStepId;
  estimatedHours: number;
  preferredTechnicianId?: string;
  requiredBayId?: string;
  priority?: WorkshopTaskPriority;
  chefComment?: string;
  id?: string;
}

export interface QuoteWorkshopTaskCandidate {
  id: string;
  label: string;
  stageId: PlanningStepId;
  stageLabel: string;
  durationHours: number;
  confidence: QuoteLine["confidence"];
  quoteLineId: string;
  rawText: string;
}

export interface WorkshopStageDurationRow {
  stepId: PlanningStepId;
  label: string;
  taskCount: number;
  durationHours: number;
  reservationStatus: "Non utilisée" | "Non réservé" | "Partiel" | "Réservé";
}

export interface StageReservationNeed {
  stepId: PlanningStepId;
  label: string;
  taskIds: string[];
  totalHours: number;
}

const LEGACY_PHASE_TO_STAGE: Record<string, PlanningStepId> = {
  body: "body-disassembly",
  oilService: "quick-service",
  mechanical: "mechanical",
  electrical: "electrical",
  prep: "preparation",
  paint: "paint",
  reassembly: "reassembly",
  finish: "finish",
  quality: "quality",
};

function generateTaskId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

function cleanText(value: string | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function roundHours(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function getWorkshopStageDefinition(stageId: string | undefined) {
  return PLANNING_STEP_DEFINITIONS.find(step => step.id === stageId);
}

export function mapLegacyPhaseToWorkshopStage(phase: string | undefined): PlanningStepId | undefined {
  return phase ? LEGACY_PHASE_TO_STAGE[phase] : undefined;
}

export function inferWorkshopStageFromTaskText(text: string): { stageId: PlanningStepId; stageLabel: string; needsConfirmation: boolean } {
  const mapping = mapRepairLineToPlanningStep({
    id: "stage_probe",
    designation: text,
    tempsEstime: 0,
    tempsPasse: 0,
    status: "pending",
  });
  return {
    stageId: mapping.stepId,
    stageLabel: mapping.label,
    needsConfirmation: mapping.needsConfirmation,
  };
}

export function createManualWorkshopTaskLine(input: ManualWorkshopTaskInput): RepairOrderLine {
  const label = cleanText(input.label);
  const stage = getWorkshopStageDefinition(input.stageId) || PLANNING_STEP_DEFINITIONS.find(step => step.id === "mechanical")!;
  const estimatedHours = roundHours(input.estimatedHours);
  const details = [
    cleanText(input.shortDescription),
    input.priority ? `Priorité: ${input.priority}` : "",
    cleanText(input.chefComment),
  ].filter(Boolean).join(" | ");

  return {
    id: input.id || generateTaskId("ro_manual"),
    designation: label || "Tâche atelier à préciser",
    tempsEstime: estimatedHours,
    tempsPasse: 0,
    status: "pending",
    estimateSource: "manual",
    isEstimatedDurationValidated: estimatedHours > 0,
    operationFamily: stage.label,
    workshopStageId: stage.id,
    preferredTechnicianId: cleanText(input.preferredTechnicianId) || undefined,
    requiredBayId: cleanText(input.requiredBayId) || undefined,
    taskPriority: input.priority || "normale",
    workshopZoneNote: details || undefined,
    chefNotes: cleanText(input.chefComment) || undefined,
  };
}

export function detectQuoteWorkshopTaskCandidates(text: string): QuoteWorkshopTaskCandidate[] {
  return parseQuoteText(text)
    .filter(line => line.type === "labor" && line.hours > 0)
    .map(line => {
      const stage = inferWorkshopStageFromTaskText(line.description || line.rawText);
      return {
        id: `candidate_${line.id}`,
        label: line.description,
        stageId: stage.stageId,
        stageLabel: stage.stageLabel,
        durationHours: roundHours(line.hours),
        confidence: line.confidence,
        quoteLineId: line.id,
        rawText: line.rawText,
      };
    });
}

export function buildWorkshopStageDurationSummary(
  dossier: DossierSAV,
  reservations: WorkshopReservation[] = []
): WorkshopStageDurationRow[] {
  const overview = buildDossierPlanningOverview(dossier, reservations);
  return overview.steps.map(step => {
    const taskCount = step.lines.length;
    let reservationStatus: WorkshopStageDurationRow["reservationStatus"] = "Non utilisée";
    if (taskCount > 0) {
      reservationStatus = step.isFullyReserved
        ? "Réservé"
        : step.reservedHours > 0
          ? "Partiel"
          : "Non réservé";
    }
    return {
      stepId: step.stepId,
      label: step.label,
      taskCount,
      durationHours: step.estimatedHours,
      reservationStatus,
    };
  });
}

export function buildStageReservationNeeds(
  dossier: DossierSAV,
  reservations: WorkshopReservation[] = []
): StageReservationNeed[] {
  const overview = buildDossierPlanningOverview(dossier, reservations);
  return overview.steps
    .map(step => {
      const lines = step.lines
        .filter(item => item.isDurationValidated && !item.isPlanned)
        .map(item => item.line);
      return {
        stepId: step.stepId,
        label: step.label,
        taskIds: lines.map(line => line.id),
        totalHours: roundHours(lines.reduce((sum, line) => sum + line.tempsEstime, 0)),
      };
    })
    .filter(need => need.taskIds.length > 0 && need.totalHours > 0);
}
