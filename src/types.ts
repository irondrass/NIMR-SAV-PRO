/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  DIRECTEUR_SAV = "Directeur SAV",
  CHEF_ATELIER = "Chef d’atelier",
  RECEPTIONNAIRE = "Réceptionnaire",
  TECHNICIEN = "Technicien",
  CONTROLE_QUALITE = "Contrôle Qualité",
  LIVRAISON = "Livraison",
  LECTURE_SEULE = "Lecture seule"
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  pinHash?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserSession {
  userId: string;
  displayName: string;
  role: UserRole;
  loginAt: string;
}

export enum DossierStatus {
  NOUVEAU = "Nouveau dossier",
  RDV_A_FIXER = "RDV à fixer",
  RDV_FIXE = "RDV fixé",
  CLIENT_ABSENT = "Client absent",
  EN_ATTENTE_RECEPTION = "En attente réception",
  VEHICULE_RECU = "Véhicule reçu",
  EN_ATTENTE_ACCORD = "En attente accord",
  TRAVAUX_PLANIFIES = "Travaux planifiés",
  EN_TRAVAUX = "En travaux",
  BLOQUE = "Bloqué",
  CONTROLE_QUALITE = "Contrôle qualité",
  PRET_A_LIVRER = "Prêt à livrer",
  LIVRE = "Livré",
  CLOTURE = "Clôturé opérationnellement",
  PRET_FACTURATION = "Prêt pour facturation ERP"
}

export enum DossierPriority {
  NORMALE = "normale",
  URGENTE = "urgente",
  CLIENT_VIP = "client VIP",
  VEHICULE_IMMOBILISE = "véhicule immobilisé",
  LIVRAISON_AUJOURDHUI = "livraison aujourd’hui",
  RECLAMATION = "réclamation"
}

export enum InterventionType {
  ENTRETIEN_RAPIDE = "entretien rapide",
  MECANIQUE_GENERALE = "réparation mécanique",
  ELECTRICITE_DIAG = "réparation électrique",
  DIAGNOSTIC = "diagnostic",
  GARANTIE_CONSTRUCTEUR = "garantie constructeur",
  CARROSSERIE = "carrosserie",
  ASSURANCE = "assurance",
  PREPARATION_LIVRAISON = "préparation livraison",
  RECLAMATION_CLIENT = "réclamation client"
}

export enum AtelierZone {
  MECANIQUE_RAPIDE = "Mécanique Rapide",
  GRANDS_TRAVAUX = "Grands Travaux Mécaniques",
  ELECTRICITE_DIAG = "Électricité / Diagnostic",
  CARROSSERIE = "Carrosserie",
  PREPARATION = "Préparation",
  PEINTURE = "Peinture",
  CONTROLE_QUALITE = "Contrôle Qualité",
  LAVAGE_FINITION = "Lavage / Finition"
}

export const PHOTO_CATEGORIES = [
  "réception avant",
  "réception arrière",
  "côté gauche",
  "côté droit",
  "intérieur",
  "kilométrage",
  "défaut carrosserie",
  "autre",
] as const;

export type PhotoCategory = typeof PHOTO_CATEGORIES[number];

export interface CameraPhoto {
  id: string;
  url: string;
  title: string;
  date: string;
  takenBy: string;
  category: PhotoCategory;
  mimeType?: string;
  sizeBytes?: number;
}

export type RepairOrderStatus = "pending" | "in_progress" | "paused" | "blocked" | "done" | "reopened";

export interface RepairOrderLine {
  id: string;
  designation: string;
  tempsEstime: number; // in hours
  tempsPasse: number; // in hours
  status: RepairOrderStatus;
  reopenedReason?: string;
  history?: string[];
  
  // Fields for Lot 4 planning
  planningStart?: string;
  planningEnd?: string;
  planningSegments?: Array<{ start: string; end: string }>;
  plannedTechnicianId?: string;
  plannedBayId?: string;
  planningDate?: string;
}

