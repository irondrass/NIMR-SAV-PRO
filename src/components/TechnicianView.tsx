/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DossierSAV, DossierStatus, TechnicienResource } from "../types";
import { createRuntimeId } from "../sav-core";
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

  const activeTech = techniciens.find(t => t.id === selectedTechId);

  // Filter tasks specific to this technician
  const techTasks = dossiers.filter(d => 
    d.technicienId === selectedTechId && 
    d.statut !== DossierStatus.LIVRE && 
    d.statut !== DossierStatus.CLOTURE
  );

  const handleUpdateTaskStatus = (dossierId: string, nextStatut: DossierStatus, extraArgs?: Partial<DossierSAV>) => {
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    const updated: DossierSAV = {
      ...original,
      statut: nextStatut,
      dateDernierStatut: new Date().toISOString(),
      ...extraArgs
    };

    // Auto-update action points
    if (nextStatut === DossierStatus.BLOQUE) {
      updated.prochaineActionRecommended = "Contacter le chef d'atelier ou attendre livraison de pièces détachées";
    } else if (nextStatut === DossierStatus.EN_TRAVAUX) {
      updated.prochaineActionRecommended = "Continuer les essais techniques et réparations de l'ordre de travaux";
    }

    onUpdateDossier(updated);
  };

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

  const handleAddPhotoLog = (dossierId: string) => {
    if (!tempPhotoTitle.trim()) return;
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    const mockPhotoArray = [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=400&auto=format&fit=crop&q=60"
    ];
    const newPh = {
      id: createRuntimeId("photo_tech"),
      url: mockPhotoArray[original.photosAvant.length % mockPhotoArray.length],
      title: tempPhotoTitle.trim(),
      date: new Date().toISOString().split("T")[0],
      takenBy: activeTech?.nom || "Technicien"
    };

    const updated: DossierSAV = {
      ...original,
      photosAvant: [...original.photosAvant, newPh],
      dateDernierStatut: new Date().toISOString()
    };
    onUpdateDossier(updated);
    setTempPhotoTitle("");
    alert("Photo de diagnostic ajoutée au dossier !");
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
            className="w-full p-2 bg-slate-800 bg-slate-800 text-white border-2 border-slate-700 rounded font-bold text-xs"
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
              const isBlocked = task.statut === DossierStatus.BLOQUE;
              const isRunning = task.statut === DossierStatus.EN_TRAVAUX;

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
                      <span className="text-[10px] text-blue-800 dark:text-blue-400 uppercase tracking-widest block font-bold font-display">Piloter mon intervention :</span>
                      
                      <div className="flex gap-2">
                        {!isRunning ? (
                          <button 
                            onClick={() => handleUpdateTaskStatus(task.id, DossierStatus.EN_TRAVAUX)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded flex items-center justify-center gap-1 text-[11px] transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Démarrer travaux
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateTaskStatus(task.id, DossierStatus.TRAVAUX_PLANIFIES)}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded flex items-center justify-center gap-1 text-[11px] transition cursor-pointer"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            Mettre en Pause
                          </button>
                        )}

                        <button 
                          onClick={() => {
                            const cause = prompt("Raison du blocage technique :");
                            if (cause) {
                              handleUpdateTaskStatus(task.id, DossierStatus.BLOQUE, { bloqueRaison: cause });
                            }
                          }}
                          className="py-2 px-3 bg-red-600 text-white bg-red-600 rounded font-bold hover:bg-red-700 text-[11px] transition"
                        >
                          Bloquer
                        </button>

                        <button 
                          onClick={() => handleUpdateTaskStatus(task.id, DossierStatus.CONTROLE_QUALITE)}
                          className="py-2 px-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-[11px] transition"
                        >
                          Terminer travaux
                        </button>
                      </div>
                    </div>

                    {/* Quick photo upload simulation */}
                    <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Preuve Photo d'intervention :</span>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border rounded text-[11px] flex-1 font-semibold dark:text-neutral-100 placeholder-zinc-400"
                          placeholder="EX: Remplacement plaquette usée, filtre cassé..."
                          value={tempPhotoTitle}
                          onChange={(e) => setTempPhotoTitle(e.target.value)}
                        />
                        <button 
                          onClick={() => handleAddPhotoLog(task.id)}
                          className="px-3 py-1 bg-zinc-800 text-white font-bold rounded text-[11px] hover:bg-zinc-950"
                        >
                          Prendre photo
                        </button>
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
