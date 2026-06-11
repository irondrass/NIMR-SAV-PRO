/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AtelierZone, TechnicienResource, DossierSAV, DossierStatus, WorkshopBay } from "../types";
import { normalizeRepairOrderStatus, suggestWorkshopSlot, WorkshopSlotSuggestion } from "../sav-core";
import { Calendar, UserCheck, AlertTriangle, Clock, Hammer, Search, SlidersHorizontal, Settings, Sparkles, Check } from "lucide-react";
import { LicencePlate, StatusBadge } from "./UIParts";

interface WorkshopPlanningProps {
  techniciens: TechnicienResource[];
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
  onUpdateDossier: (updated: DossierSAV) => void;
}

const DEFAULT_WORKSHOP_BAYS: WorkshopBay[] = [
  { id: "bay_fast_01", name: "Pont rapide 1", zone: AtelierZone.MECANIQUE_RAPIDE },
  { id: "bay_mech_01", name: "Pont mécanique 1", zone: AtelierZone.GRANDS_TRAVAUX },
  { id: "bay_diag_01", name: "Pont diagnostic 1", zone: AtelierZone.ELECTRICITE_DIAG },
  { id: "bay_body_01", name: "Pont carrosserie 1", zone: AtelierZone.CARROSSERIE },
  { id: "bay_general_01", name: "Pont polyvalent" },
];

