/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActiviteLog,
  AtelierZone,
  CameraPhoto,
  ChecklistQualite,
  DeliveryProtocole,
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  PHOTO_CATEGORIES,
  PhotoCategory,
  ReclammationClient,
  RepairOrderLine,
  RepairOrderStatus,
  TechnicienResource,
  UserRole,
  WorkshopBay,
  WorkshopReservation,
  WorkshopAvailabilityConfig,
} from "./types";
import { createComplaint } from "./complaints-workflow";
import {
  validateAvailabilityForSlot,
  isTechnicianAbsent,
  isBayUnavailable,
  getEffectiveWorkshopWindows,
  findNextAvailableWorkingSlot,
  getAbsenceIntervalsOnDay,
  getBayUnavailabilityIntervalsOnDay
} from "./workshop-availability";

const DELIVERY_OFFSET_MS = 48 * 3600 * 1000;
const WORKDAY_START_HOUR = 8;
const LUNCH_START_HOUR = 12;
const LUNCH_END_HOUR = 13;
const WORKDAY_END_HOUR = 17;
let runtimeFallbackCounter = 0;

type RecordLike = Record<string, unknown>;

export interface BackupPayload {
  dossiers: DossierSAV[];
  reclamations: ReclammationClient[];
  techList: TechnicienResource[];
  activityLogs: ActiviteLog[];
  reservations?: WorkshopReservation[];
}

export interface ReceptionPhotoInput {
  id: string;
  url: string;
  title: string;
  date: string;
  category?: PhotoCategory;
  takenBy?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export type DossierPhotoInput = Omit<CameraPhoto, "takenBy" | "category"> & {
  takenBy?: string;
  category?: PhotoCategory;
};

export interface ReceptionDossierInput {
  clientNom: string;
  clientTelephone: string;
  deposantNom: string;
  deposantTelephone: string;
  vehiculeMarque: string;
  vehiculeModele: string;
  vehiculeImmatriculation: string;
  vehiculeVIN: string;
  vehiculeKilometrage: number;
  vehiculeCouleur: string;
  typeDossier: InterventionType;
  priorite: DossierPriority;
  plainteClient: string;
  observationsReception: string;
  photosAvant: ReceptionPhotoInput[];
  niveauCarburant: number;
  etatCarrosserie: {
    rayures: boolean;
    bosses: boolean;
    fissureParbrise: boolean;
    jantesAbimees: boolean;
    autresNotes: string;
  };
  objetsLaisses: string[];
}

export interface ReclamationInput {
  dossierId: string;
  clientNom: string;
  vehiculeNom: string;
  immatriculation?: string;
  motif: string;
  criticite: ReclammationClient["criticite"];
  responsable: string;
  actionCorrective: string;
  delaiCible?: string;
}

export interface WorkshopSlotSuggestionInput {
  dossiers: DossierSAV[];
  technicians: TechnicienResource[];
  workshopBays: WorkshopBay[];
  estimatedHours: number;
  desiredDate: Date | string;
  dossierId?: string;
  reservations?: WorkshopReservation[];
  availabilityConfig?: WorkshopAvailabilityConfig;
}

export interface WorkshopSlotSuggestion {
  technicianId: string;
  technicianName: string;
  bayId: string;
  bayName: string;
  startTime: string;
  endTime: string;
  segments: Array<{ start: string; end: string }>;
  reason: string;
  technicianLoad: number;
  bayAvailability: string;
}

export type PlanningBlockingCode =
  | "planning-collision-tech"
  | "planning-collision-bay"
  | "planning-collision-overload"
  | "planning-collision-hours"
  | "planning-collision-saturday-afternoon"
  | "planning-collision-sunday"
  | "planning-collision-lunch"
  | "planning-segments-invalid"
  | "planning-in-past"
  | "planning-tech-not-found"
  | "planning-bay-not-found"
  | "planning-task-not-found"
  | "planning-dossier-not-found"
  | "planning-duration-missing"
  | "planning-duration-not-validated"
  | "workshop-closed"
  | "workshop-holiday"
  | "technician-absent"
  | "bay-unavailable"
  | "outside-effective-working-hours";

export interface PlanningAssignmentInput {
  dossiers: DossierSAV[];
  dossierId: string;
  lineId: string;
  technicianId: string;
  bayId: string;
  start: Date | string;
  end: Date | string;
  planningSegments?: Array<{ start: string; end: string }>;
  technicianDailyCapacityHours?: number;
  technicians?: TechnicienResource[];
  workshopBays?: WorkshopBay[];
  reservations?: WorkshopReservation[];
  availabilityConfig?: WorkshopAvailabilityConfig;
}

export interface PlanningAssignmentValidation {
  allowed: boolean;
  codes: PlanningBlockingCode[];
  reasons: string[];
  segments: Array<{ start: string; end: string }>;
}

export interface DossierDeliveryGate {
  allowed: boolean;
  reasons: string[];
}

export type TaskMutationResult =
  | { ok: true; dossiers: DossierSAV[]; dossier: DossierSAV; line: RepairOrderLine }
  | { ok: false; error: string };

export function createRuntimeId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  runtimeFallbackCounter += 1;
  return `${prefix}_${runtimeFallbackCounter}`;
}

