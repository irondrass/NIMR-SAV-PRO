/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { DossierSAV, DossierStatus } from "../types";
import { isOperationalActiveDossier } from "../sav-core";

interface KanbanBoardProps {
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ dossiers, onSelectDossier }) => {
  const productionDossiers = useMemo(() => {
    return dossiers.filter(isOperationalActiveDossier);
  }, [dossiers]);

  const receptionnes = useMemo(() => {
    return productionDossiers.filter(d => [DossierStatus.VEHICULE_RECU, DossierStatus.TRAVAUX_PLANIFIES].includes(d.statut));
  }, [productionDossiers]);

  const enTravaux = useMemo(() => {
    return productionDossiers.filter(d => d.statut === DossierStatus.EN_TRAVAUX);
  }, [productionDossiers]);

  const bloques = useMemo(() => {
    return productionDossiers.filter(d => d.statut === DossierStatus.BLOQUE);
  }, [productionDossiers]);

  const aLivrer = useMemo(() => {
    return productionDossiers.filter(d => d.statut === DossierStatus.PRET_A_LIVRER);
  }, [productionDossiers]);

  return (
    <div className="space-y-4 text-xs font-semibold">
      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
        <h3 className="font-extrabold text-sm uppercase tracking-tight text-slate-900">Tableau Kanban d'Avancement de l'Atelier</h3>
        <p className="text-xs text-zinc-500">Visualisation dynamique des colonnes de production par statut</p>
      </div>

      {/* Grid of columns representing stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        
        {/* Received column */}
        <div className="bg-slate-50 border border-gray-200 p-4 rounded-lg space-y-3 shadow-xs">
          <span className="font-bold text-xs uppercase text-zinc-500 block border-b pb-1 font-display">
            1. Réceptionnés ({receptionnes.length})
          </span>
          
          <div className="space-y-2">
            {receptionnes.map(d => (
              <div 
                key={d.id} 
                onClick={() => onSelectDossier(d.id)}
                className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
              >
                <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Works in progress column */}
        <div className="bg-sky-50/50 border border-sky-100 p-4 rounded-lg space-y-3 shadow-xs">
          <span className="font-bold text-xs uppercase text-sky-600 block border-b pb-1 font-display">
            2. En travaux ({enTravaux.length})
          </span>
          
          <div className="space-y-2">
            {enTravaux.map(d => (
              <div 
                key={d.id} 
                onClick={() => onSelectDossier(d.id)}
                className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
              >
                <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blocked column */}
        <div className="bg-red-50/50 border border-red-100 p-4 rounded-lg space-y-3 shadow-xs">
          <span className="font-bold text-xs uppercase text-red-600 block border-b pb-1 font-display">
            3. Bloqués ({bloques.length})
          </span>
          
          <div className="space-y-2">
            {bloques.map(d => (
              <div 
                key={d.id} 
                onClick={() => onSelectDossier(d.id)}
                className="bg-white p-3 rounded-lg border border-gray-200 hover:border-red-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
              >
                <span className="font-mono text-red-600 font-black text-[11px]">{d.id}</span>
                <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                <span className="text-[10px] text-red-600 font-bold block truncate">{d.bloqueRaison || "Facteur bloquant"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ready to hand over column */}
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg space-y-3 shadow-xs">
          <span className="font-bold text-xs uppercase text-emerald-600 block border-b pb-1 font-display">
            4. À livrer ({aLivrer.length})
          </span>
          
          <div className="space-y-2">
            {aLivrer.map(d => (
              <div 
                key={d.id} 
                onClick={() => onSelectDossier(d.id)}
                className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
              >
                <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
