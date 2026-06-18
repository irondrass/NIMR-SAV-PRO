/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import StandardReasonModal from "./StandardReasonModal";
import QuoteImportModal from "./QuoteImportModal";
import PrintDocuments from "./PrintDocuments";
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
  PhotoCategory
} from "../types";
import * as perm from "../permissions";
import {
  addPhotoToDossier,
  blockRepairOrder,
  canDeliverDossier,
  confirmDelivery,
  createRuntimeId,
  finishRepairOrder,
  getRepairOrderStatusLabel,
  isRepairOrderDone,
  markReadyForBilling,
  normalizeRepairOrderStatus,
  pauseRepairOrder,
  releaseRepairOrderBlock,
  removePhotoFromDossier,
  reopenRepairOrder,
  startRepairOrder,
  submitQualityControl
} from "../sav-core";
import { COMPLAINT_STATUS_LABELS, normalizeComplaint, normalizeComplaintStatus } from "../complaints-workflow";
import { fileToCameraPhoto } from "../photo-utils";
import { validateStructuredTechnicianDiagnostic } from "../field-validations";
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
}

export default function DossierDetail({ 
  dossier, 
  dossiers,
  reclamations,
  userRole, 
  onBack, 
  onUpdateDossier,
  techniciensList
}: DossierDetailProps) {
  const [activeTab, setActiveTab] = useState<string>("resume");
  const [printType, setPrintType] = useState<"reception" | "or" | "qc" | "delivery" | null>(null);
  
  // Temporary form values for adding a repair order line
  const [newROLineText, setNewROLineText] = useState("");
  const [newROLineTime, setNewROLineTime] = useState<number>(1.0);
  const [showQuoteImport, setShowQuoteImport] = useState(false);

  // For adding custom logs
  const [newLogText, setNewLogText] = useState("");
  const [dossierPhotoTitle, setDossierPhotoTitle] = useState("");
  const [dossierPhotoCategory, setDossierPhotoCategory] = useState<PhotoCategory>("autre");

  // QA/E2E error states for strict validation
  const [taskError, setTaskError] = useState<string | null>(null);
  const [qcError, setQcError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [showQCValidationConfirm, setShowQCValidationConfirm] = useState(false);
  const [showDeliveryValidationConfirm, setShowDeliveryValidationConfirm] = useState(false);
  const [finishCause, setFinishCause] = useState("");
  const [finishAction, setFinishAction] = useState("");
  const [finishValidation, setFinishValidation] = useState("");
  const [finishValidationError, setFinishValidationError] = useState<string | null>(null);
  const [finishSubmitting, setFinishSubmitting] = useState(false);

  // Modal states for Lot 1
  const [modalActive, setModalActive] = useState<"qc-refuse" | "task-reopen" | "task-block" | "task-unblock" | "task-finish" | null>(null);
  const [modalTargetLineId, setModalTargetLineId] = useState<string | null>(null);

  const handlePrintDocument = (type: "reception" | "or" | "qc" | "delivery") => {
    setPrintType(type);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintType(null), 750);
    }, 50);
  };

  const updateDossierState = (changes: Partial<DossierSAV>) => {
    const updated = {
      ...dossier,
      ...changes,
      dateDernierStatut: new Date().toISOString()
    };
    onUpdateDossier(updated);
  };

  // 1. Repair Order functions
  const handleAddROLine = () => {
    if (!newROLineText.trim()) return;
    const newLine: RepairOrderLine = {
      id: createRuntimeId("ro"),
      designation: newROLineText.trim(),
      tempsEstime: Number(newROLineTime),
      tempsPasse: 0,
      status: "pending",
      estimateSource: "manual",
      isEstimatedDurationValidated: true
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
    setNewROLineTime(1.0);
  };

  const handleValidateDuration = (lineId: string) => {
    const updatedLines = dossier.ordresReparation.map(l =>
      l.id === lineId ? { ...l, isEstimatedDurationValidated: true } : l
    );
    updateDossierState({
      ordresReparation: updatedLines
    });
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
      return;
    }
    setTaskError(null);
    onUpdateDossier(result.dossier);
  };

  const handleStartROLine = (lineId: string) => {
    applyTaskMutation(startRepairOrder(dossiers, dossier.id, lineId));
  };

  const handlePauseROLine = (lineId: string) => {
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
    if (globVal === "valide" && !isChecklistComplete) {
      setQcError("Impossible de valider le QC sans checklist complÃ¨te.");
      return;
    }
    if (globVal === "refuse" && !comment?.trim()) {
      setQcError("Un motif est obligatoire pour refuser le QC.");
      return;
    }
    setQcError(null);
    onUpdateDossier(submitQualityControl(dossier, userRole, globVal, comment));
  };

  const handleQCValidationRequest = () => {
    if (!isChecklistComplete) {
      setQcError("Impossible de valider le QC sans checklist complÃ¨te.");
      return;
    }
    setQcError(null);
    setShowQCValidationConfirm(true);
  };

  // 5. Handover / Delivery functions
  const handleDeliveryConfirm = () => {
    const deliveryGate = canDeliverDossier(dossier);
    if (!deliveryGate.allowed) {
      setDeliveryError(deliveryGate.reasons.join(" "));
      return;
    }
    if (!signatureCaptured) {
      setDeliveryError("Signature client obligatoire avant restitution.");
      return;
    }
    setDeliveryError(null);
    setShowDeliveryValidationConfirm(true);
  };

  const confirmDeliveryRequest = () => {
    setShowDeliveryValidationConfirm(false);
    setDeliveryError(null);
    onUpdateDossier(confirmDelivery(dossier, new Date(), "LivrÃ© sans rÃ©serve"));
  };

  const handleFinalOperationalClose = () => {
    setDeliveryError(null);
    onUpdateDossier(markReadyForBilling(dossier));
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
    setModalActive(null);
  };

  const handleReopenConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    if (modalTargetLineId) {
      const line = dossier.ordresReparation.find(l => l.id === modalTargetLineId);
      const taskName = line ? line.designation : modalTargetLineId;
      const logMessage = `[${userRole}] - RÃ©ouverture TÃ¢che "${taskName}" - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;
      
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
    const validation = validateStructuredTechnicianDiagnostic({
      cause: finishCause,
      action: finishAction,
      validation: finishValidation,
    });
    if (!validation.valid || !validation.diagnostic) {
      const reason = validation.reason || "Diagnostic structurÃ© obligatoire.";
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
      const logMessage = `[${userRole}] - LevÃ©e Blocage TÃ¢che "${taskName}" - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;

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
  const deliveryGate = canDeliverDossier(dossier);
  const linkedComplaints = reclamations
    .map(normalizeComplaint)
    .filter(reclamation => reclamation.dossierId === dossier.id);
  const finishDiagnosticGate = validateStructuredTechnicianDiagnostic({
    cause: finishCause,
    action: finishAction,
    validation: finishValidation,
  });

  return (
    <div data-testid="dossier-detail-view" className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-display">
        <button 
          data-testid="dossier-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600  hover:text-blue-600  transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour Ã  la liste des dossiers
        </button>

        {canManageDossier && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-bold text-neutral-400 self-center">PrioritÃ© dossier :</span>
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
          </div>
        )}
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
                <span>â€¢</span>
                <LicencePlate plate={dossier.vehiculeImmatriculation} />
                <span>â€¢</span>
                <span>Kms: {dossier.vehiculeKilometrage.toLocaleString()}</span>
                <span>â€¢</span>
                <span>VIN: <span className="font-mono text-[11px] text-slate-300">{dossier.vehiculeVIN}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Statut Actuel OpÃ©rationnel</span>
            <StatusBadge status={dossier.statut} />
            
            {/* Progress indicator */}
            <div className="mt-1 flex items-center gap-2">
              <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${dossier.avancementGlobal}%` }}></div>
              </div>
              <span className="text-xs font-mono font-bold text-green-400">{dossier.avancementGlobal}% terminÃ©</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-slate-200  flex overflow-x-auto bg-slate-50  p-1.5 rounded-lg">
        {[
          { key: "resume", label: "RÃ©sumÃ© Action", icon: FileText },
          { key: "client", label: "Client & VÃ©hicule", icon: User },
          { key: "repair-orders", label: "Ordres Travaux", icon: Wrench },
          { key: "photos", label: "Dossier Photos", icon: Camera },
          { key: "complements", label: "ComplÃ©ments & Accords", icon: ThumbsUp },
          { key: "documents", label: "Documents", icon: Printer },
          { key: "quality-control", label: "Checklist QualitÃ©", icon: CheckCircle2 },
          { key: "deliveries", label: "Livraison VÃ©hicule", icon: FileCheck }
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
        
        {/* Tab 1: RÃ©sumÃ© */}
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
                      <span className="uppercase block font-black leading-none">Prochaine action recommandÃ©e :</span>
                      <span className="text-[13px] font-medium block mt-1 text-slate-900 ">
                        {dossier.prochaineActionRecommended}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-zinc-400 block font-normal">Responsable en cours :</span>
                    <span className="text-zinc-700  font-bold block">{dossier.technicienId ? techniciensList.find(t=>t.id===dossier.technicienId)?.nom || "Technicien AffectÃ©" : "Non assignÃ©"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Zone de l'Atelier :</span>
                    <span className="text-zinc-700  font-bold block">{dossier.zoneAtelier || "RÃ©ception"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Date d'EntrÃ©e :</span>
                    <span className="text-zinc-700  font-bold block">
                      {new Date(dossier.dateReception).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Ã‰chÃ©ance de restitution :</span>
                    <span className="text-zinc-700  font-bold block">
                      {new Date(dossier.dateSouhaiteeLivraison).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

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
                      RÃ©clamations liÃ©es au dossier
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
                  <h4 className="font-bold text-xs text-slate-800  uppercase tracking-wider">Planifications & ContrÃ´les Rapides</h4>
                  <p className="text-xs text-slate-500">
                    Attribuer rapidement le dossier Ã  un technicien disponible ou diriger le dossier vers la zone appropriÃ©e.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600  mb-1">Attribuer Ã  un technicien :</label>
                      <select
                        data-testid="assign-technicien-select"
                        className="w-full p-2 bg-white  border border-slate-200  rounded font-semibold text-xs "
                        value={dossier.technicienId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDossierState({
                            technicienId: val || undefined,
                            statut: val ? DossierStatus.EN_TRAVAUX : DossierStatus.TRAVAUX_PLANIFIES,
                            prochaineActionRecommended: val ? "Terminer les ordres de rÃ©paration affectÃ©s" : "Affecter un technicien"
                          });
                        }}
                      >
                        <option value="">-- Non assignÃ© (File d'attente) --</option>
                        {techniciensList.map(t => (
                          <option key={t.id} value={t.id}>{t.nom}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600  mb-1">Zone de l'Atelier affectÃ©e :</label>
                      <select
                        className="w-full p-2 bg-white  border border-slate-200  rounded font-semibold text-xs "
                        value={dossier.zoneAtelier || ""}
                        onChange={(e) => updateDossierState({ zoneAtelier: e.target.value as AtelierZone })}
                      >
                        <option value="">-- Non spÃ©cifiÃ©e (Lobby) --</option>
                        {Object.values(AtelierZone).map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] text-zinc-400 block text-right">DerniÃ¨re mise Ã  jour : {new Date(dossier.dateDernierStatut).toLocaleTimeString("fr-FR")}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Tab 2: Client & VÃ©hicule */}
        {activeTab === "client" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800  border-b pb-1">Fiche CoordonnÃ©es Client</h3>
              
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-semibold">
                <div>
                  <span className="text-zinc-400 font-normal block">Client Titulaire :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.clientNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">TÃ©lÃ©phone Portable :</span>
                  <span className="text-blue-600 font-bold block font-mono">{dossier.clientTelephone}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Nom DÃ©posant :</span>
                  <span className="text-zinc-700  block">{dossier.deposantNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">TÃ©lÃ©phone DÃ©posant :</span>
                  <span className="text-zinc-700  block font-mono">{dossier.deposantTelephone}</span>
                </div>
              </div>

              {/* Objets check list display */}
              <div className="p-3.5 bg-neutral-50  rounded-xl border border-neutral-100  text-xs">
                <span className="font-bold text-zinc-600  block mb-1.5 uppercase">Objets recensÃ©s Ã  bord :</span>
                {dossier.objetsLaisses.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">Aucun objet listÃ©.</p>
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
              <h3 className="font-bold text-sm text-slate-800  border-b pb-1">Identifiants VÃ©hicule</h3>
              
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-medium">
                <div>
                  <span className="text-zinc-400 font-normal block">Marque / Gamme :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.vehiculeMarque}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">ModÃ¨le Commercial :</span>
                  <span className="text-zinc-950  font-bold block">{dossier.vehiculeModele}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Immatriculation NIMR :</span>
                  <LicencePlate plate={dossier.vehiculeImmatriculation} />
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">NumÃ©ro de ChÃ¢ssis (VIN) :</span>
                  <span className="text-slate-800  font-mono text-[11px] font-bold block">{dossier.vehiculeVIN}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Teinte ExtÃ©rieure :</span>
                  <span className="text-slate-800  font-bold block">{dossier.vehiculeCouleur || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">KilomÃ©trage relevÃ© :</span>
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
                      : dossier.statutGarantie === "Garantie expirÃ©e"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`} data-testid="detail-warranty-status">
                    {dossier.statutGarantie || "Garantie inconnue"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 font-normal block">Dernier entretien :</span>
                  <span className="text-slate-800 font-bold block font-mono text-[11px]" data-testid="detail-last-service">{dossier.dernierEntretien || "Aucun entretien enregistrÃ©"}</span>
                </div>
              </div>

              {/* Fuel and paint panel */}
              <div className="p-3.5 bg-neutral-50  rounded-xl border border-neutral-100  space-y-2.5 text-xs">
                <span className="font-bold text-zinc-600  block uppercase">Niveau dâ€™Ã‰thanol / Carburant</span>
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
                    Pare-brise cassÃ©: {dossier.etatCarrosserie.fissureParbrise ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.jantesAbimees ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Jante rayÃ©e: {dossier.etatCarrosserie.jantesAbimees ? "OUI" : "NON"}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Ordres de rÃ©paration */}
        {activeTab === "repair-orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-800  font-display uppercase tracking-tight">Ordres de Travaux & Remplacement PiÃ¨ces</h3>
                <p className="text-slate-400 text-xs">Suivi des travaux de main-d'Å“uvre spÃ©cifiques Ã  l'atelier</p>
              </div>
              <div className="flex items-center gap-2">
                {[UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole) && (
                  <button
                    onClick={() => setShowQuoteImport(true)}
                    data-testid="quote-import-button"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                  >
                    Importer devis / MO
                  </button>
                )}
                <span className="bg-blue-50  text-blue-700  text-xs font-bold px-3 py-1 rounded font-mono">
                  Total estimÃ© : {dossier.ordresReparation.reduce((acc, current) => acc + current.tempsEstime, 0)} Heures
                </span>
              </div>
            </div>

            {taskError && (
              <div data-testid="task-error-message" className="p-3.5 bg-red-50  border border-red-200  text-red-700  rounded-lg text-xs font-bold">
                {taskError}
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
                  ? "Affecter un technicien avant de dÃ©marrer la tÃ¢che."
                  : status === "blocked"
                    ? "Lever le blocage avant de reprendre la tÃ¢che."
                    : activeLineInSameDossier
                      ? "Une tÃ¢che est dÃ©jÃ  en cours pour ce dossier."
                      : activeDossierForTechnician
                        ? "Ce technicien a dÃ©jÃ  une tÃ¢che en cours."
                        : "";
                const canStartLine = status !== "done" && status !== "in_progress" && !startBlockedMessage;
                const badgeStyle = {
                  pending: "bg-stone-100 text-stone-600",
                  in_progress: "bg-amber-50 text-amber-700 animate-pulse border border-amber-200",
                  paused: "bg-sky-50 text-sky-700 border border-sky-200",
                  blocked: "bg-rose-50 text-rose-700 border border-rose-200",
                  done: "bg-green-50 text-green-700 border border-green-200",
                  reopened: "bg-violet-50 text-violet-700 border border-violet-200",
                }[status];

                return (
                  <div 
                    key={line.id}
                    data-testid={`task-card-${line.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-neutral-50  border border-neutral-200  rounded-lg text-xs gap-4"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800  font-display uppercase text-[11px]">{line.designation}</span>
                      <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px] font-semibold">
                        <span>Estimation: <span className="text-stone-700  font-bold font-mono">{line.tempsEstime}H</span></span>
                        <span>PassÃ©: <span className="font-mono">{line.tempsPasse}H</span></span>
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
                              line.estimateSource === "preset" ? "Preset" : "DÃ©mo"
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
                            {line.isEstimatedDurationValidated ? "DurÃ©e validÃ©e" : "DurÃ©e preset Ã  valider"}
                          </span>
                        )}
                      </div>
                      {line.reopenedReason && (
                        <p className="text-[10px] text-violet-600  font-bold">
                          Motif rÃ©ouverture : {line.reopenedReason}
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
                            <span className="block">ETA rÃ©solution : {line.blockResolutionEta || dossier.bloqueResolutionEta}</span>
                          )}
                          {(line.blockSparePartRef || dossier.bloqueSparePartRef) && (
                            <span className="block">RÃ©f. piÃ¨ce demandÃ©e : {line.blockSparePartRef || dossier.bloqueSparePartRef}</span>
                          )}
                          {(line.blockSparePartEta || dossier.bloqueSparePartEta) && (
                            <span className="block">RÃ©ception piÃ¨ce estimÃ©e : {line.blockSparePartEta || dossier.bloqueSparePartEta}</span>
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
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeStyle}`}
                      >
                        {getRepairOrderStatusLabel(status)}
                      </span>
                      {startBlockedMessage && status !== "in_progress" && status !== "done" && (
                        <span className="text-[10px] text-rose-600  font-bold text-right">
                          {startBlockedMessage}
                        </span>
                      )}

                      {/* Technical staff control buttons */}
                      {canUpdateWorkOrders && (
                        status === "done" ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            <span className="p-1 px-2.5 bg-green-50 text-green-700 border border-green-200 rounded font-bold text-[10px] uppercase">
                              TerminÃ©
                            </span>
                            {canManageDossier && (
                              <button
                                onClick={() => handleReopenROLine(line.id)}
                                data-testid={`task-reopen-${line.id}`}
                                className="p-1 px-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="RÃ©ouvrir avec motif obligatoire"
                              >
                                <RotateCcw className="w-3 h-3" />
                                RÃ©ouvrir
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1">
                            {canManageDossier && (line.estimateSource === "preset" || line.estimateSource === "demo") && !line.isEstimatedDurationValidated && (
                              <button
                                onClick={() => handleValidateDuration(line.id)}
                                data-testid={`task-validate-duration-${line.id}`}
                                className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                title="Valider la durÃ©e estimÃ©e"
                              >
                                Valider durÃ©e
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
                                title={startBlockedMessage || "Lancer la tÃ¢che"}
                              >
                                {status === "pending" ? "DÃ©marrer" : "Reprendre"}
                              </button>
                            )}
                            {status === "in_progress" && (
                              <>
                                <button
                                  onClick={() => handlePauseROLine(line.id)}
                                  data-testid={`task-pause-${line.id}`}
                                  className="p-1 px-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold text-[10px] cursor-pointer"
                                  title="Suspendre cette tÃ¢che"
                                >
                                  Suspendre
                                </button>
                                <button
                                  onClick={() => handleBlockROLine(line.id)}
                                  data-testid={`task-block-${line.id}`}
                                  className="p-1 px-2.5 bg-rose-600 text-white rounded font-bold text-[10px] hover:bg-rose-700 cursor-pointer"
                                  title="Bloquer cette tÃ¢che"
                                >
                                  Bloquer
                                </button>
                                <button
                                  onClick={() => handleFinishROLine(line.id)}
                                  data-testid={`task-finish-${line.id}`}
                                  className="p-1 px-2.5 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                                  title="Valider la fin de tÃ¢che"
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
                <span className="text-xs font-bold text-slate-700  uppercase block font-display">Ajouter une ligne de travaux (Main d'Å“uvre / Diagnostic)</span>
                
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
                    type="number" 
                    step="0.1"
                    data-testid="new-task-time"
                    className="p-2 bg-white  border border-slate-200  rounded font-bold  focus:outline-none" 
                    placeholder="Temps estimÃ© (H)"
                    value={newROLineTime}
                    onChange={(e) => setNewROLineTime(Number(e.target.value))}
                  />
                  <button 
                    onClick={handleAddROLine}
                    data-testid="new-task-submit"
                    disabled={!newROLineText.trim() || !newROLineTime || newROLineTime <= 0}
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

        {/* Tab 4: Photos */}
        {activeTab === "photos" && (
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 ">Preuves Photos SAV (Avant / AprÃ¨s)</h3>
              <p className="text-slate-400 text-xs">Historique visuel permettant de sÃ©curiser le client et la concession</p>
            </div>

            <div className="p-4 bg-slate-50  border border-slate-200  rounded-lg space-y-3">
              <span className="text-xs font-bold text-slate-700  uppercase block">Ajouter une photo au dossier</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  data-testid="photo-title-input"
                  className="md:col-span-2 p-2 bg-white  border border-slate-200  rounded font-semibold  placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Titre photo (ex: dÃ©faut aile droite)"
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
              <p className="text-xs text-zinc-400 italic">Aucune photo enregistrÃ©e pour ce dossier.</p>
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
                        Ã—
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

        {/* Tab 5: ComplÃ©ments & Accords */}
        {activeTab === "complements" && (
          <div className="space-y-6">
            
            {/* Complements of work */}
            <div className="space-y-4">
              <div className="border-b pb-1">
                <h3 className="font-bold text-sm text-slate-800 ">Module de ComplÃ©ments de Travaux</h3>
                <p className="text-slate-400 text-xs text-left">RÃ©parations complÃ©mentaires identifiÃ©es lors du dÃ©montage en atelier et nÃ©cessitant l'avis du client ou de l'assurance</p>
              </div>

              {dossier.complements.length === 0 ? (
                <div className="p-4 bg-slate-50  rounded-xl text-center border text-xs text-slate-400">
                  Aucune rÃ©paration complÃ©mentaire signalÃ©e pour l'instant.
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
                          <span>Main d'Å“uvre estimÃ©e : <strong className="text-zinc-700 ">{comp.tempsEstime} Heures</strong></span>
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
                              Accepter le complÃ©ment
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
                <p className="text-slate-400 text-xs">Validation de prises en charge avant raccordement final des piÃ¨ces de remplacement</p>
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
                            <span className="text-slate-400">â€¢</span>
                            <span className="text-slate-600  italic">Destinataire: {acc.destinataire}</span>
                          </div>
                          <p className="text-slate-500 text-[11px] font-medium leading-tight">{acc.commentaire}</p>
                          <div className="text-[10px] text-neutral-400 font-semibold">
                            Date d'envoi: {new Date(acc.dateEnvoi).toLocaleDateString()} 
                            {acc.dateRelance && ` | RelancÃ© le: ${new Date(acc.dateRelance).toLocaleDateString()}`}
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
                                DÃ©cliner
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
              <h3 className="font-bold text-sm text-slate-800">Documents opÃ©rationnels internes</h3>
              <p className="text-slate-400 text-xs">Sorties papier atelier sans donnÃ©es financiÃ¨res ni stock rÃ©el.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { type: "reception" as const, label: "Fiche rÃ©ception" },
                { type: "or" as const, label: "OR interne" },
                { type: "qc" as const, label: "Fiche QC" },
                { type: "delivery" as const, label: "Bon restitution" },
              ].map((doc) => (
                <button
                  key={doc.type}
                  type="button"
                  data-testid={`print-${doc.type}`}
                  onClick={() => handlePrintDocument(doc.type)}
                  className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Printer className="h-4 w-4" />
                  {doc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: ContrÃ´le qualitÃ© */}
        {activeTab === "quality-control" && (
          <div className="space-y-6">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 ">Protocole de ContrÃ´le de QualitÃ© Obligatoire</h3>
              <p className="text-slate-400 text-xs">Checklist de sÃ©curitÃ© opÃ©rationnelle Ã  valider obligatoirement par l'essayeur contrÃ´leur technique</p>
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
                  CONTRÃ”LE QUALITÃ‰ VALIDÃ‰ - BON POUR LIVRAISON VÃ‰HICULE
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 ">
                  <div>ValidÃ© par: <strong className="text-slate-800 ">{dossier.checklistQC.validePar || "Chef d'atelier"}</strong></div>
                  <div>Le: <strong className="text-slate-800 ">{new Date(dossier.checklistQC.dateValidation!).toLocaleString()}</strong></div>
                </div>
                <p className="text-slate-500  font-medium italic">Tous les voyants d'alerte moteur Ã©teints, essais statiques et routiers entiÃ¨rement concluants.</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Checklist rendering with interactive buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  {[
                    { key: "essaiEffectue", label: "Essai routier / essai de conduite rÃ©alisÃ© Ã  bord" },
                    { key: "defautRepare", label: "DÃ©faut d'origine du client confirmed comme rÃ©solu" },
                    { key: "aucunVoyantAllume", label: "Aucun voyant de panne ou anomalie orange/rouge allumÃ©" },
                    { key: "niveauxVerifies", label: "Niveaux de fluides et batteries contrÃ´lÃ©s et ajustÃ©s" },
                    { key: "serrageSecurite", label: "Serrages dynamomÃ©triques et organes de sÃ©curitÃ© vÃ©rifiÃ©s" },
                    { key: "propreteVehicule", label: "PropretÃ© impeccable du vÃ©hicule (volant, tapis, carrosserie)" },
                    { key: "documentsPrets", label: "Tous les documents / fiches de travaux d'atelier signÃ©s" },
                    { key: "photosApresOk", label: "Photos du vÃ©hicule aprÃ¨s travaux enregistrÃ©es sur l'app" }
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
                    <span className="text-xs font-bold text-slate-800  uppercase block">DÃ©cision Finale de Validation de QualitÃ© :</span>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={handleQCValidationRequest}
                        data-testid="qc-accept"
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valider & Marquer PrÃªt Ã  Livrer
                      </button>

                      <button 
                        onClick={() => {
                          setModalActive("qc-refuse");
                        }}
                        data-testid="qc-refuse"
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Refuser (Renvoi Ã  l'atelier)
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
              <h3 className="font-bold text-sm text-slate-800 ">Protocole de ClÃ´ture et Restitution d'VÃ©hicules</h3>
              <p className="text-slate-400 text-xs">Validation de conformitÃ© d'exploitation avec signature manuelle du client final</p>
            </div>

            {deliveryError && (
              <div data-testid="delivery-error-message" className="p-3.5 bg-red-50  border border-red-200  text-red-700  rounded-lg text-xs font-bold">
                {deliveryError}
              </div>
            )}

            {/* Check requirements */}
            <div className="p-4 bg-slate-50  rounded-xl border border-slate-200  text-xs space-y-3.5">
              <span className="font-bold text-neutral-800  block uppercase">PrÃ©-requis opÃ©rationnels :</span>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.checklistQC.validationGlobale === "valide" ? "bg-green-500" : "bg-red-500"
                  }`}>
                    {dossier.checklistQC.validationGlobale === "valide" ? "âœ“" : "!"}
                  </span>
                  <span className="font-semibold text-slate-700 ">
                    ContrÃ´le qualitÃ© validÃ© par l'essayeur : 
                    <strong className="text-slate-900  ml-1">
                      {dossier.checklistQC.validationGlobale === "valide" ? "OUI" : "NON (En cours de validation)"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.ordresReparation.every(isRepairOrderDone) ? "bg-green-500" : "bg-red-500"
                  }`}>
                    {dossier.ordresReparation.every(isRepairOrderDone) ? "âœ“" : "!"}
                  </span>
                  <span className="font-semibold text-slate-700 ">
                    Tous les ordres de rÃ©paration d'origine validÃ©s : 
                    <strong className="text-slate-900  ml-1">
                      {dossier.ordresReparation.every(isRepairOrderDone) ? "OUI (100% terminÃ©s)" : "NON (Certaines tÃ¢ches suspendues ou en cours)"}
                    </strong>
                  </span>
                </div>
              </div>
              {!deliveryGate.allowed && (
                <div data-testid="delivery-blocking-reasons" className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 font-bold space-y-1">
                  {deliveryGate.reasons.map(reason => (
                    <p key={reason}>- {reason}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Complete Handover section */}
            {dossier.statut === DossierStatus.PRET_A_LIVRER && canDeliverVehicle ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/20  border border-blue-200/40 rounded-lg space-y-3 text-xs">
                  <span className="font-bold text-blue-800  block uppercase font-display">Signature client lors de la remise des clÃ©s :</span>
                  
                  {/* Visual Signature Mock */}
                  <div 
                    data-testid="delivery-signature"
                    className="bg-white  border border-dashed border-zinc-300  h-28 rounded-lg flex items-center justify-center text-zinc-400 font-mono italic cursor-pointer" 
                    onClick={() => setSignatureCaptured(true)}
                  >
                    {signatureCaptured ? "[ Signature client capturÃ©e ]" : "[ Cliquer ici pour simuler la signature tactile du client ]"}
                  </div>

                  <p className="text-[10px] text-zinc-400">La signature certifie la restitution du vÃ©hicule, le contrÃ´le de propretÃ© et la remise des objets personnels listÃ©s.</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleDeliveryConfirm}
                    data-testid="delivery-submit"
                    disabled={!deliveryGate.allowed}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:hover:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded text-xs transition duration-200 cursor-pointer disabled:cursor-not-allowed"
                    title={deliveryGate.allowed ? "Restituer le vÃ©hicule" : deliveryGate.reasons.join(" ")}
                  >
                    Restituer le VÃ©hicule au client
                  </button>
                </div>
              </div>
            ) : dossier.statut === DossierStatus.LIVRE ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50  border border-emerald-200  rounded-lg text-xs space-y-1 text-emerald-800 ">
                  <span className="font-bold block">âœ“ VÃ©hicule remis en main propre au client. ClÃ´ture en transit.</span>
                  <p className="font-medium text-slate-600 ">Restitution confirmÃ©e et signÃ©e. Le dossier passe au suivi administratif interne.</p>
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

                {canDeliverVehicle && (
                  <button 
                    onClick={handleFinalOperationalClose}
                    data-testid="delivery-billing"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition cursor-pointer"
                  >
                    ClÃ´turer opÃ©rationnellement le dossier
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                La remise des clÃ©s n'est autorisÃ©e qu'aprÃ¨s validation complÃ¨te du contrÃ´le routier de qualitÃ©.
              </p>
            )}

          </div>
        )}

        {showQCValidationConfirm && (
          <div data-testid="modal-qc-validate-detail" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-black text-slate-900">Confirmer la validation QC</h3>
                  <p className="mt-1 font-semibold text-slate-600">Le dossier sera dÃ©clarÃ© conforme et prÃªt Ã  livrer.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  data-testid="modal-qc-validate-detail-cancel"
                  onClick={() => setShowQCValidationConfirm(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="modal-qc-validate-detail-confirm"
                  onClick={() => {
                    setShowQCValidationConfirm(false);
                    handleQCSubmit("valide");
                  }}
                  className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white transition hover:bg-green-700"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeliveryValidationConfirm && (
          <div data-testid="modal-delivery-confirm-detail" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-black text-slate-900">Confirmer la restitution</h3>
                  <p className="mt-1 font-semibold text-slate-600">La signature client est capturÃ©e et le dossier passera au statut livrÃ©.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  data-testid="modal-delivery-confirm-detail-cancel"
                  onClick={() => setShowDeliveryValidationConfirm(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="modal-delivery-confirm-detail-confirm"
                  onClick={confirmDeliveryRequest}
                  className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white transition hover:bg-green-700"
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
                  <h3 className="font-black uppercase text-slate-900">Diagnostic structurÃ© obligatoire</h3>
                  <p className="mt-1 font-semibold text-slate-600">
                    La clÃ´ture tÃ¢che exige une cause, une action rÃ©alisÃ©e et un test final exploitables.
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
                  <span className="font-black text-slate-700">Cause constatÃ©e</span>
                  <textarea
                    data-testid="detail-task-finish-cause"
                    value={finishCause}
                    onChange={(e) => {
                      setFinishCause(e.target.value);
                      setFinishValidationError(null);
                    }}
                    className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder="Ex: Usure avancÃ©e des plaquettes avant constatÃ©e aprÃ¨s contrÃ´le visuel."
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="font-black text-slate-700">Action rÃ©alisÃ©e</span>
                  <textarea
                    data-testid="detail-task-finish-action"
                    value={finishAction}
                    onChange={(e) => {
                      setFinishAction(e.target.value);
                      setFinishValidationError(null);
                    }}
                    className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder="Ex: Remplacement des plaquettes et contrÃ´le du serrage sur les deux roues avant."
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
                    placeholder="Ex: Essai statique et freinage progressif conformes, aucun bruit rÃ©siduel dÃ©tectÃ©."
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
          title="Refus du ContrÃ´le QualitÃ©"
          description="Veuillez sÃ©lectionner le motif principal de refus pour renvoyer le dossier Ã  l'atelier."
          reasons={[
            "Essai routier non validÃ©",
            "DÃ©faut d'aspect carrosserie",
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
          title="RÃ©ouverture de la tÃ¢che"
          description="Le motif de rÃ©ouverture de la tÃ¢che est obligatoire."
          reasons={[
            "Retour client sous garantie",
            "ComplÃ©ment de travaux requis",
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
          title="Blocage de la tÃ¢che"
          description="Veuillez spÃ©cifier la raison du blocage technique de cette tÃ¢che."
          reasons={[
            "Attente piÃ¨ce de rechange (Magasin)",
            "Attente accord client complÃ©mentaire",
            "Outillage spÃ©cifique indisponible",
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
          title="LevÃ©e de blocage"
          description="Le motif de levÃ©e de blocage est obligatoire avant toute reprise atelier."
          reasons={[
            "PiÃ¨ce reÃ§ue et contrÃ´lÃ©e",
            "Accord client obtenu",
            "Outillage de nouveau disponible",
            "Pont / ressource libÃ©rÃ©",
            "Autre (saisie libre)"
          ]}
          testIdPrefix="modal-task-unblock"
        />

      </div>

      <div id="nimr-print-container" className="fixed -left-[9999px] top-0 w-[210mm] bg-white" aria-hidden={!printType}>
        {printType && <PrintDocuments type={printType} dossier={dossier} clientPhoneToShow={dossier.clientTelephone} />}
      </div>

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