export function createSequentialBusinessId(prefix: string, existingIds: string[], now = new Date()): string {
  const year = now.getFullYear();
  const marker = `${prefix}-${year}-`;
  const maxSequence = existingIds.reduce((max, id) => {
    if (!id.startsWith(marker)) return max;
    const sequence = Number(id.slice(marker.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${marker}${String(maxSequence + 1).padStart(3, "0")}`;
}

export function createReceptionDossier(
  input: ReceptionDossierInput,
  existingIds: string[],
  now = new Date()
): DossierSAV {
  const receptionDate = now.toISOString();
  const deliveryDate = new Date(now.getTime() + DELIVERY_OFFSET_MS).toISOString();
  const safeKilometrage = Number.isFinite(input.vehiculeKilometrage) ? input.vehiculeKilometrage : 0;
  const fuelLevel = Math.min(100, Math.max(0, input.niveauCarburant));

  return {
    id: createSequentialBusinessId("NIMR", existingIds, now),
    clientNom: input.clientNom.trim() || "Client Inconnu",
    clientTelephone: input.clientTelephone.trim() || "+216 20 000 000",
    deposantNom: input.deposantNom.trim() || input.clientNom.trim() || "Déposant",
    deposantTelephone: input.deposantTelephone.trim() || input.clientTelephone.trim() || "+216 20 000 000",
    vehiculeMarque: input.vehiculeMarque,
    vehiculeModele: input.vehiculeModele.trim() || "Modèle standard",
    vehiculeImmatriculation: input.vehiculeImmatriculation.trim() || "000 TU 0000",
    vehiculeVIN: input.vehiculeVIN.trim() || "17-VIN-PLACEHOLDER",
    vehiculeKilometrage: Math.max(0, safeKilometrage),
    vehiculeCouleur: input.vehiculeCouleur.trim() || "Non spécifiée",
    typeDossier: input.typeDossier,
    priorite: input.priorite,
    plainteClient: input.plainteClient.trim() || "R.A.S. - Entretien périodique",
    observationsReception: input.observationsReception.trim() || "Aucune observation particulière",
    photosAvant: input.photosAvant.map((photo): CameraPhoto => ({
      ...photo,
      title: photo.title.trim() || "Photo réception",
      category: normalizePhotoCategory(photo.category),
      takenBy: photo.takenBy || "Conseiller Client NIMR",
    })),
    niveauCarburant: fuelLevel,
    etatCarrosserie: input.etatCarrosserie,
    objetsLaisses: input.objetsLaisses,
    dateReception: receptionDate,
    dateSouhaiteeLivraison: deliveryDate,
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: createRuntimeId("ro_auto"),
        designation: `Opération initiale: ${input.typeDossier}`,
        tempsEstime: 2.5,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "preset" as const,
        isEstimatedDurationValidated: false,
      },
      {
        id: createRuntimeId("ro_auto"),
        designation: "Contrôle global NIMR Premium (28 points de contrôle)",
        tempsEstime: 1.0,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "preset" as const,
        isEstimatedDurationValidated: false,
      },
    ],
    complements: [],
    accords: [],
    checklistQC: createEmptyChecklist(),
    livraison: createDeliveryProtocol(deliveryDate),
    prochaineActionRecommended: "Affecter à un technicien selon disponibilité atelier",
    dateDernierStatut: receptionDate,
    avancementGlobal: 10,
    historiqueLogs: [`${receptionDate} - Dossier créé en réception.`],
  };
}

export function createReclamationClient(
  input: ReclamationInput,
  existingIds: string[],
  now = new Date()
): ReclammationClient {
  return createComplaint(input, existingIds, {
    user: "Utilisateur NIMR",
    role: "Système",
  }, now);
}

export function assignTechnicianToDossier(dossier: DossierSAV, techId: string, now = new Date()): DossierSAV {
  return {
    ...dossier,
    technicienId: techId,
    statut: DossierStatus.EN_TRAVAUX,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: "Suivre la réalisation des ordres de travaux de réparation",
  };
}

export function normalizeRepairOrderStatus(status: string): RepairOrderStatus {
  const legacyStatuses: Record<string, RepairOrderStatus> = {
    non_commence: "pending",
    en_cours: "in_progress",
    suspendu: "paused",
    termine: "done",
  };

  if (legacyStatuses[status]) return legacyStatuses[status];
  if (["pending", "in_progress", "paused", "blocked", "done", "reopened"].includes(status)) {
    return status as RepairOrderStatus;
  }
  return "pending";
}

export function getRepairOrderStatusLabel(status: string): string {
  const labels: Record<RepairOrderStatus, string> = {
    pending: "à faire",
    in_progress: "en cours",
    paused: "suspendue",
    blocked: "bloquée",
    done: "terminée",
    reopened: "réouverte",
  };
  return labels[normalizeRepairOrderStatus(status)];
}

export function isRepairOrderDone(line: RepairOrderLine): boolean {
  return normalizeRepairOrderStatus(line.status) === "done";
}

export type DossierOperationalBucket = "active" | "ready_for_billing" | "delivered" | "closed";

const ARCHIVED_OR_ERP_READY_STATUSES = new Set<DossierStatus>([
  DossierStatus.PRET_FACTURATION,
  DossierStatus.LIVRE,
  DossierStatus.CLOTURE,
]);

const TECHNICIAN_VISIBLE_TASK_STATUSES = new Set<RepairOrderStatus>([
  "pending",
  "in_progress",
  "paused",
  "blocked",
  "reopened",
]);

export function isOperationalActiveDossier(dossier: DossierSAV): boolean {
  return !ARCHIVED_OR_ERP_READY_STATUSES.has(dossier.statut);
}

export function isArchivedOrErpReadyDossier(dossier: DossierSAV): boolean {
  return ARCHIVED_OR_ERP_READY_STATUSES.has(dossier.statut);
}

export function getVisibleTechnicianTasks(dossier: DossierSAV, technicianId: string): RepairOrderLine[] {
  if (!technicianId || !isOperationalActiveDossier(dossier)) {
    return [];
  }

  return dossier.ordresReparation.filter(line => {
    const assignedToTechnician = line.plannedTechnicianId === technicianId ||
      (!line.plannedTechnicianId && dossier.technicienId === technicianId);
    return assignedToTechnician && TECHNICIAN_VISIBLE_TASK_STATUSES.has(normalizeRepairOrderStatus(line.status));
  });
}

export function shouldShowDossierForTechnician(dossier: DossierSAV, technicianId: string): boolean {
  return getVisibleTechnicianTasks(dossier, technicianId).length > 0;
}

export function getDossierOperationalBucket(dossier: DossierSAV): DossierOperationalBucket {
  if (dossier.statut === DossierStatus.PRET_FACTURATION) return "ready_for_billing";
  if (dossier.statut === DossierStatus.LIVRE) return "delivered";
  if (dossier.statut === DossierStatus.CLOTURE) return "closed";
  return "active";
}

export function normalizeDossierForRuntime(dossier: DossierSAV): DossierSAV {
  return {
    ...dossier,
    photosAvant: dossier.photosAvant.map(photo => ({
      ...photo,
      title: photo.title || "Photo dossier",
      date: photo.date || new Date().toISOString(),
      takenBy: photo.takenBy || "Utilisateur NIMR",
      category: normalizePhotoCategory(photo.category),
    })),
    ordresReparation: dossier.ordresReparation.map(line => ({
      ...line,
      status: normalizeRepairOrderStatus(line.status),
      history: line.history ?? [],
    })),
    historiqueLogs: dossier.historiqueLogs ?? [],
  };
}

export function addPhotoToDossier(dossier: DossierSAV, photo: DossierPhotoInput, now = new Date()): DossierSAV {
  const normalized = normalizeDossierForRuntime(dossier);
  const timestamp = now.toISOString();
  const newPhoto: CameraPhoto = {
    ...photo,
    title: photo.title.trim() || "Photo dossier",
    date: photo.date || timestamp,
    takenBy: photo.takenBy || "Utilisateur NIMR",
    category: normalizePhotoCategory(photo.category),
  };

  return {
    ...normalized,
    photosAvant: [...normalized.photosAvant, newPhoto],
    dateDernierStatut: timestamp,
    historiqueLogs: [`${timestamp} - Photo ajoutée: ${newPhoto.title} (${newPhoto.category}).`, ...normalized.historiqueLogs],
  };
}

export function removePhotoFromDossier(dossier: DossierSAV, photoId: string, now = new Date()): DossierSAV {
  const normalized = normalizeDossierForRuntime(dossier);
  const removedPhoto = normalized.photosAvant.find(photo => photo.id === photoId);
  const timestamp = now.toISOString();

  return {
    ...normalized,
    photosAvant: normalized.photosAvant.filter(photo => photo.id !== photoId),
    dateDernierStatut: timestamp,
    historiqueLogs: removedPhoto
      ? [`${timestamp} - Photo supprimée: ${removedPhoto.title}.`, ...normalized.historiqueLogs]
      : normalized.historiqueLogs,
  };
}

export function startRepairOrder(dossiers: DossierSAV[], dossierId: string, lineId: string, now = new Date()): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ dossier, line, normalizedDossiers }) => {
    const status = normalizeRepairOrderStatus(line.status);
    if (status === "done") {
      return { ok: false, error: "Une tâche terminée doit être réouverte avant reprise." };
    }
    if (status === "blocked") {
      return { ok: false, error: "Lever le blocage avant de reprendre la tâche." };
    }

    const assignedTechnicianId = line.plannedTechnicianId || dossier.technicienId;
    if (!assignedTechnicianId) {
      return { ok: false, error: "Affecter un technicien avant de démarrer la tâche." };
    }

    const activeLineInDossier = dossier.ordresReparation.find(
      current => current.id !== lineId && normalizeRepairOrderStatus(current.status) === "in_progress"
    );
    if (activeLineInDossier) {
      return { ok: false, error: "Une tâche est déjà en cours pour ce dossier." };
    }

    if (assignedTechnicianId) {
      const activeForTechnician = normalizedDossiers.find(currentDossier =>
        currentDossier.ordresReparation.some(current => 
          normalizeRepairOrderStatus(current.status) === "in_progress" &&
          (current.plannedTechnicianId === assignedTechnicianId || (!current.plannedTechnicianId && currentDossier.technicienId === assignedTechnicianId))
        )
      );
      if (activeForTechnician) {
        return { ok: false, error: "Ce technicien a déjà une tâche en cours." };
      }
    }

    return {
      ok: true,
      line: appendLineHistory({ ...line, status: "in_progress" }, now, "Tâche démarrée."),
      dossierChanges: {
        statut: DossierStatus.EN_TRAVAUX,
        technicienId: assignedTechnicianId,
        bloqueRaison: "",
        prochaineActionRecommended: "Terminer la tâche en cours avant d'en démarrer une autre",
      },
      dossierLog: `Tâche "${line.designation}" ${status === "paused" ? "reprise" : "démarrée"}`,
    };
  });
}

export function releaseRepairOrderBlock(
  dossiers: DossierSAV[],
  dossierId: string,
  lineId: string,
  userRole: UserRole,
  reason: string,
  now = new Date()
): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ line }) => {
    if (![UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole)) {
      return { ok: false, error: "Seul le Directeur SAV ou le Chef Atelier peut lever un blocage." };
    }
    if (!reason.trim()) {
      return { ok: false, error: "Le motif de levée de blocage est obligatoire." };
    }
    if (normalizeRepairOrderStatus(line.status) !== "blocked") {
      return { ok: false, error: "Seule une tâche bloquée peut être débloquée." };
    }

    return {
      ok: true,
      line: appendLineHistory({ ...line, status: "paused" }, now, `Blocage levé: ${reason.trim()}`),
      dossierChanges: {
        statut: DossierStatus.TRAVAUX_PLANIFIES,
        bloqueRaison: "",
        prochaineActionRecommended: "Reprendre la tâche après levée du blocage",
      },
      dossierLog: `Levée de blocage tâche ${line.designation}: ${reason.trim()}`,
    };
  });
}

export function pauseRepairOrder(dossiers: DossierSAV[], dossierId: string, lineId: string, now = new Date()): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ line }) => {
    if (normalizeRepairOrderStatus(line.status) !== "in_progress") {
      return { ok: false, error: "Seule une tâche en cours peut être suspendue." };
    }
    return {
      ok: true,
      line: appendLineHistory({ ...line, status: "paused" }, now, "Tâche suspendue."),
      dossierChanges: {
        statut: DossierStatus.TRAVAUX_PLANIFIES,
        prochaineActionRecommended: "Reprendre la tâche suspendue ou affecter une autre intervention",
      },
      dossierLog: `Tâche "${line.designation}" suspendue`,
    };
  });
}

export function blockRepairOrder(
  dossiers: DossierSAV[],
  dossierId: string,
  lineId: string,
  reason = "Blocage technique atelier",
  userRole: UserRole = UserRole.TECHNICIEN,
  now = new Date()
): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ line }) => {
    if (normalizeRepairOrderStatus(line.status) !== "in_progress") {
      return { ok: false, error: "Seule une tâche en cours peut être bloquée." };
    }
    return {
      ok: true,
      line: appendLineHistory({ ...line, status: "blocked" }, now, `Tâche bloquée: ${reason}`),
      dossierChanges: {
        statut: DossierStatus.BLOQUE,
        bloqueRaison: reason,
        prochaineActionRecommended: `Lever le blocage atelier: ${reason}`,
      },
      dossierLog: `[${userRole}] - Blocage Tâche "${line.designation}" - Motif: ${reason}`,
    };
  });
}

export function finishRepairOrder(dossiers: DossierSAV[], dossierId: string, lineId: string, now = new Date()): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ dossier, line }) => {
    if (normalizeRepairOrderStatus(line.status) === "done") {
      return { ok: false, error: "Cette tâche est déjà terminée." };
    }
    if (normalizeRepairOrderStatus(line.status) !== "in_progress") {
      return { ok: false, error: "Une tâche doit être en cours avant d'être terminée." };
    }

    const nextLine = appendLineHistory({ ...line, status: "done", tempsPasse: Math.max(line.tempsPasse, line.tempsEstime) }, now, "Tâche terminée.");
    const nextLines = dossier.ordresReparation.map(current => current.id === lineId ? nextLine : current);
    const allDone = nextLines.every(isRepairOrderDone);

    return {
      ok: true,
      line: nextLine,
      dossierChanges: {
        statut: allDone ? DossierStatus.CONTROLE_QUALITE : DossierStatus.EN_TRAVAUX,
        prochaineActionRecommended: allDone
          ? "Lancer le contrôle qualité d'essai routier"
          : "Continuer les ordres de réparation restants",
      },
      dossierLog: `Tâche "${line.designation}" terminée`,
    };
  });
}

export function reopenRepairOrder(
  dossiers: DossierSAV[],
  dossierId: string,
  lineId: string,
  userRole: UserRole,
  reason: string,
  now = new Date()
): TaskMutationResult {
  return mutateRepairOrder(dossiers, dossierId, lineId, now, ({ line }) => {
    if (![UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole)) {
      return { ok: false, error: "Seul le Directeur SAV ou le Chef Atelier peut réouvrir une tâche terminée." };
    }
    if (!reason.trim()) {
      return { ok: false, error: "Le motif de réouverture est obligatoire." };
    }
    if (normalizeRepairOrderStatus(line.status) !== "done") {
      return { ok: false, error: "Seule une tâche terminée peut être réouverte." };
    }

    return {
      ok: true,
      line: appendLineHistory({ ...line, status: "reopened", reopenedReason: reason.trim() }, now, `Tâche réouverte: ${reason.trim()}`),
      dossierChanges: {
        statut: DossierStatus.TRAVAUX_PLANIFIES,
        prochaineActionRecommended: "Replanifier la tâche réouverte avant reprise",
      },
      dossierLog: `Réouverture de tâche ${line.designation}: ${reason.trim()}`,
    };
  });
}

function roundToNextSlot(date: Date, granularityMinutes: number = 15): Date {
  const ms = granularityMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function isTechnicianCompatible(tech: TechnicienResource, type?: InterventionType): boolean {
  if (!type) return true;
  switch (type) {
    case InterventionType.ENTRETIEN_RAPIDE:
      return tech.zoneAffectee === AtelierZone.MECANIQUE_RAPIDE;
    case InterventionType.MECANIQUE_GENERALE:
      return tech.zoneAffectee === AtelierZone.GRANDS_TRAVAUX;
    case InterventionType.ELECTRICITE_DIAG:
    case InterventionType.DIAGNOSTIC:
      return tech.zoneAffectee === AtelierZone.ELECTRICITE_DIAG;
    case InterventionType.CARROSSERIE:
    case InterventionType.ASSURANCE:
      return tech.zoneAffectee === AtelierZone.CARROSSERIE || tech.zoneAffectee === AtelierZone.PEINTURE;
    case InterventionType.PREPARATION_LIVRAISON:
      return tech.zoneAffectee === AtelierZone.PREPARATION || tech.zoneAffectee === AtelierZone.LAVAGE_FINITION;
    default:
      return true;
  }
}

function isSlotOverlappingActiveReservations(
  reservations: WorkshopReservation[] | undefined,
  techId: string | undefined,
  bayId: string | undefined,
  start: Date,
  end: Date,
  ignoreDossierId?: string
): boolean {
  if (!reservations || reservations.length === 0) return false;
  const requestedSegments = buildPlanningSegments(start, end);
  for (const res of reservations) {
    if (ignoreDossierId && res.dossierId === ignoreDossierId) continue;
    if (res.status !== "CRENEAU_PROPOSE" && res.status !== "RESERVATION_CONFIRMEE") continue;
    if (!res.startTime || !res.endTime) continue;

    const matchTech = techId && res.technicianId === techId;
    const matchBay = bayId && res.bayId === bayId;
    if (!matchTech && !matchBay) continue;

    const resSegments = res.segments || buildPlanningSegments(new Date(res.startTime), new Date(res.endTime));
    
    let overlap = false;
    for (const a of requestedSegments) {
      const aStart = new Date(a.start).getTime();
      const aEnd = new Date(a.end).getTime();
      for (const b of resSegments) {
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        if (aStart < bEnd && bStart < aEnd) {
          overlap = true;
          break;
        }
      }
      if (overlap) break;
    }
    if (overlap) return true;
  }
  return false;
}

export function suggestWorkshopSlot(input: WorkshopSlotSuggestionInput, now: Date = new Date()): WorkshopSlotSuggestion {
  if (input.availabilityConfig) {
    const desiredDate = input.desiredDate instanceof Date ? input.desiredDate : new Date(input.desiredDate);
    const durationHours = Math.max(0.5, Number.isFinite(input.estimatedHours) ? input.estimatedHours : 1);
    const durationMinutes = Math.ceil(durationHours * 60);

    const desiredDateStr = getLocalDateKey(desiredDate);
    const nowDateStr = getLocalDateKey(now);

    if (desiredDateStr < nowDateStr) {
      throw new Error("Impossible de planifier dans le passé.");
    }

    const usableTechnicians = input.technicians.filter(technician => !["absent", "formation"].includes(technician.disponibilite));
    const techsToTry = usableTechnicians.length > 0 ? usableTechnicians : input.technicians;

    let startAfter = new Date(desiredDate);
    let isShiftedDueToNow = false;
    if (desiredDateStr === nowDateStr) {
      const startOfToday = new Date(desiredDate);
      startOfToday.setHours(8, 0, 0, 0);
      const alignedNow = new Date(now);
      alignedNow.setSeconds(0, 0);
      const mins = alignedNow.getMinutes();
      const roundedMins = Math.ceil(mins / 15) * 15;
      alignedNow.setMinutes(roundedMins);
      if (alignedNow.getTime() > startOfToday.getTime()) {
        startAfter = alignedNow;
        isShiftedDueToNow = true;
      } else {
        startAfter = startOfToday;
      }
    } else {
      startAfter.setHours(8, 0, 0, 0);
    }

    const dossier = input.dossierId ? input.dossiers.find(d => d.id === input.dossierId) : null;
    const typeDossier = dossier?.typeDossier;

    const sortedTechs = [...techsToTry].sort((left, right) => {
      const compLeft = typeDossier ? isTechnicianCompatible(left, typeDossier) : true;
      const compRight = typeDossier ? isTechnicianCompatible(right, typeDossier) : true;
      if (compLeft && !compRight) return -1;
      if (!compLeft && compRight) return 1;

      // When compatibility is equal, sort by daily load on the start date
      const dateStr = getLocalDateKey(startAfter);
      let loadLeft = calculateTechnicianDailyLoad(left.id, dateStr, input.dossiers, input.reservations, input.dossierId);
      let loadRight = calculateTechnicianDailyLoad(right.id, dateStr, input.dossiers, input.reservations, input.dossierId);
      if (dateStr === getLocalDateKey(now)) {
        loadLeft = Math.max(loadLeft, left.chargeActuelle || 0);
        loadRight = Math.max(loadRight, right.chargeActuelle || 0);
      }
      return loadLeft - loadRight;
    });

    let bestSlot: {
      startTime: Date;
      endTime: Date;
      segments: Array<{ start: string; end: string }>;
      techId: string;
      techName: string;
      bayId: string;
      bayName: string;
    } | null = null;

    for (const tech of sortedTechs) {
      const compatibleBays = input.workshopBays.filter(bay => !bay.zone || bay.zone === tech.zoneAffectee);
      const baysToTry = compatibleBays.length > 0 ? compatibleBays : input.workshopBays;

      for (const bay of baysToTry) {
        const slot = findNextAvailableWorkingSlot({
          durationMinutes,
          startDate: startAfter,
          technicianId: tech.id,
          bayId: bay.id,
          dossiers: input.dossiers,
          reservations: input.reservations || [],
          excludeDossierId: input.dossierId,
          config: input.availabilityConfig
        });

        if (slot) {
          if (!bestSlot || slot.startTime.getTime() < bestSlot.startTime.getTime()) {
            bestSlot = {
              startTime: slot.startTime,
              endTime: slot.endTime,
              segments: slot.segments,
              techId: tech.id,
              techName: tech.nom,
              bayId: bay.id,
              bayName: bay.name
            };
          }
        }
      }
    }

    if (bestSlot) {
      const dateStr = getLocalDateKey(bestSlot.startTime);
      const dailyLoad = calculateTechnicianDailyLoad(bestSlot.techId, dateStr, input.dossiers, input.reservations, input.dossierId);
      let reason = `Créneau disponible trouvé selon les disponibilités de l'atelier.`;
      if (isShiftedDueToNow) {
        reason = "Créneau proposé à partir de l’heure actuelle. " + reason;
      }
      return {
        technicianId: bestSlot.techId,
        technicianName: bestSlot.techName,
        bayId: bestSlot.bayId,
        bayName: bestSlot.bayName,
        startTime: bestSlot.startTime.toISOString(),
        endTime: bestSlot.endTime.toISOString(),
        segments: bestSlot.segments,
        reason,
        technicianLoad: dailyLoad,
        bayAvailability: "Pont disponible"
      };
    }

    const fallbackDate = new Date(startAfter);
    fallbackDate.setDate(fallbackDate.getDate() + 1);
    fallbackDate.setHours(8, 0, 0, 0);
    const fallbackTech = sortedTechs[0] || input.technicians[0];
    const fallbackBay = input.workshopBays[0];
    return {
      technicianId: fallbackTech?.id || "tech_virtual",
      technicianName: fallbackTech?.nom || "Technicien",
      bayId: fallbackBay?.id || "bay_virtual",
      bayName: fallbackBay?.name || "Pont",
      startTime: fallbackDate.toISOString(),
      endTime: new Date(fallbackDate.getTime() + durationMinutes * 60000).toISOString(),
      segments: [{ start: fallbackDate.toISOString(), end: new Date(fallbackDate.getTime() + durationMinutes * 60000).toISOString() }],
      reason: "Proposition par défaut.",
      technicianLoad: 0,
      bayAvailability: "Pont disponible"
    };
  }

  const durationHours = Math.max(0.5, Number.isFinite(input.estimatedHours) ? input.estimatedHours : 1);
  const durationMinutes = Math.ceil(durationHours * 60);
  const desiredDate = input.desiredDate instanceof Date ? input.desiredDate : new Date(input.desiredDate);

  const desiredDateStr = getLocalDateKey(desiredDate);
  const nowDateStr = getLocalDateKey(now);

  if (desiredDateStr < nowDateStr) {
    throw new Error("Impossible de planifier dans le passé.");
  }

  const usableTechnicians = input.technicians.filter(technician => !["absent", "formation"].includes(technician.disponibilite));
  const technicians = usableTechnicians.length > 0 ? usableTechnicians : input.technicians;

  // Search for the next 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const candidateDate = addCalendarDays(desiredDate, dayOffset);
    if (!isWorkingDay(candidateDate)) continue;

    const dateStr = candidateDate.toISOString().split("T")[0];

    // Determine candidate times: Saturday ends at 12, Mon-Fri at 17
    let timeCursor: Date;
    let isShiftedDueToNow = false;

    if (dayOffset === 0 && desiredDateStr === nowDateStr) {
      const earliestStart = maxDate(now, setTimeOnDate(candidateDate, 8, 0));
      timeCursor = alignToWorkingTime(roundToNextSlot(earliestStart, 15));
      if (timeCursor.getTime() > setTimeOnDate(candidateDate, 8, 0).getTime()) {
        isShiftedDueToNow = true;
      }
    } else {
      timeCursor = setTimeOnDate(candidateDate, 8, 0);
    }

    const endOfDayLimit = candidateDate.getDay() === 6 
      ? setTimeOnDate(candidateDate, 12, 0) 
      : setTimeOnDate(candidateDate, 17, 0);

    while (timeCursor.getTime() < endOfDayLimit.getTime()) {
      // Calculate end time by adding working minutes
      const endTime = addWorkingMinutes(timeCursor, durationMinutes);
      
      // If the end time is on a different local day or exceeds the day's limit, this start time is invalid
      if (!isSameLocalDate(timeCursor, endTime) || endTime.getTime() > endOfDayLimit.getTime()) {
        timeCursor = new Date(timeCursor.getTime() + 30 * 60 * 1000);
        continue;
      }

      // Sort technicians:
      // 1. Compatibility
      // 2. Workload
      const sortedTechs = [...technicians].sort((left, right) => {
        if (input.dossierId) {
          const dossier = input.dossiers.find(d => d.id === input.dossierId);
          if (dossier) {
            const compLeft = isTechnicianCompatible(left, dossier.typeDossier);
            const compRight = isTechnicianCompatible(right, dossier.typeDossier);
            if (compLeft && !compRight) return -1;
            if (!compLeft && compRight) return 1;
          }
        }
        let loadLeft = calculateTechnicianDailyLoad(left.id, dateStr, input.dossiers, input.reservations);
        let loadRight = calculateTechnicianDailyLoad(right.id, dateStr, input.dossiers, input.reservations);
        if (dayOffset === 0) {
          loadLeft = Math.max(loadLeft, left.chargeActuelle || 0);
          loadRight = Math.max(loadRight, right.chargeActuelle || 0);
        }
        return loadLeft - loadRight;
      });

      // Check each technician and bay
      for (const tech of sortedTechs) {
        // 1. Collision check for technician
        if (detectTechnicianCollision(input.dossiers, tech.id, timeCursor, endTime)) {
          continue;
        }
        if (isSlotOverlappingActiveReservations(input.reservations, tech.id, undefined, timeCursor, endTime, input.dossierId)) {
          continue;
        }

        // 2. Capacity check for technician
        const maxCap = candidateDate.getDay() === 6 ? 4 : 8;
        let dailyLoad = calculateTechnicianDailyLoad(tech.id, dateStr, input.dossiers, input.reservations);
        if (dayOffset === 0) {
          dailyLoad = Math.max(dailyLoad, tech.chargeActuelle || 0);
        }
        if (dailyLoad + durationHours > maxCap) {
          continue;
        }

        // 3. Find compatible bay and check collision
        const compatibleBays = input.workshopBays.filter(
          bay => !bay.zone || bay.zone === tech.zoneAffectee
        );
        const baysToTry = compatibleBays.length > 0 ? compatibleBays : input.workshopBays;

        for (const bay of baysToTry) {
          if (!detectBayCollision(input.dossiers, bay.id, timeCursor, endTime) && 
              !isSlotOverlappingActiveReservations(input.reservations, undefined, bay.id, timeCursor, endTime, input.dossierId)) {
            const segments = buildPlanningSegments(timeCursor, endTime);
            
            let reason = `Technicien compatible avec ${formatHours(dailyLoad)}h déjà planifiées et capacité restante suffisante.`;
            if (isShiftedDueToNow) {
              reason = "Créneau proposé à partir de l’heure actuelle. " + reason;
            }

            // Found a valid slot!
            return {
              technicianId: tech.id,
              technicianName: tech.nom,
              bayId: bay.id,
              bayName: bay.name,
              startTime: timeCursor.toISOString(),
              endTime: endTime.toISOString(),
              segments,
              reason,
              technicianLoad: dailyLoad,
              bayAvailability: bay.zone ? `Pont compatible zone ${bay.zone}` : "Premier pont libre compatible"
            };
          }
        }
      }

      // Increment start time by 30 minutes
      timeCursor = new Date(timeCursor.getTime() + 30 * 60 * 1000);
    }
  }

  // Fallback next working day at 08:00
  const fallbackDate = setTimeOnDate(nextWorkingDay(desiredDate), 8, 0);
  const fallbackTechnician = technicians[0];
  const fallbackBay = chooseWorkshopBay(input.workshopBays, fallbackTechnician?.zoneAffectee);
  return {
    technicianId: fallbackTechnician?.id ?? "tech_virtual",
    technicianName: fallbackTechnician?.nom ?? "Technicien à affecter",
    bayId: fallbackBay.id,
    bayName: fallbackBay.name,
    startTime: fallbackDate.toISOString(),
    endTime: addWorkingMinutes(fallbackDate, durationMinutes).toISOString(),
    segments: buildPlanningSegments(fallbackDate, addWorkingMinutes(fallbackDate, durationMinutes)),
    reason: "Aucun créneau compatible immédiat: proposition au prochain jour ouvrable.",
    technicianLoad: 0,
    bayAvailability: fallbackBay.zone ? `Pont compatible zone ${fallbackBay.zone}` : "Premier pont libre compatible"
  };
}

export function canSavePlanningAssignment(input: PlanningAssignmentInput, now: Date = new Date()): boolean {
  return validatePlanningAssignment(input, now).allowed;
}

export function validatePlanningAssignment(input: PlanningAssignmentInput, now: Date = new Date()): PlanningAssignmentValidation {
  const codes: PlanningBlockingCode[] = [];
  const start = parsePlanningDate(input.start);
  const end = parsePlanningDate(input.end);
  const pushIssue = (code: PlanningBlockingCode) => {
    if (!codes.includes(code)) codes.push(code);
  };

  if (!start || !end || end.getTime() <= start.getTime()) {
    pushIssue("planning-segments-invalid");
    return buildPlanningValidationResult(codes, []);
  }

  if (start.getTime() < now.getTime()) {
    pushIssue("planning-in-past");
  }

  if (input.availabilityConfig) {
    const avail = validateAvailabilityForSlot({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      segments: input.planningSegments || buildPlanningSegments(start, end),
      technicianId: input.technicianId,
      bayId: input.bayId,
      config: input.availabilityConfig
    });
    if (!avail.allowed) {
      avail.codes.forEach(code => pushIssue(code as PlanningBlockingCode));
    }
  }

  const dossier = input.dossiers.find(d => d.id === input.dossierId);
  const isDummyTestDossier = input.dossierId && input.dossierId.startsWith("NIMR-PLAN-");
  if (!dossier) {
    if (!isDummyTestDossier) {
      pushIssue("planning-dossier-not-found");
    }
  } else {
    const line = dossier.ordresReparation.find(l => l.id === input.lineId);
    if (!line) {
      pushIssue("planning-task-not-found");
    }
  }

  if (input.technicians) {
    const tech = input.technicians.find(t => t.id === input.technicianId);
    if (!tech) {
      pushIssue("planning-tech-not-found");
    }
  }

  if (input.workshopBays) {
    const bay = input.workshopBays.find(b => b.id === input.bayId);
    if (!bay) {
      pushIssue("planning-bay-not-found");
    }
  }

  if (!isWorkingDay(start)) {
    pushIssue("planning-collision-sunday");
  }

  if (!isSameLocalDate(start, end)) {
    pushIssue("planning-collision-hours");
  }

  const startMin = getMinutesSinceMidnight(start);
  const endMin = getMinutesSinceMidnight(end);
  const isSaturday = start.getDay() === 6;

  if (isSaturday && (startMin >= LUNCH_START_HOUR * 60 || endMin > LUNCH_START_HOUR * 60)) {
    pushIssue("planning-collision-saturday-afternoon");
  }

  if (!isStartInsideWorkingWindow(start) || !isEndAllowedForWorkingDate(end, isSaturday)) {
    pushIssue("planning-collision-hours");
  }

  const expectedSegments = buildPlanningSegments(start, end);
  const submittedSegments = input.planningSegments && input.planningSegments.length > 0
    ? input.planningSegments
    : expectedSegments;

  if (!arePlanningSegmentsValidForInterval(start, end, submittedSegments, expectedSegments)) {
    pushIssue("planning-segments-invalid");
  }
  if (submittedSegments.some(segmentOverlapsLunch)) {
    pushIssue("planning-collision-lunch");
  }

  if (detectTechnicianCollision(input.dossiers, input.technicianId, start, end, input.lineId)) {
    pushIssue("planning-collision-tech");
  }
  if (isSlotOverlappingActiveReservations(input.reservations, input.technicianId, undefined, start, end, input.dossierId)) {
    pushIssue("planning-collision-tech");
  }
  if (detectBayCollision(input.dossiers, input.bayId, start, end, input.lineId)) {
    pushIssue("planning-collision-bay");
  }
  if (isSlotOverlappingActiveReservations(input.reservations, undefined, input.bayId, start, end, input.dossierId)) {
    pushIssue("planning-collision-bay");
  }

  const planningDate = getLocalDateKey(start);
  const maxCapacity = input.technicianDailyCapacityHours ?? (isSaturday ? 4 : 8);
  const requestedHours = calculateSegmentHoursForDate(submittedSegments, planningDate);
  const currentDailyLoad = calculateTechnicianDailyLoad(input.technicianId, planningDate, input.dossiers, input.reservations, input.lineId);
  if (currentDailyLoad + requestedHours > maxCapacity) {
    pushIssue("planning-collision-overload");
  }

  // Lot 5F-3: validate task duration
  if (dossier) {
    const line = dossier.ordresReparation.find(l => l.id === input.lineId);
    if (line) {
      const hours = line.tempsEstime;
      if (!hours || hours <= 0) {
        pushIssue("planning-duration-missing");
      } else {
        const src = line.estimateSource;
        const validated = line.isEstimatedDurationValidated;
        // preset/demo require explicit validation before scheduling
        if ((src === "preset" || src === "demo") && !validated) {
          pushIssue("planning-duration-not-validated");
        }
        // manual with duration > 0 is considered validated implicitly
        // quote-import is always validated (set during import confirmation)
      }
    }
  }

  return buildPlanningValidationResult(codes, submittedSegments);
}

export function blockDossier(dossier: DossierSAV, reason: string, now = new Date()): DossierSAV {
  return {
    ...dossier,
    statut: DossierStatus.BLOQUE,
    bloqueRaison: reason,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: "Traiter la cause de blocage technique",
  };
}

export function releaseDossierBlock(dossier: DossierSAV, now = new Date()): DossierSAV {
  return {
    ...dossier,
    statut: DossierStatus.EN_TRAVAUX,
    bloqueRaison: "",
    dateDernierStatut: now.toISOString(),
  };
}

export function finishWorksForQuality(dossier: DossierSAV, now = new Date()): DossierSAV {
  return {
    ...dossier,
    statut: DossierStatus.CONTROLE_QUALITE,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: "Lancer le contrôle qualité par l'essayeur",
  };
}

export function submitQualityControl(
  dossier: DossierSAV,
  userRole: UserRole,
  validationGlobale: "valide" | "refuse",
  comment = "",
  now = new Date()
): DossierSAV {
  const updatedQC: ChecklistQualite = {
    ...dossier.checklistQC,
    validationGlobale,
    commentaireRefus: comment || undefined,
    dateValidation: now.toISOString(),
    validePar: userRole,
  };

  if (validationGlobale === "valide") {
    return {
      ...dossier,
      checklistQC: updatedQC,
      statut: DossierStatus.PRET_A_LIVRER,
      prochaineActionRecommended: "Aviser le client et convenir de la date de livraison",
      bloqueRaison: "",
      dateDernierStatut: now.toISOString(),
    };
  }

  return {
    ...dossier,
    checklistQC: updatedQC,
    statut: DossierStatus.EN_TRAVAUX,
    prochaineActionRecommended: `Retour atelier suite à refus contrôle qualité. Motif: ${comment}`,
    bloqueRaison: "",
    dateDernierStatut: now.toISOString(),
  };
}

export function canDeliverDossier(dossier: DossierSAV): DossierDeliveryGate {
  const reasons: string[] = [];
  const repairStatuses = dossier.ordresReparation.map(line => normalizeRepairOrderStatus(line.status));

  if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.PRET_FACTURATION || dossier.statut === DossierStatus.CLOTURE) {
    reasons.push("Le dossier est déjà livré ou clôturé.");
  }
  if (dossier.statut !== DossierStatus.PRET_A_LIVRER) {
    reasons.push("Le statut doit être Prêt à livrer.");
  }
  if (dossier.checklistQC.validationGlobale !== "valide") {
    reasons.push("Contrôle qualité accepté obligatoire.");
  }
  if (dossier.checklistQC.validationGlobale === "refuse") {
    reasons.push("Contrôle qualité refusé : retour atelier requis.");
  }
  if (repairStatuses.some(status => status === "in_progress")) {
    reasons.push("Une tâche atelier est encore en cours.");
  }
  if (repairStatuses.some(status => status === "blocked")) {
    reasons.push("Une tâche atelier est bloquée.");
  }
  if (!dossier.ordresReparation.every(isRepairOrderDone)) {
    reasons.push("Toutes les tâches obligatoires doivent être terminées.");
  }
  if (dossier.statut === DossierStatus.BLOQUE || Boolean(dossier.bloqueRaison?.trim())) {
    reasons.push("Le dossier est bloqué.");
  }

  return {
    allowed: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
}

export function confirmDelivery(dossier: DossierSAV, now = new Date()): DossierSAV {
  if (!canDeliverDossier(dossier).allowed) {
    return dossier;
  }

  const livraison: DeliveryProtocole = {
    ...dossier.livraison,
    controleQualiteOk: true,
    clientInforme: true,
    confirmationReceptionClient: true,
    dateLivraisonReelle: now.toISOString(),
    clotureInterne: true,
  };

  return {
    ...dossier,
    livraison,
    statut: DossierStatus.LIVRE,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: "Clôturer le dossier opérationnellement pour facturation ERP",
  };
}

export function markReadyForBilling(dossier: DossierSAV, now = new Date()): DossierSAV {
  return {
    ...dossier,
    statut: DossierStatus.PRET_FACTURATION,
    dateDernierStatut: now.toISOString(),
    prochaineActionRecommended: "Dossier prêt pour transmission comptabilité / ERP",
  };
}

export function createBackupPayload(
  dossiers: DossierSAV[],
  reclamations: ReclammationClient[],
  techList: TechnicienResource[],
  activityLogs: ActiviteLog[],
  reservations?: WorkshopReservation[]
): BackupPayload {
  return { dossiers, reclamations, techList, activityLogs, reservations };
}

export function parseStoredArray<T>(
  rawValue: string | null,
  fallback: T[],
  itemGuard: (value: unknown) => value is T
): { items: T[]; usedFallback: boolean; error?: string } {
  if (!rawValue) {
    return { items: fallback, usedFallback: true };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed) || !parsed.every(itemGuard)) {
      return { items: fallback, usedFallback: true, error: "Format de liste invalide" };
    }
    return { items: parsed, usedFallback: false };
  } catch {
    return { items: fallback, usedFallback: true, error: "JSON invalide" };
  }
}