export interface ComplementTravail {
  id: string;
  titre: string;
  description: string;
  tempsEstime: number; // hours
  impactPlanning: string;
  accordRequis: "client" | "assurance" | "garantie" | "aucun";
  statut: "brouillon" | "attente" | "accepte" | "refuse" | "planifie" | "termine";
  photos: string[];
}

export interface AccordSuivi {
  id: string;
  type: "Client" | "Assurance" | "Garantie Constructeur";
  destinataire: string;
  dateEnvoi: string;
  dateRelance?: string;
  statut: "en_attente" | "approuve" | "refuse" | "rappele";
  commentaire: string;
  pieceJointe?: string;
}

export interface ChecklistQualite {
  essaiEffectue: boolean;
  defautRepare: boolean;
  aucunVoyantAllume: boolean;
  niveauxVerifies: boolean;
  serrageSecurite: boolean;
  propreteVehicule: boolean;
  documentsPrets: boolean;
  photosApresOk: boolean;
  validationGlobale: "en_attente" | "valide" | "refuse";
  commentaireRefus?: string;
  dateValidation?: string;
  validePar?: string;
}

export interface DeliveryProtocole {
  controleQualiteOk: boolean;
  clientInforme: boolean;
  dateLivraisonPrevue: string;
  dateLivraisonReelle?: string;
  remarquesLivraison: string;
  confirmationReceptionClient: boolean;
  signatureClientUri?: string; // Simulated base64
  clotureInterne: boolean;
}

export interface ReclammationClient {
  id: string;
  dossierId: string;
  clientNom: string;
  vehiculeNom: string;
  motif: string;
  criticite: "moyenne" | "haute" | "critique";
  responsable: string;
  statut: "nouvelle" | "en_cours" | "resolue" | "classee";
  actionCorrective: string;
  delaiTraitement: string;
  dateCreation: string;
  historiqueLogs: string[];
}

export interface ActiviteLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
}

export interface TechnicienResource {
  id: string;
  nom: string;
  specialite: string;
  disponibilite: "disponible" | "occupe" | "absent" | "formation";
  compétences: string[];
  zoneAffectee: AtelierZone;
  absencesConges: string[]; // dates description
  capaciteJournaliere: number; // standard 8h
  chargeActuelle: number; // sum of scheduled hours
}

export interface WorkshopBay {
  id: string;
  name: string;
  zone?: AtelierZone;
}

export interface DossierSAV {
  id: string; // EX: NIMR-2026-001
  clientNom: string;
  clientTelephone: string;
  deposantNom: string;
  deposantTelephone: string;
  vehiculeMarque: string; // Dongfeng, DFSK, Forthing
  vehiculeModele: string;
  vehiculeImmatriculation: string; // Ex: 000 TU 0001
  vehiculeVIN: string;
  vehiculeKilometrage: number;
  vehiculeCouleur: string;
  typeDossier: InterventionType;
  priorite: DossierPriority;
  plainteClient: string;
  observationsReception: string;
  photosAvant: CameraPhoto[];
  niveauCarburant: number; // percentage unit or ratio
  etatCarrosserie: {
    rayures: boolean;
    bosses: boolean;
    fissureParbrise: boolean;
    jantesAbimees: boolean;
    autresNotes: string;
  };
  objetsLaisses: string[];
  dateReception: string;
  dateSouhaiteeLivraison: string;
  
  // Operational workshop status
  statut: DossierStatus;
  technicienId?: string; // current active task technician
  zoneAtelier?: AtelierZone;
  workshopBayId?: string;
  
  // Sections Inside Tabbed detail view
  ordresReparation: RepairOrderLine[];
  complements: ComplementTravail[];
  accords: AccordSuivi[];
  checklistQC: ChecklistQualite;
  livraison: DeliveryProtocole;
  
  // Custom states
  bloqueRaison?: string;
  prochaineActionRecommended: string;
  dateDernierStatut: string;
  avancementGlobal: number; // progress indicator 0 - 100
  datePlanningDebut?: string;
  datePlanningFin?: string;
  historiqueLogs?: string[];
}
