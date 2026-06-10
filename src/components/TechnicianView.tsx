/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DossierSAV, DossierStatus, PHOTO_CATEGORIES, PhotoCategory, TechnicienResource } from "../types";
import {
  addPhotoToDossier,
  blockRepairOrder,
  finishRepairOrder,
  getRepairOrderStatusLabel,
  normalizeRepairOrderStatus,
  pauseRepairOrder,
  startRepairOrder
} from "../sav-core";
import { fileToCameraPhoto } from "../photo-utils";
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

interface TechnicianViewProps {
  dossiers: DossierSAV[];
  techniciens: TechnicienResource[];
  onUpdateDossier: (updated: DossierSAV) => void;
}

export default function TechnicianView({ dossiers, techniciens, onUpdateDossier }: TechnicianViewProps) {
  const [selectedTechId, setSelectedTechId] = useState<string>("tech_01");
  const [tempNote, setTempNote] = useState("");
  const [tempPhotoTitle, setTempPhotoTitle] = useState("");
  const [tempPhotoCategory, setTempPhotoCategory] = useState<PhotoCategory>("autre");

  const activeTech = techniciens.find(t => t.id === selectedTechId);

  // Filter tasks specific to this technician
  const techTasks = dossiers.filter(d => 
    d.technicienId === selectedTechId && 
    d.statut !== DossierStatus.LIVRE && 
    d.statut !== DossierStatus.CLOTURE
  );

  const handleAddNoteLog = (dossierId: string) => {
    if (!tempNote.trim()) return;
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    const finalNote = `[Note Technicien - ${activeTech?.nom}] : ${tempNote.trim()}`;
    const updated: DossierSAV = {
      ...original,
      observationsReception: original.observationsReception 
        ? `${original.observationsReception} | ${finalNote}` 
        : finalNote,
      dateDernierStatut: new Date().toISOString()
    };
    onUpdateDossier(updated);
    setTempNote("");
    alert("Note technique ajoutée au dossier avec succès !");
  };

  const handleRepairOrderAction = (dossierId: string, lineId: string, action: "start" | "pause" | "block" | "finish") => {
    const reason = action === "block" ? prompt("Raison du blocage technique :")?.trim() : "";
    if (action === "block" && !reason) return;

    const result =
      action === "start" ? startRepairOrder(dossiers, dossierId, lineId) :
      action === "pause" ? pauseRepairOrder(dossiers, dossierId, lineId) :
      action === "block" ? blockRepairOrder(dossiers, dossierId, lineId, reason) :
      finishRepairOrder(dossiers, dossierId, lineId);

    if (result.ok === false) {
      alert(result.error);
      return;
    }
    onUpdateDossier(result.dossier);
  };

  const handleAddPhotoFiles = async (dossierId: string, files: FileList | null) => {
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
      alert("Photo de diagnostic ajoutée au dossier !");
    } catch {
      alert("Impossible d'ajouter cette photo de diagnostic.");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Simulation Tech Switcher */}
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
            className="w-full p-2 bg-slate-800 text-white border-2 border-slate-700 rounded font-bold text-xs"
            value={selectedTechId}
            onChange={(e) => setSelectedTechId(e.target.value)}
          >
            {techniciens.map(t => (
              <option key={t.id} value={t.id}>
                {t.nom} — {t.specialite} ({t.zoneAffectee})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary tasks */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200 uppercase tracking-wider">
          Mes travaux assignés aujourd'hui ({techTasks.length})
        </h3>

        {techTasks.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 p-8 border rounded-xl text-center text-xs text-slate-400 space-y-2">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
            <span>Aucune tâche active assignée. Vous êtes entièrement disponible commercialement.</span>
          </div>
        ) : (
          <div className="space-y-4 text-xs font-semibold">
            {techTasks.map(task => {
              return (
                <div key={task.id} className="bg-white dark:bg-neutral-900 border rounded-2xl shadow-sm overflow-hidden">
                  
                  {/* Top quick state info */}
                  <div className="p-4 bg-slate-50 dark:bg-neutral-950 border-b flex justify-between items-center font-display">
                    <div>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm block">{task.id}</span>
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
                        <span className="font-extrabold text-slate-800 dark:text-neutral-200">{task.vehiculeMarque} {task.vehiculeModele}</span>
                        <LicencePlate plate={task.vehiculeImmatriculation} />
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">Client: {task.clientNom}</span>
                      </div>

                      {/* Client symptoms */}
                      <div className="p-2.5 bg-neutral-50 dark:bg-neutral-950 border rounded-lg text-[11px] leading-tight text-neutral-500 font-medium">
                        <span className="font-bold text-neutral-700 block mb-0.5">Plainte Client :</span>
                        {task.plainteClient}
                      </div>
                    </div>

                    {/* Interactive controls */}
                    <div className="p-3 bg-blue-50/10 dark:bg-blue-950/25 border border-blue-100/40 rounded-lg space-y-2.5">
                      <span className="text-[10px] text-blue-800 dark:text-blue-400 uppercase tracking-widest block font-bold font-display">Piloter mes tâches :</span>
                      <div className="space-y-2">
                        {task.ordresReparation.map(line => {
                          const status = normalizeRepairOrderStatus(line.status);
                          const activeLineInSameDossier = task.ordresReparation.find(current =>
                            current.id !== line.id && normalizeRepairOrderStatus(current.status) === "in_progress"
                          );
                          const activeDossierForTechnician = dossiers.find(current =>
                            current.id !== task.id &&
                            current.technicienId === selectedTechId &&
                            current.ordresReparation.some(order => normalizeRepairOrderStatus(order.status) === "in_progress")
                          );
                          const startBlockedMessage = activeLineInSameDossier
                            ? "Une tâche est déjà en cours pour ce dossier."
                            : activeDossierForTechnician
                              ? "Ce technicien a déjà une tâche en cours."
                              : "";
                          const canStartLine = status !== "done" && status !== "in_progress" && !startBlockedMessage;

                          return (
                            <div key={line.id} className="p-2 bg-white dark:bg-neutral-900 border border-blue-100 dark:border-blue-900 rounded space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-neutral-200 block">{line.designation}</span>
                                  <span className="text-[10px] text-zinc-400 font-mono">{line.tempsPasse}H / {line.tempsEstime}H</span>
                                </div>
                                <span 
                                  data-testid={`task-status-${line.id}`}
                                  className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                                  {getRepairOrderStatusLabel(status)}
                                </span>
                              </div>
                              {startBlockedMessage && status !== "done" && status !== "in_progress" && (
                                <p className="text-[10px] text-rose-600 font-bold">{startBlockedMessage}</p>
                              )}
                              {status === "done" ? (
                                <div className="py-1 text-green-700 dark:text-green-400 font-black text-[10px] uppercase flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Statut terminé
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {status !== "in_progress" && (
                                    <button
                                      disabled={!canStartLine}
                                      data-testid={`task-start-${line.id}`}
                                      onClick={() => handleRepairOrderAction(task.id, line.id, "start")}
                                      className="flex-1 min-w-24 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded flex items-center justify-center gap-1 text-[10px] transition cursor-pointer"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      {status === "pending" ? "Démarrer" : "Reprendre"}
                                    </button>
                                  )}
                                  {status === "in_progress" && (
                                    <>
                                      <button
                                        data-testid={`task-pause-${line.id}`}
                                        onClick={() => handleRepairOrderAction(task.id, line.id, "pause")}
                                        className="flex-1 min-w-20 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded flex items-center justify-center gap-1 text-[10px] transition cursor-pointer"
                                      >
                                        <Pause className="w-3.5 h-3.5" />
                                        Pause
                                      </button>
                                      <button
                                        onClick={() => handleRepairOrderAction(task.id, line.id, "block")}
                                        className="py-1.5 px-2.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 text-[10px] transition"
                                      >
                                        Bloquer
                                      </button>
                                      <button
                                        data-testid={`task-finish-${line.id}`}
                                        onClick={() => handleRepairOrderAction(task.id, line.id, "finish")}
                                        className="py-1.5 px-2.5 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-[10px] transition"
                                      >
                                        Terminer
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick photo upload */}
                    <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Preuve Photo d'intervention :</span>
                      <div className="grid grid-cols-1 gap-2">
                        <input 
                          type="text"
                          className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border rounded text-[11px] flex-1 font-semibold dark:text-neutral-100 placeholder-zinc-400"
                          placeholder="EX: Remplacement plaquette usée, filtre cassé..."
                          value={tempPhotoTitle}
                          onChange={(e) => setTempPhotoTitle(e.target.value)}
                        />
                        <select
                          className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border rounded text-[11px] font-bold dark:text-neutral-100"
                          value={tempPhotoCategory}
                          onChange={(e) => setTempPhotoCategory(e.target.value as PhotoCategory)}
                        >
                          {PHOTO_CATEGORIES.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="px-3 py-1.5 bg-zinc-800 text-white font-bold rounded text-[11px] hover:bg-zinc-950 cursor-pointer text-center">
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
                          <label className="px-3 py-1.5 bg-white dark:bg-neutral-900 border text-slate-700 dark:text-neutral-200 font-bold rounded text-[11px] hover:bg-zinc-50 dark:hover:bg-neutral-800 cursor-pointer text-center">
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
                    <div className="space-y-2">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Ajouter une note technique :</span>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border rounded text-[11px] flex-1 font-semibold dark:text-neutral-100 placeholder-zinc-400"
                          placeholder="EX: Vis oxydée débloquée, complément à prévoir..."
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddNoteLog(task.id)}
                        />
                        <button 
                          onClick={() => handleAddNoteLog(task.id)}
                          className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-[11px] hover:bg-blue-700 cursor-pointer"
                        >
                          Sauver
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
