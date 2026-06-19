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
  lastActivityAt?: string;
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
  IMMOBILISE = "Immobilisé",
  CONTROLE_QUALITE = "Contrôle qualité",
  PRET_A_LIVRER = "Prêt à livrer",
  NON_RETIRE = "Non retiré",
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

export type QuoteLineType = "labor" | "part" | "paint" | "misc" | "unknown";

export interface QuoteLine {
  id: string;
  rawText: string;
  description: string;
  type: QuoteLineType;
  hours: number; // hours, 0 if not labor or not detected
  confidence: "high" | "medium" | "low";
  selected: boolean; // user selects which labor lines to import
  editedDescription?: string;
  editedHours?: number;
}

export interface QuoteImportPreview {
  importId: string;
  sourceType: "text" | "csv" | "xlsx";
  fileName?: string;
  lines: QuoteLine[];
  laborCount: number;
  partCount: number;
  totalDetectedHours: number;
  ignoredCount?: number;
}

export interface QuoteImportResult {
  importId: string;
  importedLines: RepairOrderLine[];
  laborLinesCount: number;
  partLinesCount: number;
  totalHours: number;
  historyEntry: string;
}

export const TASK_BLOCK_FOLLOW_UP_OWNERS = [
  "Chef Atelier",
  "Réception",
  "Garantie",
  "Support technique",
  "Client",
] as const;

export type TaskBlockFollowUpOwner = typeof TASK_BLOCK_FOLLOW_UP_OWNERS[number];

export const DELIVERY_RESTITUTION_STATUSES = [
  "Client absent",
  "Livraison reportée",
  "Réserve client",
  "Client mécontent",
  "Livré sans réserve",
] as const;

export type DeliveryRestitutionStatus = typeof DELIVERY_RESTITUTION_STATUSES[number];

export interface RepairOrderLine {
  id: string;
  designation: string;
  tempsEstime: number; // in hours
  tempsPasse: number; // in hours
  status: RepairOrderStatus;
  reopenedReason?: string;
  history?: string[];
  diagnosticFinal?: string;
  blockReason?: string;
  blockComment?: string;
  blockFollowUpOwner?: TaskBlockFollowUpOwner;
  blockResolutionEta?: string;
  blockSparePartRef?: string;
  blockSparePartEta?: string;

  // Lot 5F-3: estimate source and duration validation
  estimateSource?: "manual" | "preset" | "quote-import" | "demo";
  isEstimatedDurationValidated?: boolean;
  quoteImportId?: string;
  quoteLineRef?: string;
  operationCode?: string;
  operationFamily?: string;

  // Fields for Lot 4 planning
  planningStart?: string;
  planningEnd?: string;
  planningSegments?: Array<{ start: string; end: string }>;
  plannedTechnicianId?: string;
  plannedBayId?: string;
  planningDate?: string;
  sourceComplaintId?: string;
  complaintSeverity?: ComplaintCriticity;
  complaintBadge?: boolean;
  workshopZoneNote?: string;
  chefNotes?: string;
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

export interface WarrantyLocalAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
  addedAt: string;
  addedBy: string;
  note: string;
}

export interface SatisfactionFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
  createdBy: string;
  status: "a_contacter" | "satisfait" | "insatisfait" | "neutre";
  internalPilotOnly: true;
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
  statutRestitution?: DeliveryRestitutionStatus;
  confirmationReceptionClient: boolean;
  signatureClientUri?: string; // Simulated base64
  clotureInterne: boolean;
  kilometrageSortie?: number;
}

export type ComplaintCriticity = "basse" | "moyenne" | "haute" | "critique";

export type ComplaintStatus =
  | "nouvelle"
  | "en_analyse"
  | "action_corrective"
  | "attente_client"
  | "resolue"
  | "cloturee"
  | "reouverte"
  | "tache_corrective_creee"
  | "en_cours_atelier"
  | "attente_qc"
  | "action_realisee"
  | "rejetee_non_fondee"
  | "en_cours"
  | "classee";

export interface ComplaintHistoryEntry {
  id: string;
  date: string;
  utilisateur: string;
  role: UserRole | string;
  action: string;
  ancienStatut?: ComplaintStatus;
  nouveauStatut?: ComplaintStatus;
  commentaire?: string;
  ancienResponsable?: string;
  nouveauResponsable?: string;
}

