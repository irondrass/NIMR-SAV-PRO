/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import StandardReasonModal from "./StandardReasonModal";
import QuoteImportModal from "./QuoteImportModal";
import PrintDocuments from "./PrintDocuments";
import ConfirmModal from "./ConfirmModal";
import AuditTrailView from "./AuditTrailView";
import { applyQuoteImportPreview } from "../quote-import";
import {
  DossierSAV,
  DossierStatus,
  DossierPriority,
  InterventionType,
  AtelierZone,
  RepairOrderLine,
  ComplementTravail,
  AccordSuivi,
  ReclammationClient,
  UserRole,
  TaskBlockFollowUpOwner,
  PHOTO_CATEGORIES,
  PhotoCategory,
  WorkshopReservation,
  TechnicienResource,
  WorkshopAvailabilityConfig
} from "../types";
import * as perm from "../permissions";
import {
  addPhotoToDossier,
  blockRepairOrder,
  canDeliverDossier,
  confirmDelivery,
  createRuntimeId,
  finishRepairOrder,
  isRepairOrderDone,
  markReadyForBilling,
  normalizeRepairOrderStatus,
  pauseRepairOrder,
  releaseRepairOrderBlock,
  removePhotoFromDossier,
  reopenRepairOrder,
  startRepairOrder,
  submitQualityControl,
  getVehicleETAInfo,
  isSameVehicle,
  isDossierActive,
  suggestWorkshopSlot,
  reserveSuggestedWorkshopSlot,
  WorkshopSlotSuggestion,
  getQCStatusDisplayLabel,
  normalizeQCStatus,
  getDossierQCStatus,
  invalidateQCAfterWorkshopChange
} from "../sav-core";
import { COMPLAINT_STATUS_LABELS, normalizeComplaint, normalizeComplaintStatus } from "../complaints-workflow";
import { fileToCameraPhoto } from "../photo-utils";
import { validateStructuredTechnicianDiagnostic } from "../field-validations";
import { getTaskStatusVisual } from "../task-status-visual";
import { PILOT_SIGNATURE_NOTICE } from "../rc-notices";
import { logAuditEvent, AuditTrailResult, AuditTrailSource } from "../audit-trail";
import { canRunGuardedAction } from "../action-guard";
import { DEFAULT_WORKSHOP_BAYS } from "../workshop-bays";
import {
  buildDossierPlanningOverview,
  getRepairLinePlanningSegments,
  PLANNING_STEP_DEFINITIONS,
  PlanningStepId,
  releasePlanningStepReservation,
} from "../workshop-planning-steps";
import {
  buildStageReservationNeeds,
  buildWorkshopStageDurationSummary,
  createManualWorkshopTaskLine,
  WorkshopTaskPriority,
} from "../workshop-task-intake";
import { convertReservationToPlanning, validateReservationSlot } from "../workshop-reservations";
import {
  cancelWorkshopTaskAdministratively,
  deleteWorkshopTask,
  getWorkshopTaskDeletionReadiness,
  releaseWorkshopTaskReservation,
} from "../core/workshop-tasks";
import {
  ArrowLeft,
  FileText,
  User,
  Car,
  Wrench,
  Camera,
  Clock,
  ShieldAlert,
  CheckCircle,
  ChevronRight,
  Plus,
  AlertTriangle,
  History,
  Lock,
  ThumbsUp,
  XCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  Printer
} from "lucide-react";
import { StatusBadge, PriorityBadge, LicencePlate, FuelIndicator, MiniProgress, InterventionTypeBadge } from "./UIParts";

interface DossierDetailProps {
  dossier: DossierSAV;
  dossiers: DossierSAV[];
  reclamations: ReclammationClient[];
  userRole: UserRole;
  onBack: () => void;
  onUpdateDossier: (updated: DossierSAV) => void;
  techniciensList: { id: string; nom: string }[];
  reservations?: WorkshopReservation[];
  onUpdateReservations: (updated: WorkshopReservation[]) => void;
  techniciens: TechnicienResource[];
  availabilityConfig: WorkshopAvailabilityConfig;
}

function formatRepairOrderDuration(hours: number | undefined): string {
  return hours && hours > 0 ? `${hours}H` : "À estimer";
}

