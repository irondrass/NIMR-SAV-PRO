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
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) {
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
