/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import StandardReasonModal from "./StandardReasonModal";
import QuoteImportModal from "./QuoteImportModal";
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
  FileCheck
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

  // Modal states for Lot 1
  const [modalActive, setModalActive] = useState<"qc-refuse" | "task-reopen" | "task-block" | "task-unblock" | null>(null);
  const [modalTargetLineId, setModalTargetLineId] = useState<string | null>(null);

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
    applyTaskMutation(finishRepairOrder(dossiers, dossier.id, lineId));
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
      setQcError("Impossible de valider le QC sans checklist complète.");
      return;
    }
    if (globVal === "refuse" && !comment?.trim()) {
      setQcError("Un motif est obligatoire pour refuser le QC.");
      return;
    }
    setQcError(null);
    onUpdateDossier(submitQualityControl(dossier, userRole, globVal, comment));
  };

  // 5. Handover / Delivery functions
  const handleDeliveryConfirm = () => {
    const deliveryGate = canDeliverDossier(dossier);
    if (!deliveryGate.allowed) {
      setDeliveryError(deliveryGate.reasons.join(" "));
      return;
    }
    setDeliveryError(null);
    onUpdateDossier(confirmDelivery(dossier));
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
        setTaskError(null);
      }
    }
    setModalActive(null);
    setModalTargetLineId(null);
  };

  const handleBlockConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    if (modalTargetLineId) {
      const result = blockRepairOrder(dossiers, dossier.id, modalTargetLineId, fullReason, userRole);
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
  const deliveryGate = canDeliverDossier(dossier);
  const linkedComplaints = reclamations
    .map(normalizeComplaint)
    .filter(reclamation => reclamation.dossierId === dossier.id);

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
          Retour à la liste des dossiers
        </button>

        {canManageDossier && (
          <div className="flex flex-wrap gap-2">
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
            <StatusBadge status={dossier.statut} />
            
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
          { key: "photos", label: "Dossier Photos", icon: Camera },
          { key: "complements", label: "Compléments & Accords", icon: ThumbsUp },
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
                  <button
                    onClick={() => setShowQuoteImport(true)}
                    data-testid="quote-import-button"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                  >
                    Importer devis / MO
                  </button>
                )}
                <span className="bg-blue-50  text-blue-700  text-xs font-bold px-3 py-1 rounded font-mono">
                  Total estimé : {dossier.ordresReparation.reduce((acc, current) => acc + current.tempsEstime, 0)} Heures
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
                  ? "Affecter un technicien avant de démarrer la tâche."
                  : status === "blocked"
                    ? "Lever le blocage avant de reprendre la tâche."
                    : activeLineInSameDossier
                      ? "Une tâche est déjà en cours pour ce dossier."
                      : activeDossierForTechnician
                        ? "Ce technicien a déjà une tâche en cours."
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
                              line.estimateSource === "preset" ? "Preset" : "Démo"
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
                            {line.isEstimatedDurationValidated ? "Durée validée" : "Durée preset à valider"}
                          </span>
                        )}
                      </div>
                      {line.reopenedReason && (
                        <p className="text-[10px] text-violet-600  font-bold">
                          Motif réouverture : {line.reopenedReason}
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
                              Terminé
                            </span>
                            {canManageDossier && (
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
                            {canManageDossier && (line.estimateSource === "preset" || line.estimateSource === "demo") && !line.isEstimatedDurationValidated && (
                              <button
                                onClick={() => handleValidateDuration(line.id)}
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
                    type="number" 
                    step="0.1"
                    data-testid="new-task-time"
                    className="p-2 bg-white  border border-slate-200  rounded font-bold  focus:outline-none" 
                    placeholder="Temps estimé (H)"
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

        {/* Tab 6: Contrôle qualité */}
        {activeTab === "quality-control" && (
          <div className="space-y-6">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 ">Protocole de Contrôle de Qualité Obligatoire</h3>
              <p className="text-slate-400 text-xs">Checklist de sécurité opérationnelle à valider obligatoirement par l'essayeur contrôleur technique</p>
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
                        onClick={() => handleQCSubmit("valide")}
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
              <p className="text-slate-400 text-xs">Validation de conformité d'exploitation avec signature manuelle du client final</p>
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
                  <span className="font-bold text-blue-800  block uppercase font-display">Signature client lors de la remise des clés :</span>
                  
                  {/* Visual Signature Mock */}
                  <div 
                    data-testid="delivery-signature"
                    className="bg-white  border border-dashed border-zinc-300  h-28 rounded-lg flex items-center justify-center text-zinc-400 font-mono italic cursor-pointer" 
                    onClick={() => setSignatureCaptured(true)}
                  >
                    {signatureCaptured ? "[ Signature client capturée ]" : "[ Cliquer ici pour simuler la signature tactile du client ]"}
                  </div>

                  <p className="text-[10px] text-zinc-400">La signature certifie la restitution du véhicule, le contrôle de propreté et la remise des objets personnels listés.</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleDeliveryConfirm}
                    data-testid="delivery-submit"
                    disabled={!deliveryGate.allowed}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:hover:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded text-xs transition duration-200 cursor-pointer disabled:cursor-not-allowed"
                    title={deliveryGate.allowed ? "Restituer le véhicule" : deliveryGate.reasons.join(" ")}
                  >
                    Restituer le Véhicule au client
                  </button>
                </div>
              </div>
            ) : dossier.statut === DossierStatus.LIVRE ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50  border border-emerald-200  rounded-lg text-xs space-y-1 text-emerald-800 ">
                  <span className="font-bold block">✓ Véhicule remis en main propre au client. Clôture en transit.</span>
                  <p className="font-medium text-slate-600 ">Restitution confirmée et signée. Le dossier doit être transmis à l'ERP NIMR pour facturation définitive.</p>
                </div>

                {canDeliverVehicle && (
                  <button 
                    onClick={handleFinalOperationalClose}
                    data-testid="delivery-billing"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition cursor-pointer"
                  >
                    Marquer "Prêt pour facturation ERP" (Clôture Opérationnelle)
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                La remise des clés n'est autorisée qu'après validation complète du contrôle routier de qualité.
              </p>
            )}

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
