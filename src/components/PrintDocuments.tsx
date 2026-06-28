/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DossierSAV, ReclammationClient, RepairOrderLine } from "../types";
import { getTaskStatusVisual } from "../task-status-visual";
import { CLIENT_SIDE_SECURITY_NOTICE, PILOT_SIGNATURE_NOTICE } from "../rc-notices";
import { getDeliveryReadiness, getDossierQCStatus, getQCStatusDisplayLabel } from "../sav-core";

function formatPrintDuration(hours: number | undefined): string {
  return hours && hours > 0 ? `${hours} h` : "À estimer";
}

function formatValidatedDuration(line: RepairOrderLine | undefined): string {
  if (!line) return "À estimer";
  if (line.isEstimatedDurationValidated && line.tempsEstime > 0) {
    return formatPrintDuration(line.tempsEstime);
  }
  if (line.tempsEstime > 0) {
    return `${formatPrintDuration(line.tempsEstime)} - Durée à valider`;
  }
  return "À estimer";
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function formatOptional(value: string | number | undefined | null, fallback = "Non renseigné"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatPlanningWindow(line: RepairOrderLine | undefined): string {
  if (!line) return "Créneau à confirmer";
  const segments = line.planningSegments || [];
  const firstStart = segments[0]?.start || line.planningStart;
  const lastEnd = segments[segments.length - 1]?.end || line.planningEnd;
  if (!firstStart || !lastEnd) return "Créneau à confirmer";
  return `${formatDateTime(firstStart)} -> ${formatDateTime(lastEnd)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-testid="print-document-section" className="print-document-section rounded-lg border border-slate-200 p-4 text-xs">
      <h3 className="mb-3 border-b border-slate-100 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-800">
        {title}
      </h3>
      {children}
    </section>
  );
}

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

  const renderHeader = (title: string, role: string) => (
    <div className="mb-6 border-b-2 border-slate-900 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">NIMR CONCESSIONS SAV</h1>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Document interne NIMR SAV PRO</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Rôle document : {role}</p>
        </div>
        <div className="text-right">
          <span data-testid="print-document-title" className="inline-block rounded bg-slate-900 px-3 py-1 font-mono text-xs font-bold uppercase text-white">
            {title}
          </span>
          <p className="mt-1 font-mono text-[9px] text-slate-500">Imprimé le: {printTime}</p>
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="mt-10 space-y-1 border-t border-dashed border-slate-300 pt-4 text-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
      <div>Document interne de travail NIMR SAV PRO - Reproduction interdite sans autorisation</div>
      <div>{CLIENT_SIDE_SECURITY_NOTICE}</div>
      <div>{PILOT_SIGNATURE_NOTICE}</div>
    </div>
  );

  const renderShell = (
    title: string,
    role: string,
    children: React.ReactNode,
    watermark?: React.ReactNode
  ) => (
    <div data-testid="print-document-preview" className="print-document mx-auto max-w-4xl bg-white p-6 text-slate-900">
      {renderHeader(title, role)}
      {watermark}
      {children}
      {renderFooter()}
    </div>
  );

  const renderDossierInfo = () => (
    <Section title="Identité dossier et client">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p><span className="font-bold text-slate-700">Dossier ID :</span> <span className="font-mono font-bold text-slate-900">{dossier.id}</span></p>
          <p><span className="font-bold text-slate-700">Date réception :</span> {formatDateTime(dossier.dateReception)}</p>
          <p><span className="font-bold text-slate-700">Réceptionnaire :</span> Équipe réception NIMR</p>
          <p><span className="font-bold text-slate-700">Type dossier :</span> <span className="font-bold uppercase text-blue-800">{dossier.typeDossier}</span></p>
          <p><span className="font-bold text-slate-700">Priorité :</span> <span className="font-bold text-slate-800">{dossier.priorite}</span></p>
        </div>
        <div className="space-y-1">
          <p><span className="font-bold text-slate-700">Client :</span> <span className="font-bold text-slate-900">{dossier.clientNom}</span></p>
          <p><span className="font-bold text-slate-700">Téléphone :</span> <span className="font-mono text-slate-800">{clientPhoneToShow}</span></p>
          <p><span className="font-bold text-slate-700">Déposant :</span> {formatOptional(dossier.deposantNom, "Client")}</p>
          {dossier.deposantTelephone && (
            <p><span className="font-bold text-slate-700">Téléphone déposant :</span> <span className="font-mono text-slate-800">{dossier.deposantTelephone}</span></p>
          )}
        </div>
      </div>
    </Section>
  );

  const renderVehicleInfo = () => (
    <Section title="Véhicule">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase text-slate-400">Marque et modèle</p>
          <p className="font-black text-slate-900">{dossier.vehiculeMarque} {dossier.vehiculeModele}</p>
          <p className="font-semibold text-slate-600">Version / énergie : {formatOptional(dossier.vehiculeVersion)}</p>
          <p className="font-semibold text-slate-600">Couleur : {formatOptional(dossier.vehiculeCouleur)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase text-slate-400">Immatriculation et VIN</p>
          <p className="font-mono font-black text-slate-900">Plaque: {dossier.vehiculeImmatriculation}</p>
          <p className="font-mono text-[10px] font-semibold text-slate-600">Châssis: {formatOptional(dossier.vehiculeVIN)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase text-slate-400">Kilométrage et état entrée</p>
          <p className="font-black text-slate-900">{dossier.vehiculeKilometrage} km</p>
          <p className="font-semibold text-slate-600">Carburant: {dossier.niveauCarburant}%</p>
          <p className="font-semibold text-slate-600">Date souhaitée: {formatDateTime(dossier.dateSouhaiteeLivraison)}</p>
        </div>
      </div>
    </Section>
  );

  if (type === "task") {
    return (
      <TechnicianTaskSheetPrint
        dossier={dossier}
        task={task}
        clientPhoneToShow={clientPhoneToShow}
        technicianName={technicianName}
        bayName={bayName}
        linkedComplaint={linkedComplaint}
      />
    );
  }

  if (type === "reception") {
    return renderShell(
      "Fiche Réception",
      "Réception véhicule",
      <div className="space-y-4">
        {renderDossierInfo()}
        {renderVehicleInfo()}
        <Section title="Motif client et symptômes">
          <p className="whitespace-pre-line text-slate-700 italic leading-relaxed">"{dossier.plainteClient || "Non renseigné"}"</p>
          {dossier.observationsReception && (
            <p className="mt-3 font-semibold text-slate-700"><span className="font-bold">Observations réception :</span> {dossier.observationsReception}</p>
          )}
        </Section>
        <div className="grid grid-cols-2 gap-4">
          <Section title="État véhicule entrée">
            <ul className="space-y-1 font-semibold text-slate-700">
              <li>Rayures : {dossier.etatCarrosserie.rayures ? "Oui" : "Non"}</li>
              <li>Bosses : {dossier.etatCarrosserie.bosses ? "Oui" : "Non"}</li>
              <li>Pare-brise fissuré : {dossier.etatCarrosserie.fissureParbrise ? "Oui" : "Non"}</li>
              <li>Jantes abîmées : {dossier.etatCarrosserie.jantesAbimees ? "Oui" : "Non"}</li>
              <li>Notes : {formatOptional(dossier.etatCarrosserie.autresNotes, "Aucune observation")}</li>
            </ul>
          </Section>
          <Section title="Accessoires et preuves">
            <p className="font-semibold text-slate-700">
              Photos / preuves : {dossier.photosAvant.length > 0 ? `${dossier.photosAvant.length} photo(s) jointe(s) au dossier local` : "Aucune photo jointe"}
            </p>
            <p className="mt-2 font-semibold text-slate-700">Objets et accessoires :</p>
            {dossier.objetsLaisses.length === 0 ? (
              <p className="text-slate-400 italic">Aucun objet déclaré.</p>
            ) : (
              <ul className="mt-1 list-inside list-disc space-y-1 font-semibold text-slate-700">
                {dossier.objetsLaisses.map((obj, index) => <li key={`${obj}-${index}`}>{obj}</li>)}
              </ul>
            )}
          </Section>
        </div>
        <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Acceptation simple client / déposant</span>
            <span className="text-center text-[10px] italic text-slate-300">Case ou signature simple pilote interne</span>
          </div>
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Signature réceptionnaire</span>
            <span className="text-center text-[10px] italic text-slate-300">Prise en charge opérationnelle</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "or") {
    return renderShell(
      "Ordre de Réparation Interne",
      "OR opérationnel interne",
      <div className="space-y-4">
        {renderDossierInfo()}
        {renderVehicleInfo()}
        <Section title="Demande d'intervention / symptômes">
          <p className="whitespace-pre-line text-slate-700 italic leading-relaxed">"{dossier.plainteClient || "Non renseigné"}"</p>
          <p className="mt-3 font-semibold text-slate-700">Diagnostic initial : {formatOptional(dossier.observationsReception, "À compléter atelier")}</p>
        </Section>
        <Section title="Tâches atelier et planification">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                <th className="px-3 py-2">Tâches demandées</th>
                <th className="px-3 py-2">Technicien</th>
                <th className="px-3 py-2">Pont / zone</th>
                <th className="px-3 py-2">Durée planning</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {dossier.ordresReparation.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Aucune tâche atelier créée.</td>
                </tr>
              ) : dossier.ordresReparation.map((line, index) => (
                <tr key={line.id || index}>
                  <td className="px-3 py-2 text-slate-800">{line.designation}</td>
                  <td className="px-3 py-2 text-slate-600">{line.plannedTechnicianId || "Non assigné"}</td>
                  <td className="px-3 py-2 text-slate-600">{line.plannedBayId || "À confirmer"}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{formatValidatedDuration(line)}</td>
                  <td className="px-3 py-2 text-[10px] uppercase text-slate-500">{getTaskStatusVisual(line.status).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <div className="grid grid-cols-2 gap-4">
          <Section title="Suivi opérationnel pièces">
            <ul className="space-y-1 font-semibold text-slate-700">
              <li>Pièce à confirmer ERP</li>
              <li>En attente retour ERP</li>
              <li>Pièce reçue selon suivi interne</li>
            </ul>
          </Section>
          <Section title="Livraison et blocages">
            <p><span className="font-bold text-slate-700">ETA restitution :</span> {formatDateTime(dossier.dateSouhaiteeLivraison)}</p>
            <p><span className="font-bold text-slate-700">Blocage :</span> {formatOptional(dossier.bloqueRaison, "Aucun blocage déclaré")}</p>
            {dossier.bloqueComment && <p><span className="font-bold text-slate-700">Commentaire :</span> {dossier.bloqueComment}</p>}
            <p className="mt-2 font-black uppercase text-slate-700">QC obligatoire avant restitution</p>
            <p className="font-semibold text-slate-700">Prêt clôture ERP / En attente clôture ERP / Prêt restitution après QC conforme</p>
          </Section>
        </div>
        <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Visa Chef d'Atelier</span>
            <span className="text-center text-[10px] italic text-slate-300">Affectation et planification</span>
          </div>
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Signature technicien référent</span>
            <span className="text-center text-[10px] italic text-slate-300">Travaux suivis</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "qc") {
    const qc = dossier.checklistQC;
    const qcStatus = getDossierQCStatus(dossier);
    const qcNonCompliant = qcStatus.status !== "conforme";
    const watermark = qcNonCompliant ? (
      <div data-testid="print-document-watermark" className="mb-6 border-2 border-rose-700 bg-rose-50 p-4 text-center text-sm font-black uppercase tracking-wider text-rose-800">
        NON RESTITUABLE - QC NON CONFORME
      </div>
    ) : null;

    return renderShell(
      "Fiche Contrôle Qualité",
      "Grille contrôle qualité",
      <div className="space-y-4">
        {renderDossierInfo()}
        {renderVehicleInfo()}
        <Section title="Checklist qualité">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-semibold text-slate-700">
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Essai routier effectué :</span><span className="font-bold">{qc.essaiEffectue ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Défauts signalés traités :</span><span className="font-bold">{qc.defautRepare ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Aucun voyant allumé :</span><span className="font-bold">{qc.aucunVoyantAllume ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Niveaux vérifiés :</span><span className="font-bold">{qc.niveauxVerifies ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Organes sécurité serrés :</span><span className="font-bold">{qc.serrageSecurite ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Propreté véhicule :</span><span className="font-bold">{qc.propreteVehicule ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Documents atelier prêts :</span><span className="font-bold">{qc.documentsPrets ? "Conforme" : "Non conforme"}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-1"><span>Photos après travaux :</span><span className="font-bold">{qc.photosApresOk ? "Conforme" : "Non conforme"}</span></div>
          </div>
        </Section>
        <Section title="Décision et retour atelier">
          <p><span className="font-bold text-slate-700">Statut Qualité :</span> <span className="font-black uppercase text-slate-900">{getQCStatusDisplayLabel(qcStatus.status)}</span></p>
          <p><span className="font-bold text-slate-700">Contrôleur :</span> {formatOptional(qc.validePar, "Contrôleur qualité")}</p>
          <p><span className="font-bold text-slate-700">Date QC :</span> {formatDateTime(qc.dateValidation)}</p>
          <p><span className="font-bold text-slate-700">Motifs refus / retour :</span> {qcStatus.refusalReasons?.join(" ; ") || qc.commentaireRefus || "Aucun motif déclaré"}</p>
          <p className="mt-3 font-black uppercase text-rose-700">Restitution interdite sans QC conforme</p>
        </Section>
        <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Signature Contrôle Qualité</span>
            <span className="text-center text-[10px] italic text-slate-300">Statut qualité final</span>
          </div>
          <div className="flex h-36 flex-col justify-between rounded-lg border border-slate-300 p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Signature Chef Atelier</span>
            <span className="text-center text-[10px] italic text-slate-300">Retour atelier si nécessaire</span>
          </div>
        </div>
      </div>,
      watermark
    );
  }

  if (type === "delivery") {
    const deliveryReadiness = getDeliveryReadiness(dossier);
    const qcStatus = deliveryReadiness.qcStatus;
    const deliveryBlocked = !deliveryReadiness.canDeliver;
    const watermark = deliveryBlocked ? (
      <div data-testid="print-document-watermark" className="mb-6 border-2 border-rose-700 bg-rose-50 p-4 text-center text-sm font-black uppercase tracking-wider text-rose-800">
        DOCUMENT NON VALIDE - QC NON CONFORME
        <span data-testid="delivery-invalid-watermark" className="mt-1 block text-[10px]">NON VALIDE POUR RESTITUTION - QC NON CONFORME</span>
      </div>
    ) : null;
    const del = dossier.livraison;

    return renderShell(
      "Bon de Restitution & Livraison",
      "PV restitution / livraison client",
      <div className="space-y-4">
        {renderDossierInfo()}
        {renderVehicleInfo()}
        {qcStatus.status === "conforme" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            QC conforme{qcStatus.lastQCAt ? ` le ${formatDateTime(qcStatus.lastQCAt)}` : ""}{qcStatus.lastQCBy ? ` - Contrôleur QC: ${qcStatus.lastQCBy}` : ""}
          </div>
        )}
        {deliveryBlocked && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            Ce document ne vaut pas restitution. Dossier bloqué.
          </div>
        )}
        <Section title="Résumé travaux et contrôle final">
          <p><span className="font-bold text-slate-700">Synthèse travaux :</span> {dossier.ordresReparation.length > 0 ? dossier.ordresReparation.map(line => line.designation).join(" ; ") : "Aucune tâche atelier déclarée"}</p>
          <p className="mt-2"><span className="font-bold text-slate-700">Résultat QC :</span> {getQCStatusDisplayLabel(qcStatus.status)}</p>
          <p><span className="font-bold text-slate-700">Kilométrage sortie :</span> {del.kilometrageSortie ?? dossier.vehiculeKilometrage} km</p>
          <p><span className="font-bold text-slate-700">Date restitution :</span> {formatDateTime(del.dateLivraisonReelle)}</p>
        </Section>
        <Section title="Observations et réserves client">
          <p><span className="font-bold text-slate-700">Statut restitution :</span> {del.statutRestitution || "Livré sans réserve"}</p>
          <p className="mt-2 whitespace-pre-line italic text-slate-700">
            {del.remarquesLivraison ? `"${del.remarquesLivraison}"` : "Aucune remarque formulée par le client lors de la remise des clés."}
          </p>
          {deliveryReadiness.reasons.length > 0 && (
            <ul className="mt-3 list-inside list-disc font-semibold text-rose-700">
              {deliveryReadiness.reasons.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
          )}
        </Section>
        <Section title="Confirmation restitution">
          <div className="space-y-2 font-semibold text-slate-700">
            <p>Contrôle qualité conforme : {del.controleQualiteOk ? "Oui" : "Non"}</p>
            <p>Client informé des travaux réalisés : {del.clientInforme ? "Oui" : "Non"}</p>
            <p>Acceptation simple client recueillie : {del.confirmationReceptionClient ? "Oui" : "Non"}</p>
          </div>
        </Section>
        <div className="grid grid-cols-3 gap-5 pt-6 text-xs">
          <div className="flex h-32 flex-col justify-between rounded-lg border border-slate-300 p-4">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Signature client</span>
            <span className="text-center text-[9px] italic text-slate-300">Acceptation simple pilote interne</span>
          </div>
          <div className="flex h-32 flex-col justify-between rounded-lg border border-slate-300 p-4">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Signature livraison / réception</span>
            <span className="text-center text-[9px] italic text-slate-300">Remise des clés</span>
          </div>
          <div className="flex h-32 flex-col justify-between rounded-lg border border-slate-300 p-4">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Contrôle Qualité optionnel</span>
            <span className="text-center text-[9px] italic text-slate-300">Traçabilité conformité</span>
          </div>
        </div>
      </div>,
      watermark
    );
  }

  return null;
}

export function TechnicianTaskSheetPrint({
  dossier,
  task,
  clientPhoneToShow,
  technicianName,
  bayName,
  linkedComplaint,
}: {
  dossier: DossierSAV;
  task?: RepairOrderLine;
  clientPhoneToShow: string;
  technicianName?: string;
  bayName?: string;
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
    if (!task.sourceComplaintId) return undefined;
    try {
      const raw = localStorage.getItem("nimr-sav-pro-reclamations-v1");
      if (raw) {
        const recs: ReclammationClient[] = JSON.parse(raw);
        return recs.find(rec => rec.id === task.sourceComplaintId);
      }
    } catch (error) {
      console.error(error);
    }
    return undefined;
  })();

  return (
    <div
      data-testid="technician-task-sheet-print"
      className="print-document mx-auto max-w-4xl space-y-6 bg-white p-6 text-slate-900"
      style={{ breakAfter: "auto", pageBreakAfter: "auto" }}
    >
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">NIMR CONCESSIONS SAV</h1>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Document interne NIMR SAV PRO</p>
        </div>
        <div className="text-right">
          <span data-testid="technician-task-sheet-title" className="inline-block rounded bg-slate-900 px-3 py-1 font-mono text-xs font-bold uppercase text-white">
            Fiche tâche technicien
          </span>
          <p className="mt-1 font-mono text-[9px] text-slate-500">Imprimé le: {printTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Informations Dossier & Client</p>
          <p><span className="font-bold text-slate-700">Dossier ID :</span> <span data-testid="technician-task-sheet-dossier" className="font-mono font-bold text-slate-900">{dossier.id}</span></p>
          <p><span className="font-bold text-slate-700">Client :</span> <span className="font-bold text-slate-900">{dossier.clientNom}</span></p>
          {clientPhoneToShow && <p><span className="font-bold text-slate-700">Téléphone :</span> <span className="font-mono text-slate-800">{clientPhoneToShow}</span></p>}
          <p><span className="font-bold text-slate-700">Priorité :</span> <span className="font-bold text-slate-800">{dossier.priorite}</span></p>
        </div>

        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Informations Véhicule</p>
          <p><span className="font-bold text-slate-700">Véhicule :</span> <span className="font-bold text-slate-900">{dossier.vehiculeMarque} {dossier.vehiculeModele} {dossier.vehiculeVersion || ""}</span></p>
          <p><span className="font-bold text-slate-700">Immatriculation :</span> <span className="font-mono font-bold text-slate-900">{dossier.vehiculeImmatriculation}</span></p>
          {dossier.vehiculeVIN && <p><span className="font-bold text-slate-700">VIN :</span> <span className="font-mono text-slate-800">{dossier.vehiculeVIN}</span></p>}
          <p><span className="font-bold text-slate-700">Kilométrage :</span> <span className="font-mono text-slate-800">{dossier.vehiculeKilometrage} km</span></p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 text-xs">
        <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Motif client / Plainte</h3>
        <p className="font-semibold italic text-slate-700">"{dossier.plainteClient || "Non renseigné"}"</p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 text-xs space-y-2">
        <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Opération à réaliser</h3>
        <p><span className="font-bold text-slate-700">Tâche / opération :</span> <span className="font-extrabold text-slate-900">{task.designation}</span></p>
        <p><span className="font-bold text-slate-700">Technicien affecté :</span> <span data-testid="technician-task-sheet-technician" className="font-semibold text-slate-800">{technicianName || "À affecter"}</span></p>
        <p><span className="font-bold text-slate-700">Pont / zone :</span> {bayName || task.plannedBayId || "À confirmer"}</p>
        <p><span className="font-bold text-slate-700">Créneau planning :</span> {formatPlanningWindow(task)}</p>
        <p><span className="font-bold text-slate-700">Durée planning :</span> {formatValidatedDuration(task)}</p>
        <p><span className="font-bold text-slate-700">Statut :</span> <span className="font-black uppercase">{getTaskStatusVisual(task.status).label}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Travail à réaliser</h3>
          <p className="whitespace-pre-line font-semibold text-slate-700">{task.chefNotes || task.workshopZoneNote || "Suivre la demande atelier et renseigner le résultat final."}</p>
          <p className="mt-3 font-semibold text-slate-700">Pièces à vérifier / confirmer : Pièce à confirmer ERP si nécessaire.</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Essai et validation</h3>
          <p className="font-semibold text-slate-700">Essai routier ou contrôle statique selon opération et consignes chef atelier.</p>
          <p className="mt-3 font-black uppercase text-slate-700">☐ Travail terminé</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 text-xs">
        <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Diagnostic technicien</h3>
        <p className="min-h-16 whitespace-pre-line rounded border border-slate-100 bg-slate-50 p-2 font-mono text-slate-700">
          {task.diagnosticFinal || "À renseigner après intervention."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 text-xs space-y-1">
        <h3 className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Observations</h3>
        {dossier.observationsReception && <p><span className="font-bold text-slate-700">Observations Réception :</span> {dossier.observationsReception}</p>}
        {task.workshopZoneNote && <p><span className="font-bold text-slate-700">Note Atelier :</span> {task.workshopZoneNote}</p>}
        {task.chefNotes && <p><span className="font-bold text-slate-700">Note Chef d'Atelier :</span> {task.chefNotes}</p>}
        {!dossier.observationsReception && !task.workshopZoneNote && !task.chefNotes && <p className="italic text-slate-400">Aucune observation particulière.</p>}
      </div>

      {isBlocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-1">
          <h3 className="mb-2 border-b border-amber-100 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Blocage technique constaté</h3>
          <p><span className="font-bold">Motif du blocage :</span> {task.blockReason || "Non spécifié"}</p>
          {task.blockComment && <p><span className="font-bold">Commentaire :</span> {task.blockComment}</p>}
          {task.blockFollowUpOwner && <p><span className="font-bold">Suivi par :</span> {task.blockFollowUpOwner}</p>}
          {task.blockResolutionEta && <p><span className="font-bold">Délai estimé :</span> {task.blockResolutionEta}</p>}
          {task.blockSparePartRef && <p><span className="font-bold">Référence pièce requise :</span> {task.blockSparePartRef}</p>}
          {task.blockSparePartEta && <p><span className="font-bold">Date de réception estimée :</span> {task.blockSparePartEta}</p>}
        </div>
      )}

      {hasQCFeedback && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 text-xs space-y-1">
          <h3 className="mb-2 border-b border-rose-100 pb-1 text-[10px] font-bold uppercase tracking-wider text-rose-800">Retour Contrôle Qualité</h3>
          <p className="font-bold text-rose-700">Refus de conformité qualité</p>
          {dossier.checklistQC.commentaireRefus && <p><span className="font-bold">Motif / Commentaire :</span> {dossier.checklistQC.commentaireRefus}</p>}
        </div>
      )}

      {finalComplaint && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-xs space-y-1">
          <h3 className="mb-2 border-b border-red-100 pb-1 text-[10px] font-bold uppercase tracking-wider text-red-800">Réclamation liée</h3>
          <p><span className="font-bold">Numéro Réclamation :</span> {finalComplaint.id}</p>
          <p><span className="font-bold">Motif :</span> {finalComplaint.motif}</p>
          <p><span className="font-bold">Criticité :</span> {finalComplaint.criticite}</p>
        </div>
      )}

      <div data-testid="technician-task-sheet-signatures" className="grid grid-cols-3 gap-5 pt-4 text-xs">
        <div className="flex h-28 flex-col justify-between rounded-lg border border-slate-300 p-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Signature Technicien</span>
          <span className="text-center text-[9px] italic text-slate-300">Intervention réalisée</span>
        </div>
        <div className="flex h-28 flex-col justify-between rounded-lg border border-slate-300 p-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Signature Chef Atelier</span>
          <span className="text-center text-[9px] italic text-slate-300">Contrôle atelier</span>
        </div>
        <div className="flex h-28 flex-col justify-between rounded-lg border border-slate-300 p-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Contrôle Qualité</span>
          <span className="text-center text-[9px] italic text-slate-300">Validation finale</span>
        </div>
      </div>

      <div className="space-y-1 border-t border-dashed border-slate-300 pt-4 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <div>Document interne de travail NIMR SAV PRO - Reproduction interdite sans autorisation</div>
        <div>{PILOT_SIGNATURE_NOTICE}</div>
      </div>
    </div>
  );
}
