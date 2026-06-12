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
  UserRole,
} from "./types";

export type ActiveComplaintStatus = Exclude<ComplaintStatus, "en_cours" | "classee">;

export const COMPLAINT_STATUSES: ActiveComplaintStatus[] = [
  "nouvelle",
  "en_analyse",
  "action_corrective",
  "attente_client",
  "resolue",
  "cloturee",
  "reouverte",
];

export const COMPLAINT_STATUS_LABELS: Record<ActiveComplaintStatus, string> = {
  nouvelle: "Nouvelle",
  en_analyse: "En analyse",
  action_corrective: "Action corrective en cours",
  attente_client: "En attente client",
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
  const complaint: ReclammationClient = {
    id: createSequentialComplaintId("REC", existingIds, now),
    dossierId: input.dossierId.trim() || "NIMR-GEN",
    clientNom: input.clientNom.trim(),
    vehiculeNom: input.vehiculeNom.trim() || "Véhicule non spécifié",
    immatriculation: input.immatriculation?.trim() || "",
    motif: input.motif.trim(),
    criticite: input.criticite,
    responsable: input.responsable.trim() || "Responsable SAV à affecter",
    statut: "nouvelle",
    actionCorrective: input.actionCorrective?.trim() || "À définir",
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
    comment: input.motif.trim(),
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
  const next: ReclammationClient = {
    ...normalized,
    ...changes,
    statut: normalizeComplaintStatus(normalized.statut),
    delaiTraitement: changes.delaiCible ?? changes.delaiTraitement ?? normalized.delaiTraitement,
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
  const nextAction = actionCorrective.trim();
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
    commentaire: entry.comment?.trim() || "",
    ancienResponsable: entry.oldOwner,
    nouveauResponsable: entry.newOwner,
  };

  const legacyLog = [
    timestamp,
    `${entry.actor.user} (${entry.actor.role})`,
    entry.action,
    entry.comment ? `Commentaire: ${entry.comment}` : "",
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