export function validateBackupPayload(value: unknown): { ok: true; data: Partial<BackupPayload> } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Le fichier importé doit contenir un objet JSON." };
  }

  const data: Partial<BackupPayload> = {};
  const candidates = [
    ["dossiers", isDossierSAV],
    ["reclamations", isReclamationClient],
    ["techList", isTechnicienResource],
    ["activityLogs", isActiviteLog],
    ["reservations", isWorkshopReservation],
  ] as const;

  for (const [key, guard] of candidates) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (!Array.isArray(candidate) || !candidate.every(guard)) {
      return { ok: false, error: `La section "${key}" est absente ou invalide.` };
    }
    data[key] = candidate as never;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Aucune section importable n'a été trouvée." };
  }

  if (data.dossiers) {
    const invariantError = validateImportedDossierInvariants(data.dossiers);
    if (invariantError) {
      return { ok: false, error: invariantError };
    }
  }

  return { ok: true, data };
}

function validateImportedDossierInvariants(dossiers: DossierSAV[]): string | null {
  for (const dossier of dossiers) {
    const statuses = dossier.ordresReparation.map(line => normalizeRepairOrderStatus(line.status));
    const hasActiveTask = statuses.includes("in_progress");
    const hasBlockedTask = statuses.includes("blocked");
    const allTasksDone = dossier.ordresReparation.every(isRepairOrderDone);
    const isDeliveredOrClosed = [DossierStatus.LIVRE, DossierStatus.PRET_FACTURATION, DossierStatus.CLOTURE].includes(dossier.statut);

    if (dossier.statut === DossierStatus.PRET_A_LIVRER) {
      const deliveryGate = canDeliverDossier(dossier);
      if (!deliveryGate.allowed) {
        return `Dossier ${dossier.id} prêt à livrer incohérent: ${deliveryGate.reasons.join(" ")}`;
      }
    }

    if (isDeliveredOrClosed) {
      if (dossier.checklistQC.validationGlobale !== "valide") {
        return `Dossier ${dossier.id} livré/clôturé sans QC accepté.`;
      }
      if (hasActiveTask || hasBlockedTask || !allTasksDone) {
        return `Dossier ${dossier.id} livré/clôturé avec tâches atelier non terminées.`;
      }
      if (dossier.statut === DossierStatus.BLOQUE || Boolean(dossier.bloqueRaison?.trim())) {
        return `Dossier ${dossier.id} livré/clôturé alors qu'il est bloqué.`;
      }
    }

    for (const line of dossier.ordresReparation) {
      const hasPlanningData = Boolean(line.planningStart || line.planningEnd || line.planningSegments?.length || line.plannedTechnicianId || line.plannedBayId);
      if (!hasPlanningData) continue;

      if (!line.planningStart || !line.planningEnd || !line.plannedTechnicianId || !line.plannedBayId) {
        return `Planning incomplet pour la tâche ${line.id} du dossier ${dossier.id}.`;
      }

      const planningValidation = validatePlanningAssignment({
        dossiers,
        dossierId: dossier.id,
        lineId: line.id,
        technicianId: line.plannedTechnicianId,
        bayId: line.plannedBayId,
        start: line.planningStart,
        end: line.planningEnd,
        planningSegments: line.planningSegments,
      });

      if (!planningValidation.allowed) {
        return `Planning invalide pour la tâche ${line.id} du dossier ${dossier.id}: ${planningValidation.reasons.join(" ")}`;
      }
    }
  }

  return null;
}

