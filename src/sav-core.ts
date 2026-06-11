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
} from "./types";

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
  motif: string;
  criticite: ReclammationClient["criticite"];
  responsable: string;
  actionCorrective: string;
}

export interface WorkshopSlotSuggestionInput {
  dossiers: DossierSAV[];
  technicians: TechnicienResource[];
  workshopBays: WorkshopBay[];
  estimatedHours: number;
  desiredDate: Date | string;
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
      },
      {
        id: createRuntimeId("ro_auto"),
        designation: "Contrôle global NIMR Premium (28 points de contrôle)",
        tempsEstime: 1.0,
        tempsPasse: 0,
        status: "pending",
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
  const createdAt = now.toISOString();

  return {
    id: createSequentialBusinessId("REC", existingIds, now),
    dossierId: input.dossierId.trim() || "NIMR-GEN",
    clientNom: input.clientNom.trim(),
    vehiculeNom: input.vehiculeNom.trim() || "Non spécifié",
    motif: input.motif.trim(),
    criticite: input.criticite,
    responsable: input.responsable.trim() || "Responsable Démo SAV",
    statut: "nouvelle",
    actionCorrective: input.actionCorrective.trim() || "À définir suite d'investigation d'atelier",
    delaiTraitement: "Sous 48 heures",
    dateCreation: createdAt,
    historiqueLogs: [`${createdAt} - Réclamation créée.`],
  };
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

    const activeLineInDossier = dossier.ordresReparation.find(
      current => current.id !== lineId && normalizeRepairOrderStatus(current.status) === "in_progress"
    );
    if (activeLineInDossier) {
      return { ok: false, error: "Une tâche est déjà en cours pour ce dossier." };
    }

    if (dossier.technicienId) {
      const activeForTechnician = normalizedDossiers.find(currentDossier =>
        currentDossier.id !== dossierId &&
        currentDossier.technicienId === dossier.technicienId &&
        currentDossier.ordresReparation.some(current => normalizeRepairOrderStatus(current.status) === "in_progress")
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
        bloqueRaison: "",
        prochaineActionRecommended: "Terminer la tâche en cours avant d'en démarrer une autre",
      },
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
    };
  });
}

export function blockRepairOrder(
  dossiers: DossierSAV[],
  dossierId: string,
  lineId: string,
  reason = "Blocage technique atelier",
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

export function suggestWorkshopSlot(input: WorkshopSlotSuggestionInput): WorkshopSlotSuggestion {
  const durationHours = Math.max(0.5, Number.isFinite(input.estimatedHours) ? input.estimatedHours : 1);
  const durationMinutes = Math.ceil(durationHours * 60);
  const desiredDate = input.desiredDate instanceof Date ? input.desiredDate : new Date(input.desiredDate);
  const usableTechnicians = input.technicians.filter(technician => !["absent", "formation"].includes(technician.disponibilite));
  const technicians = usableTechnicians.length > 0 ? usableTechnicians : input.technicians;

  // Search for the next 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const candidateDate = addCalendarDays(desiredDate, dayOffset);
    if (!isWorkingDay(candidateDate)) continue;

    const dateStr = candidateDate.toISOString().split("T")[0];

    // Determine candidate times: Saturday ends at 12, Mon-Fri at 17
    let timeCursor = dayOffset === 0 
      ? maxDate(alignToWorkingTime(desiredDate), setTimeOnDate(candidateDate, 8, 0)) 
      : setTimeOnDate(candidateDate, 8, 0);

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

      // Sort technicians by their daily load on dateStr (or fallback to chargeActuelle)
      const sortedTechs = [...technicians].sort((left, right) => {
        let loadLeft = calculateTechnicianDailyLoad(left.id, dateStr, input.dossiers);
        let loadRight = calculateTechnicianDailyLoad(right.id, dateStr, input.dossiers);
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

        // 2. Capacity check for technician
        const maxCap = candidateDate.getDay() === 6 ? 4 : 8;
        let dailyLoad = calculateTechnicianDailyLoad(tech.id, dateStr, input.dossiers);
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
          if (!detectBayCollision(input.dossiers, bay.id, timeCursor, endTime)) {
            const segments = buildPlanningSegments(timeCursor, endTime);
            // Found a valid slot!
            return {
              technicianId: tech.id,
              technicianName: tech.nom,
              bayId: bay.id,
              bayName: bay.name,
              startTime: timeCursor.toISOString(),
              endTime: endTime.toISOString(),
              segments,
              reason: `Technicien compatible avec ${formatHours(dailyLoad)}h déjà planifiées et capacité restante suffisante.`,
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
    statut: DossierStatus.BLOQUE,
    prochaineActionRecommended: `Alerte: Retour atelier suite à refus contrôle qualité. Motif: ${comment}`,
    bloqueRaison: `Refus qualité: ${comment}`,
    dateDernierStatut: now.toISOString(),
  };
}

export function confirmDelivery(dossier: DossierSAV, now = new Date()): DossierSAV {
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
  activityLogs: ActiviteLog[]
): BackupPayload {
  return { dossiers, reclamations, techList, activityLogs };
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

  return { ok: true, data };
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
    ["moyenne", "haute", "critique"].includes(String(value.criticite)) &&
    ["nouvelle", "en_cours", "resolue", "classee"].includes(String(value.statut)) &&
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

function chooseWorkshopBay(workshopBays: WorkshopBay[], technicianZone?: AtelierZone): WorkshopBay {
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

export function calculateTechnicianDailyLoad(techId: string, dateStr: string, dossiers: DossierSAV[]): number {
  let total = 0;
  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (line.plannedTechnicianId === techId && line.planningDate === dateStr) {
        total += calculateSegmentHoursForDate(getLinePlanningSegments(line), dateStr);
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

function nextWorkingDay(date: Date): Date {
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
