/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV, DossierStatus, RepairOrderLine, RepairOrderStatus } from "./types";
import { normalizeRepairOrderStatus } from "./sav-core";

export interface TaskPlanningTarget {
  key: string;
  dossier: DossierSAV;
  line: RepairOrderLine;
}

export function isRepairOrderPlanned(line: RepairOrderLine): boolean {
  return Boolean(line.planningStart && line.planningEnd && line.plannedTechnicianId && line.plannedBayId);
}

export function isRepairOrderPlanifiable(line: RepairOrderLine): boolean {
  return normalizeRepairOrderStatus(line.status) !== "done";
}

export function getUnplannedRepairOrderTargets(dossiers: DossierSAV[]): TaskPlanningTarget[] {
  return dossiers.flatMap(dossier => {
    if (isTerminalPlanningDossier(dossier)) {
      return [];
    }

    return dossier.ordresReparation
      .filter(line => isRepairOrderPlanifiable(line) && !isRepairOrderPlanned(line))
      .map(line => ({
        key: `${dossier.id}::${line.id}`,
        dossier,
        line,
      }));
  });
}

export function findTaskPlanningTarget(
  targets: TaskPlanningTarget[],
  targetKeyOrDossierId: string
): TaskPlanningTarget | undefined {
  return targets.find(target => target.key === targetKeyOrDossierId)
    ?? targets.find(target => target.dossier.id === targetKeyOrDossierId);
}

export function getCurrentGanttTaskStatus(
  dossier: DossierSAV,
  lineId: string,
  fallbackStatus: RepairOrderStatus | string = "pending"
): RepairOrderStatus {
  const currentLine = dossier.ordresReparation.find(line => line.id === lineId);
  return normalizeRepairOrderStatus(currentLine?.status ?? fallbackStatus);
}

export function getRepairOrderPlanningSegments(task: RepairOrderLine): Array<{ start: string; end: string }> {
  if (task.planningSegments && task.planningSegments.length > 0) {
    return task.planningSegments;
  }
  if (task.planningStart && task.planningEnd) {
    return [{ start: task.planningStart, end: task.planningEnd }];
  }
  return [];
}

export function getRepairOrderPlanningSegmentsForDate(
  task: RepairOrderLine,
  dateStr: string
): Array<{ start: string; end: string }> {
  return getRepairOrderPlanningSegments(task).filter(segment => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return false;
    }
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);
    return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
  });
}

export function isTerminalPlanningDossier(dossier: DossierSAV): boolean {
  return (
    dossier.statut === DossierStatus.LIVRE ||
    dossier.statut === DossierStatus.CLOTURE ||
    dossier.statut === DossierStatus.ANNULE ||
    dossier.statut === DossierStatus.PRET_FACTURATION ||
    Boolean(dossier.archiveOperationnelle) ||
    dossier.checklistQC?.validationGlobale === "valide"
  );
}

export function isActivePlannedTask(task: RepairOrderLine, dossier: DossierSAV, dateStr?: string): boolean {
  if (!task.plannedTechnicianId) return false;
  const hasSchedule = getRepairOrderPlanningSegments(task).length > 0;
  if (!hasSchedule) return false;

  if (normalizeRepairOrderStatus(task.status) === "done") return false;
  if (isTerminalPlanningDossier(dossier)) return false;
  if (dateStr && getRepairOrderPlanningSegmentsForDate(task, dateStr).length === 0) return false;
  return true;
}

export type GanttTaskVisualState =
  | "planned_future"
  | "due_now_not_started"
  | "in_progress"
  | "overdue_unfinished"
  | "blocked"
  | "qc_return";

export function getGanttTaskVisualState(task: RepairOrderLine, now: Date, dossier?: DossierSAV): GanttTaskVisualState {
  const status = normalizeRepairOrderStatus(task.status);
  if (status === "blocked") return "blocked";
  if (status === "reopened" || dossier?.retourQualite || dossier?.checklistQC?.validationGlobale === "refuse") {
    return "qc_return";
  }

  const segments = getRepairOrderPlanningSegments(task).sort((a, b) => a.start.localeCompare(b.start));
  const start = segments[0] ? new Date(segments[0].start) : null;
  const end = segments[segments.length - 1] ? new Date(segments[segments.length - 1].end) : null;

  const nowTime = now.getTime();

  if (status === "in_progress") {
    if (end && end.getTime() < nowTime) {
      return "overdue_unfinished";
    }
    return "in_progress";
  }

  if (status === "pending" || status === "paused") {
    if (start && start.getTime() > nowTime) {
      return "planned_future";
    }
    if (end && end.getTime() < nowTime) {
      return "overdue_unfinished";
    }
    return "due_now_not_started";
  }

  return "planned_future";
}

export interface GanttStateVisual {
  label: string;
  className: string;
  badgeClassName: string;
  testId: string;
}

export const GANTT_STATE_VISUALS: Record<GanttTaskVisualState, GanttStateVisual> = {
  planned_future: {
    label: "Planifié",
    className: "bg-blue-50/95 border-blue-400 text-blue-900",
    badgeClassName: "bg-blue-50 text-blue-700 border-blue-100",
    testId: "gantt-task-status-pending",
  },
  due_now_not_started: {
    label: "À démarrer",
    className: "bg-amber-50/95 border-amber-400 text-amber-900 animate-pulse",
    badgeClassName: "bg-amber-50 text-amber-700 border-amber-100",
    testId: "gantt-task-status-due-now",
  },
  in_progress: {
    label: "En cours",
    className: "bg-orange-50/95 border-orange-500 text-orange-900",
    badgeClassName: "bg-orange-50 text-orange-800 border-orange-100",
    testId: "gantt-task-status-in-progress",
  },
  overdue_unfinished: {
    label: "Non terminé",
    className: "bg-rose-50/95 border-rose-500 text-rose-900 font-bold",
    badgeClassName: "bg-rose-50 text-rose-800 border-rose-100",
    testId: "gantt-task-status-overdue",
  },
  blocked: {
    label: "Bloqué",
    className: "bg-red-50/95 border-red-500 text-red-900",
    badgeClassName: "bg-red-50 text-red-800 border-red-100",
    testId: "gantt-task-status-blocked",
  },
  qc_return: {
    label: "Retour QC",
    className: "bg-purple-50/95 border-purple-500 text-purple-900",
    badgeClassName: "bg-purple-50 text-purple-800 border-purple-100",
    testId: "gantt-task-status-reopened",
  },
};