export function isDossierSAV(value: unknown): value is DossierSAV {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.clientNom) &&
    isString(value.clientTelephone) &&
    isString(value.vehiculeMarque) &&
    isString(value.vehiculeModele) &&
    isString(value.vehiculeImmatriculation) &&
    isEnumValue(InterventionType, value.typeDossier) &&
    isEnumValue(DossierPriority, value.priorite) &&
    isEnumValue(DossierStatus, value.statut) &&
    Array.isArray(value.photosAvant) &&
    Array.isArray(value.ordresReparation) &&
    Array.isArray(value.complements) &&
    Array.isArray(value.accords) &&
    isRecord(value.checklistQC) &&
    isRecord(value.livraison) &&
    isNumber(value.avancementGlobal) &&
    isString(value.dateReception) &&
    isString(value.dateSouhaiteeLivraison) &&
    isString(value.dateDernierStatut)
  );
}

export function isReclamationClient(value: unknown): value is ReclammationClient {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.dossierId) &&
    isString(value.clientNom) &&
    isString(value.vehiculeNom) &&
    isString(value.motif) &&
    ["basse", "moyenne", "haute", "critique"].includes(String(value.criticite)) &&
    ["nouvelle", "en_analyse", "action_corrective", "attente_client", "resolue", "cloturee", "reouverte", "en_cours", "classee"].includes(String(value.statut)) &&
    Array.isArray(value.historiqueLogs)
  );
}

