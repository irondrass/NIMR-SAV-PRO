/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import StandardReasonModal from "./StandardReasonModal";
import { CameraPhoto, DossierSAV, PHOTO_CATEGORIES, PhotoCategory, TaskBlockFollowUpOwner, TechnicienResource, UserRole } from "../types";
import {
  addPhotoToDossier,
  blockRepairOrder,
  finishRepairOrder,
  getVisibleTechnicianTasks,
  normalizeRepairOrderStatus,
  pauseRepairOrder,
  shouldShowDossierForTechnician,
  startRepairOrder
} from "../sav-core";
import { fileToCameraPhoto } from "../photo-utils";
import { validateStructuredTechnicianDiagnostic } from "../field-validations";
import { canSimulateTechnicianAccess } from "../permissions";
import { getTaskStatusVisual } from "../task-status-visual";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Camera, 
  FileText, 
  User, 
  Car, 
  CheckSquare, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import { LicencePlate, StatusBadge, PriorityBadge } from "./UIParts";

function formatTechnicianDuration(hours: number | undefined): string {
  return hours && hours > 0 ? `${hours}H` : "À estimer";
}

interface TechnicianViewProps {
  dossiers: DossierSAV[];
  techniciens: TechnicienResource[];
  onUpdateDossier: (updated: DossierSAV) => void;
  activeRole: UserRole;
  currentUserLabel: string;
}

const OBSERVATION_PRESETS = [
  "Vis/Écrou grippé débloqué",
  "Niveau liquide complété",
  "Faisceau électrique vérifié",
  "Essai statique conforme",
  "Complément d'huile effectué",
  "Plaquette de frein usée à remplacer"
];

const DIAGNOSTIC_PRESETS = [
  "Travaux réalisés et essai statique conforme",
  "Réparation terminée, contrôle visuel et fonctionnel conforme",
  "Intervention finalisée avec essai routier satisfaisant"
];

