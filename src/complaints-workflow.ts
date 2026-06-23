/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ComplaintCriticity,
  ComplaintHistoryEntry,
  ComplaintStatus,
  DossierSAV,
  DossierStatus,
  ReclammationClient,
  RepairOrderLine,
  UserRole,
} from "./types";
import { normalizePlateNumber, sanitizeFreeText } from "./field-validations";

export type ActiveComplaintStatus = Exclude<ComplaintStatus, "en_cours" | "classee">;

export const COMPLAINT_STATUSES: ActiveComplaintStatus[] = [
  "nouvelle",
  "en_analyse",
  "action_corrective",
  "attente_client",
  "tache_corrective_creee",
  "en_cours_atelier",
  "attente_qc",
  "action_realisee",
  "rejetee_non_fondee",
  "resolue",
  "cloturee",
  "reouverte",
];

export const COMPLAINT_STATUS_LABELS: Record<ActiveComplaintStatus, string> = {
  nouvelle: "Nouvelle",
  en_analyse: "En analyse",
  action_corrective: "Action corrective en cours",
  attente_client: "En attente client",
  tache_corrective_creee: "Tâche corrective créée",
  en_cours_atelier: "En cours atelier",
  attente_qc: "En attente QC",
  action_realisee: "Action réalisée",
  rejetee_non_fondee: "Rejetée non fondée",
  resolue: "Résolue",
  cloturee: "Clôturée",
  reouverte: "Réouverte",
};

export const COMPLAINT_CRITICITY_LABELS: Record<ComplaintCriticity, string> = {
  basse: "Basse",
  moyenne: "Moyenne",
  haute: "Haute",
  critique: "Critique",
};

export interface ComplaintActor {
  user: string;
  role: UserRole | string;
}

export interface ComplaintInput {
  dossierId: string;
  clientNom: string;
  vehiculeNom: string;
  immatriculation?: string;
  motif: string;
  criticite: ComplaintCriticity;
  responsable: string;
  actionCorrective?: string;
  delaiCible?: string;
}

export interface ComplaintFilters {
  status?: ActiveComplaintStatus | "toutes";
  criticite?: ComplaintCriticity | "toutes";
  responsable?: string;
  dossierId?: string;
  query?: string;
}

const DEFAULT_ACTOR: ComplaintActor = {
  user: "Système NIMR",
  role: "Système",
};

const LEGACY_STATUS_MAP: Record<string, ActiveComplaintStatus> = {
  en_cours: "en_analyse",
  classee: "cloturee",
};

export function normalizeComplaintStatus(status: ComplaintStatus | string): ActiveComplaintStatus {
  if (COMPLAINT_STATUSES.includes(status as ActiveComplaintStatus)) {
    return status as ActiveComplaintStatus;
  }
  return LEGACY_STATUS_MAP[String(status)] ?? "nouvelle";
}

export function createComplaint(
  input: ComplaintInput,
  existingIds: string[] = [],
  actor: ComplaintActor = DEFAULT_ACTOR,
  now = new Date()
): ReclammationClient {
  const timestamp = now.toISOString();
  const motif = sanitizeFreeText(input.motif);
  const complaint: ReclammationClient = {
    id: createSequentialComplaintId("REC", existingIds, now),
    dossierId: sanitizeFreeText(input.dossierId) || "NIMR-GEN",
    clientNom: sanitizeFreeText(input.clientNom),
    vehiculeNom: sanitizeFreeText(input.vehiculeNom) || "Véhicule non spécifié",
    immatriculation: normalizePlateNumber(input.immatriculation || ""),
    motif,
    criticite: input.criticite,
    responsable: sanitizeFreeText(input.responsable) || "Responsable SAV à affecter",
    statut: "nouvelle",
    actionCorrective: sanitizeFreeText(input.actionCorrective || "") || "À définir",
    delaiCible: input.delaiCible || "",
    delaiTraitement: input.delaiCible || "À définir",
    dateCreation: timestamp,
    dateDerniereModification: timestamp,
    historiqueActions: [],
    historiqueLogs: [],
  };

  return appendComplaintHistory(complaint, {
    actor,
    action: "Création réclamation",
    newStatus: "nouvelle",
    comment: motif,
    now,
  });
}