export function isTechnicienResource(value: unknown): value is TechnicienResource {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.nom) &&
    isString(value.specialite) &&
    ["disponible", "occupe", "absent", "formation"].includes(String(value.disponibilite)) &&
    Array.isArray(value.compétences) &&
    isEnumValue(AtelierZone, value.zoneAffectee) &&
    isNumber(value.capaciteJournaliere) &&
    isNumber(value.chargeActuelle)
  );
}

export function isActiviteLog(value: unknown): value is ActiviteLog {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.timestamp) &&
    isString(value.user) &&
    isString(value.role) &&
    isString(value.action) &&
    isString(value.details)
  );
}

export function isWorkshopReservation(value: unknown): value is WorkshopReservation {
  if (!isRecord(value)) return false;
  return (
    isString(value.reservationId) &&
    isString(value.dossierId) &&
    Array.isArray(value.taskIds) &&
    isNumber(value.totalHours) &&
    isString(value.desiredDate) &&
    ["A_RESERVER", "CRENEAU_PROPOSE", "RESERVATION_CONFIRMEE", "AFFECTEE_ATELIER", "ANNULEE", "TRANSFORMEE_PLANNING"].includes(String(value.status)) &&
    isString(value.source) &&
    Array.isArray(value.history)
  );
}

function createEmptyChecklist(): ChecklistQualite {
  return {
    essaiEffectue: false,
    defautRepare: false,
    aucunVoyantAllume: false,
    niveauxVerifies: false,
    serrageSecurite: false,
    propreteVehicule: false,
    documentsPrets: false,
    photosApresOk: false,
    validationGlobale: "en_attente",
  };
}

