/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import StandardReasonModal from "./StandardReasonModal";
import { DossierSAV, DossierStatus, TechnicienResource, AtelierZone, UserRole } from "../types";
import {
  assignTechnicianToDossier,
  blockDossier,
  finishWorksForQuality,
  releaseDossierBlock
} from "../sav-core";
import { 
  Users, 
  Wrench, 
  AlertTriangle, 
  CheckSquare, 
  Clock, 
  HelpCircle, 
  UserPlus, 
  ShieldAlert, 
  Activity, 
  Play, 
  CheckCircle,
  TrendingUp,
  SlidersHorizontal,
  FolderOpen
} from "lucide-react";
import { StatusBadge, LicencePlate, PriorityBadge } from "./UIParts";

interface ChefAtelierViewProps {
  dossiers: DossierSAV[];
  techniciens: TechnicienResource[];
  onSelectDossier: (id: string) => void;
  onUpdateDossier: (updated: DossierSAV) => void;
}

export default function ChefAtelierView({ 
  dossiers, 
  techniciens, 
  onSelectDossier, 
  onUpdateDossier 
}: ChefAtelierViewProps) {
  
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("Toutes");

  // Modal states for Lot 1
  const [modalActive, setModalActive] = useState<boolean>(false);
  const [modalTargetDossierId, setModalTargetDossierId] = useState<string | null>(null);

  // Get active files
  const activeFolders = dossiers.filter(d => d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE);
  
  // Tasks requiring assignment
  const unassignedFolders = activeFolders.filter(d => !d.technicienId);

  // Blocked folders list
  const blockedFolders = activeFolders.filter(d => d.statut === DossierStatus.BLOQUE);

  // Ready for QC
  const readyForQCFolders = activeFolders.filter(d => d.statut === DossierStatus.CONTROLE_QUALITE);

  const handleQuickAssign = (dossierId: string, techId: string) => {
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    onUpdateDossier(assignTechnicianToDossier(original, techId));
  };

  const handleQuickBlock = (dossierId: string) => {
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    setModalTargetDossierId(dossierId);
    setModalActive(true);
  };

  const handleBlockConfirm = (reason: string, details: string) => {
    const fullReason = details ? `${reason} : ${details}` : reason;
    if (modalTargetDossierId) {
      const original = dossiers.find(d => d.id === modalTargetDossierId);
      if (original) {
        const logMessage = `[${UserRole.CHEF_ATELIER}] - Blocage Dossier - Motif: ${reason}${details ? ` (Observations: ${details})` : ""}`;
        const nextDossier = blockDossier(original, fullReason);
        const updatedLogs = [
          `${new Date().toISOString()} - ${logMessage}`,
          ...(nextDossier.historiqueLogs || [])
        ];
        onUpdateDossier({
          ...nextDossier,
          historiqueLogs: updatedLogs
        });
      }
    }
    setModalActive(false);
    setModalTargetDossierId(null);
  };

  const handleQuickEndWorks = (dossierId: string) => {
    const original = dossiers.find(d => d.id === dossierId);
    if (!original) return;

    onUpdateDossier(finishWorksForQuality(original));
  };

  return (
    <div className="space-y-6">
      
      {/* Banner info */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2 font-display">
              <Wrench className="w-5 h-5 text-blue-600" />
              CONTRÔLEUR DE PRODUCTION CHEF D'ATELIER
            </h2>
            <p className="text-slate-400 text-xs text-left">Suivi de l'avancement, dispatch des techniciens et déblocage de lignes de production</p>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded text-xs font-bold text-slate-800 dark:text-neutral-300"
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
            >
              <option value="Toutes">Filtrer par Zone Atelier</option>
              {Object.values(AtelierZone).map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid of quick summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
        <div className="bg-white dark:bg-neutral-900 p-4 border rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold dark:text-neutral-100">{unassignedFolders.length}</div>
            <div className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Dossiers Non Affectés</div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 border rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-red-50 dark:bg-red-950 text-red-600 rounded">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold dark:text-neutral-100">{blockedFolders.length}</div>
            <div className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Actuellement Bloqués</div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 border rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold dark:text-neutral-100">{readyForQCFolders.length}</div>
            <div className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Prêts pour Essai de Qualité</div>
          </div>
        </div>

        {/* Available techs */}
        <div className="bg-white dark:bg-neutral-900 p-4 border rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold dark:text-neutral-100">
              {techniciens.filter(t => t.disponibilite === "disponible").length} / {techniciens.length}
            </div>
            <div className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Compagnons Disponibles</div>
          </div>
        </div>
      </div>

      {/* Queue panel split side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Unassigned Work Queue (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b pb-1.5 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">FILE D’ATTENTE NON AFFECTÉE (DISPATCH)</h3>
            <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full">
              {unassignedFolders.length} dossiers
            </span>
          </div>

          {unassignedFolders.length === 0 ? (
            <p className="text-xs text-zinc-400 italic text-center py-6">Parfait ! Tous les dossiers actifs sont assignés à des compagnons.</p>
          ) : (
            <div className="space-y-3">
              {unassignedFolders.map(doss => (
                <div key={doss.id} className="p-3 bg-slate-50 dark:bg-neutral-950 border rounded-lg text-xs space-y-2.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-blue-600 font-bold cursor-pointer hover:underline font-mono" onClick={() => onSelectDossier(doss.id)}>
                      {doss.id}
                    </span>
                    <PriorityBadge priority={doss.priorite} />
                  </div>

                  <div>
                    <span className="font-bold text-slate-800 dark:text-neutral-300 block">{doss.clientNom}</span>
                    <span className="text-slate-500 font-semibold text-[11px] block">{doss.vehiculeMarque} {doss.vehiculeModele}</span>
                  </div>

                  {/* Assign dropdown */}
                  <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 block font-bold">Attribuer à :</span>
                    <select
                      className="p-1 px-1.5 bg-white dark:bg-neutral-900 border rounded font-bold text-[10px] dark:text-neutral-100 text-slate-700 flex-1 focus:outline-none"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleQuickAssign(doss.id, e.target.value);
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Choisir Compagnon --</option>
                      {techniciens.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.nom} ({t.disponibilite === "disponible" ? "Dispo" : "Occupé"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Production Board (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b pb-1.5">
            <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">TRAVAUX EN ATELIER ACTIFS</h3>
            <p className="text-slate-400 text-xs">Aperçu et actions rapides : mise en repos, relance, ou fin de travaux de réparation</p>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto">
            {activeFolders.filter(d => d.technicienId).map(doss => {
              const tech = techniciens.find(t => t.id === doss.technicienId);
              
              return (
                <div key={doss.id} className="p-3.5 bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => onSelectDossier(doss.id)}>
                      {doss.id}
                    </span>
                    <div className="flex gap-1.5">
                      <StatusBadge status={doss.statut} />
                      <PriorityBadge priority={doss.priorite} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-zinc-400 block text-[10px]">CLIENT & INFOS :</span>
                      <span className="font-bold block text-zinc-700 dark:text-zinc-300">{doss.clientNom}</span>
                      <span className="text-[11px] block text-zinc-500 font-semibold">{doss.vehiculeMarque} {doss.vehiculeModele}</span>
                    </div>

                    <div>
                      <span className="text-zinc-400 block text-[10px]">ASSIGNATION COMPAGNON :</span>
                      <span className="font-bold block text-zinc-700 dark:text-zinc-300">{tech?.nom || "Non assigné"}</span>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950 px-1 py-[1px] rounded text-blue-700 dark:text-blue-400 font-bold uppercase">{doss.zoneAtelier}</span>
                    </div>
                  </div>

                  {/* Actions for active items */}
                  <div className="pt-2.5 border-t border-zinc-200 dark:border-neutral-800 flex justify-between items-center gap-2">
                    {/* Time indicator */}
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Avancement : {doss.avancementGlobal}%
                    </div>

                    <div className="flex gap-1">
                      {doss.statut !== DossierStatus.BLOQUE ? (
                        <button 
                          onClick={() => handleQuickBlock(doss.id)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px]"
                        >
                          Signaler blocage
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            onUpdateDossier(releaseDossierBlock(doss));
                          }}
                          className="px-2 py-1 bg-green-600 text-white bg-green-600 rounded font-bold text-[10px]"
                        >
                          Débloquer
                        </button>
                      )}

                      {doss.statut === DossierStatus.EN_TRAVAUX && (
                        <button 
                          onClick={() => handleQuickEndWorks(doss.id)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10px] cursor-pointer"
                        >
                          Fin Travaux → QC
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <StandardReasonModal
        isOpen={modalActive}
        onClose={() => {
          setModalActive(false);
          setModalTargetDossierId(null);
        }}
        onConfirm={handleBlockConfirm}
        title="Blocage du Dossier"
        description="Veuillez spécifier la raison du blocage de ce dossier."
        reasons={[
          "Attente pièce de rechange (Magasin)",
          "Attente accord client complémentaire",
          "Outillage spécifique indisponible",
          "Surcharge pont / ressource",
          "Autre (saisie libre)"
        ]}
        testIdPrefix="modal-task-block"
      />

    </div>
  );
}
