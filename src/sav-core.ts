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
  ReclammationClient,
  TechnicienResource,
  UserRole,
} from "./types";

const DELIVERY_OFFSET_MS = 48 * 3600 * 1000;
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
}

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
      takenBy: "Conseiller Client NIMR",
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
        status: "non_commence",
      },
      {
        id: createRuntimeId("ro_auto"),
        designation: "Contrôle global NIMR Premium (28 points de contrôle)",
        tempsEstime: 1.0,
        tempsPasse: 0,
        status: "non_commence",
      },
    ],
    complements: [],
    accords: [],
    checklistQC: createEmptyChecklist(),
    livraison: createDeliveryProtocol(deliveryDate),
    prochaineActionRecommended: "Affecter à un technicien selon disponibilité atelier",
    dateDernierStatut: receptionDate,
    avancementGlobal: 10,
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