function createDeliveryProtocol(dateLivraisonPrevue: string): DeliveryProtocole {
  return {
    controleQualiteOk: false,
    clientInforme: false,
    dateLivraisonPrevue,
    remarquesLivraison: "",
    confirmationReceptionClient: false,
    clotureInterne: false,
  };
}

type RepairOrderMutationContext = {
  normalizedDossiers: DossierSAV[];
  dossier: DossierSAV;
  line: RepairOrderLine;
};

type RepairOrderMutation =
  | {
      ok: true;
      line: RepairOrderLine;
      dossierChanges: Partial<DossierSAV>;
      dossierLog?: string;
    }
  | { ok: false; error: string };

function mutateRepairOrder(
  dossiers: DossierSAV[],
  dossierId: string,
  lineId: string,
  now: Date,
  mutation: (context: RepairOrderMutationContext) => RepairOrderMutation
): TaskMutationResult {
  const normalizedDossiers = dossiers.map(normalizeDossierForRuntime);
  const dossier = normalizedDossiers.find(current => current.id === dossierId);
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const line = dossier.ordresReparation.find(current => current.id === lineId);
  if (!line) return { ok: false, error: "Tâche atelier introuvable." };

  const result = mutation({ normalizedDossiers, dossier, line });
  if (result.ok === false) return result;

  const timestamp = now.toISOString();
  const nextLines = dossier.ordresReparation.map(current => current.id === lineId ? result.line : current);
  const progress = calculateRepairProgress(nextLines);
  const nextLogs = result.dossierLog
    ? [`${timestamp} - ${result.dossierLog}`, ...(dossier.historiqueLogs ?? [])]
    : dossier.historiqueLogs;

  const nextDossier: DossierSAV = {
    ...dossier,
    ...result.dossierChanges,
    ordresReparation: nextLines,
    avancementGlobal: progress,
    dateDernierStatut: timestamp,
    historiqueLogs: nextLogs,
  };

  const nextDossiers = normalizedDossiers.map(current => current.id === dossierId ? nextDossier : current);
  return { ok: true, dossiers: nextDossiers, dossier: nextDossier, line: result.line };
}

