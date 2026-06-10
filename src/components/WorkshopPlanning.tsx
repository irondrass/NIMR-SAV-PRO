/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { TechnicienResource, DossierSAV, DossierStatus } from "../types";
import { Calendar, UserCheck, AlertTriangle, Clock, Hammer, Search, SlidersHorizontal, Settings } from "lucide-react";
import { LicencePlate, StatusBadge } from "./UIParts";

interface WorkshopPlanningProps {
  techniciens: TechnicienResource[];
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
}

export default function WorkshopPlanning({ techniciens, dossiers, onSelectDossier }: WorkshopPlanningProps) {
  const [filterZone, setFilterZone] = useState<string>("Toutes");

  // Filter technicians
  const filteredTechs = filterZone === "Toutes" 
    ? techniciens 
    : techniciens.filter(t => t.zoneAffectee === filterZone);

  return (
    <div className="space-y-6">
      
      {/* Title & quick instructions */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2 font-display">
              <Calendar className="w-5 h-5 text-blue-600" />
              PLANNING & CHARGE DES TECHNICIENS DE L’ATELIER
            </h2>
            <p className="text-slate-400 text-xs">Aperçu visuel de la charge journalière des techniciens (Gantt opérationnel)</p>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded text-xs font-bold text-slate-800 dark:text-neutral-300"
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

      {/* Grid of technicans and Gantt representations */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="w-2/5">Technicien / Spécialité</span>
          <span className="w-3/5 text-center">Charge Horaire Journalière Globale (Capacité standard 8H)</span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-neutral-800">
          {filteredTechs.map(tech => {
            // Find dossiers assigned to this technician
            const assignedDossiers = dossiers.filter(d => d.technicienId === tech.id && d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE);
            
            // Calculate active hours
            const totalHoursEst = assignedDossiers.reduce((acc, current) => {
              const activeRO = current.ordresReparation.filter(r => r.status !== "termine");
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
              <div key={tech.id} className="flex flex-col md:flex-row p-4 items-stretch gap-4 hover:bg-slate-50/50 dark:hover:bg-neutral-950/40 transition">
                
                {/* Tech Profile Panel */}
                <div className="md:w-2/5 space-y-1.5 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} title={tech.disponibilite}></span>
                    <span className="font-bold text-slate-800 dark:text-neutral-100 text-xs">{tech.nom}</span>
                    <span className="bg-zinc-100 dark:bg-neutral-800 text-zinc-500 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {tech.zoneAffectee}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-slate-500 font-semibold">{tech.specialite}</div>
                  
                  {/* Competencies badges */}
                  <div className="flex flex-wrap gap-1">
                    {tech.compétences.map((comp, idx) => (
                      <span key={idx} className="bg-slate-100 dark:bg-neutral-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded">
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
                    <span className="text-slate-400">Total charge planifiée: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{totalHoursEst}H</strong></span>
                    <span className={`font-mono font-bold ${isOverloaded ? "text-rose-500" : "text-neutral-500"}`}>
                      {chargePercent}% {isOverloaded && "(Surcharge)"}
                    </span>
                  </div>

                  {/* Load progress slider representation */}
                  <div className="w-full bg-slate-100 dark:bg-neutral-950 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-neutral-800">
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
                          className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/25 dark:hover:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 text-[10px] font-bold p-1 px-2.5 rounded flex items-center gap-1.5 transition text-left cursor-pointer"
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