export default function WorkshopPlanning({ techniciens, dossiers, onSelectDossier, onUpdateDossier }: WorkshopPlanningProps) {
  const [filterZone, setFilterZone] = useState<string>("Toutes");
  const [suggestionTargetId, setSuggestionTargetId] = useState("");
  const [suggestion, setSuggestion] = useState<WorkshopSlotSuggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState("");

  // Filter technicians
  const filteredTechs = filterZone === "Toutes" 
    ? techniciens 
    : techniciens.filter(t => t.zoneAffectee === filterZone);
  const targetDossiers = dossiers.filter(dossier =>
    dossier.statut !== DossierStatus.LIVRE &&
    dossier.statut !== DossierStatus.CLOTURE &&
    !dossier.ordresReparation.every(line => normalizeRepairOrderStatus(line.status) === "done")
  );
  const selectedTargetId = suggestionTargetId || targetDossiers[0]?.id || "";
  const selectedTarget = targetDossiers.find(dossier => dossier.id === selectedTargetId);

  const handleSuggestSlot = () => {
    if (!selectedTarget) {
      setSuggestionError("Aucun dossier actif disponible pour planification.");
      setSuggestion(null);
      return;
    }

    const estimatedHours = selectedTarget.ordresReparation.reduce((total, line) => (
      normalizeRepairOrderStatus(line.status) === "done" ? total : total + line.tempsEstime
    ), 0) || 1;
    setSuggestion(suggestWorkshopSlot({
      dossiers,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      estimatedHours,
      desiredDate: new Date(),
    }));
    setSuggestionError("");
  };

  const handleApplySuggestion = () => {
    if (!selectedTarget || !suggestion) return;
    onUpdateDossier({
      ...selectedTarget,
      technicienId: suggestion.technicianId,
      workshopBayId: suggestion.bayId,
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      dateDernierStatut: new Date().toISOString(),
      prochaineActionRecommended: `Planifier sur ${suggestion.bayName} avec ${suggestion.technicianName} de ${new Date(suggestion.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(suggestion.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Title & quick instructions */}
      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900  uppercase tracking-widest flex items-center gap-2 font-display">
              <Calendar className="w-5 h-5 text-blue-600" />
              PLANNING & CHARGE DES TECHNICIENS DE L’ATELIER
            </h2>
            <p className="text-slate-400 text-xs">Aperçu visuel de la charge journalière des techniciens (Gantt opérationnel)</p>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              className="p-1 px-2.5 bg-slate-50  border border-slate-200  rounded text-xs font-bold text-slate-800 "
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
            >
              <option value="Toutes">Tous les Pôles d'Atelier</option>
              {Array.from(new Set(techniciens.map(t => t.zoneAffectee))).map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Suggestion automatique atelier</span>
            <select
              data-testid="planning-suggest-dossier"
              className="w-full p-2 bg-slate-50  border border-slate-200  rounded text-xs font-bold text-slate-800 "
              value={selectedTargetId}
              onChange={(e) => {
                setSuggestionTargetId(e.target.value);
                setSuggestion(null);
                setSuggestionError("");
              }}
            >
              {targetDossiers.map(dossier => (
                <option key={dossier.id} value={dossier.id}>
                  {dossier.id} - {dossier.vehiculeMarque} {dossier.vehiculeModele}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSuggestSlot}
            data-testid="planning-suggest-submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Suggérer meilleur créneau
          </button>
        </div>

        {suggestionError && (
          <p data-testid="planning-suggest-error" className="text-xs font-bold text-rose-600">{suggestionError}</p>
        )}

        {suggestion && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-blue-50/40  border border-blue-100  rounded-lg text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Technicien proposé</span>
              <strong data-testid="planning-suggest-tech" className="text-slate-800 ">{suggestion.technicianName}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Pont proposé</span>
              <strong data-testid="planning-suggest-bay" className="text-slate-800 ">{suggestion.bayName}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Heure début</span>
              <strong className="text-slate-800 ">{new Date(suggestion.startTime).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Heure fin</span>
              <strong className="text-slate-800 ">{new Date(suggestion.endTime).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</strong>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Raison</span>
              <p className="text-slate-600  font-semibold">{suggestion.reason}</p>
              <button
                onClick={handleApplySuggestion}
                data-testid="planning-suggest-apply"
                className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Appliquer la suggestion
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid of technicans and Gantt representations */}
      <div className="bg-white  border border-slate-200  rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50  border-b border-slate-200  flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="w-2/5">Technicien / Spécialité</span>
          <span className="w-3/5 text-center">Charge Horaire Journalière Globale (Capacité standard 8H)</span>
        </div>

        <div className="divide-y divide-slate-200 ">
          {filteredTechs.map(tech => {
            // Find dossiers assigned to this technician
            const assignedDossiers = dossiers.filter(d => d.technicienId === tech.id && d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE);
            
            // Calculate active hours
            const totalHoursEst = assignedDossiers.reduce((acc, current) => {
              const activeRO = current.ordresReparation.filter(r => normalizeRepairOrderStatus(r.status) !== "done");
              return acc + activeRO.reduce((sum, line) => sum + line.tempsEstime, 0);
            }, 0);

            // Tech availability color
            let statusColor = "bg-green-500";
            if (tech.disponibilite === "occupe") statusColor = "bg-amber-500";
            if (tech.disponibilite === "absent") statusColor = "bg-red-500";
            if (tech.disponibilite === "formation") statusColor = "bg-blue-500";

            // Percentage calculation
            const chargePercent = Math.min(100, Math.round((totalHoursEst / 8) * 100));
            const isOverloaded = totalHoursEst > 8;

            return (
              <div key={tech.id} data-testid={`tech-row-${tech.id}`} className="flex flex-col md:flex-row p-4 items-stretch gap-4 hover:bg-slate-50/50  transition">
                
                {/* Tech Profile Panel */}
                <div className="md:w-2/5 space-y-1.5 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} title={tech.disponibilite}></span>
                    <span data-testid={`tech-name-${tech.id}`} className="font-bold text-slate-800  text-xs">{tech.nom}</span>
                    <span className="bg-zinc-100  text-zinc-500 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {tech.zoneAffectee}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-slate-500 font-semibold">{tech.specialite}</div>
                  
                  {/* Competencies badges */}
                  <div className="flex flex-wrap gap-1">
                    {tech.compétences.map((comp, idx) => (
                      <span key={idx} className="bg-slate-100  text-slate-500 text-[9px] px-1.5 py-0.5 rounded">
                        {comp}
                      </span>
                    ))}
                  </div>

                  {tech.absencesConges.length > 0 && (
                    <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Absence: {tech.absencesConges[0]}
                    </div>
                  )}
                </div>

                {/* Visual Gantt Bar Panel */}
                <div className="md:w-3/5 flex flex-col justify-center space-y-2 pt-2 md:pt-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total charge planifiée: <strong className="text-zinc-700  font-bold">{totalHoursEst}H</strong></span>
                    <span data-testid={`tech-charge-${tech.id}`} className={`font-mono font-bold ${isOverloaded ? "text-rose-500" : "text-neutral-500"}`}>
                      {chargePercent}% {isOverloaded && "(Surcharge)"}
                    </span>
                  </div>

                  {/* Load progress slider representation */}
                  <div className="w-full bg-slate-100  rounded-full h-3 overflow-hidden border border-slate-200 ">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOverloaded 
                          ? "bg-rose-500" 
                          : chargePercent >= 80 
                            ? "bg-amber-500" 
                            : "bg-blue-600"
                      }`}
                      style={{ width: `${chargePercent}%` }}
                    />
                  </div>

                  {/* Allocated folders list with links */}
                  {assignedDossiers.length === 0 ? (
                    <span className="text-[10px] text-zinc-400 italic">Aucun véhicule planifié pour aujourd'hui (Disponible)</span>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {assignedDossiers.map(dossier => (
                        <button 
                          key={dossier.id}
                          onClick={() => onSelectDossier(dossier.id)}
                          className="bg-blue-50 hover:bg-blue-100   text-blue-700  border border-blue-200  text-[10px] font-bold p-1 px-2.5 rounded flex items-center gap-1.5 transition text-left cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          {dossier.id}
                          <span>({dossier.vehiculeMarque} {dossier.vehiculeModele})</span>
                          <LicencePlate plate={dossier.vehiculeImmatriculation} />
                        </button>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