function appendLineHistory(line: RepairOrderLine, now: Date, action: string): RepairOrderLine {
  return {
    ...line,
    history: [`${now.toISOString()} - ${action}`, ...(line.history ?? [])],
  };
}

function calculateRepairProgress(lines: RepairOrderLine[]): number {
  if (lines.length === 0) return 0;
  const completedCount = lines.filter(isRepairOrderDone).length;
  return Math.round((completedCount / lines.length) * 100);
}

function normalizePhotoCategory(category: unknown): PhotoCategory {
  return typeof category === "string" && (PHOTO_CATEGORIES as readonly string[]).includes(category)
    ? category as PhotoCategory
    : "autre";
}

function getTechnicianLoad(technician: TechnicienResource, dossiers: DossierSAV[]): number {
  return Math.max(technician.chargeActuelle || 0, getScheduledLoadForTechnician(technician.id, dossiers));
}

function getScheduledLoadForTechnician(technicianId: string, dossiers: DossierSAV[]): number {
  return dossiers
    .filter(dossier =>
      dossier.technicienId === technicianId &&
      dossier.statut !== DossierStatus.LIVRE &&
      dossier.statut !== DossierStatus.CLOTURE
    )
    .reduce((total, dossier) => total + dossier.ordresReparation.reduce((lineTotal, line) => (
      isRepairOrderDone(line) ? lineTotal : lineTotal + line.tempsEstime
    ), 0), 0);
}

export function chooseWorkshopBay(workshopBays: WorkshopBay[], technicianZone?: AtelierZone): WorkshopBay {
  if (workshopBays.length === 0) return { id: "bay_virtual", name: "Pont atelier à confirmer" };
  return workshopBays.find(bay => !bay.zone || bay.zone === technicianZone) ?? workshopBays[0];
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0; // Sunday (0) is closed, Saturday (6) is open
}

export function getWorkingWindowsForDate(date: Date): Array<{ start: Date; end: Date }> {
  if (!isWorkingDay(date)) return [];
  const day = date.getDay();
  const startOfDay = new Date(date);
  startOfDay.setHours(8, 0, 0, 0);

  if (day === 6) { // Saturday
    const endOfSat = new Date(date);
    endOfSat.setHours(12, 0, 0, 0);
    return [{ start: startOfDay, end: endOfSat }];
  } else { // Monday to Friday
    const endOfMorning = new Date(date);
    endOfMorning.setHours(12, 0, 0, 0);
    const startOfAfternoon = new Date(date);
    startOfAfternoon.setHours(13, 0, 0, 0);
    const endOfAfternoon = new Date(date);
    endOfAfternoon.setHours(17, 0, 0, 0);
    return [
      { start: startOfDay, end: endOfMorning },
      { start: startOfAfternoon, end: endOfAfternoon }
    ];
  }
}

export function alignToWorkingTime(date: Date): Date {
  if (!isWorkingDay(date)) {
    return alignToWorkingTime(setTimeOnDate(nextWorkingDay(date), 8, 0));
  }

  const aligned = new Date(date);
  const day = aligned.getDay();
  const minutes = aligned.getHours() * 60 + aligned.getMinutes();

  if (day === 6) { // Saturday
    if (minutes < 8 * 60) return setTimeOnDate(aligned, 8, 0);
    if (minutes >= 12 * 60) return alignToWorkingTime(setTimeOnDate(nextWorkingDay(aligned), 8, 0));
  } else { // Monday to Friday
    if (minutes < 8 * 60) return setTimeOnDate(aligned, 8, 0);
    if (minutes >= 12 * 60 && minutes < 13 * 60) return setTimeOnDate(aligned, 13, 0);
    if (minutes >= 17 * 60) return alignToWorkingTime(setTimeOnDate(nextWorkingDay(aligned), 8, 0));
  }

  return aligned;
}

export function addWorkingMinutes(start: Date, minutes: number): Date {
  let current = alignToWorkingTime(start);
  let remaining = minutes;

  while (remaining > 0) {
    current = alignToWorkingTime(current);
    const day = current.getDay();

    let segmentEnd: Date;
    if (day === 6) { // Saturday
      segmentEnd = setTimeOnDate(current, 12, 0);
    } else { // Mon-Fri
      if (current.getHours() < 12) {
        segmentEnd = setTimeOnDate(current, 12, 0);
      } else {
        segmentEnd = setTimeOnDate(current, 17, 0);
      }
    }

    const availableMinutes = Math.max(0, Math.round((segmentEnd.getTime() - current.getTime()) / 60000));
    if (remaining <= availableMinutes) {
      return new Date(current.getTime() + remaining * 60000);
    }

    remaining -= availableMinutes;
    if (day === 6) { // Saturday afternoon -> Monday 08:00
      current = setTimeOnDate(nextWorkingDay(current), 8, 0);
    } else {
      if (current.getHours() < 12) {
        current = setTimeOnDate(current, 13, 0);
      } else {
        current = setTimeOnDate(nextWorkingDay(current), 8, 0);
      }
    }
  }

  return current;
}

export function buildPlanningSegments(start: Date, end: Date): Array<{ start: string; end: string }> {
  const segments: Array<{ start: string; end: string }> = [];
  let temp = new Date(start);
  const targetEnd = new Date(end);

  while (temp.getTime() < targetEnd.getTime()) {
    const windows = getWorkingWindowsForDate(temp);
    let activeWindowFound = false;

    for (const win of windows) {
      // If temp lies before this window, shift to start of this window
      if (temp.getTime() < win.start.getTime()) {
        temp = new Date(win.start);
      }

      // If temp lies within this window
      if (temp.getTime() >= win.start.getTime() && temp.getTime() < win.end.getTime()) {
        const segEnd = new Date(Math.min(win.end.getTime(), targetEnd.getTime()));
        segments.push({
          start: temp.toISOString(),
          end: segEnd.toISOString()
        });
        temp = new Date(segEnd);
        activeWindowFound = true;
        break;
      }
    }

    if (!activeWindowFound) {
      // If temp is outside all windows for this day, move to next working day at 08:00
      temp = setTimeOnDate(nextWorkingDay(temp), 8, 0);
    }
  }

  return segments;
}

function buildPlanningValidationResult(
  codes: PlanningBlockingCode[],
  segments: Array<{ start: string; end: string }>
): PlanningAssignmentValidation {
  const labels: Record<PlanningBlockingCode, string> = {
    "planning-collision-tech": "Le technicien est déjà affecté sur un autre dossier durant cette période.",
    "planning-collision-bay": "Le pont d'atelier sélectionné est déjà occupé durant cette période.",
    "planning-collision-overload": "La tâche dépasse la capacité journalière restante du technicien.",
    "planning-collision-hours": "Créneau en dehors des horaires d'ouverture de l'atelier.",
    "planning-collision-saturday-afternoon": "Samedi après-midi fermé.",
    "planning-collision-sunday": "Dimanche fermé.",
    "planning-collision-lunch": "Le créneau ne doit pas créer de bloc sur la pause déjeuner.",
    "planning-segments-invalid": "Segments de planning invalides.",
    "planning-in-past": "Impossible de planifier dans le passé.",
    "planning-tech-not-found": "Technicien inexistant.",
    "planning-bay-not-found": "Pont inexistant.",
    "planning-task-not-found": "Tâche inexistante.",
    "planning-dossier-not-found": "Dossier inexistant.",
    "planning-duration-missing": "Durée estimée absente ou nulle. Ouvrez le dossier pour saisir ou importer la durée.",
    "planning-duration-not-validated": "Durée preset à valider. Ouvrez le dossier et validez la durée avant de planifier.",
    "workshop-holiday": "L'atelier est fermé pour jour férié.",
    "workshop-closed": "L'atelier est fermé à cette date.",
    "outside-effective-working-hours": "En dehors des horaires d'ouverture.",
    "technician-absent": "Le technicien est absent.",
    "bay-unavailable": "Le pont est indisponible.",
  };


  return {
    allowed: codes.length === 0,
    codes,
    reasons: codes.map(code => labels[code]),
    segments,
  };
}