export default function DossierDetail({
  dossier,
  dossiers,
  reclamations,
  userRole,
  onBack,
  onUpdateDossier,
  techniciensList,
  reservations,
  onUpdateReservations,
  techniciens,
  availabilityConfig
}: DossierDetailProps) {
  const [activeTab, setActiveTab] = useState<string>("resume");
  const [printType, setPrintType] = useState<"reception" | "or" | "qc" | "delivery" | "task" | null>(null);
  const [printTask, setPrintTask] = useState<RepairOrderLine | null>(null);

  // Temporary form values for adding a repair order line
  const [newROLineText, setNewROLineText] = useState("");
  const [showQuoteImport, setShowQuoteImport] = useState(false);
  const [showWorkshopTaskModal, setShowWorkshopTaskModal] = useState(false);
  const [workshopTaskLabel, setWorkshopTaskLabel] = useState("");
  const [workshopTaskDescription, setWorkshopTaskDescription] = useState("");
  const [workshopTaskStage, setWorkshopTaskStage] = useState<PlanningStepId>("mechanical");
  const [workshopTaskDuration, setWorkshopTaskDuration] = useState("");
  const [workshopTaskTechnician, setWorkshopTaskTechnician] = useState("");
  const [workshopTaskBay, setWorkshopTaskBay] = useState("");
  const [workshopTaskPriority, setWorkshopTaskPriority] = useState<WorkshopTaskPriority>("normale");
  const [workshopTaskComment, setWorkshopTaskComment] = useState("");
  const [workshopTaskModalError, setWorkshopTaskModalError] = useState("");
  const [reservationBatchResult, setReservationBatchResult] = useState<{
    technicianName: string;
    bayName: string;
    start: string;
    end: string;
    count: number;
  } | null>(null);
  const [durationValidationLineId, setDurationValidationLineId] = useState<string | null>(null);
  const [durationValidationHours, setDurationValidationHours] = useState("");
  const [durationValidationReason, setDurationValidationReason] = useState("");
  const [durationValidationError, setDurationValidationError] = useState<string | null>(null);
  const [deleteTaskTargetId, setDeleteTaskTargetId] = useState<string | null>(null);
  const [deleteTaskMode, setDeleteTaskMode] = useState<"delete" | "cancel" | null>(null);
  const [deleteTaskReason, setDeleteTaskReason] = useState("");
  const [deleteTaskError, setDeleteTaskError] = useState("");
  const [taskReservationReleasedMessage, setTaskReservationReleasedMessage] = useState("");

  // For adding custom logs
  const [newLogText, setNewLogText] = useState("");
  const [dossierPhotoTitle, setDossierPhotoTitle] = useState("");
  const [dossierPhotoCategory, setDossierPhotoCategory] = useState<PhotoCategory>("autre");

  // QA/E2E error states for strict validation
  const [taskError, setTaskError] = useState<string | null>(null);
  const [qcError, setQcError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: AuditTrailResult; message: string } | null>(null);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [showQCValidationConfirm, setShowQCValidationConfirm] = useState(false);
  const [showDeliveryValidationConfirm, setShowDeliveryValidationConfirm] = useState(false);
  const [finishCause, setFinishCause] = useState("");
  const [finishAction, setFinishAction] = useState("");
  const [finishValidation, setFinishValidation] = useState("");
  const [finishValidationError, setFinishValidationError] = useState<string | null>(null);
  const [finishSubmitting, setFinishSubmitting] = useState(false);

  // Cancellation states (Part 7)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotif, setCancelMotif] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Satisfaction entry states (Part 10)
  const [satisfactionRating, setSatisfactionRating] = useState<1|2|3|4|5 | null>(
    dossier.satisfaction?.rating ?? null
  );
  const [satisfactionComment, setSatisfactionComment] = useState(
    dossier.satisfaction?.comment ?? ""
  );

  // Modal states for Lot 1
  const [modalActive, setModalActive] = useState<"qc-refuse" | "task-reopen" | "task-block" | "task-unblock" | "task-finish" | null>(null);
  const [modalTargetLineId, setModalTargetLineId] = useState<string | null>(null);
  const [planningStepSuggestion, setPlanningStepSuggestion] = useState<{
    stepId: PlanningStepId;
    lineId: string;
    suggestion: WorkshopSlotSuggestion;
  } | null>(null);
  const [planningStepFeedback, setPlanningStepFeedback] = useState("");
  const [planningStepError, setPlanningStepError] = useState("");

  const planningOverview = buildDossierPlanningOverview(dossier, reservations || []);
  const workshopStageSummaryRows = buildWorkshopStageDurationSummary(dossier, reservations || []);
  const canEditDossierPlanning = userRole === UserRole.CHEF_ATELIER;
  const planningEtaInfo = getVehicleETAInfo(dossiers, dossier.id, reservations || []);
  const planningValidatedRows = planningOverview.steps.flatMap(step =>
    step.lines
      .filter(item => item.isPlanned)
      .map(item => {
        const segments = getRepairLinePlanningSegments(item.line);
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        return {
          step,
          item,
          start: firstSegment?.start || item.reservation?.startTime,
          end: lastSegment?.end || item.reservation?.endTime,
          technicianId: item.line.plannedTechnicianId || item.reservation?.technicianId,
          bayId: item.line.plannedBayId || item.reservation?.bayId,
          duration: item.reservedHours || item.reservation?.totalHours || 0,
        };
      })
  );

  const recordLocalAudit = (event: {
    action: string;
    summary: string;
    result?: AuditTrailResult;
    blockReason?: string;
    source: AuditTrailSource;
    ancienStatut?: DossierStatus | string;
    nouveauStatut?: DossierStatus | string;
  }) => {
    logAuditEvent({
      user: userRole,
      role: userRole,
      module: "dossier",
      action: event.action,
      dossierId: dossier.id,
      dossierLabel: `${dossier.vehiculeMarque} ${dossier.vehiculeModele}`,
      ancienStatut: event.ancienStatut,
      nouveauStatut: event.nouveauStatut,
      summary: event.summary,
      commentaire: event.summary,
      result: event.result || "success",
      blockReason: event.blockReason,
      source: event.source,
    });
  };

  const setSuccessFeedback = (message: string) => {
    setActionFeedback({ type: "success", message });
  };

  const setBlockedFeedback = (message: string) => {
    setActionFeedback({ type: "blocked", message });
  };

  const handlePrintDocument = (type: "reception" | "or" | "qc" | "delivery") => {
    if (!canRunGuardedAction(`print-document:${dossier.id}:${type}`)) return;
    setPrintTask(null);
    setPrintType(type);
    recordLocalAudit({
      action: "impression_document",
      summary: `Impression document ${type} demandée pour ${dossier.id}.`,
      source: "impression",
    });
    document.body.classList.add("printing-standard-document");

    const cleanup = () => {
      document.body.classList.remove("printing-standard-document");
      setPrintType(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(cleanup, 1000);
      });
    });
  };

  const handlePrintTaskDocument = (line: RepairOrderLine | null | undefined) => {
    if (!line) {
      setTaskError("Aucune tâche sélectionnée pour impression.");
      setActionFeedback({ type: "failed", message: "Aucune tâche sélectionnée pour impression." });
      return;
    }
    if (!canRunGuardedAction(`print-task:${dossier.id}:${line.id}`)) return;
    setPrintTask(line);
    setPrintType("task");
    recordLocalAudit({
      action: "impression_fiche_tache",
      summary: `Impression fiche tâche ${line.designation}.`,
      source: "impression",
    });
    document.body.classList.add("printing-task-sheet");

    const cleanup = () => {
      document.body.classList.remove("printing-task-sheet");
      setPrintType(null);
      setPrintTask(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(cleanup, 1000);
      });
    });
  };

  const updateDossierState = (changes: Partial<DossierSAV>) => {
    let updated = {
      ...dossier,
      ...changes,
      dateDernierStatut: new Date().toISOString()
    };
    if (changes.ordresReparation && dossier.checklistQC.validationGlobale === "valide") {
      updated = invalidateQCAfterWorkshopChange(
        updated,
        "Modification atelier après contrôle qualité conforme.",
        userRole
      );
    }
    onUpdateDossier(updated);
  };

  const getTechnicianName = (id?: string) =>
    techniciens.find(technician => technician.id === id)?.nom ||
    techniciensList.find(technician => technician.id === id)?.nom ||
    id ||
    "Non affecté";

  const getBayName = (id?: string) =>
    DEFAULT_WORKSHOP_BAYS.find(bay => bay.id === id)?.name || id || "Non affecté";

  const formatPlanningHours = (hours: number) => `${Number(hours.toFixed(2)).toLocaleString("fr-FR")} h`;

  const formatPlanningDate = (value?: string) => {
    if (!value) return "Non définie";
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? parsed.toLocaleDateString("fr-FR")
      : "Non définie";
  };

  const formatPlanningTimeRange = (start?: string, end?: string) => {
    if (!start || !end) return "Non réservé";
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return "Non réservé";
    return `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const resetPlanningStepMessages = () => {
    setPlanningStepError("");
    setPlanningStepFeedback("");
    setReservationBatchResult(null);
  };

  const resetWorkshopTaskModal = () => {
    setWorkshopTaskLabel("");
    setWorkshopTaskDescription("");
    setWorkshopTaskStage("mechanical");
    setWorkshopTaskDuration("");
    setWorkshopTaskTechnician("");
    setWorkshopTaskBay("");
    setWorkshopTaskPriority("normale");
    setWorkshopTaskComment("");
    setWorkshopTaskModalError("");
  };

  const handleOpenWorkshopTaskModal = () => {
    resetWorkshopTaskModal();
    setShowWorkshopTaskModal(true);
  };

  const handleSaveWorkshopTask = () => {
    const parsedDuration = Number(workshopTaskDuration.replace(",", "."));
    if (!workshopTaskLabel.trim()) {
      setWorkshopTaskModalError("Libellé tâche obligatoire.");
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0 || parsedDuration > 40) {
      setWorkshopTaskModalError("Durée estimée atelier obligatoire entre 0,1h et 40h.");
      return;
    }

    const newLine = createManualWorkshopTaskLine({
      label: workshopTaskLabel,
      shortDescription: workshopTaskDescription,
      stageId: workshopTaskStage,
      estimatedHours: parsedDuration,
      preferredTechnicianId: workshopTaskTechnician || undefined,
      requiredBayId: workshopTaskBay || undefined,
      priority: workshopTaskPriority,
      chefComment: workshopTaskComment,
    });
    const nextLines = [...dossier.ordresReparation, newLine];
    updateDossierState({
      ordresReparation: nextLines,
      avancementGlobal: nextLines.length > 0
        ? Math.round((nextLines.filter(isRepairOrderDone).length / nextLines.length) * 100)
        : dossier.avancementGlobal,
      historiqueLogs: [
        `${new Date().toISOString()} - Tâche atelier créée par ${userRole}: ${newLine.designation}.`,
        ...(dossier.historiqueLogs || []),
      ],
    });
    recordLocalAudit({
      action: "creation_tache_atelier",
      summary: `Tâche atelier créée: ${newLine.designation}.`,
      source: "atelier",
    });
    setShowWorkshopTaskModal(false);
    resetWorkshopTaskModal();
  };

  const handleReserveAllWorkshopTasks = () => {
    resetPlanningStepMessages();
    if (!canRunGuardedAction(`reserve-all-workshop-tasks:${dossier.id}`)) return;
    if (!canEditDossierPlanning) {
      const message = "Consultation uniquement : action réservée au Chef Atelier.";
      setPlanningStepError(message);
      setReservationBatchResult(null);
      recordLocalAudit({
        action: "reservation_toutes_taches_refusee",
        summary: message,
        result: "blocked",
        blockReason: message,
        source: "planning",
      });
      return;
    }

    const activeSteps = planningOverview.steps.filter(step => step.active);
    if (activeSteps.some(step => step.unvalidatedDurationCount > 0)) {
      setPlanningStepError("Durée manquante sur une tâche.");
      return;
    }

    let workingDossiers = dossiers.map(current => current.id === dossier.id ? dossier : current);
    let workingReservations = [...(reservations || [])];
    let workingDossier = workingDossiers.find(current => current.id === dossier.id) || dossier;
    const createdReservations: WorkshopReservation[] = [];
    const now = new Date();

    try {
      let needs = buildStageReservationNeeds(workingDossier, workingReservations);
      if (needs.length === 0) {
        setPlanningStepError("Aucune tâche active à réserver sur cette étape.");
        return;
      }

      for (const need of needs) {
        const suggestion = suggestWorkshopSlot({
          dossiers: workingDossiers,
          technicians: techniciens,
          workshopBays: DEFAULT_WORKSHOP_BAYS,
          estimatedHours: need.totalHours,
          desiredDate: createdReservations.at(-1)?.endTime || now,
          dossierId: workingDossier.id,
          reservations: workingReservations,
          availabilityConfig,
        }, now);

        const reservation: WorkshopReservation = {
          reservationId: createRuntimeId("res_stage"),
          dossierId: workingDossier.id,
          taskIds: need.taskIds,
          totalHours: need.totalHours,
          desiredDate: suggestion.startTime,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
          segments: suggestion.segments,
          technicianId: suggestion.technicianId,
          bayId: suggestion.bayId,
          status: "RESERVATION_CONFIRMEE",
          source: "stage-batch-reservation",
          history: [
            `${now.toISOString()} - Réservation groupée ${need.label} au premier créneau disponible.`,
          ],
        };

        const validation = validateReservationSlot({
          reservation,
          dossiers: workingDossiers,
          reservations: workingReservations,
          technicians: techniciens,
          workshopBays: DEFAULT_WORKSHOP_BAYS,
          availabilityConfig,
        }, now);
        if (!validation.allowed) {
          throw new Error(validation.reasons.join(" ") || "Aucun créneau disponible dans la période sélectionnée.");
        }

        const converted = convertReservationToPlanning(reservation, workingDossiers, now);
        workingDossiers = converted.dossiers;
        workingReservations = [...workingReservations, converted.reservation];
        workingDossier = workingDossiers.find(current => current.id === dossier.id) || workingDossier;
        createdReservations.push(converted.reservation);
        needs = buildStageReservationNeeds(workingDossier, workingReservations);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aucun créneau disponible pour cette durée.";
      setPlanningStepError(message || "Aucun créneau disponible pour cette durée.");
      setReservationBatchResult(null);
      recordLocalAudit({
        action: "reservation_toutes_taches_bloquee",
        summary: message,
        result: "blocked",
        blockReason: message,
        source: "planning",
      });
      return;
    }

    if (createdReservations.length === 0) {
      setPlanningStepError("Aucun créneau disponible pour cette durée.");
      return;
    }

    onUpdateDossier(workingDossier);
    onUpdateReservations(workingReservations);
    const first = createdReservations[0];
    setReservationBatchResult({
      technicianName: getTechnicianName(first.technicianId),
      bayName: getBayName(first.bayId),
      start: first.startTime || "",
      end: first.endTime || "",
      count: createdReservations.length,
    });
    setPlanningStepFeedback(`${createdReservations.length} étape(s) réservée(s) au premier créneau disponible.`);
    recordLocalAudit({
      action: "reservation_toutes_taches",
      summary: `${createdReservations.length} étape(s) réservée(s) au premier créneau disponible.`,
      source: "planning",
    });
  };

  const findPlanningStepLine = (stepId: PlanningStepId, mode: "reserve" | "reschedule") => {
    const step = planningOverview.steps.find(item => item.stepId === stepId);
    if (!step) return null;
    return mode === "reschedule"
      ? step.reschedulableLine || step.nextReservableLine || null
      : step.nextReservableLine || step.reschedulableLine || null;
  };

  const handleSuggestPlanningStep = (stepId: PlanningStepId, mode: "reserve" | "reschedule" = "reserve") => {
    resetPlanningStepMessages();
    if (!canEditDossierPlanning) {
      setPlanningStepError("Consultation uniquement : action réservée au Chef Atelier.");
      return;
    }
    const line = findPlanningStepLine(stepId, mode);
    if (!line) {
      const step = planningOverview.steps.find(item => item.stepId === stepId);
      setPlanningStepError(
        step?.unvalidatedDurationCount
          ? "Durée à valider par Chef Atelier avant planification."
          : "Aucune tâche active à réserver sur cette étape."
      );
      setPlanningStepSuggestion(null);
      return;
    }
    if (!line.tempsEstime || line.tempsEstime <= 0 || !line.isEstimatedDurationValidated) {
      setPlanningStepError("Durée à valider par Chef Atelier avant planification.");
      setPlanningStepSuggestion(null);
      return;
    }

    try {
      const suggestion = suggestWorkshopSlot({
        dossiers,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        estimatedHours: line.tempsEstime,
        desiredDate: new Date(),
        dossierId: dossier.id,
        reservations: reservations || [],
        availabilityConfig,
      }, new Date());
      setPlanningStepSuggestion({ stepId, lineId: line.id, suggestion });
      setPlanningStepFeedback(
        mode === "reschedule"
          ? "Nouveau créneau proposé pour replanification."
          : "Meilleur créneau disponible pour cette étape."
      );
    } catch (error: any) {
      setPlanningStepSuggestion(null);
      setPlanningStepError(error.message || "Aucun créneau disponible dans la période sélectionnée.");
    }
  };

  const handleApplyPlanningStepSuggestion = () => {
    resetPlanningStepMessages();
    if (!canRunGuardedAction(`planning-step-reserve:${dossier.id}:${planningStepSuggestion?.lineId || "none"}`)) return;
    if (!canEditDossierPlanning) {
      setPlanningStepError("Consultation uniquement : action réservée au Chef Atelier.");
      recordLocalAudit({
        action: "reservation_planning_refusee",
        summary: "Action refusée : votre rôle ne permet pas cette opération.",
        result: "blocked",
        blockReason: "Action refusée : votre rôle ne permet pas cette opération.",
        source: "planning",
      });
      return;
    }
    if (!planningStepSuggestion) {
      setPlanningStepError("Aucun créneau proposé à réserver.");
      return;
    }

    const result = reserveSuggestedWorkshopSlot({
      role: userRole,
      dossiers,
      reservations: reservations || [],
      dossierId: dossier.id,
      lineId: planningStepSuggestion.lineId,
      suggestion: planningStepSuggestion.suggestion,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      availabilityConfig,
    }, new Date());

    if (result.ok === false) {
      const message = result.error || "Réservation impossible : technicien déjà occupé sur ce créneau.";
      setPlanningStepError(message);
      recordLocalAudit({
        action: "reservation_planning_bloquee",
        summary: message,
        result: "blocked",
        blockReason: message,
        source: "planning",
      });
      return;
    }

    onUpdateDossier(result.dossier);
    onUpdateReservations(result.reservations);
    setPlanningStepFeedback("Créneau réservé avec succès.");
    recordLocalAudit({
      action: "reservation_planning",
      summary: "Créneau réservé avec succès.",
      source: "planning",
    });
    setPlanningStepSuggestion(null);
  };

  const handleReleasePlanningStep = (stepId: PlanningStepId) => {
    resetPlanningStepMessages();
    if (!canRunGuardedAction(`planning-step-release:${dossier.id}:${stepId}`)) return;
    if (!canEditDossierPlanning) {
      setPlanningStepError("Consultation uniquement : action réservée au Chef Atelier.");
      recordLocalAudit({
        action: "liberation_planning_refusee",
        summary: "Action refusée : votre rôle ne permet pas cette opération.",
        result: "blocked",
        blockReason: "Action refusée : votre rôle ne permet pas cette opération.",
        source: "planning",
      });
      return;
    }
    const result = releasePlanningStepReservation(dossier, reservations || [], stepId, new Date());
    if (result.releasedTaskIds.length === 0) {
      setPlanningStepError("Aucun créneau réservé à libérer pour cette étape.");
      return;
    }
    onUpdateDossier(result.dossier);
    onUpdateReservations(result.reservations);
    setPlanningStepSuggestion(null);
    setPlanningStepFeedback("Étape libérée du planning atelier.");
    recordLocalAudit({
      action: "liberation_planning",
      summary: "Étape libérée du planning atelier.",
      source: "planning",
    });
  };

  const closeDeleteTaskModal = () => {
    setDeleteTaskTargetId(null);
    setDeleteTaskMode(null);
    setDeleteTaskReason("");
    setDeleteTaskError("");
  };

  const handleOpenDeleteTaskModal = (line: RepairOrderLine, mode: "delete" | "cancel") => {
    const readiness = getWorkshopTaskDeletionReadiness(dossier, line.id, reservations || []);
    const allowed = mode === "delete" ? readiness.canDeletePhysically : readiness.canCancelAdministratively;
    if (!allowed) {
      const message = readiness.blockReason || "Action impossible sur cette tâche atelier.";
      setTaskError(message);
      setDeleteTaskError(message);
      setBlockedFeedback(message);
      return;
    }
    setTaskError(null);
    setDeleteTaskTargetId(line.id);
    setDeleteTaskMode(mode);
    setDeleteTaskReason("");
    setDeleteTaskError("");
  };

  const handleReleaseTaskReservation = (lineId: string) => {
    if (!canRunGuardedAction(`task-release-reservation:${dossier.id}:${lineId}`)) return;
    if (!canManageDossier) {
      const message = "Consultation uniquement : action réservée au Chef Atelier.";
      setTaskError(message);
      setBlockedFeedback(message);
      return;
    }

    const result = releaseWorkshopTaskReservation(dossier, reservations || [], lineId, new Date());
    if (result.ok === false) {
      setTaskError(result.error);
      setBlockedFeedback(result.error);
      return;
    }
    onUpdateDossier(result.dossier);
    if (result.reservations) onUpdateReservations(result.reservations);
    setTaskError(null);
    setTaskReservationReleasedMessage(result.message);
    setSuccessFeedback(result.message);
    recordLocalAudit({
      action: "liberation_reservation_tache_atelier",
      summary: result.message,
      source: "planning",
    });
  };

  const handleConfirmDeleteWorkshopTask = () => {
    if (!deleteTaskTargetId || !deleteTaskMode) return;
    if (!canRunGuardedAction(`task-delete:${dossier.id}:${deleteTaskTargetId}:${deleteTaskMode}`)) return;

    const result = deleteTaskMode === "delete"
      ? deleteWorkshopTask(dossier, reservations || [], deleteTaskTargetId, deleteTaskReason, userRole, new Date())
      : cancelWorkshopTaskAdministratively(dossier, reservations || [], deleteTaskTargetId, deleteTaskReason, userRole, new Date());

    if (result.ok === false) {
      setDeleteTaskError(result.error);
      setTaskError(result.error);
      return;
    }

    onUpdateDossier(result.dossier);
    if (result.reservations) onUpdateReservations(result.reservations);
    recordLocalAudit({
      action: deleteTaskMode === "delete" ? "suppression_tache_atelier" : "annulation_tache_atelier",
      summary: result.message,
      source: "atelier",
    });
    if (dossier.checklistQC.validationGlobale === "valide" && result.dossier.checklistQC.validationGlobale === "a_refaire") {
      recordLocalAudit({
        action: "invalidation_qc_apres_modification_atelier",
        summary: "Modification enregistrée : le contrôle qualité doit être refait.",
        source: "qc",
      });
    }
    setTaskError(null);
    setSuccessFeedback(result.message);
    closeDeleteTaskModal();
  };

  const handleViewStepOnGantt = (stepId: PlanningStepId) => {
    const step = planningOverview.steps.find(item => item.stepId === stepId);
    const firstPlanned = step?.lines.find(item => item.isPlanned);
    setPlanningStepError("");
    setPlanningStepFeedback(
      firstPlanned
        ? `Étape ${step?.label} visible dans le Gantt Planning Atelier à la date ${formatPlanningDate(firstPlanned.line.planningStart || firstPlanned.reservation?.startTime)}.`
        : `Étape ${step?.label || stepId} non réservée : aucun bloc Gantt à afficher.`
    );
  };

  // 1. Repair Order functions
  const handleAddROLine = () => {
    if (!newROLineText.trim()) return;
    const newLine: RepairOrderLine = {
      id: createRuntimeId("ro"),
      designation: newROLineText.trim(),
      tempsEstime: 0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "manual",
      isEstimatedDurationValidated: false
    };
    const updatedRO = [...dossier.ordresReparation, newLine];

    // Auto recalculate progress percentage based on task counts
    const completedCount = updatedRO.filter(isRepairOrderDone).length;
    const progress = Math.round((completedCount / updatedRO.length) * 100);

    updateDossierState({
      ordresReparation: updatedRO,
      avancementGlobal: progress
    });
    setNewROLineText("");
  };

  const handleOpenDurationValidation = (line: RepairOrderLine) => {
    setDurationValidationLineId(line.id);
    setDurationValidationHours(line.tempsEstime > 0 ? String(line.tempsEstime) : "");
    setDurationValidationReason("");
    setDurationValidationError(null);
  };

  const handleCloseDurationValidation = () => {
    setDurationValidationLineId(null);
    setDurationValidationHours("");
    setDurationValidationReason("");
    setDurationValidationError(null);
  };

  const handleConfirmDurationValidation = () => {
    if (!durationValidationLineId) return;
    if (!canRunGuardedAction(`duration-validation:${dossier.id}:${durationValidationLineId}`)) return;
    const parsedHours = Number(durationValidationHours);
    const reason = durationValidationReason.trim();
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 12) {
      setDurationValidationError("Durée obligatoire entre 0,1h et 12h.");
      return;
    }
    if (reason.length < 8) {
      setDurationValidationError("Motif obligatoire pour valider ou modifier la durée.");
      return;
    }
    const updatedLines = dossier.ordresReparation.map(l =>
      l.id === durationValidationLineId ? {
        ...l,
        tempsEstime: Math.round(parsedHours * 10) / 10,
        isEstimatedDurationValidated: true,
        durationValidationReason: reason,
        durationValidatedAt: new Date().toISOString(),
        durationValidatedBy: userRole,
      } : l
    );
    updateDossierState({
      ordresReparation: updatedLines
    });
    recordLocalAudit({
      action: "validation_duree_planning",
      summary: "Durée atelier validée pour planification.",
      source: "planning",
    });
    setSuccessFeedback("Durée atelier validée pour planification.");
    handleCloseDurationValidation();
  };

  const handleQuoteImportConfirm = (
    result: ReturnType<typeof applyQuoteImportPreview>,
    historyEntry: string
  ) => {
    const nextRO = [...dossier.ordresReparation, ...result.importedLines];
    const updatedLogs = [
      ...(dossier.historiqueLogs || []),
      `[${userRole}] - ${historyEntry}`
    ];
    updateDossierState({
      ordresReparation: nextRO,
      historiqueLogs: updatedLogs
    });
    setShowQuoteImport(false);
  };

  const applyTaskMutation = (result: ReturnType<typeof startRepairOrder>) => {
    if (result.ok === false) {
      setTaskError(result.error);
      setActionFeedback({ type: "blocked", message: result.error });
      return;
    }
    setTaskError(null);
    onUpdateDossier(result.dossier);
    if (dossier.checklistQC.validationGlobale === "valide" && result.dossier.checklistQC.validationGlobale === "a_refaire") {
      recordLocalAudit({
        action: "modification_atelier_apres_qc",
        summary: "Modification enregistrée : le contrôle qualité doit être refait.",
        source: "atelier",
      });
      recordLocalAudit({
        action: "invalidation_qc_apres_modification_atelier",
        summary: "Modification enregistrée : le contrôle qualité doit être refait.",
        source: "qc",
      });
      setSuccessFeedback("Modification enregistrée : le contrôle qualité doit être refait.");
    }
  };

  const handleStartROLine = (lineId: string) => {
    if (!canRunGuardedAction(`task-start:${dossier.id}:${lineId}`)) return;
    applyTaskMutation(startRepairOrder(dossiers, dossier.id, lineId));
  };

  const handlePauseROLine = (lineId: string) => {
    if (!canRunGuardedAction(`task-pause:${dossier.id}:${lineId}`)) return;
    applyTaskMutation(pauseRepairOrder(dossiers, dossier.id, lineId));
  };

  const handleBlockROLine = (lineId: string) => {
    setModalTargetLineId(lineId);
    setModalActive("task-block");
  };

  const handleUnblockROLine = (lineId: string) => {
    setModalTargetLineId(lineId);
    setModalActive("task-unblock");
  };

  const handleFinishROLine = (lineId: string) => {
    setModalTargetLineId(lineId);
    setFinishCause("");
    setFinishAction("");
    setFinishValidation("");
    setFinishValidationError(null);
    setModalActive("task-finish");
  };

  const handleReopenROLine = (lineId: string) => {
    setModalTargetLineId(lineId);
    setModalActive("task-reopen");
  };

  const handleDossierPhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const currentCount = dossier.photosAvant.length;
      const photos = await Promise.all(Array.from(files).map((file, index) => (
        fileToCameraPhoto(file, {
          title: dossierPhotoTitle.trim() || `${dossierPhotoCategory} ${currentCount + index + 1}`,
          category: dossierPhotoCategory,
          takenBy: userRole,
        })
      )));
      const nextDossier = photos.reduce((current, photo) => addPhotoToDossier(current, photo), dossier);
      onUpdateDossier(nextDossier);
      setDossierPhotoTitle("");
    } catch {
      console.error("Impossible d'ajouter cette photo au dossier.");
    }
  };

  // 2. Complements Actions
  const handleStatusComplement = (compId: string, nextStatut: "accepte" | "refuse" | "planifie") => {
    const updatedComps = dossier.complements.map(c => {
      if (c.id === compId) {
        return { ...c, statut: nextStatut };
      }
      return c;
    });
    updateDossierState({ complements: updatedComps });
  };

  // 3. Approval status
  const handleUpdateAccordStatut = (accId: string, nextStatut: "en_attente" | "approuve" | "refuse") => {
    const updatedAccs = dossier.accords.map(a => {
      if (a.id === accId) {
        return { ...a, statut: nextStatut };
      }
      return a;
    });
    updateDossierState({ accords: updatedAccs });
  };

  // 4. Checklist Quality validation
  const handleQCFieldChange = (field: keyof typeof dossier.checklistQC, value: boolean) => {
    const updatedQC = {
      ...dossier.checklistQC,
      [field]: value
    };
    updateDossierState({ checklistQC: updatedQC });
  };

  const isChecklistComplete =
    !!dossier.checklistQC.essaiEffectue &&
    !!dossier.checklistQC.defautRepare &&
    !!dossier.checklistQC.aucunVoyantAllume &&
    !!dossier.checklistQC.niveauxVerifies &&
    !!dossier.checklistQC.serrageSecurite &&
    !!dossier.checklistQC.propreteVehicule &&
    !!dossier.checklistQC.documentsPrets &&
    !!dossier.checklistQC.photosApresOk;

  const handleQCSubmit = (globVal: "valide" | "refuse", comment?: string) => {
    if (!canRunGuardedAction(`qc-submit:${dossier.id}:${globVal}`)) return;
    if (globVal === "valide" && !isChecklistComplete) {
      setQcError("Impossible de valider le QC sans checklist complète.");
      return;
    }
    if (globVal === "refuse" && !comment?.trim()) {
      setQcError("Un motif est obligatoire pour refuser le QC.");
      return;
    }
    setQcError(null);
    onUpdateDossier(submitQualityControl(dossier, userRole, globVal, comment));
    recordLocalAudit({
      action: globVal === "valide" ? "validation_qc" : "refus_qc",
      summary: globVal === "valide" ? "Contrôle qualité validé." : "Contrôle qualité refusé avec retour atelier.",
      source: "qc",
      nouveauStatut: globVal === "valide" ? DossierStatus.PRET_A_LIVRER : DossierStatus.EN_TRAVAUX,
    });
  };

  const handleQCValidationRequest = () => {
    if (!isChecklistComplete) {
      setQcError("Impossible de valider le QC sans checklist complète.");
      return;
    }
    setQcError(null);
    setShowQCValidationConfirm(true);
  };

  // 5. Handover / Delivery functions
  const handleDeliveryConfirm = () => {
    const deliveryGate = canDeliverDossier(dossier);
    if (!deliveryGate.allowed) {
      const message = deliveryGate.reasons.join(" ") || "Action impossible : contrôle qualité conforme obligatoire.";
      setDeliveryError(message);
      setBlockedFeedback(message);
      recordLocalAudit({
        action: "tentative_livraison_bloquee",
        summary: message,
        result: "blocked",
        blockReason: message,
        source: "livraison",
      });
      return;
    }
    if (!signatureCaptured) {
      const message = "Acceptation/signature simple client obligatoire avant restitution.";
      setDeliveryError(message);
      setBlockedFeedback(message);
      recordLocalAudit({
        action: "tentative_livraison_bloquee",
        summary: message,
        result: "blocked",
        blockReason: message,
        source: "livraison",
      });
      return;
    }
    setDeliveryError(null);
    setShowDeliveryValidationConfirm(true);
  };

  const confirmDeliveryRequest = () => {
    if (!canRunGuardedAction(`delivery-confirm-detail:${dossier.id}`)) return;
    setShowDeliveryValidationConfirm(false);
    setDeliveryError(null);
    onUpdateDossier(confirmDelivery(dossier, new Date(), "Livré sans réserve"));
    recordLocalAudit({
      action: "livraison_reussie",
      summary: "Livraison réussie : restitution client validée.",
      source: "livraison",
      ancienStatut: dossier.statut,
      nouveauStatut: DossierStatus.LIVRE,
    });
    setSuccessFeedback("Livraison réussie : restitution client validée.");
  };

  const handleFinalOperationalClose = () => {
    if (!canRunGuardedAction(`operational-close:${dossier.id}`)) return;
    setDeliveryError(null);
    onUpdateDossier(markReadyForBilling(dossier));
    recordLocalAudit({
      action: "cloture_operationnelle",
      summary: "Clôture opérationnelle validée.",
      source: "livraison",
    });
  };

  const handleQCRefuseConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    const logMessage = `[${userRole}] - Refus QC - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;
    const nextDossier = submitQualityControl(dossier, userRole, "refuse", fullReason);

    // Add history log
    const updatedLogs = [
      `${new Date().toISOString()} - ${logMessage}`,
      ...(nextDossier.historiqueLogs || [])
    ];

    onUpdateDossier({
      ...nextDossier,
      historiqueLogs: updatedLogs
    });
    recordLocalAudit({
      action: "retour_atelier_qc",
      summary: "Contrôle qualité refusé : retour atelier demandé.",
      source: "qc",
      nouveauStatut: DossierStatus.EN_TRAVAUX,
    });
    setModalActive(null);
  };

  const handleReopenConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    if (modalTargetLineId) {
      const line = dossier.ordresReparation.find(l => l.id === modalTargetLineId);
      const taskName = line ? line.designation : modalTargetLineId;
      const logMessage = `[${userRole}] - Réouverture Tâche "${taskName}" - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;

      const result = reopenRepairOrder(dossiers, dossier.id, modalTargetLineId, userRole, fullReason);
      if (result.ok === false) {
        setTaskError(result.error);
      } else {
        const updatedLogs = [
          `${new Date().toISOString()} - ${logMessage}`,
          ...(result.dossier.historiqueLogs || [])
        ];
        onUpdateDossier({
          ...result.dossier,
          historiqueLogs: updatedLogs
        });
        if (dossier.checklistQC.validationGlobale === "valide" && result.dossier.checklistQC.validationGlobale === "a_refaire") {
          recordLocalAudit({
            action: "modification_atelier_apres_qc",
            summary: "Modification enregistrée : le contrôle qualité doit être refait.",
            source: "atelier",
          });
          recordLocalAudit({
            action: "invalidation_qc_apres_modification_atelier",
            summary: "Modification enregistrée : le contrôle qualité doit être refait.",
            source: "qc",
          });
          setSuccessFeedback("Modification enregistrée : le contrôle qualité doit être refait.");
        }
        setTaskError(null);
      }
    }
    setModalActive(null);
    setModalTargetLineId(null);
  };

  const handleBlockConfirm = (
    reason: string,
    details: string,
    sparePartRef?: string,
    sparePartEta?: string,
    followUpOwner?: TaskBlockFollowUpOwner,
    resolutionEta?: string
  ) => {
    if (modalTargetLineId) {
      const result = blockRepairOrder(
        dossiers,
        dossier.id,
        modalTargetLineId,
        reason,
        userRole,
        new Date(),
        sparePartRef,
        sparePartEta,
        followUpOwner,
        resolutionEta,
        details
      );
      if (result.ok === false) {
        setTaskError(result.error);
      } else {
        onUpdateDossier(result.dossier);
        setTaskError(null);
      }
    }
    setModalActive(null);
    setModalTargetLineId(null);
  };

  const handleFinishConfirm = () => {
    if (!modalTargetLineId || finishSubmitting) return;
    if (!canRunGuardedAction(`task-finish:${dossier.id}:${modalTargetLineId}`)) return;
    const validation = validateStructuredTechnicianDiagnostic({
      cause: finishCause,
      action: finishAction,
      validation: finishValidation,
    });
    if (!validation.valid || !validation.diagnostic) {
      const reason = validation.reason || "Diagnostic structuré obligatoire.";
      setFinishValidationError(reason);
      setTaskError(reason);
      return;
    }

    setFinishSubmitting(true);
    setTaskError(null);
    setFinishValidationError(null);
    const result = finishRepairOrder(dossiers, dossier.id, modalTargetLineId, validation.diagnostic);
    if (result.ok === false) {
      setTaskError(result.error);
      setFinishValidationError(result.error);
      setFinishSubmitting(false);
      return;
    }

    onUpdateDossier(result.dossier);
    if (dossier.checklistQC.validationGlobale === "valide" && result.dossier.checklistQC.validationGlobale === "a_refaire") {
      recordLocalAudit({
        action: "modification_atelier_apres_qc",
        summary: "Modification enregistrée : le contrôle qualité doit être refait.",
        source: "atelier",
      });
      recordLocalAudit({
        action: "invalidation_qc_apres_modification_atelier",
        summary: "Modification enregistrée : le contrôle qualité doit être refait.",
        source: "qc",
      });
      setSuccessFeedback("Modification enregistrée : le contrôle qualité doit être refait.");
    }
    setModalActive(null);
    setModalTargetLineId(null);
    setFinishCause("");
    setFinishAction("");
    setFinishValidation("");
    setFinishSubmitting(false);
  };

  const handleUnblockConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    if (modalTargetLineId) {
      const line = dossier.ordresReparation.find(l => l.id === modalTargetLineId);
      const taskName = line ? line.designation : modalTargetLineId;
      const logMessage = `[${userRole}] - Levée Blocage Tâche "${taskName}" - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;

      const result = releaseRepairOrderBlock(dossiers, dossier.id, modalTargetLineId, userRole, fullReason);
      if (result.ok === false) {
        setTaskError(result.error);
      } else {
        const updatedLogs = [
          `${new Date().toISOString()} - ${logMessage}`,
          ...(result.dossier.historiqueLogs || [])
        ];
        onUpdateDossier({
          ...result.dossier,
          historiqueLogs: updatedLogs
        });
        setTaskError(null);
      }
    }
    setModalActive(null);
    setModalTargetLineId(null);
  };

  const canManageDossier = perm.canPlanWorkshop(userRole);
  const canUpdateWorkOrders = perm.canStartTask(userRole);
  const canHandleApprovals = perm.canCreateDossier(userRole);
  const canValidateQuality = perm.canValidateQC(userRole);
  const canDeliverVehicle = perm.canDeliver(userRole);
  const durationValidationLine = durationValidationLineId
    ? dossier.ordresReparation.find(line => line.id === durationValidationLineId)
    : undefined;
  const deliveryGate = canDeliverDossier(dossier);
  const dossierQcStatus = getDossierQCStatus(dossier);
  const canShowDeliveryButton = canDeliverVehicle || userRole === UserRole.CHEF_ATELIER;
  const deleteTaskTarget = deleteTaskTargetId
    ? dossier.ordresReparation.find(line => line.id === deleteTaskTargetId)
    : null;
  const linkedComplaints = reclamations
    .map(normalizeComplaint)
    .filter(reclamation => reclamation.dossierId === dossier.id);
  const finishDiagnosticGate = validateStructuredTechnicianDiagnostic({
    cause: finishCause,
    action: finishAction,
    validation: finishValidation,
  });

  const isAlreadyCancelled = dossier.statut === DossierStatus.ANNULE;

  const isDossierCancelable = (): boolean => {
    if (isAlreadyCancelled) return false;
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) return false;
    const allowedRoles = [UserRole.RECEPTIONNAIRE, UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV];
    if (!allowedRoles.includes(userRole as any)) return false;
    const hasStartedTask = dossier.ordresReparation.some(
      line => {
        const status = normalizeRepairOrderStatus(line.status);
        return status === "in_progress" || status === "done" || status === "cancelled" || status === "blocked";
      }
    );
    return !hasStartedTask;
  };

  const handleCancelDossier = () => {
    const motif = cancelMotif.trim();
    if (!motif || motif.length < 5) {
      setCancelError("Le motif d'annulation est obligatoire (5 caractères minimum).");
      return;
    }
    const logEntry = `${new Date().toISOString()} - [${userRole}] Dossier annulé. Motif: ${motif}`;
    onUpdateDossier({
      ...dossier,
      statut: DossierStatus.ANNULE,
      canceledReason: motif,
      historiqueLogs: [logEntry, ...(dossier.historiqueLogs || [])],
      dateDernierStatut: new Date().toISOString(),
    });
    setShowCancelModal(false);
    setCancelMotif("");
    setCancelError(null);
  };

  const handleSaveSatisfaction = () => {
    if (!satisfactionRating) {
      setActionFeedback({ type: "blocked", message: "Sélectionnez une note de satisfaction avant enregistrement." });
      return;
    }
    onUpdateDossier({
      ...dossier,
      satisfaction: {
        rating: satisfactionRating,
        comment: satisfactionComment.trim(),
        createdAt: dossier.satisfaction?.createdAt ?? new Date().toISOString(),
        createdBy: userRole,
        status: satisfactionRating >= 4 ? "satisfait" : satisfactionRating <= 2 ? "insatisfait" : "neutre",
        internalPilotOnly: true,
      },
    });
  };

  return (
    <div data-testid="dossier-detail-view" className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
        <button onClick={onBack} className="hover:text-blue-600 transition cursor-pointer">Dossiers</button>
        <ChevronRight className="w-3 h-3" />
        <span className="font-bold text-slate-800">{dossier.id}</span>
      </nav>

      {/* ANNULE banner */}
      {isAlreadyCancelled && (
        <div data-testid="dossier-annule-banner" className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold space-y-1">
          <div className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Dossier annulé logiquement — aucune modification n'est possible.</div>
          {dossier.canceledReason && (
            <div className="font-semibold text-red-700">Motif : {dossier.canceledReason}</div>
          )}
        </div>
      )}

      {actionFeedback && (
        <div
          data-testid="action-feedback"
          className={`rounded-lg border p-3 text-xs font-bold ${
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : actionFeedback.type === "blocked"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span
            data-testid={
              actionFeedback.type === "success"
                ? "action-success-message"
                : actionFeedback.type === "blocked"
                  ? "action-blocked-message"
                  : "action-error-message"
            }
          >
            {actionFeedback.message}
          </span>
        </div>
      )}

      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-display">
        <button
          data-testid="dossier-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600  hover:text-blue-600  transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste des dossiers
        </button>

        <div className="flex flex-wrap gap-2 items-center">
          {canManageDossier && !isAlreadyCancelled && (
            <>
              <span className="text-xs font-bold text-neutral-400 self-center">Priorité dossier :</span>
              <select
                data-testid="force-priority-select"
                className="p-1 px-2.5 bg-white  border border-slate-200  rounded font-bold text-xs text-slate-800 "
                value={dossier.priorite}
                onChange={(e) => updateDossierState({ priorite: e.target.value as DossierPriority })}
              >
                {Object.values(DossierPriority).map((pr) => (
                  <option key={pr} value={pr}>{pr}</option>
                ))}
              </select>
            </>
          )}

          {isDossierCancelable() && (
            <button
              data-testid="dossier-cancel-btn"
              onClick={() => { setCancelMotif(""); setCancelError(null); setShowCancelModal(true); }}
              className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Annuler le dossier
            </button>
          )}
        </div>
      </div>

      {/* Hero card showing vehicle and status summary */}
      <div className="bg-slate-900 text-white rounded-lg p-6 shadow-md border-b-4 border-blue-600">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="dossier-id-title" className="bg-blue-600 text-white text-[11px] font-mono font-extrabold px-2.5 py-1 rounded">
                {dossier.id}
              </span>
              <InterventionTypeBadge type={dossier.typeDossier} />
              <PriorityBadge priority={dossier.priorite} />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black font-display tracking-tight uppercase">{dossier.clientNom}</h1>
              <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs">
                <span className="font-bold text-slate-200 font-display">{dossier.vehiculeMarque} {dossier.vehiculeModele}</span>
                <span>•</span>
                <LicencePlate plate={dossier.vehiculeImmatriculation} />
                <span>•</span>
                <span>Kms: {dossier.vehiculeKilometrage.toLocaleString()}</span>
                <span>•</span>
                <span>VIN: <span className="font-mono text-[11px] text-slate-300">{dossier.vehiculeVIN}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Statut Actuel Opérationnel</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={dossier.statut} />
              {deliveryGate.allowed ? (
                <span data-testid="dossier-delivery-state" className="rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 text-xs font-bold font-display uppercase tracking-wider">
                  Prêt restitution
                </span>
              ) : (
                <span data-testid="dossier-delivery-state" className="hidden">
                  Restitution impossible
                </span>
              )}
              <span data-testid="delivery-qc-status" className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-800">
                QC {getQCStatusDisplayLabel(dossierQcStatus.status)}
              </span>
            </div>

            {/* Progress indicator */}
            <div className="mt-1 flex items-center gap-2">
              <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${dossier.avancementGlobal}%` }}></div>
              </div>
              <span className="text-xs font-mono font-bold text-green-400">{dossier.avancementGlobal}% terminé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-slate-200  flex overflow-x-auto bg-slate-50  p-1.5 rounded-lg">
        {[
          { key: "resume", label: "Résumé Action", icon: FileText },
          { key: "client", label: "Client & Véhicule", icon: User },
          { key: "repair-orders", label: "Ordres Travaux", icon: Wrench },
          { key: "rdv-planning", label: "RDV & Planning", icon: Clock },
          { key: "photos", label: "Dossier Photos", icon: Camera },
          { key: "complements", label: "Compléments & Accords", icon: ThumbsUp },
          { key: "documents", label: "Documents", icon: Printer },
          { key: "quality-control", label: "Checklist Qualité", icon: CheckCircle2 },
          { key: "deliveries", label: "Livraison Véhicule", icon: FileCheck }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isSel = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={`p-2.5 px-4 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-2 transition duration-150 ${
                isSel
                  ? "bg-slate-900 text-white "
                  : "text-slate-500  hover:text-slate-950  hover:bg-slate-100 "
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm">

        {/* Tab 1: Résumé */}
        {activeTab === "resume" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left summary values */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800  border-b pb-1.5">Mises en demeure & Suivi</h3>

                <div className="p-4 bg-amber-50  border border-amber-100  rounded-xl space-y-2.5">
                  <div className="flex gap-2 text-xs font-bold text-amber-800 ">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-amber-700  flex-shrink-0" />
                    <div>
                      <span className="uppercase block font-black leading-none">Prochaine action recommandée :</span>
                      <span className="text-[13px] font-medium block mt-1 text-slate-900 ">
                        {dossier.prochaineActionRecommended}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-zinc-400 block font-normal">Responsable en cours :</span>
                    <span className="text-zinc-700  font-bold block">{dossier.technicienId ? techniciensList.find(t=>t.id===dossier.technicienId)?.nom || "Technicien Affecté" : "Non assigné"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Zone de l'Atelier :</span>
                    <span className="text-zinc-700  font-bold block">{dossier.zoneAtelier || "Réception"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Date d'Entrée :</span>
                    <span className="text-zinc-700  font-bold block">
                      {new Date(dossier.dateReception).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Échéance de restitution :</span>
                    <span className="text-zinc-700  font-bold block">
                      {new Date(dossier.dateSouhaiteeLivraison).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {(() => {
                  const vehicleETAInfo = getVehicleETAInfo(dossiers, dossier.id, reservations || []);
                  const otherActiveDossiers = dossiers.filter(d =>
                    d.id !== dossier.id &&
                    isDossierActive(d) &&
                    isSameVehicle(dossier, d)
                  );
                  const formattedEta = vehicleETAInfo.etaDateTime
                    ? new Date(vehicleETAInfo.etaDateTime).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
                    : "Non confirmée";
                  const reliabilityBadgeColor = vehicleETAInfo.reliability === "Élevée"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : vehicleETAInfo.reliability === "Moyenne"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-rose-50 text-rose-700 border-rose-100";
                  return (
                    <div data-testid="vehicle-eta-block" className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs mt-4">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider">Livraison estimée</h4>
                      <div className="space-y-2">
                        {userRole === UserRole.RECEPTIONNAIRE ? (
                          <p className="font-bold text-slate-900">Livraison estimée sous réserve de validation atelier.</p>
                        ) : (
                          <p className="font-bold text-slate-900">Livraison estimée : {formattedEta}</p>
                        )}

                        <div className="flex items-center gap-2">
                          <span data-testid="vehicle-eta-reliability" className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase border ${reliabilityBadgeColor}`}>
                            Fiabilité : {vehicleETAInfo.reliability}
                          </span>
                        </div>

                        <p className="text-slate-600 font-medium">{vehicleETAInfo.message}</p>

                        <ul className="space-y-1 text-slate-500 font-semibold list-disc list-inside">
                          <li>Tâches planifiées : {vehicleETAInfo.plannedTaskCount}</li>
                          <li>Tâches non réservées : {vehicleETAInfo.unplannedTaskCount}</li>
                          <li>Durées à valider : {vehicleETAInfo.unvalidatedDurationCount}</li>
                        </ul>

                        {otherActiveDossiers.length > 0 && (
                          <div className="pt-2 border-t border-slate-200 mt-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Autres dossiers actifs du véhicule :</p>
                            <ul className="space-y-0.5 mt-1 font-mono text-[10px] text-blue-600">
                              {otherActiveDossiers.map(d => (
                                <li key={d.id}>{d.id} ({d.vehiculeModele})</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {dossier.bloqueRaison && (
                  <div className="p-3 bg-red-50  border border-red-200  rounded-lg flex gap-2.5 text-xs text-red-700 ">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Facteur Bloquant Atelier :</span>
                      <p className="font-medium mt-0.5">{dossier.bloqueRaison}</p>
                    </div>
                  </div>
                )}

                {linkedComplaints.length > 0 && (
                  <div data-testid="dossier-linked-complaints" className="p-3 bg-red-50/50 border border-red-100 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-black uppercase text-red-700">
                      <ShieldAlert className="w-4 h-4" />
                      Réclamations liées au dossier
                    </div>
                    <div className="space-y-2">
                      {linkedComplaints.map(reclamation => {
                        const status = normalizeComplaintStatus(reclamation.statut);
                        return (
                          <div key={reclamation.id} className="rounded border border-red-100 bg-white p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-slate-900">{reclamation.id}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase text-slate-700">
                                {COMPLAINT_STATUS_LABELS[status]}
                              </span>
                              <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-700">
                                {reclamation.criticite}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-slate-600">{reclamation.motif}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Quick action box */}
              {canManageDossier && (
                <div className="p-4 bg-slate-50  border border-slate-200  rounded-xl space-y-4">
                  <h4 className="font-bold text-xs text-slate-800  uppercase tracking-wider">Planifications & Contrôles Rapides</h4>
                  <p className="text-xs text-slate-500">
                    Attribuer rapidement le dossier à un technicien disponible ou diriger le dossier vers la zone appropriée.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600  mb-1">Attribuer à un technicien :</label>
                      <select
                        data-testid="assign-technicien-select"
                        className="w-full p-2 bg-white  border border-slate-200  rounded font-semibold text-xs "
                        value={dossier.technicienId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDossierState({
                            technicienId: val || undefined,
                            statut: val ? DossierStatus.EN_TRAVAUX : DossierStatus.TRAVAUX_PLANIFIES,
                            prochaineActionRecommended: val ? "Terminer les ordres de réparation affectés" : "Affecter un technicien"
                          });
                        }}
                      >
                        <option value="">-- Non assigné (File d'attente) --</option>
                        {techniciensList.map(t => (
                          <option key={t.id} value={t.id}>{t.nom}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600  mb-1">Zone de l'Atelier affectée :</label>
                      <select
                        className="w-full p-2 bg-white  border border-slate-200  rounded font-semibold text-xs "
                        value={dossier.zoneAtelier || ""}
                        onChange={(e) => updateDossierState({ zoneAtelier: e.target.value as AtelierZone })}
                      >
                        <option value="">-- Non spécifiée (Lobby) --</option>
                        {Object.values(AtelierZone).map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] text-zinc-400 block text-right">Dernière mise à jour : {new Date(dossier.dateDernierStatut).toLocaleTimeString("fr-FR")}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Tab 2: Client & Véhicule */}
        {activeTab === "client" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800  border-b pb-1">Fiche Coordonnées Client</h3>

              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-semibold">
                <div>
                  <span className="text-zinc-400 font-normal block">Client Titulaire :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.clientNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Téléphone Portable :</span>
                  <span className="text-blue-600 font-bold block font-mono">{dossier.clientTelephone}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Nom Déposant :</span>
                  <span className="text-zinc-700  block">{dossier.deposantNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Téléphone Déposant :</span>
                  <span className="text-zinc-700  block font-mono">{dossier.deposantTelephone}</span>
                </div>
              </div>

              {/* Objets check list display */}
              <div className="p-3.5 bg-neutral-50  rounded-xl border border-neutral-100  text-xs">
                <span className="font-bold text-zinc-600  block mb-1.5 uppercase">Objets recensés à bord :</span>
                {dossier.objetsLaisses.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">Aucun objet listé.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-slate-600  font-medium">
                    {dossier.objetsLaisses.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Vehicle spec block */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800  border-b pb-1">Identifiants Véhicule</h3>

              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-medium">
                <div>
                  <span className="text-zinc-400 font-normal block">Marque / Gamme :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.vehiculeMarque}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Modèle Commercial :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.vehiculeModele}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Immatriculation NIMR :</span>
                  <LicencePlate plate={dossier.vehiculeImmatriculation} />
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Numéro de Châssis (VIN) :</span>
                  <span className="text-slate-800  font-mono text-[11px] font-bold block">{dossier.vehiculeVIN}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Teinte Extérieure :</span>
                  <span className="text-slate-800  font-bold block">{dossier.vehiculeCouleur || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Kilométrage relevé :</span>
                  <span className="text-slate-800  font-bold block">{dossier.vehiculeKilometrage.toLocaleString()} km</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Version :</span>
                  <span className="text-slate-800 font-bold block" data-testid="detail-vehicle-version">{dossier.vehiculeVersion || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Date livraison :</span>
                  <span className="text-slate-800 font-bold block" data-testid="detail-delivery-date">{dossier.dateLivraison || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Mise en circulation :</span>
                  <span className="text-slate-800 font-bold block" data-testid="detail-circulation-date">{dossier.dateMiseCirculation || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Garantie :</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block ${
                    dossier.statutGarantie === "Garantie active"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : dossier.statutGarantie === "Garantie expirée"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`} data-testid="detail-warranty-status">
                    {dossier.statutGarantie || "Garantie inconnue"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 font-normal block">Dernier entretien :</span>
                  <span className="text-slate-800 font-bold block font-mono text-[11px]" data-testid="detail-last-service">{dossier.dernierEntretien || "Aucun entretien enregistré"}</span>
                </div>
              </div>

              {/* Fuel and paint panel */}
              <div className="p-3.5 bg-neutral-50  rounded-xl border border-neutral-100  space-y-2.5 text-xs">
                <span className="font-bold text-zinc-600  block uppercase">Niveau d’Éthanol / Carburant</span>
                <FuelIndicator level={dossier.niveauCarburant} />

                <div className="border-t border-neutral-200  pt-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-zinc-500">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.rayures ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Rayures: {dossier.etatCarrosserie.rayures ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.bosses ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Bosses: {dossier.etatCarrosserie.bosses ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.fissureParbrise ? "bg-red-500" : "bg-green-500"}`}></span>
                    Pare-brise cassé: {dossier.etatCarrosserie.fissureParbrise ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.jantesAbimees ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Jante rayée: {dossier.etatCarrosserie.jantesAbimees ? "OUI" : "NON"}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Ordres de réparation */}
        {activeTab === "repair-orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-800  font-display uppercase tracking-tight">Ordres de Travaux & Remplacement Pièces</h3>
                <p className="text-slate-400 text-xs">Suivi des travaux de main-d'œuvre spécifiques à l'atelier</p>
              </div>
              <div className="flex items-center gap-2">
                {[UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole) && (
                  <>
                    {userRole === UserRole.CHEF_ATELIER && (
                      <button
                        onClick={handleOpenWorkshopTaskModal}
                        data-testid="add-workshop-task-button"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                      >
                        Ajouter tâche
                      </button>
                    )}
                    <button
                      onClick={() => setShowQuoteImport(true)}
                      data-testid="quote-import-button"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                    >
                      Importer devis / MO
                    </button>
                    {userRole === UserRole.CHEF_ATELIER && (
                      <button
                        onClick={() => setShowQuoteImport(true)}
                        data-testid="import-quote-pdf-button"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                      >
                        Importer devis PDF
                      </button>
                    )}
                  </>
                )}
                <span className="bg-blue-50  text-blue-700  text-xs font-bold px-3 py-1 rounded font-mono">
                  Total estimé validé/proposé : {dossier.ordresReparation.reduce((acc, current) => acc + (current.tempsEstime > 0 ? current.tempsEstime : 0), 0)} Heures
                </span>
              </div>
            </div>

            {taskError && (
              <div data-testid="task-error-message" className="p-3.5 bg-red-50  border border-red-200  text-red-700  rounded-lg text-xs font-bold">
                <span data-testid="delete-task-blocked-message">{taskError}</span>
              </div>
            )}

            {taskReservationReleasedMessage && (
              <div data-testid="task-reservation-released-message" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold">
                {taskReservationReleasedMessage}
              </div>
            )}

            {/* List RO line items */}
            <div className="space-y-2.5">
              {dossier.ordresReparation.map((line) => {
                const status = normalizeRepairOrderStatus(line.status);
                const assignedTechnicianId = line.plannedTechnicianId || dossier.technicienId;
                const activeLineInSameDossier = dossier.ordresReparation.find(current =>
                  current.id !== line.id && normalizeRepairOrderStatus(current.status) === "in_progress"
                );
                const activeDossierForTechnician = assignedTechnicianId
                  ? dossiers.find(current =>
                    current.id !== dossier.id &&
                    current.technicienId === assignedTechnicianId &&
                    current.ordresReparation.some(order => normalizeRepairOrderStatus(order.status) === "in_progress")
                  )
                  : undefined;
                const startBlockedMessage = !assignedTechnicianId
                  ? "Affecter un technicien avant de démarrer la tâche."
                  : status === "blocked"
                    ? "Lever le blocage avant de reprendre la tâche."
                    : activeLineInSameDossier
                      ? "Une tâche est déjà en cours pour ce dossier."
                      : activeDossierForTechnician
                        ? "Ce technicien a déjà une tâche en cours."
                        : "";
                const isTerminalLine = status === "done" || status === "cancelled";
                const canStartLine = !isTerminalLine && status !== "in_progress" && !startBlockedMessage;
                const statusVisual = getTaskStatusVisual(status);
                const deletionReadiness = getWorkshopTaskDeletionReadiness(dossier, line.id, reservations || []);
                const linkedComplaint = line.sourceComplaintId
                  ? linkedComplaints.find(rec => rec.id === line.sourceComplaintId)
                  : undefined;

                return (
                  <div
                    key={line.id}
                    data-testid={`task-card-${line.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-neutral-50  border border-neutral-200  rounded-lg text-xs gap-4"
                  >
                    <div className="space-y-1">
                      <span data-testid="workshop-task-card" className="font-bold text-slate-800  font-display uppercase text-[11px]">{line.designation}</span>
                      <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px] font-semibold">
                        <span>Estimation: <span className="text-stone-700  font-bold font-mono">{formatRepairOrderDuration(line.tempsEstime)}</span></span>
                        <span>Passé: <span className="font-mono">{line.tempsPasse}H</span></span>
                        {line.estimateSource && (
                          <span
                            data-testid={`task-source-badge-${line.id}`}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              line.estimateSource === "manual" ? "bg-slate-100 text-slate-700 border border-slate-200" :
                              line.estimateSource === "quote-import" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                              line.estimateSource === "preset" ? "bg-sky-50 text-sky-700 border border-sky-200" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            Source: {
                              line.estimateSource === "manual" ? "Manuel" :
                              line.estimateSource === "quote-import" ? "Devis" :
                              line.estimateSource === "preset" ? "Preset" : "Historique"
                            }
                          </span>
                        )}
                        {line.estimateSource && (
                          <span
                            data-testid={line.isEstimatedDurationValidated ? `task-duration-validated-badge-${line.id}` : `task-duration-preset-badge-${line.id}`}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              line.isEstimatedDurationValidated
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {line.isEstimatedDurationValidated ? "Durée validée" : line.tempsEstime > 0 ? "Durée à valider" : "À estimer"}
                          </span>
                        )}
                        {(line.complaintBadge || line.sourceComplaintId) && (
                          <span
                            data-testid={`task-complaint-badge-${line.id}`}
                            className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-50 text-red-700 border border-red-200"
                            title={linkedComplaint ? `Réclamation ${linkedComplaint.id}` : "Réclamation liée"}
                          >
                            REC {line.sourceComplaintId || ""}
                          </span>
                        )}
                      </div>
                      {line.reopenedReason && (
                        <p className="text-[10px] text-violet-600  font-bold">
                          Motif réouverture : {line.reopenedReason}
                        </p>
                      )}
                      {status === "blocked" && (
                        <div
                          data-testid={`task-block-followup-${line.id}`}
                          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] font-semibold text-amber-900"
                        >
                          <span className="font-black uppercase">Blocage atelier</span>
                          <span className="block">Motif : {line.blockReason || dossier.bloqueRaison || "Blocage technique"}</span>
                          {(line.blockComment || dossier.bloqueComment) && (
                            <span className="block">Commentaire : {line.blockComment || dossier.bloqueComment}</span>
                          )}
                          <span className="block">Suivi : {line.blockFollowUpOwner || dossier.bloqueResponsableSuivi || "Chef Atelier"}</span>
                          {(line.blockResolutionEta || dossier.bloqueResolutionEta) && (
                            <span className="block">ETA résolution : {line.blockResolutionEta || dossier.bloqueResolutionEta}</span>
                          )}
                          {(line.blockSparePartRef || dossier.bloqueSparePartRef) && (
                            <span className="block">Réf. pièce demandée : {line.blockSparePartRef || dossier.bloqueSparePartRef}</span>
                          )}
                          {(line.blockSparePartEta || dossier.bloqueSparePartEta) && (
                            <span className="block">Réception pièce estimée : {line.blockSparePartEta || dossier.bloqueSparePartEta}</span>
                          )}
                        </div>
                      )}
                      {line.diagnosticFinal && (
                        <p data-testid={`task-final-diagnostic-${line.id}`} className="mt-2 whitespace-pre-line text-[10px] font-semibold text-emerald-700">
                          {line.diagnosticFinal}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <span
                        data-testid={`task-status-${line.id}`}
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${statusVisual.badgeClassName}`}
                      >
                        <span data-testid="workshop-task-status">{statusVisual.label}</span>
                      </span>
                      <button
                        type="button"
                        data-testid={`print-task-sheet-${line.id}`}
                        onClick={() => handlePrintTaskDocument(line)}
                        className="p-1 px-2.5 bg-white border border-slate-200 text-slate-700 rounded font-bold text-[10px] hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                        title="Imprimer la fiche tâche technicien"
                      >
                        <Printer className="w-3 h-3" />
                        <span data-testid="print-technician-sheet">Fiche tâche technicien</span>
                      </button>
                      {startBlockedMessage && status !== "in_progress" && !isTerminalLine && (
                        <span className="text-[10px] text-rose-600  font-bold text-right">
                          {startBlockedMessage}
                        </span>
                      )}

                      {canManageDossier && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {deletionReadiness.canReleaseReservation && (
                            <button
                              type="button"
                              data-testid="release-task-reservation-button"
                              data-task-id={line.id}
                              onClick={() => handleReleaseTaskReservation(line.id)}
                              className="p-1 px-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold text-[10px] hover:bg-blue-100 cursor-pointer"
                            >
                              Libérer réservation
                            </button>
                          )}
                          {status === "done" ? (
                            <button
                              type="button"
                              data-testid="cancel-workshop-task-button"
                              data-task-id={line.id}
                              onClick={() => handleOpenDeleteTaskModal(line, "cancel")}
                              className="p-1 px-2.5 bg-slate-700 text-white rounded font-bold text-[10px] hover:bg-slate-800 cursor-pointer"
                            >
                              Annuler administrativement
                            </button>
                          ) : status !== "cancelled" ? (
                            <button
                              type="button"
                              data-testid="delete-workshop-task-button"
                              data-task-id={line.id}
                              onClick={() => handleOpenDeleteTaskModal(line, "delete")}
                              className="p-1 px-2.5 bg-white text-rose-700 border border-rose-200 rounded font-bold text-[10px] hover:bg-rose-50 cursor-pointer"
                            >
                              Supprimer tâche
                            </button>
                          ) : null}
                        </div>
                      )}

                      {/* Technical staff control buttons */}
                      {canUpdateWorkOrders && (
                        isTerminalLine ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            <span className="p-1 px-2.5 bg-green-50 text-green-700 border border-green-200 rounded font-bold text-[10px] uppercase">
                              {status === "cancelled" ? "Annulée" : "Terminé"}
                            </span>
                            {canManageDossier && status === "done" && (
                              <button
                                onClick={() => handleReopenROLine(line.id)}
                                data-testid={`task-reopen-${line.id}`}
                                className="p-1 px-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="Réouvrir avec motif obligatoire"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Réouvrir
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1">
                            {canManageDossier && !line.isEstimatedDurationValidated && (
                              <button
                                onClick={() => handleOpenDurationValidation(line)}
                                data-testid={`task-validate-duration-${line.id}`}
                                className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="Valider la durée estimée"
                              >
                                Valider durée
                              </button>
                            )}
                            {status === "blocked" && canManageDossier && (
                              <button
                                onClick={() => handleUnblockROLine(line.id)}
                                data-testid={`task-unblock-${line.id}`}
                                className="p-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="Lever le blocage avec motif obligatoire"
                              >
                                <Lock className="w-3 h-3" />
                                Lever blocage
                              </button>
                            )}
                            {status !== "in_progress" && (
                              <button
                                disabled={!canStartLine}
                                onClick={() => {
                                  if (canStartLine) {
                                    handleStartROLine(line.id);
                                  }
                                }}
                                data-testid={`task-start-${line.id}`}
                                className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={startBlockedMessage || "Lancer la tâche"}
                              >
                                {status === "pending" ? "Démarrer" : "Reprendre"}
                              </button>
                            )}
                            {status === "in_progress" && (
                              <>
                                <button
                                  onClick={() => handlePauseROLine(line.id)}
                                  data-testid={`task-pause-${line.id}`}
                                  className="p-1 px-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold text-[10px] cursor-pointer"
                                  title="Suspendre cette tâche"
                                >
                                  Suspendre
                                </button>
                                <button
                                  onClick={() => handleBlockROLine(line.id)}
                                  data-testid={`task-block-${line.id}`}
                                  className="p-1 px-2.5 bg-rose-600 text-white rounded font-bold text-[10px] hover:bg-rose-700 cursor-pointer"
                                  title="Bloquer cette tâche"
                                >
                                  Bloquer
                                </button>
                                <button
                                  onClick={() => handleFinishROLine(line.id)}
                                  data-testid={`task-finish-${line.id}`}
                                  className="p-1 px-2.5 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                                  title="Valider la fin de tâche"
                                >
                                  Terminer
                                </button>
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form to append new repair order lines (Workshop Chief and Director only) */}
            {[UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole) && (
              <div className="p-4 bg-slate-50  border border-dashed border-slate-200  rounded-lg space-y-3 mt-4">
                <span className="text-xs font-bold text-slate-700  uppercase block font-display">Ajouter une ligne de travaux (Main d'œuvre / Diagnostic)</span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    data-testid="new-task-desc"
                    className="md:col-span-2 p-2 bg-white  border border-slate-200  rounded font-semibold  placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="EX: Remplacement plaquettes de frein avant NIMR"
                    value={newROLineText}
                    onChange={(e) => setNewROLineText(e.target.value)}
                  />
                  <input
                    type="text"
                    data-testid="new-task-time"
                    className="p-2 bg-white  border border-slate-200  rounded font-bold  focus:outline-none"
                    value="À estimer"
                    readOnly
                    aria-label="Durée initiale à estimer"
                  />
                  <button
                    onClick={handleAddROLine}
                    data-testid="new-task-submit"
                    disabled={!newROLineText.trim()}
                    className="py-2 bg-slate-900 hover:bg-slate-950 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded cursor-pointer transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: RDV & Planning */}
        {activeTab === "rdv-planning" && (
          <div data-testid="dossier-planning-tab" className="space-y-5">
            <div className="flex flex-col gap-2 border-b pb-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="font-display text-sm font-black uppercase tracking-tight text-slate-900">RDV & Planning atelier</h3>
                <p className="text-xs font-semibold text-slate-400">Vue terrain par étapes, réservations unitaires et ETA véhicule.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                {canEditDossierPlanning && (
                  <button
                    type="button"
                    data-testid="reserve-all-workshop-tasks"
                    onClick={handleReserveAllWorkshopTasks}
                    className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-white transition hover:bg-slate-800"
                  >
                    Réserver toutes les tâches
                  </button>
                )}
                {planningOverview.planningComplete ? (
                  <span data-testid="planning-complete-badge" className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    Planning complet
                  </span>
                ) : (
                  <span data-testid="planning-incomplete-warning" className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-amber-700">
                    Planning incomplet
                  </span>
                )}
                {!canEditDossierPlanning && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                    Consultation uniquement
                  </span>
                )}
              </div>
            </div>

            {(planningStepFeedback || planningStepError) && (
              <div
                data-testid="planning-suggest-feedback"
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                  planningStepError
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {planningStepError && <span data-testid="reservation-error" className="sr-only">{planningStepError}</span>}
                {planningStepError || planningStepFeedback}
              </div>
            )}

            {reservationBatchResult && (
              <section data-testid="reservation-first-slot-result" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <div>
                    <span className="block text-[10px] font-black uppercase text-emerald-600">Technicien</span>
                    <strong data-testid="reservation-technician-name">{reservationBatchResult.technicianName}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase text-emerald-600">Pont / baie</span>
                    <strong data-testid="reservation-bay-name">{reservationBatchResult.bayName}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase text-emerald-600">Début</span>
                    <strong data-testid="reservation-start">{formatPlanningDate(reservationBatchResult.start)} · {formatPlanningTimeRange(reservationBatchResult.start, reservationBatchResult.start).split(" - ")[0]}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase text-emerald-600">Fin</span>
                    <strong data-testid="reservation-end">{formatPlanningDate(reservationBatchResult.end)} · {formatPlanningTimeRange(reservationBatchResult.end, reservationBatchResult.end).split(" - ")[0]}</strong>
                  </div>
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                <span className="block text-[10px] font-black uppercase text-slate-400">Total atelier</span>
                <strong data-testid="planning-total-estimated" className="mt-1 block text-2xl font-black text-slate-900">
                  {formatPlanningHours(planningOverview.totalEstimatedHours)}
                </strong>
                <p className="mt-2 font-semibold text-slate-500">{planningOverview.unvalidatedDurationCount} durée(s) à valider</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs">
                <span className="block text-[10px] font-black uppercase text-blue-400">Total réservé</span>
                <strong data-testid="planning-total-reserved" className="mt-1 block text-2xl font-black text-blue-900">
                  {formatPlanningHours(planningOverview.totalReservedHours)}
                </strong>
                <p className="mt-2 font-semibold text-blue-700">{planningOverview.reservedStepCount}/{planningOverview.activeStepCount} étape(s) réservée(s)</p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-xs">
                <span className="block text-[10px] font-black uppercase text-indigo-400">Marge atelier</span>
                <strong data-testid="planning-workshop-margin" className="mt-1 block text-2xl font-black text-indigo-900">
                  {formatPlanningHours(planningOverview.workshopMarginHours)}
                </strong>
                <p className="mt-2 font-semibold text-indigo-700">Reste à réserver sur durées validées</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
                <span className="block text-[10px] font-black uppercase text-slate-400">Synthèse étapes</span>
                <strong className="mt-1 block text-2xl font-black text-slate-900">{planningOverview.activeStepCount}</strong>
                <p className="mt-2 font-semibold text-slate-500">{planningOverview.unreservedStepCount} étape(s) encore à réserver</p>
              </div>
            </section>

            <section data-testid="workshop-stage-summary" className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Récapitulatif par étape</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-white text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Étape atelier</th>
                      <th className="px-4 py-2">Nombre de tâches</th>
                      <th className="px-4 py-2">Durée totale</th>
                      <th className="px-4 py-2">Statut réservation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workshopStageSummaryRows.map(row => (
                      <tr key={row.stepId} data-testid="workshop-stage-summary-row" className="bg-white">
                        <td className="px-4 py-3 font-black text-slate-900">{row.label}</td>
                        <td data-testid="workshop-stage-task-count" className="px-4 py-3 font-semibold text-slate-600">{row.taskCount}</td>
                        <td data-testid="workshop-stage-duration-total" className="px-4 py-3 font-bold text-slate-700">{formatPlanningHours(row.durationHours)}</td>
                        <td data-testid="workshop-stage-reservation-status" className="px-4 py-3 font-semibold text-slate-600">{row.reservationStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Étapes à modifier</h4>
                <span className="text-[10px] font-bold uppercase text-slate-400">Réservation unitaire par tâche atelier</span>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {planningOverview.steps.map(step => {
                  const activeSuggestion = planningStepSuggestion?.stepId === step.stepId ? planningStepSuggestion.suggestion : null;
                  const primaryLine = step.nextReservableLine || step.reschedulableLine || step.lines[0]?.line;
                  const plannedLine = step.lines.find(item => item.isPlanned);
                  const plannedStart = plannedLine?.line.planningStart || plannedLine?.reservation?.startTime;
                  const plannedEnd = plannedLine?.line.planningEnd || plannedLine?.reservation?.endTime;
                  const technicianId = plannedLine?.line.plannedTechnicianId || plannedLine?.reservation?.technicianId;
                  const bayId = plannedLine?.line.plannedBayId || plannedLine?.reservation?.bayId;

                  return (
                    <article
                      key={step.stepId}
                      data-testid={`planning-step-card-${step.stepId}`}
                      className={`rounded-lg border p-4 text-xs shadow-sm ${
                        step.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="font-black text-slate-900">{step.label}</h5>
                          <p className="mt-1 font-semibold text-slate-400">{step.serviceType}</p>
                        </div>
                        {step.active ? (
                          <span data-testid="planning-step-active" className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                            Étape active
                          </span>
                        ) : (
                          <span data-testid="planning-step-unused" className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">
                            Non utilisée
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                        <div>
                          <span className="block text-slate-400">Temps atelier réservé</span>
                          <strong className="text-slate-800">{formatPlanningHours(step.reservedHours)}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Durée validée</span>
                          <strong data-testid="workshop-stage-total-duration" className="text-slate-800">{formatPlanningHours(step.estimatedHours)}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Technicien affecté</span>
                          <strong className="text-slate-800">{getTechnicianName(technicianId)}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Pont / matériel</span>
                          <strong className="text-slate-800">{getBayName(bayId)}</strong>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {step.isFullyReserved ? (
                          <span data-testid="planning-step-reserved-status" className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">
                            Réservé
                          </span>
                        ) : step.active ? (
                          <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                            À réserver
                          </span>
                        ) : null}
                        {step.needsConfirmation && (
                          <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[9px] font-black uppercase text-purple-700">
                            Étape à confirmer
                          </span>
                        )}
                      </div>

                      {primaryLine && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] font-semibold text-slate-600">
                          <span className="block font-black text-slate-800">{primaryLine.designation}</span>
                          <span>{formatPlanningTimeRange(plannedStart, plannedEnd)}</span>
                        </div>
                      )}

                      {activeSuggestion && (
                        <div data-testid="planning-suggest-result" className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-semibold text-blue-900">
                          <strong className="block">Créneau proposé</strong>
                          <span className="block">{formatPlanningDate(activeSuggestion.startTime)} · {formatPlanningTimeRange(activeSuggestion.startTime, activeSuggestion.endTime)}</span>
                          <span className="block">Technicien : {activeSuggestion.technicianName}</span>
                          <span className="block">Pont : {activeSuggestion.bayName}</span>
                          <button
                            type="button"
                            data-testid="planning-suggest-apply"
                            onClick={handleApplyPlanningStepSuggestion}
                            className="mt-2 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Réserver ce créneau
                          </button>
                        </div>
                      )}

                      {canEditDossierPlanning && step.active && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {!step.isFullyReserved && (
                            <button
                              type="button"
                              data-testid="planning-step-reserve"
                              onClick={() => handleSuggestPlanningStep(step.stepId, "reserve")}
                              className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Réserver
                            </button>
                          )}
                          {step.reschedulableLine && (
                            <button
                              type="button"
                              data-testid="planning-step-reschedule"
                              onClick={() => handleSuggestPlanningStep(step.stepId, "reschedule")}
                              className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Réplanifier
                            </button>
                          )}
                          {step.reschedulableLine && (
                            <button
                              type="button"
                              data-testid="planning-step-release"
                              onClick={() => handleReleasePlanningStep(step.stepId)}
                              className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 transition hover:bg-rose-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Libérer
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid="planning-step-view-gantt"
                            onClick={() => handleViewStepOnGantt(step.stepId)}
                            className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-black text-blue-700 transition hover:bg-blue-100"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                            Voir sur Gantt
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section data-testid="planning-validated-table" className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Planning rendez-vous validé</h4>
              </div>
              {planningValidatedRows.length === 0 ? (
                <div className="p-4 text-xs font-semibold text-slate-400">Aucun créneau réservé pour ce dossier.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-2">Étape</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Horaire</th>
                        <th className="px-4 py-2">Technicien</th>
                        <th className="px-4 py-2">Matériel / Pont</th>
                        <th className="px-4 py-2">Durée</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planningValidatedRows.map(row => (
                        <tr key={`${row.step.stepId}-${row.item.line.id}`} className="bg-white">
                          <td className="px-4 py-3 font-black text-slate-900">{row.step.label}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{formatPlanningDate(row.start)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">{formatPlanningTimeRange(row.start, row.end)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{getTechnicianName(row.technicianId)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{getBayName(row.bayId)}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{formatPlanningHours(row.duration)}</td>
                          <td className="px-4 py-3">
                            {canEditDossierPlanning ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  data-testid="planning-step-reschedule"
                                  onClick={() => handleSuggestPlanningStep(row.step.stepId, "reschedule")}
                                  className="rounded border border-slate-200 px-2 py-1 font-black text-slate-600 hover:bg-slate-50"
                                >
                                  Réplanifier
                                </button>
                                <button
                                  type="button"
                                  data-testid="planning-step-release"
                                  onClick={() => handleReleasePlanningStep(row.step.stepId)}
                                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 font-black text-rose-700 hover:bg-rose-100"
                                >
                                  Libérer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleViewStepOnGantt(row.step.stepId)}
                                  className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-black text-blue-700 hover:bg-blue-100"
                                >
                                  Voir sur Gantt
                                </button>
                              </div>
                            ) : (
                              <span className="block text-right font-bold text-slate-400">Consultation</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section data-testid="vehicle-eta-block" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">Livraison estimée</span>
                  <strong className="text-slate-900">
                    {userRole === UserRole.RECEPTIONNAIRE
                      ? "Sous réserve atelier"
                      : planningEtaInfo.etaDateTime
                        ? new Date(planningEtaInfo.etaDateTime).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                        : "Non confirmée"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">Fiabilité</span>
                  <strong className="text-slate-900">{planningEtaInfo.reliability}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">Tâches réservées</span>
                  <strong className="text-slate-900">{planningEtaInfo.plannedTaskCount}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">Non réservées / à valider</span>
                  <strong className="text-slate-900">{planningEtaInfo.unplannedTaskCount} / {planningEtaInfo.unvalidatedDurationCount}</strong>
                </div>
              </div>
              <div className="mt-3 space-y-1 font-semibold text-slate-600">
                <p>{userRole === UserRole.RECEPTIONNAIRE ? planningEtaInfo.receptionMessage : planningEtaInfo.message}</p>
                <p>Message Chef Atelier / Directeur : {planningEtaInfo.message}</p>
              </div>
            </section>
          </div>
        )}

        {/* Tab 4: Photos */}
        {activeTab === "photos" && (
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 ">Preuves Photos SAV (Avant / Après)</h3>
              <p className="text-slate-400 text-xs">Historique visuel permettant de sécuriser le client et la concession</p>
            </div>

            <div className="p-4 bg-slate-50  border border-slate-200  rounded-lg space-y-3">
              <span className="text-xs font-bold text-slate-700  uppercase block">Ajouter une photo au dossier</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  data-testid="photo-title-input"
                  className="md:col-span-2 p-2 bg-white  border border-slate-200  rounded font-semibold  placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Titre photo (ex: défaut aile droite)"
                  value={dossierPhotoTitle}
                  onChange={(e) => setDossierPhotoTitle(e.target.value)}
                />
                <select
                  data-testid="photo-category-select"
                  className="p-2 bg-white  border border-slate-200  rounded font-bold  focus:outline-none"
                  value={dossierPhotoCategory}
                  onChange={(e) => setDossierPhotoCategory(e.target.value as PhotoCategory)}
                >
                  {PHOTO_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="py-2 bg-slate-900 hover:bg-slate-950 text-white   font-bold rounded cursor-pointer transition flex items-center justify-center gap-1">
                    <Camera className="w-4 h-4" />
                    Prendre
                    <input
                      type="file"
                      data-testid="photo-file-input-capture"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        void handleDossierPhotoFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="py-2 bg-white  border border-slate-200  text-slate-700  font-bold rounded cursor-pointer transition flex items-center justify-center gap-1">
                    <Plus className="w-4 h-4" />
                    Importer
                    <input
                      type="file"
                      data-testid="photo-file-input-import"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handleDossierPhotoFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {dossier.photosAvant.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Aucune photo enregistrée pour ce dossier.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {dossier.photosAvant.map((ph) => (
                  <div key={ph.id} data-testid={`photo-card-${ph.id}`} className="border border-slate-200  rounded-lg overflow-hidden bg-white  shadow-sm relative group">
                    <img src={ph.url} alt={ph.title} className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute left-2 top-2 bg-white/90 text-zinc-700 text-[9px] px-1.5 py-0.5 rounded font-bold">
                      {ph.category}
                    </span>
                    {canUpdateWorkOrders && (
                      <button
                        onClick={() => onUpdateDossier(removePhotoFromDossier(dossier, ph.id))}
                        data-testid={`photo-delete-${ph.id}`}
                        className="absolute right-2 top-2 bg-red-600/90 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-700"
                        title="Supprimer la photo"
                      >
                        ×
                      </button>
                    )}
                    <div className="p-2.5 space-y-1 text-[10px]">
                      <span className="font-bold text-slate-800  block truncate">{ph.title}</span>
                      <div className="flex justify-between text-zinc-400 font-semibold">
                        <span>{new Date(ph.date).toLocaleDateString("fr-FR")}</span>
                        <span>{ph.takenBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Compléments & Accords */}
        {activeTab === "complements" && (
          <div className="space-y-6">

            {/* Complements of work */}
            <div className="space-y-4">
              <div className="border-b pb-1">
                <h3 className="font-bold text-sm text-slate-800 ">Module de Compléments de Travaux</h3>
                <p className="text-slate-400 text-xs text-left">Réparations complémentaires identifiées lors du démontage en atelier et nécessitant l'avis du client ou de l'assurance</p>
              </div>

              {dossier.complements.length === 0 ? (
                <div className="p-4 bg-slate-50  rounded-xl text-center border text-xs text-slate-400">
                  Aucune réparation complémentaire signalée pour l'instant.
                </div>
              ) : (
                <div className="space-y-3">
                  {dossier.complements.map(comp => {
                    let cBadge = "bg-zinc-100 text-zinc-800";
                    if (comp.statut === "attente") cBadge = "bg-purple-100 text-purple-800 animate-pulse";
                    if (comp.statut === "accepte") cBadge = "bg-green-100 text-green-700 border border-green-200";
                    if (comp.statut === "refuse") cBadge = "bg-red-100 text-red-700 border border-red-200";

                    return (
                      <div key={comp.id} className="p-4 bg-purple-50/10  border border-purple-100  rounded-xl text-xs space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-900  text-[13px]">{comp.titre}</span>
                            <p className="text-slate-600  leading-relaxed">{comp.description}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${cBadge}`}>
                            {comp.statut}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs font-semibold text-zinc-500 border-t border-purple-50  pt-2.5">
                          <span>Main d'œuvre estimée : <strong className="text-zinc-700 ">{comp.tempsEstime} Heures</strong></span>
                          <span>Impact planning : <strong className="text-red-600 ">{comp.impactPlanning}</strong></span>
                          <span>Accord requis : <strong className="capitalize text-zinc-700 ">{comp.accordRequis}</strong></span>
                        </div>

                        {/* Interactive Acceptance Toggle */}
                        {canHandleApprovals && comp.statut === "attente" && (
                          <div className="flex justify-end gap-2 pt-1 border-t border-purple-50 ">
                            <button
                              onClick={() => handleStatusComplement(comp.id, "accepte")}
                              className="px-3 py-1 bg-green-600 text-white font-bold rounded hover:bg-green-700 flex items-center gap-1 transition"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              Accepter le complément
                            </button>
                            <button
                              onClick={() => handleStatusComplement(comp.id, "refuse")}
                              className="px-3 py-1 bg-red-600 text-white font-bold rounded hover:bg-red-700 flex items-center gap-1 transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Official Accords table */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <div className="border-b pb-1">
                <h3 className="font-bold text-sm text-slate-800 ">Suivi Des Accords d'Assurance / Garantie</h3>
                <p className="text-slate-400 text-xs">Validation de prises en charge avant raccordement final des pièces de remplacement</p>
              </div>

              {dossier.accords.length === 0 ? (
                <div className="p-4 bg-slate-50  rounded-xl text-center text-xs text-slate-400">
                  Aucun accord d'assurance ou garantie constructeur requis sur ce dossier.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {dossier.accords.map(acc => {
                    let color = "bg-amber-100 text-amber-800";
                    if (acc.statut === "approuve") color = "bg-green-100 text-green-800";
                    if (acc.statut === "refuse") color = "bg-red-100 text-red-800";

                    return (
                      <div key={acc.id} className="p-3.5 bg-neutral-50  border border-neutral-200  rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 ">{acc.type}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600  italic">Destinataire: {acc.destinataire}</span>
                          </div>
                          <p className="text-slate-500 text-[11px] font-medium leading-tight">{acc.commentaire}</p>
                          <div className="text-[10px] text-neutral-400 font-semibold">
                            Date d'envoi: {new Date(acc.dateEnvoi).toLocaleDateString()}
                            {acc.dateRelance && ` | Relancé le: ${new Date(acc.dateRelance).toLocaleDateString()}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>
                            {acc.statut.replace("_", " ")}
                          </span>

                          {canHandleApprovals && acc.statut === "en_attente" && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdateAccordStatut(acc.id, "approuve")}
                                className="px-2 py-0.5 bg-green-600 text-white font-bold rounded text-[10px]"
                              >
                                Approuver
                              </button>
                              <button
                                onClick={() => handleUpdateAccordStatut(acc.id, "refuse")}
                                className="px-2 py-0.5 bg-red-600 text-white font-bold rounded text-[10px]"
                              >
                                Décliner
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 6: Documents internes */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Documents opérationnels internes</h3>
              <p className="text-slate-400 text-xs">Sorties papier atelier internes, sans données financières ni informations pièces sensibles.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { type: "reception" as const, label: "Fiche réception", aliasTestId: "print-reception-sheet" },
                { type: "or" as const, label: "OR interne", aliasTestId: "print-operational-or" },
                { type: "qc" as const, label: "Fiche QC", aliasTestId: "print-qc-sheet" },
                { type: "delivery" as const, label: "Bon restitution", aliasTestId: "print-delivery-pv" },
              ].map((doc) => (
                <button
                  key={doc.type}
                  type="button"
                  data-testid={`print-${doc.type}`}
                  onClick={() => handlePrintDocument(doc.type)}
                  className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Printer className="h-4 w-4" />
                  <span data-testid={doc.aliasTestId}>{doc.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Contrôle qualité */}
        {activeTab === "quality-control" && (
          <div className="space-y-6">
            <div className="border-b pb-2 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 ">Protocole de Contrôle de Qualité Obligatoire</h3>
                <p className="text-slate-400 text-xs">Checklist de sécurité opérationnelle à valider obligatoirement par l'essayeur contrôleur technique</p>
              </div>
              <div className="flex items-center gap-2">
                <span data-testid="qc-status-badge" className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-800">
                  QC {getQCStatusDisplayLabel(dossierQcStatus.status)}
                </span>
              </div>
            </div>

            {qcError && (
              <div data-testid="qc-error-message" className="p-3.5 bg-red-50  border border-red-200  text-red-700  rounded-lg text-xs font-bold">
                {qcError}
              </div>
            )}

            {/* If QC is already validated display details */}
            {dossier.checklistQC.validationGlobale === "valide" ? (
              <div data-testid="qc-status-message" className="p-5 bg-green-50  border border-green-200  rounded-xl text-xs space-y-3">
                <div className="flex items-center gap-2 text-green-700  font-bold">
                  <CheckCircle className="w-5 h-5" />
                  CONTRÔLE QUALITÉ VALIDÉ - BON POUR LIVRAISON VÉHICULE
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 ">
                  <div>Validé par: <strong className="text-slate-800 ">{dossier.checklistQC.validePar || "Chef d'atelier"}</strong></div>
                  <div>Le: <strong className="text-slate-800 ">{new Date(dossier.checklistQC.dateValidation!).toLocaleString()}</strong></div>
                </div>
                <p className="text-slate-500  font-medium italic">Tous les voyants d'alerte moteur éteints, essais statiques et routiers entièrement concluants.</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Checklist rendering with interactive buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  {[
                    { key: "essaiEffectue", label: "Essai routier / essai de conduite réalisé à bord" },
                    { key: "defautRepare", label: "Défaut d'origine du client confirmed comme résolu" },
                    { key: "aucunVoyantAllume", label: "Aucun voyant de panne ou anomalie orange/rouge allumé" },
                    { key: "niveauxVerifies", label: "Niveaux de fluides et batteries contrôlés et ajustés" },
                    { key: "serrageSecurite", label: "Serrages dynamométriques et organes de sécurité vérifiés" },
                    { key: "propreteVehicule", label: "Propreté impeccable du véhicule (volant, tapis, carrosserie)" },
                    { key: "documentsPrets", label: "Tous les documents / fiches de travaux d'atelier signés" },
                    { key: "photosApresOk", label: "Photos du véhicule après travaux enregistrées sur l'app" }
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="p-3 bg-neutral-50  border border-neutral-200 rounded-lg flex items-center justify-between cursor-pointer select-none"
                    >
                      <span className="text-slate-700  font-semibold">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={dossier.checklistQC[item.key as keyof typeof dossier.checklistQC] as boolean}
                        onChange={(e) => handleQCFieldChange(item.key as any, e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                        disabled={!canValidateQuality}
                        data-testid={`qc-check-${item.key}`}
                      />
                    </label>
                  ))}
                </div>

                {/* Confirm QC Section (QC staff, Chief Workshop and Director only) */}
                {canValidateQuality && (
                  <div className="p-4 bg-slate-50  border border-slate-200  rounded-xl space-y-4">
                    <span className="text-xs font-bold text-slate-800  uppercase block">Décision Finale de Validation de Qualité :</span>

                    <div className="flex gap-2">
                      <button
                        onClick={handleQCValidationRequest}
                        data-testid="qc-accept"
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valider & Marquer Prêt à Livrer
                      </button>

                      <button
                        onClick={() => {
                          setModalActive("qc-refuse");
                        }}
                        data-testid="qc-refuse"
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Refuser (Renvoi à l'atelier)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab 7: Livraison */}
        {activeTab === "deliveries" && (
          <div className="space-y-6">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 ">Protocole de Clôture et Restitution d'Véhicules</h3>
              <p className="text-slate-400 text-xs">Validation de conformité d'exploitation avec acceptation simple client pour pilote interne</p>
            </div>

            {deliveryError && (
              <div data-testid="delivery-error-message" className="p-3.5 bg-red-50  border border-red-200  text-red-700  rounded-lg text-xs font-bold">
                {deliveryError}
              </div>
            )}

            {/* Check requirements */}
            <div className="p-4 bg-slate-50  rounded-xl border border-slate-200  text-xs space-y-3.5">
              <span className="font-bold text-neutral-800  block uppercase">Pré-requis opérationnels :</span>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.checklistQC.validationGlobale === "valide" ? "bg-green-500" : "bg-red-500"
                  }`}>
                    {dossier.checklistQC.validationGlobale === "valide" ? "✓" : "!"}
                  </span>
                  <span className="font-semibold text-slate-700 ">
                    Contrôle qualité validé par l'essayeur :
                    <strong className="text-slate-900  ml-1">
                      {dossier.checklistQC.validationGlobale === "valide" ? "OUI" : "NON (En cours de validation)"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.ordresReparation.every(isRepairOrderDone) ? "bg-green-500" : "bg-red-500"
                  }`}>
                    {dossier.ordresReparation.every(isRepairOrderDone) ? "✓" : "!"}
                  </span>
                  <span className="font-semibold text-slate-700 ">
                    Tous les ordres de réparation d'origine validés :
                    <strong className="text-slate-900  ml-1">
                      {dossier.ordresReparation.every(isRepairOrderDone) ? "OUI (100% terminés)" : "NON (Certaines tâches suspendues ou en cours)"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Readiness Block */}
            <div
              data-testid="delivery-readiness-block"
              className={`p-4 border rounded-xl space-y-3 text-xs ${
                deliveryGate.allowed ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black uppercase">
                  {deliveryGate.allowed ? "Restitution autorisée" : "Restitution impossible"}
                </span>
                <span data-testid="delivery-qc-status" className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-800">
                  {getQCStatusDisplayLabel(dossierQcStatus.status)}
                </span>
              </div>
              {!deliveryGate.allowed && (
                <div data-testid="delivery-blocking-reasons" className="mt-2 space-y-1">
                  <p data-testid="delivery-blocked-message" className="whitespace-pre-line font-medium">
                    {deliveryGate.reasons.map(reason => `- ${reason}`).join("\n")}
                  </p>
                </div>
              )}
            </div>

            {/* Complete Handover section */}
            {dossier.statut === DossierStatus.PRET_A_LIVRER && canShowDeliveryButton ? (
              <div className="space-y-4">
                {dossier.statut === DossierStatus.PRET_A_LIVRER && canDeliverVehicle && (
                  <div className="p-4 bg-blue-50/20  border border-blue-200/40 rounded-lg space-y-3 text-xs">
                    <span className="font-bold text-blue-800  block uppercase font-display">Acceptation / signature simple client lors de la remise des clés :</span>

                    {/* Visual Signature Mock */}
                    <div
                      data-testid="delivery-signature"
                      className="bg-white  border border-dashed border-zinc-300  h-28 rounded-lg flex items-center justify-center text-zinc-400 font-mono italic cursor-pointer"
                      onClick={() => setSignatureCaptured(true)}
                    >
                      {signatureCaptured ? "[ Acceptation simple client capturée ]" : "[ Cliquer ici pour simuler l'acceptation/signature simple du client ]"}
                    </div>

                    <p data-testid="detail-simple-signature-notice" className="text-[10px] text-zinc-500">{PILOT_SIGNATURE_NOTICE}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleDeliveryConfirm}
                    data-testid="delivery-submit"
                    disabled={!deliveryGate.allowed || !canDeliverVehicle}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:hover:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded text-xs transition duration-200 cursor-pointer disabled:cursor-not-allowed"
                    title={deliveryGate.allowed ? "Restituer le véhicule" : deliveryGate.reasons.join(" ")}
                  >
                    {deliveryGate.allowed && canDeliverVehicle ? "Valider restitution client" : "Livraison bloquée"}
                  </button>
                </div>
              </div>
            ) : (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50  border border-emerald-200  rounded-lg text-xs space-y-1 text-emerald-800 ">
                  <span className="font-bold block">✓ Véhicule remis en main propre au client. Clôture en transit.</span>
                  <p className="font-medium text-slate-600 ">Restitution confirmée avec acceptation simple. Le dossier passe au suivi administratif interne.</p>
                  {dossier.livraison.statutRestitution && (
                    <p data-testid="delivery-restitution-status-detail" className="font-black text-emerald-900">
                      Statut restitution : {dossier.livraison.statutRestitution}
                    </p>
                  )}
                  {dossier.livraison.remarquesLivraison && (
                    <p className="font-semibold text-slate-700">
                      Commentaire : {dossier.livraison.remarquesLivraison}
                    </p>
                  )}
                </div>

                {canDeliverVehicle && dossier.statut === DossierStatus.LIVRE && (
                  <button
                    onClick={handleFinalOperationalClose}
                    data-testid="delivery-billing"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition cursor-pointer"
                  >
                    Clôturer opérationnellement le dossier
                  </button>
                )}

                {/* Satisfaction entry form (pilot internal) */}
                <div data-testid="satisfaction-entry-form" className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">Retour Satisfaction Client (Pilote Interne)</h4>
                  <div className="flex gap-2">
                    {([1,2,3,4,5] as const).map(star => (
                      <button
                        key={star}
                        type="button"
                        data-testid={`satisfaction-star-${star}`}
                        onClick={() => setSatisfactionRating(star)}
                        className={`w-8 h-8 rounded-full font-bold text-sm transition cursor-pointer ${
                          satisfactionRating === star
                            ? "bg-amber-400 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-amber-100"
                        }`}
                      >
                        {star}
                      </button>
                    ))}
                    {satisfactionRating && (
                      <span className="self-center text-[10px] font-bold text-slate-500 ml-1">
                        {satisfactionRating >= 4 ? "Satisfait" : satisfactionRating <= 2 ? "Insatisfait" : "Neutre"}
                      </span>
                    )}
                  </div>
                  <textarea
                    data-testid="satisfaction-comment"
                    value={satisfactionComment}
                    onChange={e => setSatisfactionComment(e.target.value)}
                    rows={2}
                    placeholder="Commentaire client (optionnel)..."
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    data-testid="satisfaction-save-btn"
                    onClick={handleSaveSatisfaction}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Enregistrer satisfaction
                  </button>
                  {dossier.satisfaction && (
                    <p className="text-[10px] text-emerald-700 font-bold">✓ Satisfaction enregistrée le {new Date(dossier.satisfaction.createdAt).toLocaleDateString("fr-FR")}</p>
                  )}
                </div>
              </div>
            ) : null}

          </div>
        )}

        <AuditTrailView currentRole={userRole} dossierId={dossier.id} />

        <ConfirmModal
          isOpen={showQCValidationConfirm}
          onClose={() => setShowQCValidationConfirm(false)}
          onConfirm={() => {
            setShowQCValidationConfirm(false);
            handleQCSubmit("valide");
          }}
          title="Confirmer la validation QC"
          message="Le dossier sera déclaré conforme et prêt à livrer."
          confirmText="Confirmer"
          modalAliasTestId="modal-qc-validate-detail"
          cancelAliasTestId="modal-qc-validate-detail-cancel"
          confirmAliasTestId="modal-qc-validate-detail-confirm"
        />

        <ConfirmModal
          isOpen={showDeliveryValidationConfirm}
          onClose={() => setShowDeliveryValidationConfirm(false)}
          onConfirm={confirmDeliveryRequest}
          title="Confirmer la restitution"
          message="L'acceptation simple client est capturée et le dossier passera au statut livré."
          confirmText="Confirmer"
          modalAliasTestId="modal-delivery-confirm-detail"
          cancelAliasTestId="modal-delivery-confirm-detail-cancel"
          confirmAliasTestId="modal-delivery-confirm-detail-confirm"
        />

        {deleteTaskMode && deleteTaskTarget && (
          <div data-testid="delete-task-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-black uppercase text-slate-900">
                    {deleteTaskMode === "delete" ? "Supprimer la tâche atelier" : "Annuler administrativement la tâche"}
                  </h3>
                  <p className="mt-1 font-semibold text-slate-600">
                    {deleteTaskTarget.designation}
                  </p>
                </div>
              </div>

              {deleteTaskError && (
                <div data-testid="delete-task-blocked-message" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">
                  {deleteTaskError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="font-black text-slate-700">Motif obligatoire</span>
                <textarea
                  data-testid="delete-task-reason"
                  value={deleteTaskReason}
                  onChange={(e) => {
                    setDeleteTaskReason(e.target.value);
                    setDeleteTaskError("");
                  }}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-300"
                  placeholder="Motif opérationnel pour audit atelier..."
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteTaskModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="delete-task-confirm"
                  onClick={handleConfirmDeleteWorkshopTask}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {modalActive === "task-finish" && (
          <div data-testid="modal-detail-task-finish" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-black uppercase text-slate-900">Diagnostic structuré obligatoire</h3>
                  <p className="mt-1 font-semibold text-slate-600">
                    La clôture tâche exige une cause, une action réalisée et un test final exploitables.
                  </p>
                </div>
              </div>

              {(finishValidationError || (finishCause || finishAction || finishValidation) && !finishDiagnosticGate.valid) && (
                <div data-testid="modal-detail-task-finish-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">
                  {finishValidationError || finishDiagnosticGate.reason}
                </div>
              )}

              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="font-black text-slate-700">Cause constatée</span>
                  <textarea
                    data-testid="detail-task-finish-cause"
                    value={finishCause}
                    onChange={(e) => {
                      setFinishCause(e.target.value);
                      setFinishValidationError(null);
                    }}
                    className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder="Ex: Usure avancée des plaquettes avant constatée après contrôle visuel."
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="font-black text-slate-700">Action réalisée</span>
                  <textarea
                    data-testid="detail-task-finish-action"
                    value={finishAction}
                    onChange={(e) => {
                      setFinishAction(e.target.value);
                      setFinishValidationError(null);
                    }}
                    className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder="Ex: Remplacement des plaquettes et contrôle du serrage sur les deux roues avant."
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="font-black text-slate-700">Test / validation finale</span>
                  <textarea
                    data-testid="detail-task-finish-validation"
                    value={finishValidation}
                    onChange={(e) => {
                      setFinishValidation(e.target.value);
                      setFinishValidationError(null);
                    }}
                    className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder="Ex: Essai statique et freinage progressif conformes, aucun bruit résiduel détecté."
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  data-testid="detail-task-finish-cancel"
                  onClick={() => {
                    setModalActive(null);
                    setModalTargetLineId(null);
                    setFinishValidationError(null);
                    setFinishSubmitting(false);
                  }}
                  className="rounded-lg bg-slate-100 px-4 py-2 font-extrabold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="detail-task-finish-confirm"
                  disabled={finishSubmitting || !finishDiagnosticGate.valid}
                  onClick={handleFinishConfirm}
                  className="rounded-lg bg-green-600 px-4 py-2 font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {finishSubmitting ? "Traitement..." : "Terminer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tactile reason modals for Lot 1 */}
        <StandardReasonModal
          isOpen={modalActive === "qc-refuse"}
          onClose={() => setModalActive(null)}
          onConfirm={handleQCRefuseConfirm}
          title="Refus du Contrôle Qualité"
          description="Veuillez sélectionner le motif principal de refus pour renvoyer le dossier à l'atelier."
          reasons={[
            "Essai routier non validé",
            "Défaut d'aspect carrosserie",
            "Bruit ou vibration persistant",
            "Voyant anomalie actif",
            "Autre (saisie libre)"
          ]}
          testIdPrefix="modal-qc-refuse"
        />

        <StandardReasonModal
          isOpen={modalActive === "task-reopen"}
          onClose={() => {
            setModalActive(null);
            setModalTargetLineId(null);
          }}
          onConfirm={handleReopenConfirm}
          title="Réouverture de la tâche"
          description="Le motif de réouverture de la tâche est obligatoire."
          reasons={[
            "Retour client sous garantie",
            "Complément de travaux requis",
            "Erreur de saisie statut",
            "Autre (saisie libre)"
          ]}
          testIdPrefix="modal-task-reopen"
        />

        <StandardReasonModal
          isOpen={modalActive === "task-block"}
          onClose={() => {
            setModalActive(null);
            setModalTargetLineId(null);
          }}
          onConfirm={handleBlockConfirm}
          title="Blocage de la tâche"
          description="Veuillez spécifier la raison du blocage technique de cette tâche."
          reasons={[
            "Attente pièce de rechange (Magasin)",
            "Attente accord client complémentaire",
            "Outillage spécifique indisponible",
            "Surcharge pont / ressource",
            "Autre (saisie libre)"
          ]}
          testIdPrefix="modal-task-block"
        />

        <StandardReasonModal
          isOpen={modalActive === "task-unblock"}
          onClose={() => {
            setModalActive(null);
            setModalTargetLineId(null);
          }}
          onConfirm={handleUnblockConfirm}
          title="Levée de blocage"
          description="Le motif de levée de blocage est obligatoire avant toute reprise atelier."
          reasons={[
            "Pièce reçue et contrôlée",
            "Accord client obtenu",
            "Outillage de nouveau disponible",
            "Pont / ressource libéré",
            "Autre (saisie libre)"
          ]}
          testIdPrefix="modal-task-unblock"
        />

      </div>

      {/* Cancellation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">Annuler le dossier</h3>
                <p className="mt-1 text-xs text-slate-600">Cette action est irréversible. Le dossier sera marqué comme annulé et ne pourra plus être modifié.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Motif d'annulation <span className="text-red-500">*</span></label>
              <textarea
                data-testid="cancel-motif-input"
                value={cancelMotif}
                onChange={e => { setCancelMotif(e.target.value); setCancelError(null); }}
                rows={3}
                placeholder="Expliquer le motif d'annulation..."
                className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
              />
              {cancelError && <p className="text-xs text-red-600 font-bold">{cancelError}</p>}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                data-testid="cancel-modal-dismiss"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="cancel-modal-confirm"
                onClick={handleCancelDossier}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard print container */}
      {createPortal(
        <div id="nimr-print-container" className="fixed -left-[9999px] top-0 w-[210mm] bg-white" aria-hidden={!printType || printType === "task"}>
          {printType && printType !== "task" && (
            <PrintDocuments
              type={printType}
              dossier={dossier}
              clientPhoneToShow={dossier.clientTelephone}
            />
          )}
        </div>,
        document.body
      )}

      {/* Technician task print root container */}
      {createPortal(
        <div id="technician-task-print-root" className="print-only">
          {printType === "task" && (
            printTask ? (
              <PrintDocuments
                type="task"
                dossier={dossier}
                task={printTask}
                clientPhoneToShow={dossier.clientTelephone}
                technicianName={
                  printTask
                    ? techniciensList.find(t => t.id === (printTask.plannedTechnicianId || dossier.technicienId))?.nom
                    : undefined
                }
                linkedComplaint={printTask?.sourceComplaintId ? linkedComplaints.find(rec => rec.id === printTask.sourceComplaintId) : undefined}
              />
            ) : (
              <div className="p-4 text-center font-bold text-rose-600">Aucune tâche sélectionnée pour impression.</div>
            )
          )}
        </div>,
        document.body
      )}

      {showWorkshopTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div data-testid="workshop-task-modal" className="w-full max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs shadow-xl">
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900">Créer une tâche atelier</h3>
              <p className="mt-1 font-semibold text-slate-500">Tâche, étape, durée validée et préférences de réservation.</p>
            </div>

            {workshopTaskModalError && (
              <div data-testid="workshop-task-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">
                {workshopTaskModalError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block space-y-1 md:col-span-2">
                <span className="font-black uppercase text-slate-600">Libellé tâche</span>
                <input
                  data-testid="workshop-task-label"
                  type="text"
                  value={workshopTaskLabel}
                  onChange={(event) => setWorkshopTaskLabel(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ex: Vidange + filtre huile"
                />
              </label>

              <label className="block space-y-1 md:col-span-2">
                <span className="font-black uppercase text-slate-600">Description courte</span>
                <textarea
                  data-testid="workshop-task-description"
                  value={workshopTaskDescription}
                  onChange={(event) => setWorkshopTaskDescription(event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-slate-200 bg-white p-2 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Informations atelier utiles au technicien."
                />
              </label>

              <label className="block space-y-1">
                <span className="font-black uppercase text-slate-600">Étape atelier</span>
                <select
                  data-testid="workshop-task-stage"
                  value={workshopTaskStage}
                  onChange={(event) => setWorkshopTaskStage(event.target.value as PlanningStepId)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {PLANNING_STEP_DEFINITIONS.map(step => (
                    <option key={step.id} value={step.id}>{step.label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-black uppercase text-slate-600">Durée estimée (heures)</span>
                <input
                  data-testid="workshop-task-duration"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="40"
                  value={workshopTaskDuration}
                  onChange={(event) => setWorkshopTaskDuration(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="1.5"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-black uppercase text-slate-600">Technicien préféré</span>
                <select
                  data-testid="workshop-task-technician"
                  value={workshopTaskTechnician}
                  onChange={(event) => setWorkshopTaskTechnician(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Premier disponible</option>
                  {techniciens.map(technician => (
                    <option key={technician.id} value={technician.id}>{technician.nom}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-black uppercase text-slate-600">Pont / matériel requis</span>
                <select
                  data-testid="workshop-task-bay"
                  value={workshopTaskBay}
                  onChange={(event) => setWorkshopTaskBay(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Selon disponibilité</option>
                  {DEFAULT_WORKSHOP_BAYS.map(bay => (
                    <option key={bay.id} value={bay.id}>{bay.name}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-black uppercase text-slate-600">Priorité</span>
                <select
                  data-testid="workshop-task-priority"
                  value={workshopTaskPriority}
                  onChange={(event) => setWorkshopTaskPriority(event.target.value as WorkshopTaskPriority)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="basse">Basse</option>
                  <option value="normale">Normale</option>
                  <option value="haute">Haute</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>

              <label className="block space-y-1 md:col-span-2">
                <span className="font-black uppercase text-slate-600">Commentaire Chef Atelier</span>
                <textarea
                  data-testid="workshop-task-comment"
                  value={workshopTaskComment}
                  onChange={(event) => setWorkshopTaskComment(event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-slate-200 bg-white p-2 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Consigne interne, contrôle attendu, contrainte client."
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                data-testid="workshop-task-cancel"
                onClick={() => {
                  setShowWorkshopTaskModal(false);
                  resetWorkshopTaskModal();
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="workshop-task-save"
                onClick={handleSaveWorkshopTask}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-black text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Créer tâche
              </button>
            </div>
          </div>
        </div>
      )}

      {durationValidationLineId && durationValidationLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs shadow-xl">
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900">Valider la durée atelier</h3>
              <p className="mt-1 font-semibold text-slate-500">{durationValidationLine.designation}</p>
            </div>
            {durationValidationError && (
              <div data-testid="duration-validation-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">
                {durationValidationError}
              </div>
            )}
            <label className="block space-y-1">
              <span className="font-black uppercase text-slate-600">Durée validée (heures)</span>
              <input
                data-testid="duration-validation-hours"
                type="number"
                step="0.1"
                min="0.1"
                max="12"
                value={durationValidationHours}
                onChange={(event) => setDurationValidationHours(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-black uppercase text-slate-600">Motif validation / modification</span>
              <textarea
                data-testid="duration-validation-reason"
                value={durationValidationReason}
                onChange={(event) => setDurationValidationReason(event.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-2 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Ex: Durée validée selon preset SAV interne."
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                data-testid="duration-validation-cancel"
                onClick={handleCloseDurationValidation}
                className="rounded-lg bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="duration-validation-confirm"
                onClick={handleConfirmDurationValidation}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-black text-white hover:bg-emerald-700"
              >
                Valider durée
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuoteImport && (
        <QuoteImportModal
          dossierId={dossier.id}
          onConfirm={handleQuoteImportConfirm}
          onCancel={() => setShowQuoteImport(false)}
        />
      )}

    </div>
  );
}