export default function TechnicianView({ dossiers, techniciens, onUpdateDossier, activeRole, currentUserLabel }: TechnicianViewProps) {
  const [selectedTechId, setSelectedTechId] = useState<string>("tech_01");
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const [tempPhotoTitle, setTempPhotoTitle] = useState("");
  const [tempPhotoCategory, setTempPhotoCategory] = useState<PhotoCategory>("autre");

  // Error/Success state messages for tactile feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Photo viewer overlay state
  const [activeViewerPhoto, setActiveViewerPhoto] = useState<CameraPhoto | null>(null);

  // Modal states for Lot 1
  const [modalActive, setModalActive] = useState<boolean>(false);
  const [modalTargetDossierId, setModalTargetDossierId] = useState<string | null>(null);
  const [modalTargetLineId, setModalTargetLineId] = useState<string | null>(null);
  const [finishModalActive, setFinishModalActive] = useState(false);
  const [finishCause, setFinishCause] = useState("");
  const [finishAction, setFinishAction] = useState("");
  const [finishValidation, setFinishValidation] = useState("");
  const [finishPreset, setFinishPreset] = useState("");
  const [finishTarget, setFinishTarget] = useState<{ dossierId: string; lineId: string } | null>(null);
  const [finishSubmitting, setFinishSubmitting] = useState(false);
  const finishSubmitRef = useRef(false);

  const canSimulate = canSimulateTechnicianAccess(activeRole);

  const matchedTech = techniciens.find(t => 
    t.nom.toLowerCase().includes(currentUserLabel.toLowerCase()) ||
    currentUserLabel.toLowerCase().includes(t.nom.toLowerCase())
  );

  const activeTechId = canSimulate ? selectedTechId : (matchedTech ? matchedTech.id : null);
  const activeTech = activeTechId ? techniciens.find(t => t.id === activeTechId) : null;
  const finishDiagnosticGate = validateStructuredTechnicianDiagnostic({
    cause: finishCause,
    action: finishAction,
    validation: finishValidation,
  });

  // Filter operational tasks specific to this technician.
  const techTasks = activeTechId ? dossiers.filter(d => shouldShowDossierForTechnician(d, activeTechId)) : [];

  const setNoteForDossier = (dossierId: string, val: string) => {
    setTempNotes(prev => ({ ...prev, [dossierId]: val }));
  };

  const handleApplyPreset = (dossierId: string, preset: string) => {
    const currentVal = tempNotes[dossierId] || "";
    if (!currentVal.trim()) {
      setNoteForDossier(dossierId, preset);
    } else {
      setNoteForDossier(dossierId, `${currentVal}, ${preset}`);
    }
  };

  const handleAddNoteLog = (dossierId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const noteText = tempNotes[dossierId] || "";
    if (!noteText.trim()) return;

    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    const finalNote = `[Note Technicien - ${activeTech?.nom}] : ${noteText.trim()}`;
    const updated: DossierSAV = {
      ...original,
      observationsReception: original.observationsReception 
        ? `${original.observationsReception} | ${finalNote}` 
        : finalNote,
      dateDernierStatut: new Date().toISOString()
    };
    onUpdateDossier(updated);
    setNoteForDossier(dossierId, "");
    setSuccessMsg("Note technique ajoutée au dossier avec succès !");
  };

  const handleRepairOrderAction = (dossierId: string, lineId: string, action: "start" | "pause" | "block" | "finish") => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (action === "block") {
      setModalTargetDossierId(dossierId);
      setModalTargetLineId(lineId);
      setModalActive(true);
      return;
    }

    if (action === "finish") {
      setFinishTarget({ dossierId, lineId });
      setFinishCause("");
      setFinishAction("");
      setFinishValidation("");
      setFinishPreset("");
      setFinishModalActive(true);
      return;
    }

    const result =
      action === "start" ? startRepairOrder(dossiers, dossierId, lineId) :
      pauseRepairOrder(dossiers, dossierId, lineId);

    if (result.ok === false) {
      setErrorMsg(result.error || "Une erreur est survenue.");
      return;
    }
    onUpdateDossier(result.dossier);
    setSuccessMsg(`Tâche ${action === "start" ? "démarrée" : action === "pause" ? "suspendue" : "terminée"} avec succès !`);
  };

  const handleFinishConfirm = () => {
    if (!finishTarget || finishSubmitRef.current) return;
    const validation = validateStructuredTechnicianDiagnostic({
      cause: finishCause,
      action: finishAction,
      validation: finishValidation,
    });
    if (!validation.valid || !validation.diagnostic) {
      setErrorMsg(validation.reason || "Diagnostic structuré obligatoire avant clôture.");
      return;
    }

    finishSubmitRef.current = true;
    setFinishSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = finishRepairOrder(dossiers, finishTarget.dossierId, finishTarget.lineId, validation.diagnostic);
    if (result.ok === false) {
      setErrorMsg(result.error || "Impossible de terminer la tâche.");
      setFinishSubmitting(false);
      finishSubmitRef.current = false;
      return;
    }
    onUpdateDossier(result.dossier);
    setSuccessMsg("Tâche terminée avec diagnostic validé.");
    setFinishModalActive(false);
    setFinishTarget(null);
    setFinishCause("");
    setFinishAction("");
    setFinishValidation("");
    setFinishPreset("");
    setFinishSubmitting(false);
    finishSubmitRef.current = false;
  };

  const handleBlockConfirm = (
    reason: string,
    details: string,
    sparePartRef?: string,
    sparePartEta?: string,
    followUpOwner?: TaskBlockFollowUpOwner,
    resolutionEta?: string
  ) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (modalTargetDossierId && modalTargetLineId) {
      const result = blockRepairOrder(
        dossiers,
        modalTargetDossierId,
        modalTargetLineId,
        reason,
        UserRole.TECHNICIEN,
        new Date(),
        sparePartRef,
        sparePartEta,
        followUpOwner,
        resolutionEta,
        details
      );
      if (result.ok === false) {
        setErrorMsg(result.error || "Impossible de bloquer la tâche.");
      } else {
        onUpdateDossier(result.dossier);
        setSuccessMsg("Tâche bloquée avec succès !");
      }
    }
    setModalActive(false);
    setModalTargetDossierId(null);
    setModalTargetLineId(null);
  };

  const handleAddPhotoFiles = async (dossierId: string, files: FileList | null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!files || files.length === 0) return;
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    try {
      const currentCount = original.photosAvant.length;
      const photos = await Promise.all(Array.from(files).map((file, index) => (
        fileToCameraPhoto(file, {
          title: tempPhotoTitle.trim() || `${tempPhotoCategory} ${currentCount + index + 1}`,
          category: tempPhotoCategory,
          takenBy: activeTech?.nom || "Technicien",
        })
      )));
      const updated = photos.reduce((current, photo) => addPhotoToDossier(current, photo), original);
      onUpdateDossier(updated);
      setTempPhotoTitle("");
      setSuccessMsg("Photo de diagnostic ajoutée au dossier avec succès !");
    } catch {
      setErrorMsg("Impossible d'ajouter cette photo de diagnostic.");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Simulation Tech Switcher */}
      {canSimulate ? (
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm space-y-2 border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              VUE TABLETTE COMPAGNON / TECHNICIEN
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-500/30">
              CONNECTÉ
            </span>
          </div>
          
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 pb-1">Choisir Compagnon (Simulateur d'Accès) :</label>
            <select
              data-testid="companion-simulator-select"
              className="w-full p-2 bg-slate-800 text-white border-2 border-slate-700 rounded font-bold text-xs"
              value={selectedTechId}
              onChange={(e) => {
                setSelectedTechId(e.target.value);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              {techniciens.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nom} — {t.specialite} ({t.zoneAffectee})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              TABLETTE COMPAGNON : {activeTech ? activeTech.nom : currentUserLabel}
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-500/30">
              CONNECTÉ
            </span>
          </div>
        </div>
      )}

      {/* DOM Notification messages for tactile use */}
      {(errorMsg || successMsg) && (
        <div className="space-y-2">
          {errorMsg && (
            <div 
              data-testid="technician-error-message" 
              className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between font-bold text-xs shadow-xs"
            >
              <span>{errorMsg}</span>
              <button 
                onClick={() => setErrorMsg(null)} 
                className="text-red-500 hover:text-red-700 font-extrabold px-2 py-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {successMsg && (
            <div 
              data-testid="technician-success-message" 
              className="bg-emerald-50 border border-emerald-200 text-emerald-805 p-4 rounded-xl flex items-center justify-between font-bold text-xs shadow-xs"
            >
              <span>{successMsg}</span>
              <button 
                onClick={() => setSuccessMsg(null)} 
                className="text-emerald-500 hover:text-emerald-700 font-extrabold px-2 py-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* If no technician profile is matched for a non-admin role */}
      {!activeTechId && (
        <div 
          data-testid="no-technician-profile-message"
          className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl font-bold text-xs shadow-xs text-center space-y-2 mt-4"
        >
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <p>Aucun profil technicien associé à ce compte.</p>
        </div>
      )}

      {/* Primary tasks */}
      {activeTechId && (
        <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-800  uppercase tracking-wider">
          Mes travaux assignés aujourd'hui ({techTasks.length})
        </h3>

        {techTasks.length === 0 ? (
          <div className="bg-white  p-8 border rounded-xl text-center text-xs text-slate-400 space-y-2">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
            <span>Aucune tâche active assignée. Vous êtes entièrement disponible commercialement.</span>
          </div>
        ) : (
          <div className="space-y-4 text-xs font-semibold">
            {techTasks.map(task => {
              const visibleTechnicianTasks = getVisibleTechnicianTasks(task, selectedTechId);
              // Check if this dossier has any active (in_progress) task
              const hasInProgressTask = visibleTechnicianTasks.some(
                line => normalizeRepairOrderStatus(line.status) === "in_progress"
              );

              return (
                <div 
                  key={task.id} 
                  className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                    hasInProgressTask 
                      ? "border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-md" 
                      : "border-gray-200"
                  }`}
                >
                  
                  {/* Top active task banner */}
                  {hasInProgressTask && (
                    <div 
                      data-testid="technician-active-task-banner" 
                      className="bg-blue-600 text-white text-center py-2 text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span>TRAVAIL EN COURS SUR CE VÉHICULE</span>
                    </div>
                  )}

                  {/* Top quick state info */}
                  <div className="p-4 bg-slate-50  border-b flex justify-between items-center font-display">
                    <div>
                      <span className="font-mono font-bold text-blue-600  text-sm block">{task.id}</span>
                      <span className="text-[10px] text-zinc-400 block font-normal uppercase">{task.typeDossier}</span>
                    </div>

                    <div className="flex gap-1">
                      <StatusBadge status={task.statut} />
                    </div>
                  </div>

                  {/* Body core info wrapper */}
                  <div className="p-4 space-y-4 text-xs font-semibold">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        <span className="font-extrabold text-slate-800 ">{task.vehiculeMarque} {task.vehiculeModele}</span>
                        <LicencePlate plate={task.vehiculeImmatriculation} />
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 ">Client: {task.clientNom}</span>
                      </div>

                      {/* Client symptoms */}
                      <div className="p-2.5 bg-neutral-50  border rounded-lg text-[11px] leading-tight text-neutral-500 font-medium">
                        <span className="font-bold text-neutral-700 block mb-0.5">Plainte Client :</span>
                        {task.plainteClient}
                      </div>
                    </div>

                    {/* Interactive controls */}
                    <div className="p-3 bg-blue-50/10  border border-blue-100/40 rounded-lg space-y-2.5">
                      <span className="text-[10px] text-blue-800  uppercase tracking-widest block font-bold font-display">Piloter mes tâches :</span>
                      <div className="space-y-2">
                        {visibleTechnicianTasks.map(line => {
                          const status = normalizeRepairOrderStatus(line.status);
                          const statusVisual = getTaskStatusVisual(status);
                          const activeLineInSameDossier = task.ordresReparation.find(current =>
                            current.id !== line.id && normalizeRepairOrderStatus(current.status) === "in_progress"
                          );
                          const activeDossierForTechnician = dossiers.find(current =>
                            current.id !== task.id &&
                            getVisibleTechnicianTasks(current, selectedTechId).some(order => normalizeRepairOrderStatus(order.status) === "in_progress")
                          );
                          const startBlockedMessage = status === "blocked"
                            ? "Lever le blocage avant de reprendre la tâche."
                            : activeLineInSameDossier
                              ? "Une tâche est déjà en cours pour ce dossier."
                              : activeDossierForTechnician
                                ? "Ce technicien a déjà une tâche en cours."
                                : "";
                          const isTerminalLine = status === "done" || status === "cancelled";
                          const canStartLine = !isTerminalLine && status !== "in_progress" && !startBlockedMessage;

                          return (
                            <div key={line.id} className="p-3 bg-white  border border-blue-100  rounded-xl space-y-3 shadow-xs">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-extrabold text-slate-800 text-sm block">{line.designation}</span>
                                  <span className="text-[10px] text-zinc-400 font-mono">{line.tempsPasse}H / {formatTechnicianDuration(line.tempsEstime)}</span>
                                </div>
                                <span 
                                  data-testid={`task-status-${line.id}`}
                                  className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${statusVisual.badgeClassName}`}>
                                  {statusVisual.label}
                                </span>
                              </div>
                              {startBlockedMessage && !isTerminalLine && status !== "in_progress" && (
                                <div className="space-y-1.5 mt-1">
                                  <div 
                                    data-testid="technician-task-locked-message"
                                    className="p-2 bg-red-50 border border-red-100 rounded-lg text-[10px] text-red-700 font-bold flex items-center gap-1.5"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                    <span>{startBlockedMessage}</span>
                                  </div>
                                </div>
                              )}
                              {isTerminalLine ? (
                                <div className="py-1.5 text-green-700  font-black text-[11px] uppercase flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" />
                                  {status === "cancelled" ? "Statut annulé" : "Statut terminé"}
                                </div>
                              ) : (
                                <div className="mt-2">
                                  {status !== "in_progress" && (
                                    <button
                                      disabled={!canStartLine}
                                      data-testid={`task-start-${line.id}`}
                                      onClick={() => {
                                        if (canStartLine) {
                                          handleRepairOrderAction(task.id, line.id, "start");
                                        }
                                      }}
                                      className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-35 disabled:cursor-not-allowed text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer"
                                    >
                                      <Play className="w-4.5 h-4.5" />
                                      {status === "pending" ? "Démarrer" : "Reprendre"}
                                    </button>
                                  )}
                                  {status === "in_progress" && (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <button
                                        data-testid={`task-pause-${line.id}`}
                                        onClick={() => handleRepairOrderAction(task.id, line.id, "pause")}
                                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer"
                                      >
                                        <Pause className="w-4.5 h-4.5" />
                                        Pause
                                      </button>
                                      <div className="flex gap-2 flex-1">
                                        <button
                                          data-testid={`task-block-${line.id}`}
                                          onClick={() => handleRepairOrderAction(task.id, line.id, "block")}
                                          className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer"
                                        >
                                          <AlertTriangle className="w-4.5 h-4.5" />
                                          Bloquer
                                        </button>
                                        <button
                                          data-testid={`task-finish-${line.id}`}
                                          onClick={() => handleRepairOrderAction(task.id, line.id, "finish")}
                                          className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer"
                                        >
                                          <CheckCircle className="w-4.5 h-4.5" />
                                          Terminer
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Photos list gallery (Read-only) */}
                    {task.photosAvant && task.photosAvant.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">
                          Photos du véhicule ({task.photosAvant.length}) :
                        </span>
                        <div 
                          data-testid="technician-photo-gallery"
                          className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200"
                        >
                          {task.photosAvant.map((photo) => (
                            <div 
                              key={photo.id}
                              className="flex-shrink-0 w-24 space-y-1 cursor-pointer group"
                              onClick={() => setActiveViewerPhoto(photo)}
                            >
                              <div className="relative aspect-video w-24 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                <img 
                                  src={photo.url} 
                                  alt={photo.title} 
                                  data-testid="technician-photo-thumbnail"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-150"
                                />
                                <span className="absolute bottom-1 right-1 bg-black/60 text-white font-extrabold text-[8px] px-1 rounded uppercase pointer-events-none">
                                  {photo.category}
                                </span>
                              </div>
                              <span className="text-[9px] text-gray-500 font-semibold block truncate leading-tight">
                                {photo.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick photo upload */}
                    <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Ajouter Preuve Photo :</span>
                      <div className="grid grid-cols-1 gap-2">
                        <input 
                          type="text"
                          className="p-1.5 px-2.5 bg-slate-50 border border-gray-200 rounded-lg text-[11px] flex-1 font-semibold  placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="EX: Remplacement plaquette usée, filtre cassé..."
                          value={tempPhotoTitle}
                          onChange={(e) => setTempPhotoTitle(e.target.value)}
                        />
                        <select
                          className="p-1.5 px-2.5 bg-slate-50 border border-gray-200 rounded-lg text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={tempPhotoCategory}
                          onChange={(e) => setTempPhotoCategory(e.target.value as PhotoCategory)}
                        >
                          {PHOTO_CATEGORIES.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="px-3 py-2 bg-zinc-800 text-white font-bold rounded-xl text-[11px] hover:bg-zinc-950 cursor-pointer text-center transition">
                            Prendre
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                void handleAddPhotoFiles(task.id, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <label className="px-3 py-2 bg-white border border-gray-200 text-slate-700 font-bold rounded-xl text-[11px] hover:bg-zinc-50 cursor-pointer text-center transition">
                            Galerie
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                void handleAddPhotoFiles(task.id, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Adding note log */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Ajouter une note technique :</span>
                      
                      {/* Textarea for observations */}
                      <textarea 
                        data-testid="technician-observation-textarea"
                        className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none min-h-[80px] transition"
                        placeholder="EX: Vis oxydée débloquée, complément à prévoir..."
                        value={tempNotes[task.id] || ""}
                        onChange={(e) => setNoteForDossier(task.id, e.target.value)}
                      />

                      {/* Presets buttons */}
                      <div className="flex flex-wrap gap-1.5 mt-1 pb-1">
                        {OBSERVATION_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            data-testid={`technician-observation-preset-${idx}`}
                            onClick={() => handleApplyPreset(task.id, preset)}
                            className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold border border-gray-200 transition cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>

                      <button 
                        onClick={() => handleAddNoteLog(task.id)}
                        className="w-full py-2 bg-blue-600 text-white font-extrabold rounded-xl text-xs hover:bg-blue-700 cursor-pointer transition shadow-xs"
                      >
                        Sauvegarder la note
                      </button>
                    </div>

                    {/* Simplified historical logs */}
                    {task.historiqueLogs && task.historiqueLogs.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">
                          Historique des opérations :
                        </span>
                        <div 
                          data-testid="technician-task-history"
                          className="bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-32 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-200"
                        >
                          {task.historiqueLogs.map((log, index) => {
                            const parts = log.split(" - ");
                            const dateStr = parts[0];
                            const message = parts.slice(1).join(" - ");
                            
                            let formattedDate = "";
                            try {
                              formattedDate = new Date(dateStr).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
                            } catch {
                              formattedDate = dateStr;
                            }

                            return (
                              <div key={index} className="text-[10px] flex items-start gap-2 text-gray-600 font-semibold leading-normal">
                                <span className="text-[9px] text-zinc-400 font-mono bg-gray-200/50 px-1 py-0.5 rounded flex-shrink-0 mt-0.5">
                                  {formattedDate}
                                </span>
                                <span className="break-all">{message || log}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {finishModalActive && (
        <div data-testid="modal-task-finish" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">Diagnostic de clôture obligatoire</h3>
                <p className="mt-1 text-slate-500">
                  Saisissez un diagnostic exploitable avant de passer la tâche à terminée.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">Modèle prédéfini</label>
              <select
                data-testid="modal-task-finish-preset"
                value={finishPreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  setFinishPreset(preset);
                  if (preset) {
                    setFinishCause("Constat atelier confirmé sur la tâche affectée au technicien.");
                    setFinishAction(preset);
                    setFinishValidation("Contrôle final effectué, résultat conforme sans anomalie résiduelle.");
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-semibold text-slate-800"
              >
                <option value="">Diagnostic libre</option>
                {DIAGNOSTIC_PRESETS.map(preset => (
                  <option key={preset} value={preset}>{preset}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">Cause constatée</label>
              <textarea
                data-testid="modal-task-finish-cause"
                value={finishCause}
                onChange={(e) => {
                  setFinishCause(e.target.value);
                  setFinishPreset("");
                }}
                className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                placeholder="Ex: Usure des plaquettes avant confirmée après contrôle visuel complet."
              />
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">Action réalisée</label>
              <textarea
                data-testid="modal-task-finish-action"
                value={finishAction}
                onChange={(e) => {
                  setFinishAction(e.target.value);
                  setFinishPreset("");
                }}
                className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                placeholder="Ex: Remplacement des pièces concernées et serrage contrôlé selon procédure interne."
              />
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">Test / validation finale</label>
              <textarea
                data-testid="modal-task-finish-validation"
                value={finishValidation}
                onChange={(e) => {
                  setFinishValidation(e.target.value);
                  setFinishPreset("");
                }}
                className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                placeholder="Ex: Essai statique conforme, aucun bruit ou défaut résiduel constaté."
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                data-testid="modal-task-finish-cancel"
                onClick={() => {
                  setFinishModalActive(false);
                  setFinishTarget(null);
                  setFinishCause("");
                  setFinishAction("");
                  setFinishValidation("");
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 font-extrabold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="modal-task-finish-confirm"
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

      <StandardReasonModal
        isOpen={modalActive}
        onClose={() => {
          setModalActive(false);
          setModalTargetDossierId(null);
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

      {/* Full Photo Viewer Modal */}
      {activeViewerPhoto && (
        <div 
          data-testid="technician-photo-viewer"
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-4 transition-opacity duration-200"
          onClick={() => setActiveViewerPhoto(null)}
        >
          <div 
            className="relative max-w-full max-h-[85vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={activeViewerPhoto.url} 
              alt={activeViewerPhoto.title}
              className="max-w-full max-h-[70vh] rounded-xl object-contain mx-auto"
            />
            <div className="p-4 bg-white border-t border-gray-100 space-y-1">
              <h4 className="font-extrabold text-sm text-gray-900">{activeViewerPhoto.title}</h4>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase pt-1">
                <span>Catégorie : {activeViewerPhoto.category}</span>
                <span>Prise par : {activeViewerPhoto.takenBy}</span>
              </div>
            </div>
            <button 
              onClick={() => setActiveViewerPhoto(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white font-extrabold flex items-center justify-center transition cursor-pointer text-sm shadow-md"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
