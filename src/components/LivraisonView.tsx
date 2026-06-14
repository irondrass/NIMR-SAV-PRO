/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DossierSAV, UserRole, DossierStatus } from "../types";
import { confirmDelivery } from "../sav-core";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  History, 
  Check, 
  ChevronRight, 
  User, 
  Truck,
  FileText
} from "lucide-react";
import { LicencePlate } from "./UIParts";

interface LivraisonViewProps {
  dossiers: DossierSAV[];
  onUpdateDossier: (dossier: DossierSAV) => void;
  currentUser: {
    displayName: string;
    role: UserRole;
  };
}

export default function LivraisonView({
  dossiers,
  onUpdateDossier,
  currentUser
}: LivraisonViewProps) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [exitKm, setExitKm] = useState("");
  const [remarks, setRemarks] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Restitution checklist checkboxes
  const [qcOk, setQcOk] = useState(false);
  const [clientInformed, setClientInformed] = useState(false);
  const [clientReceptionConfirmed, setClientReceptionConfirmed] = useState(false);

  const selectedDossier = dossiers.find(d => d.id === selectedDossierId);

  const handleSelectDossier = (dossier: DossierSAV) => {
    setSelectedDossierId(dossier.id);
    setExitKm(dossier.livraison.kilometrageSortie ? String(dossier.livraison.kilometrageSortie) : String(dossier.vehiculeKilometrage));
    setRemarks(dossier.livraison.remarquesLivraison || "");
    setValidationError(null);
    setSuccessMsg(null);

    setQcOk(dossier.livraison.controleQualiteOk || false);
    setClientInformed(dossier.livraison.clientInforme || false);
    setClientReceptionConfirmed(dossier.livraison.confirmationReceptionClient || false);
  };

  // 1. Filter dossiers
  const readyDossiers = dossiers.filter(d => d.statut === DossierStatus.PRET_A_LIVRER);
  const deliveredDossiers = dossiers
    .filter(d => d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.PRET_FACTURATION || d.statut === DossierStatus.CLOTURE)
    .sort((a, b) => {
      const dateA = a.livraison.dateLivraisonReelle ? new Date(a.livraison.dateLivraisonReelle).getTime() : 0;
      const dateB = b.livraison.dateLivraisonReelle ? new Date(b.livraison.dateLivraisonReelle).getTime() : 0;
      return dateB - dateA;
    });

  const handleConfirmDelivery = () => {
    setValidationError(null);
    setSuccessMsg(null);
    if (!selectedDossier) return;

    if (!qcOk || !clientInformed || !clientReceptionConfirmed) {
      setValidationError("Toutes les étapes de la checklist de restitution doivent être cochées pour confirmer la livraison.");
      return;
    }

    const parsedExitKm = parseInt(exitKm, 10);
    if (isNaN(parsedExitKm) || parsedExitKm < 0) {
      setValidationError("Le kilométrage de sortie est obligatoire et doit être un nombre valide.");
      return;
    }

    if (parsedExitKm < selectedDossier.vehiculeKilometrage) {
      setValidationError(`Le kilométrage de sortie (${parsedExitKm} km) ne peut pas être inférieur au kilométrage d'entrée (${selectedDossier.vehiculeKilometrage} km).`);
      return;
    }

    const withDeliveryInfo: DossierSAV = {
      ...selectedDossier,
      livraison: {
        ...selectedDossier.livraison,
        controleQualiteOk: qcOk,
        clientInforme: clientInformed,
        confirmationReceptionClient: clientReceptionConfirmed,
        remarquesLivraison: remarks,
        kilometrageSortie: parsedExitKm,
      }
    };

    const delivered = confirmDelivery(withDeliveryInfo, new Date());

    // Add delivery log with actor and details
    const timestamp = new Date().toISOString();
    const formattedLog = `${timestamp} - [${currentUser.role}] - Restitution validée. KM Sortie: ${parsedExitKm}. Obs: ${remarks || "Aucune"}`;
    delivered.historiqueLogs = [formattedLog, ...(delivered.historiqueLogs || [])];

    onUpdateDossier(delivered);
    setSuccessMsg(`Livraison confirmée pour le dossier ${selectedDossier.id} ! Le véhicule est maintenant marqué comme livré.`);
    setSelectedDossierId(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with gradient and title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Module Livraison dédié</h1>
          <p className="text-sm text-indigo-200 mt-1">
            Restitution des véhicules aux clients, signature de réception et relevé du kilométrage final.
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="px-5 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Prêts à livrer</span>
            <span className="text-2xl font-black text-white mt-0.5">{readyDossiers.length}</span>
          </div>
          <div className="px-5 py-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Livrés</span>
            <span className="text-2xl font-black text-white mt-0.5">{deliveredDossiers.length}</span>
          </div>
        </div>
      </div>

      {/* Main split screen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Ready to deliver list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Véhicules prêts à livrer ({readyDossiers.length})
            </h2>

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg">
                {successMsg}
              </div>
            )}

            {readyDossiers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Aucun véhicule n'est actuellement prêt à être livré.
              </div>
            ) : (
              <div data-testid="delivery-dossier-list" className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {readyDossiers.map(dossier => {
                  const isSelected = selectedDossierId === dossier.id;
                  return (
                    <button
                      key={dossier.id}
                      data-testid={`delivery-dossier-row-${dossier.id}`}
                      onClick={() => handleSelectDossier(dossier)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex justify-between items-center ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-200 shadow-xs ring-1 ring-indigo-200"
                          : "bg-slate-50/50 hover:bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800">{dossier.id}</span>
                          <LicencePlate plate={dossier.vehiculeImmatriculation} />
                        </div>
                        <p className="text-[11px] font-bold text-slate-600">
                          {dossier.vehiculeMarque} {dossier.vehiculeModele}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          Client: {dossier.clientNom}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-indigo-600 translate-x-0.5" : "text-slate-400"}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Delivery Checklist & Form */}
        <div className="lg:col-span-7">
          {selectedDossier ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Selected vehicle summary header */}
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Véhicule à livrer</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-extrabold text-slate-800">{selectedDossier.id}</span>
                    <LicencePlate plate={selectedDossier.vehiculeImmatriculation} />
                  </div>
                  <p className="text-xs font-bold text-slate-600 mt-1">
                    {selectedDossier.vehiculeMarque} {selectedDossier.vehiculeModele} — KM Entrée: {selectedDossier.vehiculeKilometrage} km
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Client / Déposant</span>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                    {selectedDossier.clientNom}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedDossier.clientTelephone}
                  </p>
                </div>
              </div>

              {/* Delivery Checklist form */}
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-indigo-500" />
                    Protocole de restitution
                  </h3>

                  {validationError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs font-bold rounded-lg mb-4 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Checklist checkboxes */}
                  <div className="space-y-2.5">
                    <label
                      data-testid="delivery-check-qc"
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        qcOk 
                          ? "bg-indigo-50/30 border-indigo-100 text-indigo-900 font-bold" 
                          : "bg-slate-50/30 hover:bg-slate-50 border-slate-100 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={qcOk}
                        onChange={e => setQcOk(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs">Contrôle qualité effectué et validé</span>
                    </label>

                    <label
                      data-testid="delivery-check-informed"
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        clientInformed 
                          ? "bg-indigo-50/30 border-indigo-100 text-indigo-900 font-bold" 
                          : "bg-slate-50/30 hover:bg-slate-50 border-slate-100 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={clientInformed}
                        onChange={e => setClientInformed(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs">Client informé des travaux réalisés et de la mise à disposition</span>
                    </label>

                    <label
                      data-testid="delivery-check-reception"
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        clientReceptionConfirmed 
                          ? "bg-indigo-50/30 border-indigo-100 text-indigo-900 font-bold" 
                          : "bg-slate-50/30 hover:bg-slate-50 border-slate-100 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={clientReceptionConfirmed}
                        onChange={e => setClientReceptionConfirmed(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs">Confirmation de réception et signature client (Clé remise)</span>
                    </label>
                  </div>
                </div>

                {/* KM Sortie (Kilométrage sortie) - MUST BE >= KM entrée */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                      Kilométrage d'entrée
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedDossier.vehiculeKilometrage} km`}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                      Kilométrage de sortie (Obligatoire)
                    </label>
                    <input
                      type="number"
                      data-testid="delivery-km-sortie"
                      value={exitKm}
                      onChange={e => setExitKm(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Remarks / Remarques de livraison */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Observations de livraison / Commentaires
                  </label>
                  <textarea
                    data-testid="delivery-comment"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Saisir d'éventuelles observations ou remarques émises par le client lors de la remise des clés..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                  />
                </div>

                {/* Confirm delivery button */}
                <button
                  data-testid="btn-delivery-confirm"
                  onClick={handleConfirmDelivery}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Valider et Confirmer la Livraison
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center min-h-[300px]">
              <Truck className="w-10 h-10 text-slate-300 mb-2" />
              Sélectionnez un véhicule prêt à livrer dans la liste pour démarrer la restitution.
            </div>
          )}
        </div>
      </div>

      {/* History of restitutions */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History className="w-4.5 h-4.5 text-slate-500" />
          Historique des restitutions récentes ({deliveredDossiers.length})
        </h2>

        {deliveredDossiers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Aucun historique de livraison disponible.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Dossier</th>
                  <th className="py-2.5 px-3">Véhicule</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Date Restitution</th>
                  <th className="py-2.5 px-3">KM Entrée</th>
                  <th className="py-2.5 px-3">KM Sortie</th>
                  <th className="py-2.5 px-3">Observations</th>
                </tr>
              </thead>
              <tbody data-testid="delivery-history-list" className="divide-y divide-slate-50">
                {deliveredDossiers.map(d => {
                  const dateStr = d.livraison.dateLivraisonReelle 
                    ? new Date(d.livraison.dateLivraisonReelle).toLocaleString("fr-FR") 
                    : "-";
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/30">
                      <td className="py-3 px-3 font-extrabold text-slate-800">{d.id}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{d.vehiculeMarque} {d.vehiculeModele}</span>
                          <LicencePlate plate={d.vehiculeImmatriculation} />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{d.clientNom}</td>
                      <td className="py-3 px-3 text-slate-500">{dateStr}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono">{d.vehiculeKilometrage} km</td>
                      <td className="py-3 px-3 text-indigo-600 font-mono font-bold">
                        {d.livraison.kilometrageSortie ? `${d.livraison.kilometrageSortie} km` : "-"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={d.livraison.remarquesLivraison}>
                        {d.livraison.remarquesLivraison || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