export function updateComplaint(
  complaint: ReclammationClient,
  changes: Partial<Pick<ReclammationClient, "motif" | "criticite" | "actionCorrective" | "delaiCible" | "delaiTraitement" | "immatriculation" | "vehiculeNom" | "clientNom">>,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "Mise à jour réclamation",
  now = new Date()
): ReclammationClient {
  assertComplaintEditable(complaint);
  const normalized = normalizeComplaint(complaint);
  const sanitizedChanges = { ...changes };
  if (changes.motif !== undefined) sanitizedChanges.motif = sanitizeFreeText(changes.motif);
  if (changes.actionCorrective !== undefined) sanitizedChanges.actionCorrective = sanitizeFreeText(changes.actionCorrective);
  if (changes.immatriculation !== undefined) sanitizedChanges.immatriculation = normalizePlateNumber(changes.immatriculation);
  if (changes.vehiculeNom !== undefined) sanitizedChanges.vehiculeNom = sanitizeFreeText(changes.vehiculeNom);
  if (changes.clientNom !== undefined) sanitizedChanges.clientNom = sanitizeFreeText(changes.clientNom);
  const next: ReclammationClient = {
    ...normalized,
    ...sanitizedChanges,
    statut: normalizeComplaintStatus(normalized.statut),
    delaiTraitement: sanitizedChanges.delaiCible ?? sanitizedChanges.delaiTraitement ?? normalized.delaiTraitement,
  };

  return appendComplaintHistory(next, {
    actor,
    action: "Modification réclamation",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: normalizeComplaintStatus(next.statut),
    comment,
    now,
  });
}

export function linkComplaintToRepairOrder(
  complaint: ReclammationClient,
  repairOrderId: string,
  actor: ComplaintActor = DEFAULT_ACTOR,
  now = new Date()
): ReclammationClient {
  assertComplaintEditable(complaint);
  const normalized = normalizeComplaint(complaint);
  const safeRepairOrderId = sanitizeFreeText(repairOrderId);
  if (!safeRepairOrderId) {
    throw new Error("Tâche atelier obligatoire pour lier la réclamation.");
  }

  const linkedRepairOrderIds = Array.from(new Set([
    ...(normalized.linkedRepairOrderIds ?? []),
    safeRepairOrderId,
  ]));
  const nextStatus = normalizeComplaintStatus(normalized.statut) === "nouvelle"
    ? "en_analyse"
    : normalizeComplaintStatus(normalized.statut);

  return appendComplaintHistory({
    ...normalized,
    statut: nextStatus,
    linkedDossierId: normalized.linkedDossierId || normalized.dossierId,
    linkedRepairOrderIds,
  }, {
    actor,
    action: "Réclamation liée à une tâche atelier",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: nextStatus,
    comment: `Tâche liée: ${safeRepairOrderId}`,
    now,
  });
}

export function createCorrectiveTaskFromComplaint(
  complaint: ReclammationClient,
  existingRepairOrderIds: string[] = [],
  actor: ComplaintActor = DEFAULT_ACTOR,
  now = new Date()
): { complaint: ReclammationClient; line: RepairOrderLine } {
  assertComplaintEditable(complaint);
  const normalized = normalizeComplaint(complaint);
  const taskId = normalized.correctiveTaskId || createCorrectiveTaskId(normalized, existingRepairOrderIds);
  const line: RepairOrderLine = {
    id: taskId,
    designation: `Action corrective réclamation ${normalized.id}: ${sanitizeFreeText(normalized.motif).slice(0, 90)}`,
    tempsEstime: 0,
    tempsPasse: 0,
    status: "pending",
    estimateSource: "manual",
    isEstimatedDurationValidated: false,
    sourceComplaintId: normalized.id,
    complaintSeverity: normalized.criticite,
    complaintBadge: true,
    workshopZoneNote: "Réclamation client à traiter en atelier avant QC.",
  };

  const nextComplaint = appendComplaintHistory({
    ...normalized,
    statut: "tache_corrective_creee",
    linkedDossierId: normalized.linkedDossierId || normalized.dossierId,
    linkedRepairOrderIds: Array.from(new Set([
      ...(normalized.linkedRepairOrderIds ?? []),
      taskId,
    ])),
    correctiveTaskCreated: true,
    correctiveTaskId: taskId,
    actionCorrective: normalized.actionCorrective || "Tâche corrective atelier créée",
  }, {
    actor,
    action: "Tâche corrective atelier créée",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: "tache_corrective_creee",
    comment: `Tâche corrective: ${taskId}`,
    now,
  });

  return { complaint: nextComplaint, line };
}

