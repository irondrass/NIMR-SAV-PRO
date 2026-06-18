/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackupPayload, createBackupPayload } from "./sav-core";
import { maskPhoneNumber, sanitizeFreeText } from "./field-validations";
import { ActiviteLog, DossierSAV, ReclammationClient, TechnicienResource, WorkshopReservation } from "./types";

export const PRE_IMPORT_BACKUP_KEY = "nimr-sav-pro-pre-import-backup-v1";
export const STRONG_IMPORT_CONFIRMATION = "Je comprends que l’import remplace les données locales";

export interface ImportSummary {
  dossiers: number;
  reclamations: number;
  techList: number;
  activityLogs: number;
  reservations: number;
  label: string;
}

export function createRoleAwareBackupPayload(
  dossiers: DossierSAV[],
  reclamations: ReclammationClient[],
  techList: TechnicienResource[],
  activityLogs: ActiviteLog[],
  reservations: WorkshopReservation[] | undefined,
  canViewSensitivePhone: boolean
): BackupPayload {
  const payload = createBackupPayload(dossiers, reclamations, techList, activityLogs, reservations);
  if (canViewSensitivePhone) return payload;

  return {
    ...payload,
    dossiers: payload.dossiers.map(maskDossierPhones),
  };
}

export function createPreImportBackupPayload(
  dossiers: DossierSAV[],
  reclamations: ReclammationClient[],
  techList: TechnicienResource[],
  activityLogs: ActiviteLog[],
  reservations?: WorkshopReservation[]
): BackupPayload {
  return createBackupPayload(dossiers, reclamations, techList, activityLogs, reservations);
}

export function buildImportSummary(payload: Partial<BackupPayload>): ImportSummary {
  const summary: ImportSummary = {
    dossiers: payload.dossiers?.length ?? 0,
    reclamations: payload.reclamations?.length ?? 0,
    techList: payload.techList?.length ?? 0,
    activityLogs: payload.activityLogs?.length ?? 0,
    reservations: payload.reservations?.length ?? 0,
    label: "",
  };
  summary.label = [
    `${summary.dossiers} dossier(s)`,
    `${summary.reclamations} réclamation(s)`,
    `${summary.techList} technicien(s)`,
    `${summary.activityLogs} log(s)`,
    `${summary.reservations} réservation(s) atelier`,
  ].join(" · ");
  return summary;
}

export function isStrongImportConfirmation(value: string): boolean {
  return sanitizeFreeText(value) === STRONG_IMPORT_CONFIRMATION;
}

function maskDossierPhones(dossier: DossierSAV): DossierSAV {
  return {
    ...dossier,
    clientTelephone: maskPhoneNumber(dossier.clientTelephone),
    deposantTelephone: maskPhoneNumber(dossier.deposantTelephone),
  };
}