function parsePlanningDate(value: Date | string): Date | null {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function arePlanningSegmentsValidForInterval(
  start: Date,
  end: Date,
  submittedSegments: Array<{ start: string; end: string }>,
  expectedSegments: Array<{ start: string; end: string }>
): boolean {
  if (submittedSegments.length === 0 || expectedSegments.length === 0) return false;
  if (!segmentsMatch(submittedSegments, expectedSegments)) return false;

  const firstStart = new Date(submittedSegments[0].start);
  const lastEnd = new Date(submittedSegments[submittedSegments.length - 1].end);
  if (firstStart.getTime() !== start.getTime() || lastEnd.getTime() !== end.getTime()) return false;

  return submittedSegments.every(segment => {
    const segmentStart = parsePlanningDate(segment.start);
    const segmentEnd = parsePlanningDate(segment.end);
    if (!segmentStart || !segmentEnd || segmentEnd.getTime() <= segmentStart.getTime()) return false;
    return isIntervalInsideWorkingWindow(segmentStart, segmentEnd);
  });
}

function segmentsMatch(
  left: Array<{ start: string; end: string }>,
  right: Array<{ start: string; end: string }>
): boolean {
  if (left.length !== right.length) return false;
  return left.every((segment, index) => {
    const other = right[index];
    return (
      new Date(segment.start).getTime() === new Date(other.start).getTime() &&
      new Date(segment.end).getTime() === new Date(other.end).getTime()
    );
  });
}

function isIntervalInsideWorkingWindow(start: Date, end: Date): boolean {
  return getWorkingWindowsForDate(start).some(window =>
    start.getTime() >= window.start.getTime() &&
    end.getTime() <= window.end.getTime()
  );
}

function segmentOverlapsLunch(segment: { start: string; end: string }): boolean {
  const start = parsePlanningDate(segment.start);
  const end = parsePlanningDate(segment.end);
  if (!start || !end || start.getDay() === 6) return false;
  const lunchStart = setTimeOnDate(start, LUNCH_START_HOUR, 0);
  const lunchEnd = setTimeOnDate(start, LUNCH_END_HOUR, 0);
  return start.getTime() < lunchEnd.getTime() && lunchStart.getTime() < end.getTime();
}

function isStartInsideWorkingWindow(start: Date): boolean {
  return getWorkingWindowsForDate(start).some(window =>
    start.getTime() >= window.start.getTime() &&
    start.getTime() < window.end.getTime()
  );
}

function isEndAllowedForWorkingDate(end: Date, isSaturday: boolean): boolean {
  if (!isWorkingDay(end)) return false;
  const min = getMinutesSinceMidnight(end);
  if (isSaturday) return min <= WORKDAY_START_HOUR * 60 + 4 * 60;
  return min <= WORKDAY_END_HOUR * 60;
}

function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function detectTechnicianCollision(
  dossiers: DossierSAV[],
  techId: string,
  start: Date,
  end: Date,
  ignoreTaskId?: string
): boolean {
  if (!techId) return false;
  const requestedSegments = buildPlanningSegments(start, end);

  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (ignoreTaskId && line.id === ignoreTaskId) continue;
      if (line.plannedTechnicianId === techId && line.planningStart && line.planningEnd) {
        if (segmentsOverlap(requestedSegments, getLinePlanningSegments(line))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function detectBayCollision(
  dossiers: DossierSAV[],
  bayId: string,
  start: Date,
  end: Date,
  ignoreTaskId?: string
): boolean {
  if (!bayId) return false;
  const requestedSegments = buildPlanningSegments(start, end);

  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (ignoreTaskId && line.id === ignoreTaskId) continue;
      if (line.plannedBayId === bayId && line.planningStart && line.planningEnd) {
        if (segmentsOverlap(requestedSegments, getLinePlanningSegments(line))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function calculateTechnicianDailyLoad(
  techId: string,
  dateStr: string,
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[] = [],
  ignoreTaskId?: string
): number {
  let total = 0;
  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (ignoreTaskId && line.id === ignoreTaskId) continue;
      
      const assignedTechId = line.plannedTechnicianId || dossier.technicienId;
      if (assignedTechId !== techId) continue;
      
      const status = normalizeRepairOrderStatus(line.status);
      if (status === "done") continue;
      
      const segments = getLinePlanningSegments(line);
      if (segments.length > 0) {
        total += calculateSegmentHoursForDate(segments, dateStr);
      } else if (status === "in_progress") {
        const todayStr = new Date().toISOString().split("T")[0];
        const isOnDate = line.planningDate === dateStr || (!line.planningDate && dateStr === todayStr);
        if (isOnDate) {
          total += line.tempsEstime;
        }
      }
    }
  }

  for (const res of reservations) {
    if (res.technicianId !== techId) continue;
    if (res.status === "RESERVATION_CONFIRMEE" || res.status === "AFFECTEE_ATELIER") {
      if (res.segments && res.segments.length > 0) {
        total += calculateSegmentHoursForDate(res.segments, dateStr);
      } else {
        const resDate = res.startTime ? res.startTime.split("T")[0] : res.desiredDate;
        if (resDate === dateStr) {
          total += res.totalHours;
        }
      }
    }
  }

  return total;
}

export function calculateBayDailyLoad(
  bayId: string,
  dateStr: string,
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[] = [],
  ignoreTaskId?: string
): number {
  let total = 0;
  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (ignoreTaskId && line.id === ignoreTaskId) continue;
      
      const assignedBayId = line.plannedBayId;
      if (assignedBayId !== bayId) continue;
      
      const status = normalizeRepairOrderStatus(line.status);
      if (status === "done") continue;
      
      const segments = getLinePlanningSegments(line);
      if (segments.length > 0) {
        total += calculateSegmentHoursForDate(segments, dateStr);
      } else if (status === "in_progress") {
        const todayStr = new Date().toISOString().split("T")[0];
        const isOnDate = line.planningDate === dateStr || (!line.planningDate && dateStr === todayStr);
        if (isOnDate) {
          total += line.tempsEstime;
        }
      }
    }
  }

  for (const res of reservations) {
    if (res.bayId !== bayId) continue;
    if (res.status === "RESERVATION_CONFIRMEE" || res.status === "AFFECTEE_ATELIER") {
      if (res.segments && res.segments.length > 0) {
        total += calculateSegmentHoursForDate(res.segments, dateStr);
      } else {
        const resDate = res.startTime ? res.startTime.split("T")[0] : res.desiredDate;
        if (resDate === dateStr) {
          total += res.totalHours;
        }
      }
    }
  }

  return total;
}

function getLinePlanningSegments(line: RepairOrderLine): Array<{ start: string; end: string }> {
  if (line.planningSegments && line.planningSegments.length > 0) return line.planningSegments;
  if (line.planningStart && line.planningEnd) {
    return buildPlanningSegments(new Date(line.planningStart), new Date(line.planningEnd));
  }
  return [];
}

function segmentsOverlap(
  leftSegments: Array<{ start: string; end: string }>,
  rightSegments: Array<{ start: string; end: string }>
): boolean {
  return leftSegments.some(left => {
    const leftStart = new Date(left.start).getTime();
    const leftEnd = new Date(left.end).getTime();
    return rightSegments.some(right => {
      const rightStart = new Date(right.start).getTime();
      const rightEnd = new Date(right.end).getTime();
      return leftStart < rightEnd && rightStart < leftEnd;
    });
  });
}

function calculateSegmentHoursForDate(segments: Array<{ start: string; end: string }>, dateStr: string): number {
  return segments.reduce((total, segment) => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);
    const segmentDate = start.toISOString().split("T")[0];
    if (segmentDate !== dateStr) return total;
    return total + Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  }, 0);
}

function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function nextWorkingDay(date: Date): Date {
  let next = addCalendarDays(date, 1);
  while (!isWorkingDay(next)) {
    next = addCalendarDays(next, 1);
  }
  return next;
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function maxDate(left: Date, right: Date): Date {
  return left.getTime() > right.getTime() ? left : right;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEnumValue<T extends Record<string, string>>(enumValue: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(enumValue).includes(value);
}