export function applyComplaintTaskLinkToDossier(
  dossier: DossierSAV,
  complaint: ReclammationClient,
  repairOrderId: string,
  now = new Date()
): DossierSAV {
  const normalized = normalizeComplaint(complaint);
  const safeRepairOrderId = sanitizeFreeText(repairOrderId);
  const nextLines = dossier.ordresReparation.map(line => line.id === safeRepairOrderId
    ? {
      ...line,
      sourceComplaintId: normalized.id,
      complaintSeverity: normalized.criticite,
      complaintBadge: true,
    }
    : line
  );

  return {
    ...dossier,
    ordresReparation: nextLines,
    historiqueLogs: [
      `${now.toISOString()} - Réclamation ${normalized.id} liée à la tâche ${safeRepairOrderId}.`,
      ...(dossier.historiqueLogs ?? []),
    ],
    dateDernierStatut: now.toISOString(),
  };
}

export function addCorrectiveComplaintTaskToDossier(
  dossier: DossierSAV,
  line: RepairOrderLine,
  complaint: ReclammationClient,
  now = new Date()
): DossierSAV {
  const normalized = normalizeComplaint(complaint);
  const alreadyExists = dossier.ordresReparation.some(current => current.id === line.id);
  return {
    ...dossier,
    ordresReparation: alreadyExists
      ? dossier.ordresReparation.map(current => current.id === line.id ? line : current)
      : [...dossier.ordresReparation, line],
    historiqueLogs: [
      `${now.toISOString()} - Tâche corrective ${line.id} créée depuis réclamation ${normalized.id}.`,
      ...(dossier.historiqueLogs ?? []),
    ],
    dateDernierStatut: now.toISOString(),
  };
}

export function changeComplaintStatus(
  complaint: ReclammationClient,
  nextStatus: ActiveComplaintStatus,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "",
  now = new Date()
): ReclammationClient {
  const normalized = normalizeComplaint(complaint);
  const previousStatus = normalizeComplaintStatus(normalized.statut);
  if (previousStatus === "cloturee" && nextStatus !== "reouverte") {
    throw new Error("Une réclamation clôturée doit être réouverte avant modification.");
  }

  return appendComplaintHistory({
    ...normalized,
    statut: nextStatus,
  }, {
    actor,
    action: `Statut réclamation: ${COMPLAINT_STATUS_LABELS[nextStatus]}`,
    oldStatus: previousStatus,
    newStatus: nextStatus,
    comment,
    now,
  });
}

export function assignComplaintOwner(
  complaint: ReclammationClient,
  responsable: string,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "",
  now = new Date()
): ReclammationClient {
  assertComplaintEditable(complaint);
  const normalized = normalizeComplaint(complaint);
  const nextOwner = responsable.trim() || "Responsable SAV à affecter";

  return appendComplaintHistory({
    ...normalized,
    responsable: nextOwner,
  }, {
    actor,
    action: "Affectation responsable",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: normalizeComplaintStatus(normalized.statut),
    oldOwner: normalized.responsable,
    newOwner: nextOwner,
    comment,
    now,
  });
}

export function addComplaintAction(
  complaint: ReclammationClient,
  actionCorrective: string,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "",
  now = new Date()
): ReclammationClient {
  assertComplaintEditable(complaint);
  const normalized = normalizeComplaint(complaint);
  const nextAction = sanitizeFreeText(actionCorrective);
  if (!nextAction) {
    throw new Error("L'action corrective est obligatoire.");
  }

  return appendComplaintHistory({
    ...normalized,
    actionCorrective: nextAction,
  }, {
    actor,
    action: "Action corrective ajoutée",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: normalizeComplaintStatus(normalized.statut),
    comment: comment || nextAction,
    now,
  });
}

export function closeComplaint(
  complaint: ReclammationClient,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "Clôture réclamation",
  now = new Date()
): ReclammationClient {
  return changeComplaintStatus(complaint, "cloturee", actor, comment, now);
}