export interface ReclammationClient {
  id: string;
  dossierId: string;
  clientNom: string;
  vehiculeNom: string;
  immatriculation?: string;
  motif: string;
  criticite: ComplaintCriticity;
  responsable: string;
  statut: ComplaintStatus;
  actionCorrective: string;
  delaiCible?: string;
  delaiTraitement: string;
  dateCreation: string;
  dateDerniereModification?: string;
  historiqueActions?: ComplaintHistoryEntry[];
  historiqueLogs: string[];
  linkedDossierId?: string;
  linkedRepairOrderIds?: string[];
  correctiveTaskCreated?: boolean;
  correctiveTaskId?: string;
  source?: "reception" | "livraison" | "qc" | "direction" | "client";
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
  vehiculeVersion?: string;
  dateLivraison?: string;
  dateMiseCirculation?: string;
  statutGarantie?: string;
  dernierEntretien?: string;
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
  bloqueComment?: string;
  bloqueResponsableSuivi?: TaskBlockFollowUpOwner;
  bloqueResolutionEta?: string;
  bloqueSparePartRef?: string;
  bloqueSparePartEta?: string;
  retourQualite?: boolean;
  warrantyAttachments?: WarrantyLocalAttachment[];
  satisfaction?: SatisfactionFeedback;
  archiveOperationnelle?: boolean;
  archiveDate?: string;
  prochaineActionRecommended: string;
  dateDernierStatut: string;
  avancementGlobal: number; // progress indicator 0 - 100
  datePlanningDebut?: string;
  datePlanningFin?: string;
  historiqueLogs?: string[];
}

export type WorkshopReservationStatus =
  | "A_RESERVER"            // À réserver
  | "CRENEAU_PROPOSE"       // Créneau proposé
  | "RESERVATION_CONFIRMEE" // Réservation confirmée
  | "AFFECTEE_ATELIER"      // Affectée atelier
  | "ANNULEE"               // Annulée
  | "TRANSFORMEE_PLANNING"; // Transformée en planning

export interface WorkshopReservation {
  reservationId: string;
  dossierId: string;
  taskIds: string[];
  totalHours: number; // durée totale MO validée
  desiredDate: string; // date souhaitée
  startTime?: string; // créneau proposé start
  endTime?: string; // créneau proposé end
  segments?: Array<{ start: string; end: string }>; // segments proposés
  technicianId?: string; // technicien proposé
  bayId?: string; // pont proposé
  status: WorkshopReservationStatus; // statut réservation
  source: string; // source
  history: string[]; // historique
}

export interface WorkshopDaySchedule {
  dayOfWeek: number; // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
  isClosed: boolean;
  windows: Array<{ start: string; end: string }>;
}

export interface WorkshopSchedule {
  days: WorkshopDaySchedule[];
}

export interface WorkshopShiftProfile {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  schedule: WorkshopSchedule;
}

export interface TechnicianShiftAssignment {
  id: string;
  technicianId: string;
  shiftProfileId: string;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
}

export interface BayShiftAssignment {
  id: string;
  bayId: string;
  shiftProfileId: string;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
}

export interface WorkshopExceptionDay {
  id: string;
  date: string; // YYYY-MM-DD
  isClosed: boolean;
  windows?: Array<{ start: string; end: string }>;
  reason?: string;
}

