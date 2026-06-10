/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ReclammationClient } from "../types";
import { createReclamationClient } from "../sav-core";
import { ShieldAlert, Plus, CheckCircle, RefreshCcw, UserCheck, AlertTriangle } from "lucide-react";

interface ComplaintsViewProps {
  reclamations: ReclammationClient[];
  existingReclamationIds: string[];
  onAddReclamation: (rec: ReclammationClient) => void;
  onUpdateReclamation: (updated: ReclammationClient) => void;
}

export default function ComplaintsView({ reclamations, existingReclamationIds, onAddReclamation, onUpdateReclamation }: ComplaintsViewProps) {
  const [selectedCriticFilter, setSelectedCriticFilter] = useState<string>("Toutes");
  
  // Temporary form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientNom, setClientNom] = useState("");
  const [dossierId, setDossierId] = useState("");
  const [vehiculeNom, setVehiculeNom] = useState("");
  const [motif, setMotif] = useState("");
  const [criticite, setCriticite] = useState<"moyenne" | "haute" | "critique">("moyenne");
  const [responsable, setResponsable] = useState("");
  const [actionCorrective, setActionCorrective] = useState("");

  const handleCreateReclamation = () => {
    if (!clientNom.trim() || !motif.trim()) {
      alert("Veuillez saisir au moins le client et le motif de la réclamation.");
      return;
    }

    const newRec = createReclamationClient({
      dossierId,
      clientNom,
      vehiculeNom,
      motif,
      criticite,
      responsable,
      actionCorrective
    }, existingReclamationIds);

    onAddReclamation(newRec);
    
    // Reset Form
    setClientNom("");
    setDossierId("");
    setVehiculeNom("");
    setMotif("");
    setResponsable("");
    setActionCorrective("");
    setShowAddForm(false);
  };

  const handleUpdateStatus = (recId: string, nextStatus: "nouvelle" | "en_cours" | "resolue" | "classee") => {
    const original = reclamations.find(r => r.id === recId);
    if (!original) return;

    const updated = {
      ...original,
      statut: nextStatus,
      historiqueLogs: [...original.historiqueLogs, `${new Date().toISOString()} - Statut modifié en : ${nextStatus}`]
    };
    onUpdateReclamation(updated);
  };

  const filteredRecs = selectedCriticFilter === "Toutes" 
    ? reclamations 
    : reclamations.filter(r => r.criticite === selectedCriticFilter);

  return (
    <div className="space-y-6">
      
      {/* Title card */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              RÉCLAMATIONS CLIENTS & CONTENTIEUX SAV
            </h2>
            <p className="text-slate-400 text-xs text-left">Suivi strict, actions correctives et réconciliation de la relation client</p>
          </div>

          <div className="flex gap-2">
            <select
              className="p-1 px-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded text-xs font-bold text-slate-800 dark:text-neutral-300 focus:outline-none"
              value={selectedCriticFilter}
              onChange={(e) => setSelectedCriticFilter(e.target.value)}
            >
              <option value="Toutes">Toutes les criticités</option>
              <option value="critique">Critique</option>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
            </select>

            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Saisir Réclamation
            </button>
          </div>
        </div>
      </div>

      {/* Saisir form dropdown overlay block */}
      {showAddForm && (
        <div className="bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-950 rounded-2xl p-5 shadow-md space-y-4 max-w-2xl mx-auto text-xs animate-fade-in">
          <span className="font-bold text-sm text-red-700 dark:text-red-400 block border-b pb-1.5 uppercase">Nouveau Dossier de litige client SAV</span>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Nom du client *</label>
              <input 
                type="text" 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded font-semibold dark:text-neutral-100" 
                placeholder="Ex: Client Démo 001"
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Dossier technique lié</label>
              <input 
                type="text" 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded font-bold dark:text-neutral-100" 
                placeholder="Ex: NIMR-2026-002"
                value={dossierId}
                onChange={(e) => setDossierId(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Véhicule & Immatriculation</label>
              <input 
                type="text" 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded font-medium dark:text-neutral-100" 
                placeholder="Forthing T5 EVO - 000 TU 0001"
                value={vehiculeNom}
                onChange={(e) => setVehiculeNom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Criticité du mécontentement</label>
              <select
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded font-semibold text-slate-700 dark:text-neutral-300"
                value={criticite}
                onChange={(e) => setCriticite(e.target.value as any)}
              >
                <option value="moyenne">Moyenne</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique (Véhicule stop)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Description / Motif de la plainte *</label>
              <textarea 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded h-16 dark:text-neutral-100" 
                placeholder="Problème de traces de doigts, pièces démontées non restituées..."
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Mesures correctives immédiates proposées</label>
              <input 
                type="text" 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded dark:text-neutral-100" 
                placeholder="Prise en charge nettoyage, lavage gratuit, véhicule courtoisie..."
                value={actionCorrective}
                onChange={(e) => setActionCorrective(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Responsable désigné pour suivi</label>
              <input 
                type="text" 
                className="w-full p-2 bg-slate-50 dark:bg-neutral-950 border rounded dark:text-neutral-100" 
                placeholder="Ex: Responsable Démo SAV (Directeur SAV)"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-1.5 bg-zinc-100 text-zinc-800 rounded font-semibold"
            >
              Annuler
            </button>
            <button 
              onClick={handleCreateReclamation}
              className="px-4 py-1.5 bg-red-600 text-white bg-red-600 rounded font-bold hover:bg-red-700"
            >
              Confirmer la création
            </button>
          </div>
        </div>
      )}

      {/* Grid of active tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRecs.map(rec => {
          let criticalStyle = "border-amber-200 bg-amber-50/10 dark:border-amber-950";
          let cBadge = "bg-amber-100 text-amber-800";
          
          if (rec.criticite === "critique") {
            criticalStyle = "border-red-300 bg-red-50/10 dark:border-red-950";
            cBadge = "bg-red-200 text-red-900 font-extrabold animate-pulse";
          } else if (rec.criticite === "haute") {
            criticalStyle = "border-orange-200 bg-orange-50/10";
            cBadge = "bg-orange-100 text-orange-800 font-bold";
          }

          return (
            <div key={rec.id} className={`border rounded-xl p-5 shadow-sm space-y-4 ${criticalStyle} text-xs font-semibold`}>
              
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900 dark:text-neutral-100 text-sm">{rec.id}</span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-500 text-[11px]">Dossier lié : {rec.dossierId}</span>
                  </div>
                  <h4 className="font-extrabold text-slate-800 dark:text-neutral-200 text-sm leading-tight">{rec.clientNom}</h4>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-400">{rec.vehiculeNom}</p>
                </div>

                <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${cBadge}`}>
                  {rec.criticite}
                </span>
              </div>

              {/* Litige description */}
              <div className="p-3 bg-white dark:bg-neutral-950 rounded-lg border text-[11px] font-medium leading-relaxed text-zinc-600">
                <span className="font-extrabold text-red-700 block mb-0.5">Motif du Mécontentement :</span>
                {rec.motif}
              </div>

              {/* Action plan summary */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Action corrective en cours :</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold">{rec.actionCorrective}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Responsable affecté :</span>
                  <span className="text-zinc-700 dark:text-zinc-400">{rec.responsable}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Délai estimé :</span>
                  <span className="text-zinc-700 dark:text-zinc-400">{rec.delaiTraitement}</span>
                </div>
              </div>

              {/* Actions footer */}
              <div className="pt-2 border-t flex justify-between items-center text-[10px] font-bold text-neutral-400">
                <span>Enregistrée le: {new Date(rec.dateCreation).toLocaleDateString()}</span>
                
                <div className="flex gap-1.5">
                  <select
                    className="p-1 bg-white dark:bg-neutral-900 border rounded font-bold text-[10px] dark:text-neutral-100"
                    value={rec.statut}
                    onChange={(e) => handleUpdateStatus(rec.id, e.target.value as any)}
                  >
                    <option value="nouvelle">Nouvelle</option>
                    <option value="en_cours">En Cours</option>
                    <option value="resolue">Résolue</option>
                    <option value="classee">Classée</option>
                  </select>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