export function reopenComplaint(
  complaint: ReclammationClient,
  actor: ComplaintActor = DEFAULT_ACTOR,
  comment = "Réouverture réclamation",
  now = new Date()
): ReclammationClient {
  const normalized = normalizeComplaint(complaint);
  return appendComplaintHistory({
    ...normalized,
    statut: "reouverte",
  }, {
    actor,
    action: "Réouverture réclamation",
    oldStatus: normalizeComplaintStatus(normalized.statut),
    newStatus: "reouverte",
    comment,
    now,
  });
}

export function getComplaintTimeline(complaint: ReclammationClient): ComplaintHistoryEntry[] {
  return normalizeComplaint(complaint).historiqueActions ?? [];
}

export function isComplaintOverdue(complaint: ReclammationClient, now = new Date()): boolean {
  const normalized = normalizeComplaint(complaint);
  const status = normalizeComplaintStatus(normalized.statut);
  if (status === "resolue" || status === "cloturee") return false;

  const deadline = parseComplaintDeadline(normalized.delaiCible || normalized.delaiTraitement);
  return Boolean(deadline && deadline.getTime() < now.getTime());
}

export function filterComplaints(complaints: ReclammationClient[], filters: ComplaintFilters): ReclammationClient[] {
  const statusFilter = filters.status && filters.status !== "toutes" ? filters.status : null;
  const criticityFilter = filters.criticite && filters.criticite !== "toutes" ? filters.criticite : null;
  const ownerFilter = filters.responsable?.trim().toLowerCase() || "";
  const dossierFilter = filters.dossierId?.trim().toLowerCase() || "";
  const query = filters.query?.trim().toLowerCase() || "";

  return complaints
    .map(normalizeComplaint)
    .filter(complaint => {
      const status = normalizeComplaintStatus(complaint.statut);
      const matchesStatus = !statusFilter || status === statusFilter;
      const matchesCriticity = !criticityFilter || complaint.criticite === criticityFilter;
      const matchesOwner = !ownerFilter || complaint.responsable.toLowerCase().includes(ownerFilter);
      const matchesDossier = !dossierFilter || complaint.dossierId.toLowerCase().includes(dossierFilter);
      const haystack = [
        complaint.id,
        complaint.dossierId,
        complaint.clientNom,
        complaint.vehiculeNom,
        complaint.immatriculation ?? "",
        complaint.motif,
        complaint.responsable,
      ].join(" ").toLowerCase();
      return matchesStatus && matchesCriticity && matchesOwner && matchesDossier && (!query || haystack.includes(query));
    });
}

export function canEditComplaint(role: UserRole, complaint: ReclammationClient): boolean {
  if (role === UserRole.LECTURE_SEULE || role === UserRole.TECHNICIEN) return false;
  if (normalizeComplaintStatus(complaint.statut) === "cloturee") return false;
  return [
    UserRole.DIRECTEUR_SAV,
    UserRole.RECEPTIONNAIRE,
    UserRole.CHEF_ATELIER,
    UserRole.CONTROLE_QUALITE,
  ].includes(role);
}

export function canCreateComplaint(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.RECEPTIONNAIRE;
}

export function canReopenComplaint(role: UserRole, complaint: ReclammationClient): boolean {
  return (
    [UserRole.DIRECTEUR_SAV, UserRole.RECEPTIONNAIRE].includes(role) &&
    normalizeComplaintStatus(complaint.statut) === "cloturee"
  );
}

export function isComplaintOpen(complaint: ReclammationClient): boolean {
  const status = normalizeComplaintStatus(complaint.statut);
  return status !== "resolue" && status !== "cloturee";
}

export function isComplaintLinkedToReadyDelivery(complaint: ReclammationClient, dossiers: DossierSAV[]): boolean {
  const dossier = dossiers.find(current => current.id === complaint.dossierId);
  return dossier?.statut === DossierStatus.PRET_A_LIVRER;
}