export interface TechnicianAbsence {
  id: string;
  technicianId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface BayUnavailability {
  id: string;
  bayId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface WorkshopHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface WorkshopAvailabilityConfig {
  schedule: WorkshopSchedule;
  exceptions: WorkshopExceptionDay[];
  absences: TechnicianAbsence[];
  bayUnavailabilities: BayUnavailability[];
  holidays: WorkshopHoliday[];
  shiftProfiles?: WorkshopShiftProfile[];
  technicianShiftAssignments?: TechnicianShiftAssignment[];
  bayShiftAssignments?: BayShiftAssignment[];
}

export interface VehicleMasterRecord {
  id: string;
  vin?: string;
  plateNumber?: string;
  customerName?: string;
  customerPhone?: string;
  itemNo?: string;
  brand?: string;
  model?: string;
  version?: string;
  deliveryDate?: string;
  circulationDate?: string;
  saleDate?: string;
  warrantyPartsEndDate?: string;
  warrantyLaborEndDate?: string;
  lastServiceDate?: string;
  lastServiceMileage?: number;
  energy?: string;
  source?: string;
  importedAt?: string;
}

export type VehicleWarrantyStatus = "Garantie active" | "Garantie expirée" | "Garantie inconnue";

export interface VehicleReceptionHint {
  warrantyStatus: VehicleWarrantyStatus;
  lastServiceInfo?: string;
  hasActiveWarranty: boolean;
  recommendedService?: string;
}

export interface VehicleMasterImportResult {
  records: VehicleMasterRecord[];
  importedCount: number;
  ignoredCount: number;
  duplicateVinCount: number;
  duplicatePlateCount: number;
  errors: string[];
  warnings: string[];
}

export type SavReportPeriod = "jour" | "semaine" | "mois" | "tous";

export interface SavReportFilters {
  period: SavReportPeriod;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  dossierStatus?: DossierStatus;
  technicianId?: string;
  workshopBayId?: string;
  receptionistId?: string;
  typeDossier?: InterventionType;
  modelQuery?: string;
  searchQuery?: string; // VIN, immatriculation, client
  vehicleMasterRecords?: VehicleMasterRecord[];
}

export interface DossierHistoryEntry {
  date: string; // ISO string or YYYY-MM-DD HH:MM
  type: string; // e.g. "creation", "status_change", "task_started", "qc_valid", etc.
  label: string;
  actor?: string;
  role?: UserRole | string;
  statusBefore?: string;
  statusAfter?: string;
  details?: string;
}

export interface VehicleHistoryEntry {
  vin?: string;
  plateNumber?: string;
  brand?: string;
  model?: string;
  clientNom?: string;
  dossierIds: string[];
  passagesCount: number;
  firstPassageDate?: string;
  lastPassageDate?: string;
  lastServiceMileage?: number;
  lastStatus?: DossierStatus;
  complaintsCount: number;
  dossiers: DossierSAV[];
}

export interface ClientHistoryEntry {
  clientNom: string;
  clientTelephone?: string;
  associatedVehicles: Array<{ vin?: string; plateNumber?: string; brand?: string; model?: string }>;
  passagesCount: number;
  dossierIds: string[];
  complaintsCount: number;
}

export interface ReceptionReport {
  totalCreated: number;
  manualCount: number;
  prefilledCount: number;
  prefilledPercentage: number;
  notFoundInMasterCount: number;
  motifsFrequents: Array<{ motif: string; count: number }>;
  modelsFrequents: Array<{ model: string; count: number }>;
  incompleteDossiersCount: number; // e.g. missing plate/VIN or phone
}

export interface WorkshopReport {
  tasksByStatus: Record<RepairOrderStatus, number>;
  totalLaborHoursEstimated: number; // validated preset/quote-import hours
  totalLaborHoursPlanned: number;   // planned Gantt segments duration
  totalLaborHoursSpent: number;     // actual spent hours of done tasks
  techniciansLoad: Array<{
    technicianId: string;
    technicianNom: string;
    plannedTasksCount: number;
    plannedHours: number;
  }>;
  baysLoad: Array<{
    bayId: string;
    bayName: string;
    plannedTasksCount: number;
    plannedHours: number;
  }>;
}

export interface PlanningReport {
  reservationsToConfirmCount: number; // A_RESERVER or CRENEAU_PROPOSE
  reservationsConfirmedCount: number; // RESERVATION_CONFIRMEE
  reservationsCancelledCount: number; // ANNULEE
  reservationsConvertedCount: number; // TRANSFORMEE_PLANNING
  conversionRate: number; // Converted / (Confirmed + Converted + Cancelled) * 100
  multiDayReservationsCount: number;
  conflictsPreventedCount: number;
}

export interface QcReport {
  totalQcChecked: number;
  totalQcPassed: number;
  totalQcFailed: number;
  passRate: number; // (Passed / Checked) * 100
  motifsRefus: Array<{ motif: string; count: number }>;
  firstTimeRightRate: number; // % of dossiers that passed QC without any QC refusals in history
}

export interface DeliveryReport {
  totalReadyToDeliver: number;
  totalDelivered: number;
  totalPendingClient: number; // client notified or en attente client
  averageQcToDeliveryDays: number; // average duration between last QC approval and delivery
  restitutionStatuses: Array<{ status: DeliveryRestitutionStatus; count: number }>;
}

export interface ComplaintReport {
  totalComplaints: number;
  byStatus: Record<ComplaintStatus, number>;
  byCriticite: Record<ComplaintCriticity, number>;
  averageResolutionDays: number;
}

export interface BlockingReport {
  totalBlockedDossiers: number;
  totalBlockedTasks: number;
  motifsBlocage: Array<{ motif: string; count: number }>;
  averageBlockingDurationHours: number;
  blockingByFamily: Array<{ family: string; count: number }>; // e.g. delay parts, assurance, client devis
}

export interface OperationalKpiReport {
  dossiersStatusCounts: Record<DossierStatus, number>;
  activeDossiersCount: number; // non-delivered/non-ERP dossiers
  criticalPriorityDossiersCount: number;
  averageStayDays: number; // average stay duration from reception to delivery/ERP
}
