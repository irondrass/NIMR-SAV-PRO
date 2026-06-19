/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DossierSAV, ReclammationClient, RepairOrderLine } from "../types";
import { getTaskStatusVisual } from "../task-status-visual";
import { CLIENT_SIDE_SECURITY_NOTICE, PILOT_SIGNATURE_NOTICE } from "../rc-notices";

interface PrintDocumentsProps {
  type: "reception" | "or" | "qc" | "delivery" | "task";
  dossier: DossierSAV;
  task?: RepairOrderLine;
  clientPhoneToShow: string;
  technicianName?: string;
  bayName?: string;
  linkedComplaint?: ReclammationClient;
}

export default function PrintDocuments({
  type,
  dossier,
  task,
  clientPhoneToShow,
  technicianName,
  bayName,
  linkedComplaint,
}: PrintDocumentsProps) {
  const printTime = new Date().toLocaleString("fr-FR");

  const renderHeader = (title: string) => (
    <div className="border-b-2 border-slate-900 pb-4 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black tracking-wider text-slate-900 uppercase">NIMR CONCESSIONS SAV</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Document interne NIMR SAV PRO</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase rounded">
            {title}
          </span>
          <p className="text-[9px] text-slate-500 mt-1 font-mono">Imprimé le: {printTime}</p>
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="mt-12 pt-4 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 font-bold uppercase tracking-wider space-y-1">
      <div>Document interne de travail NIMR SAV PRO - Reproduction interdite sans autorisation</div>
      <div>{CLIENT_SIDE_SECURITY_NOTICE}</div>
      <div>{PILOT_SIGNATURE_NOTICE}</div>
    </div>
  );

  const renderDossierInfo = () => (
    <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 border border-slate-200 rounded-lg">
      <div className="space-y-1">
        <p className="text-slate-500 text-[10px] uppercase font-bold">Informations Dossier</p>
        <p><span className="font-bold text-slate-700">Dossier ID :</span> <span className="font-mono font-bold text-slate-900">{dossier.id}</span></p>
        <p><span className="font-bold text-slate-700">Date Réception :</span> {new Date(dossier.dateReception).toLocaleString("fr-FR")}</p>
        <p><span className="font-bold text-slate-700">Type de Dossier :</span> <span className="font-bold uppercase text-blue-800">{dossier.typeDossier}</span></p>
        <p><span className="font-bold text-slate-700">Priorité :</span> <span className="font-bold text-slate-800">{dossier.priorite}</span></p>
      </div>
      <div className="space-y-1">
        <p className="text-slate-500 text-[10px] uppercase font-bold">Informations Client</p>
        <p><span className="font-bold text-slate-700">Nom Client :</span> <span className="font-bold text-slate-900">{dossier.clientNom}</span></p>
        <p><span className="font-bold text-slate-700">Téléphone :</span> <span className="font-mono text-slate-800">{clientPhoneToShow}</span></p>
        <p><span className="font-bold text-slate-700">Déposant :</span> {dossier.deposantNom || "Propriétaire"} {dossier.deposantTelephone ? `(${dossier.deposantTelephone})` : ""}</p>
      </div>
    </div>
  );

  const renderVehicleInfo = () => (
    <div className="grid grid-cols-3 gap-4 text-xs mb-6 border border-slate-200 p-4 rounded-lg">
      <div className="space-y-0.5">
        <span className="text-slate-400 text-[9px] block uppercase font-bold">VÉHICULE</span>
        <strong className="text-slate-800 text-sm block">{dossier.vehiculeMarque} {dossier.vehiculeModele}</strong>
        <span className="text-slate-500 font-semibold">{dossier.vehiculeVersion || "Version non précisée"}</span>
      </div>
      <div className="space-y-0.5">
        <span className="text-slate-400 text-[9px] block uppercase font-bold">IMMATRICULATION & VIN</span>
        <strong className="text-slate-800 block font-mono">Plaque: {dossier.vehiculeImmatriculation}</strong>
        <span className="text-slate-500 font-mono text-[10px] block">Châssis: {dossier.vehiculeVIN || "Non renseigné"}</span>
      </div>
      <div className="space-y-0.5">
        <span className="text-slate-400 text-[9px] block uppercase font-bold">KM ET CARBURANT</span>
        <strong className="text-slate-800 block">Kilométrage entrée: {dossier.vehiculeKilometrage} km</strong>
        <span className="text-slate-500 font-semibold">Carburant: {dossier.niveauCarburant}%</span>
      </div>
    </div>
  );

  if (type === "task") {
    return (
      <TechnicianTaskSheetPrint
        dossier={dossier}
        task={task}
        clientPhoneToShow={clientPhoneToShow}
        technicianName={technicianName}
        linkedComplaint={linkedComplaint}
      />
    );
  }

  if (type === "reception") {
    return (
      <div className="p-4 bg-white text-slate-900 max-w-4xl mx-auto">
        {renderHeader("Fiche Réception")}
        {renderDossierInfo()}
        {renderVehicleInfo()}

        <div className="space-y-4 text-xs mb-8">
          <div className="border border-slate-200 p-4 rounded-lg">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Plainte Client / Motif d'entrée</h3>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed font-semibold italic">"{dossier.plainteClient}"</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">État de Carrosserie à l'entrée</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium">
                <li>Rayures: {dossier.etatCarrosserie.rayures ? "Oui" : "Non"}</li>
                <li>Bosses: {dossier.etatCarrosserie.bosses ? "Oui" : "Non"}</li>
                <li>Pare-brise fissuré: {dossier.etatCarrosserie.fissureParbrise ? "Oui" : "Non"}</li>
                <li>Jantes abîmées: {dossier.etatCarrosserie.jantesAbimees ? "Oui" : "Non"}</li>
                {dossier.etatCarrosserie.autresNotes && (
                  <li className="mt-1 font-semibold text-slate-700">Notes: {dossier.etatCarrosserie.autresNotes}</li>
                )}
              </ul>
            </div>

            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Objets laissés à bord</h3>
              {dossier.objetsLaisses.length === 0 ? (
                <p className="text-slate-400 italic font-semibold">Aucun objet déclaré.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium">
                  {dossier.objetsLaisses.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Signature Box */}
        <div className="grid grid-cols-2 gap-8 text-xs mt-12">
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Acceptation simple Client / Déposant</span>
            <span className="text-slate-300 text-center italic text-[10px]">Case ou signature simple pilote interne</span>
          </div>
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Visa Conseiller NIMR</span>
            <span className="text-slate-300 text-center italic text-[10px]">Signature de prise en charge</span>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  if (type === "or") {
    return (
      <div className="p-4 bg-white text-slate-900 max-w-4xl mx-auto">
        {renderHeader("Ordre de Réparation Interne")}
        {renderDossierInfo()}
        {renderVehicleInfo()}

        <div className="space-y-4 text-xs mb-8">
          <div className="border border-slate-200 p-4 rounded-lg">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Demande d'Intervention / Symptômes</h3>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed italic">"{dossier.plainteClient}"</p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Tâches demandées</th>
                  <th className="py-2.5 px-3">Technicien</th>
                  <th className="py-2.5 px-3">Temps Alloué</th>
                  <th className="py-2.5 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {dossier.ordresReparation.map((line, idx) => (
                  <tr key={line.id || idx}>
                    <td className="py-2.5 px-3 text-slate-800">{line.designation}</td>
                    <td className="py-2.5 px-3 text-slate-600">{line.plannedTechnicianId || "Non assigné"}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">{line.tempsEstime} h</td>
                    <td className="py-2.5 px-3 text-slate-500 uppercase text-[10px]">{line.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-xs mt-12">
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Visa Chef d'Atelier</span>
            <span className="text-slate-300 text-center italic text-[10px]">Affectation & Planification</span>
          </div>
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Signature Compagnon Principal</span>
            <span className="text-slate-300 text-center italic text-[10px]">Validation fin de travaux</span>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  if (type === "qc") {
    const qc = dossier.checklistQC;
    return (
      <div className="p-4 bg-white text-slate-900 max-w-4xl mx-auto">
        {renderHeader("Fiche Contrôle Qualité")}
        {renderDossierInfo()}
        {renderVehicleInfo()}

        <div className="space-y-4 text-xs mb-8">
          <div className="border border-slate-200 p-4 rounded-lg">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-3 text-[10px] border-b pb-1">Points de Contrôle Réalisés</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-semibold text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>1. Essai routier effectué :</span>
                <span className="font-bold">{qc.essaiEffectue ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>2. Défauts signalés réparés :</span>
                <span className="font-bold">{qc.defautRepare ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>3. Aucun voyant allumé :</span>
                <span className="font-bold">{qc.aucunVoyantAllume ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>4. Niveaux de fluides vérifiés :</span>
                <span className="font-bold">{qc.niveauxVerifies ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>5. Organes de sécurité serrés :</span>
                <span className="font-bold">{qc.serrageSecurite ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>6. Propreté habitacle et ext. :</span>
                <span className="font-bold">{qc.propreteVehicule ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>7. Dossier & documents prêts :</span>
                <span className="font-bold">{qc.documentsPrets ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>8. Photos après travaux validées :</span>
                <span className="font-bold">{qc.photosApresOk ? "✓ VALIDÉ" : "✗ NON CONFORME"}</span>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 p-4 rounded-lg space-y-1">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Décision Qualité</h3>
            <p><span className="font-bold text-slate-700">Statut Qualité :</span> <span className="font-extrabold uppercase text-green-700">{qc.validationGlobale === "valide" ? "ACCEPTÉ" : "REFUSÉ"}</span></p>
            <p><span className="font-bold text-slate-700">Validé par :</span> {qc.validePar || "Validateur Qualité"}</p>
            {qc.commentaireRefus && (
              <p className="mt-1 font-semibold text-rose-700"><span className="font-bold">Commentaires de Refus :</span> {qc.commentaireRefus}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-xs mt-12">
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Visa du Contrôleur Qualité</span>
            <span className="text-slate-300 text-center italic text-[10px]">Visa de conformité routière</span>
          </div>
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Visa Réceptionnaire Principal</span>
            <span className="text-slate-300 text-center italic text-[10px]">Autorisation de restitution client</span>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  if (type === "delivery") {
    const del = dossier.livraison;
    return (
      <div className="p-4 bg-white text-slate-900 max-w-4xl mx-auto">
        {renderHeader("Bon de Restitution & Livraison")}
        {renderDossierInfo()}
        {renderVehicleInfo()}

        <div className="space-y-4 text-xs mb-8">
          <div className="border border-slate-200 p-4 rounded-lg">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-3 text-[10px] border-b pb-1">Protocole de Restitution</h3>
            <div className="space-y-2 font-semibold text-slate-700">
              <p>1. Contrôle routier et de qualité effectué : {del.controleQualiteOk ? "✓ OUI" : "✗ NON"}</p>
              <p>2. Client informé des travaux réalisés : {del.clientInforme ? "✓ OUI" : "✗ NON"}</p>
              <p>3. Restitution du véhicule & acceptation simple client : {del.confirmationReceptionClient ? "✓ OUI" : "✗ NON"}</p>
              <p>4. Kilométrage de sortie relevé : <strong className="font-mono">{del.kilometrageSortie || dossier.vehiculeKilometrage} km</strong> (KM Entrée : {dossier.vehiculeKilometrage} km)</p>
            </div>
          </div>

          <div className="border border-slate-200 p-4 rounded-lg space-y-1">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Remarques & Observations de Restitution</h3>
            <p className="text-slate-700 leading-relaxed italic">
              {del.remarquesLivraison ? `"${del.remarquesLivraison}"` : "Aucune remarque formulée par le client lors de la remise des clés."}
            </p>
          </div>
        </div>

        {/* Display Signature if available */}
        <div className="grid grid-cols-2 gap-8 text-xs mt-12">
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Acceptation simple client recueillie</span>
            {del.signatureClientUri ? (
              <div className="flex-1 flex justify-center items-center overflow-hidden border border-slate-100 rounded bg-slate-50">
                <img src={del.signatureClientUri} alt="Acceptation simple client" className="max-h-20 max-w-full" />
              </div>
            ) : (
              <span className="text-slate-300 text-center italic text-[10px] mt-8">Case ou signature simple pilote interne</span>
            )}
          </div>
          <div className="border border-slate-300 rounded-lg p-6 h-36 flex flex-col justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Visa du Conseiller Client</span>
            <span className="text-slate-400 font-bold block text-center">Livreur : {dossier.checklistQC.validePar || "Livreur NIMR"}</span>
            <span className="text-slate-300 text-center italic text-[10px]">Restitution opérationnelle finale</span>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  return null;
}

export function TechnicianTaskSheetPrint({
  dossier,
  task,
  clientPhoneToShow,
  technicianName,
  linkedComplaint,
}: {
  dossier: DossierSAV;
  task?: RepairOrderLine;
  clientPhoneToShow: string;
  technicianName?: string;
  linkedComplaint?: ReclammationClient;
}) {
  const printTime = new Date().toLocaleString("fr-FR");
  if (!task) {
    return (
      <div className="p-4 text-center font-bold text-rose-600">
        Aucune tâche sélectionnée pour impression.
      </div>
    );
  }

  const isBlocked = task.status === "blocked";
  const hasQCFeedback = dossier.retourQualite || dossier.checklistQC?.validationGlobale === "refuse";

  const finalComplaint = linkedComplaint || (() => {
    if (!task?.sourceComplaintId) return undefined;
    try {
      const raw = localStorage.getItem("nimr-sav-pro-reclamations-v1");
      if (raw) {
        const recs: ReclammationClient[] = JSON.parse(raw);
        return recs.find(r => r.id === task.sourceComplaintId);
      }
    } catch (e) {
      console.error(e);
    }
    return undefined;
  })();

  return (
    <div className="p-6 bg-white text-slate-900 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black tracking-wider text-slate-900 uppercase">NIMR CONCESSIONS SAV</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Document interne NIMR SAV PRO</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase rounded">
            Fiche tâche technicien
          </span>
          <p className="text-[9px] text-slate-500 mt-1 font-mono">Imprimé le: {printTime}</p>
        </div>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1 bg-slate-50 p-4 border border-slate-200 rounded-lg">
          <p className="text-slate-500 text-[10px] uppercase font-bold">Informations Dossier & Client</p>
          <p><span className="font-bold text-slate-700">Dossier ID :</span> <span className="font-mono font-bold text-slate-900">{dossier.id}</span></p>
          <p><span className="font-bold text-slate-700">Client :</span> <span className="font-bold text-slate-900">{dossier.clientNom}</span></p>
          {clientPhoneToShow && (
            <p><span className="font-bold text-slate-700">Téléphone :</span> <span className="font-mono text-slate-800">{clientPhoneToShow}</span></p>
          )}
          <p><span className="font-bold text-slate-700">Priorité :</span> <span className="font-bold text-slate-800">{dossier.priorite}</span></p>
        </div>

        <div className="space-y-1 bg-slate-50 p-4 border border-slate-200 rounded-lg">
          <p className="text-slate-500 text-[10px] uppercase font-bold">Informations Véhicule</p>
          <p><span className="font-bold text-slate-700">Véhicule :</span> <span className="font-bold text-slate-900">{dossier.vehiculeMarque} {dossier.vehiculeModele} {dossier.vehiculeVersion || ""}</span></p>
          <p><span className="font-bold text-slate-700">Immatriculation :</span> <span className="font-mono font-bold text-slate-900">{dossier.vehiculeImmatriculation}</span></p>
          {dossier.vehiculeVIN && (
            <p><span className="font-bold text-slate-700">VIN :</span> <span className="font-mono text-slate-800">{dossier.vehiculeVIN}</span></p>
          )}
          <p><span className="font-bold text-slate-700">Kilométrage :</span> <span className="font-mono text-slate-800">{dossier.vehiculeKilometrage} km</span></p>
        </div>
      </div>

      {/* Motif Client */}
      <div className="border border-slate-200 p-4 rounded-lg text-xs">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Motif client / Plainte</h3>
        <p className="text-slate-700 italic font-semibold">"{dossier.plainteClient || "Non renseigné"}"</p>
      </div>

      {/* Détails de la Tâche */}
      <div className="border border-slate-200 p-4 rounded-lg text-xs space-y-2">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Opération à réaliser</h3>
        <p><span className="font-bold text-slate-700">Tâche / opération :</span> <span className="font-extrabold text-slate-900">{task.designation}</span></p>
        <p><span className="font-bold text-slate-700">Technicien affecté :</span> <span className="font-semibold text-slate-800">{technicianName || "À affecter"}</span></p>
        <p><span className="font-bold text-slate-700">Statut :</span> <span className="font-black uppercase">{getTaskStatusVisual(task.status).label}</span></p>
        <p><span className="font-bold text-slate-700">Temps estimé :</span> {task.tempsEstime} h</p>
      </div>

      {/* Diagnostic Final */}
      <div className="border border-slate-200 p-4 rounded-lg text-xs">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Diagnostic technicien</h3>
        <p className="min-h-16 whitespace-pre-line text-slate-700 font-mono bg-slate-50 p-2 rounded border border-slate-100">
          {task.diagnosticFinal || "À renseigner après intervention."}
        </p>
      </div>

      {/* Observations */}
      <div className="border border-slate-200 p-4 rounded-lg text-xs space-y-1">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px] border-b pb-1">Observations</h3>
        {dossier.observationsReception && (
          <p><span className="font-bold text-slate-700">Observations Réception :</span> {dossier.observationsReception}</p>
        )}
        {task.workshopZoneNote && (
          <p><span className="font-bold text-slate-700">Note Atelier :</span> {task.workshopZoneNote}</p>
        )}
        {task.chefNotes && (
          <p><span className="font-bold text-slate-700">Note Chef d'Atelier :</span> {task.chefNotes}</p>
        )}
        {!dossier.observationsReception && !task.workshopZoneNote && !task.chefNotes && (
          <p className="text-slate-400 italic">Aucune observation particulière.</p>
        )}
      </div>

      {/* Blocage Éventuel */}
      {isBlocked && (
        <div className="border border-amber-200 bg-amber-50/50 p-4 rounded-lg text-xs space-y-1">
          <h3 className="font-bold text-amber-800 uppercase tracking-wider mb-2 text-[10px] border-b border-amber-100 pb-1">Blocage technique constaté</h3>
          <p><span className="font-bold">Motif du blocage :</span> {task.blockReason || "Non spécifié"}</p>
          {task.blockComment && <p><span className="font-bold">Commentaire :</span> {task.blockComment}</p>}
          {task.blockFollowUpOwner && <p><span className="font-bold">Suivi par :</span> {task.blockFollowUpOwner}</p>}
          {task.blockResolutionEta && <p><span className="font-bold">Délai estimé :</span> {task.blockResolutionEta}</p>}
          {task.blockSparePartRef && <p><span className="font-bold">Référence pièce requise :</span> {task.blockSparePartRef}</p>}
          {task.blockSparePartEta && <p><span className="font-bold">Date de réception estimée :</span> {task.blockSparePartEta}</p>}
        </div>
      )}

      {/* Retour QC Éventuel */}
      {hasQCFeedback && (
        <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-lg text-xs space-y-1">
          <h3 className="font-bold text-rose-800 uppercase tracking-wider mb-2 text-[10px] border-b border-rose-100 pb-1">Retour Contrôle Qualité</h3>
          <p className="font-bold text-rose-700">Refus de conformité qualité</p>
          {dossier.checklistQC.commentaireRefus && (
            <p><span className="font-bold">Motif / Commentaire :</span> {dossier.checklistQC.commentaireRefus}</p>
          )}
        </div>
      )}

      {/* Réclamation Liée */}
      {finalComplaint && (
        <div className="border border-red-200 bg-red-50/50 p-4 rounded-lg text-xs space-y-1">
          <h3 className="font-bold text-red-800 uppercase tracking-wider mb-2 text-[10px] border-b border-red-100 pb-1">Réclamation liée</h3>
          <p><span className="font-bold">Numéro Réclamation :</span> {finalComplaint.id}</p>
          <p><span className="font-bold">Motif :</span> {finalComplaint.motif}</p>
          <p><span className="font-bold">Criticité :</span> {finalComplaint.criticite}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-5 text-xs pt-4">
        <div className="border border-slate-300 rounded-lg p-4 h-28 flex flex-col justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Signature Technicien</span>
          <span className="text-slate-300 text-center italic text-[9px]">Intervention réalisée</span>
        </div>
        <div className="border border-slate-300 rounded-lg p-4 h-28 flex flex-col justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Signature Chef Atelier</span>
          <span className="text-slate-300 text-center italic text-[9px]">Contrôle atelier</span>
        </div>
        <div className="border border-slate-300 rounded-lg p-4 h-28 flex flex-col justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Contrôle Qualité</span>
          <span className="text-slate-300 text-center italic text-[9px]">Validation finale</span>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider space-y-1">
        <div>Document interne de travail NIMR SAV PRO - Reproduction interdite sans autorisation</div>
        <div>{PILOT_SIGNATURE_NOTICE}</div>
      </div>
    </div>
  );
}