export function normalizeComplaint(complaint: ReclammationClient): ReclammationClient {
  const status = normalizeComplaintStatus(complaint.statut);
  const delaiCible = complaint.delaiCible ?? complaint.delaiTraitement ?? "";
  const historiqueActions = complaint.historiqueActions && complaint.historiqueActions.length > 0
    ? complaint.historiqueActions
    : legacyLogsToTimeline(complaint);

  return {
    ...complaint,
    statut: status,
    criticite: complaint.criticite || "moyenne",
    immatriculation: complaint.immatriculation ?? extractPlateFromVehicleName(complaint.vehiculeNom),
    delaiCible,
    delaiTraitement: complaint.delaiTraitement || delaiCible || "À définir",
    dateDerniereModification: complaint.dateDerniereModification ?? complaint.dateCreation,
    historiqueActions,
    historiqueLogs: complaint.historiqueLogs ?? [],
  };
}

function appendComplaintHistory(
  complaint: ReclammationClient,
  entry: {
    actor: ComplaintActor;
    action: string;
    oldStatus?: ActiveComplaintStatus;
    newStatus?: ActiveComplaintStatus;
    oldOwner?: string;
    newOwner?: string;
    comment?: string;
    now: Date;
  }
): ReclammationClient {
  const normalized = normalizeComplaint(complaint);
  const timestamp = entry.now.toISOString();
  const historyEntry: ComplaintHistoryEntry = {
    id: `hist_${entry.now.getTime()}_${(normalized.historiqueActions?.length ?? 0) + 1}`,
    date: timestamp,
    utilisateur: entry.actor.user,
    role: entry.actor.role,
    action: entry.action,
    ancienStatut: entry.oldStatus,
    nouveauStatut: entry.newStatus,
    commentaire: sanitizeFreeText(entry.comment || ""),
    ancienResponsable: entry.oldOwner,
    nouveauResponsable: entry.newOwner,
  };

  const legacyLog = [
    timestamp,
    `${entry.actor.user} (${entry.actor.role})`,
    entry.action,
    entry.comment ? `Commentaire: ${sanitizeFreeText(entry.comment)}` : "",
  ].filter(Boolean).join(" - ");

  return {
    ...normalized,
    statut: normalizeComplaintStatus(normalized.statut),
    dateDerniereModification: timestamp,
    historiqueActions: [historyEntry, ...(normalized.historiqueActions ?? [])],
    historiqueLogs: [legacyLog, ...(normalized.historiqueLogs ?? [])],
  };
}

function assertComplaintEditable(complaint: ReclammationClient) {
  if (normalizeComplaintStatus(complaint.statut) === "cloturee") {
    throw new Error("Une réclamation clôturée n'est pas modifiable sans réouverture.");
  }
}

function createSequentialComplaintId(prefix: string, existingIds: string[], now: Date): string {
  const year = now.getFullYear();
  const marker = `${prefix}-${year}-`;
  const maxSequence = existingIds.reduce((max, id) => {
    if (!id.startsWith(marker)) return max;
    const sequence = Number(id.slice(marker.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${marker}${String(maxSequence + 1).padStart(3, "0")}`;
}

function createCorrectiveTaskId(complaint: ReclammationClient, existingIds: string[]): string {
  const base = complaint.id.replace(/[^A-Z0-9]+/gi, "_").toLowerCase();
  const marker = `task_${base}_`;
  const maxSequence = existingIds.reduce((max, id) => {
    if (!id.startsWith(marker)) return max;
    const sequence = Number(id.slice(marker.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${marker}${String(maxSequence + 1).padStart(2, "0")}`;
}

function parseComplaintDeadline(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function legacyLogsToTimeline(complaint: ReclammationClient): ComplaintHistoryEntry[] {
  return (complaint.historiqueLogs ?? []).map((log, index) => {
    const dateCandidate = log.split(" - ")[0];
    const parsedDate = new Date(dateCandidate);
    const date = Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : complaint.dateCreation;
    return {
      id: `legacy_${complaint.id}_${index}`,
      date,
      utilisateur: "Historique importé",
      role: "Système",
      action: log,
      nouveauStatut: normalizeComplaintStatus(complaint.statut),
      commentaire: "",
    };
  });
}

function extractPlateFromVehicleName(vehicleName: string): string {
  const plateMatch = vehicleName.match(/\b\d{1,4}\s*TU\s*\d{1,4}\b/i);
  return plateMatch ? plateMatch[0].replace(/\s+/g, " ").toUpperCase() : "";
}
