/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import StandardReasonModal from "./StandardReasonModal";
import { DossierSAV, UserRole, DossierStatus } from "../types";
import { getDossierQCStatus, submitQualityControl } from "../sav-core";
import { sanitizeFreeText } from "../field-validations";
import { canAcceptQC, canRefuseQC } from "../permissions";
import { logAuditEvent } from "../audit-trail";
import ConfirmModal from "./ConfirmModal";
import { canRunGuardedAction } from "../action-guard";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  History, 
  Check, 
  ChevronRight, 
  User, 
  ClipboardCheck,
  FileText
} from "lucide-react";
import { StatusBadge, LicencePlate } from "./UIParts";

interface ControleQualiteViewProps {
  dossiers: DossierSAV[];
  onUpdateDossier: (dossier: DossierSAV) => void;
  currentUser: {
    displayName: string;
    role: UserRole;
  };
}

export default function ControleQualiteView({
  dossiers,
  onUpdateDossier,
  currentUser
}: ControleQualiteViewProps) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [refusalComment, setRefusalComment] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [showRefuseConfirm, setShowRefuseConfirm] = useState(false);
  const [isSubmittingQC, setIsSubmittingQC] = useState(false);
  const qcSubmitRef = useRef(false);

  // Local checklist state for the currently selected dossier
  const [essaiEffectue, setEssaiEffectue] = useState(false);
  const [defautRepare, setDefautRepare] = useState(false);
  const [aucunVoyantAllume, setAucunVoyantAllume] = useState(false);
  const [niveauxVerifies, setNiveauxVerifies] = useState(false);
  const [serrageSecurite, setSerrageSecurite] = useState(false);
  const [propreteVehicule, setPropreteVehicule] = useState(false);
  const [documentsPrets, setDocumentsPrets] = useState(false);
  const [photosApresOk, setPhotosApresOk] = useState(false);

  // Sync selected dossier
  const selectedDossier = dossiers.find(d => d.id === selectedDossierId);

  const recordQCAudit = (action: string, summary: string, result: "success" | "blocked" | "failed" = "success", blockReason?: string) => {
    if (!selectedDossier) return;
    logAuditEvent({
      user: currentUser.displayName,
      role: currentUser.role,
      module: "controle-qualite",
      action,
      dossierId: selectedDossier.id,
      dossierLabel: `${selectedDossier.vehiculeMarque} ${selectedDossier.vehiculeModele}`,
      summary,
      commentaire: summary,
      result,
      blockReason,
      source: "qc",
    });
  };

  const handleSelectDossier = (dossier: DossierSAV) => {
    setSelectedDossierId(dossier.id);
    setRefusalComment("");
    setValidationError(null);
    setSuccessMsg(null);
    setShowValidateConfirm(false);
    setShowRefuseConfirm(false);
    
    // Pre-populate with existing values if any
    setEssaiEffectue(dossier.checklistQC.essaiEffectue || false);
    setDefautRepare(dossier.checklistQC.defautRepare || false);
    setAucunVoyantAllume(dossier.checklistQC.aucunVoyantAllume || false);
    setNiveauxVerifies(dossier.checklistQC.niveauxVerifies || false);
    setSerrageSecurite(dossier.checklistQC.serrageSecurite || false);
    setPropreteVehicule(dossier.checklistQC.propreteVehicule || false);
    setDocumentsPrets(dossier.checklistQC.documentsPrets || false);
    setPhotosApresOk(dossier.checklistQC.photosApresOk || false);
  };

  // 1. Calculate Quality KPIs & FTR
  const qcAccepted = dossiers.filter(d => d.checklistQC.validationGlobale === "valide").length;
  const qcRefused = dossiers.filter(d => d.checklistQC.validationGlobale === "refuse").length;
  const denominator = qcAccepted + qcRefused;

  const hasRefusalTrace = (d: DossierSAV) => {
    const logText = [
      d.bloqueRaison,
      d.checklistQC.commentaireRefus,
      ...(d.historiqueLogs ?? []),
      ...d.ordresReparation.flatMap(line => line.history ?? []),
    ].join(" ").toLowerCase();
    return logText.includes("refus qualité") || logText.includes("qc refus") || logText.includes("contrôle qualité refus");
  };

  const acceptedFirstTime = dossiers.filter(
    d => d.checklistQC.validationGlobale === "valide" && !hasRefusalTrace(d)
  ).length;

  const ftrRate = denominator > 0 ? Math.round((acceptedFirstTime / denominator) * 100) : null;
  const ftrLabel = ftrRate === null ? "Non mesurable" : `${ftrRate}%`;

  // 2. Filter Dossiers
  const pendingDossiers = dossiers.filter(d => d.statut === DossierStatus.CONTROLE_QUALITE || getDossierQCStatus(d).status === "to_recheck");
  const historyDossiers = dossiers
    .filter(d => d.checklistQC.validationGlobale === "valide" || d.checklistQC.validationGlobale === "refuse" || d.checklistQC.validationGlobale === "a_refaire")
    .sort((a, b) => {
      const dateA = a.checklistQC.dateValidation ? new Date(a.checklistQC.dateValidation).getTime() : 0;
      const dateB = b.checklistQC.dateValidation ? new Date(b.checklistQC.dateValidation).getTime() : 0;
      return dateB - dateA;
    });

  const handleValidateQC = () => {
    setValidationError(null);
    setSuccessMsg(null);
    if (!selectedDossier) return;
    if (!canAcceptQC(currentUser.role)) {
      const message = "Action refusée : votre rôle ne permet pas cette opération.";
      setValidationError(message);
      recordQCAudit("validation_qc_refusee", message, "blocked", message);
      return;
    }

    const allChecked = 
      essaiEffectue && 
      defautRepare && 
      aucunVoyantAllume && 
      niveauxVerifies && 
      serrageSecurite && 
      propreteVehicule && 
      documentsPrets && 
      photosApresOk;

    if (!allChecked) {
      setValidationError("Toutes les étapes du contrôle qualité doivent être cochées pour valider le dossier.");
      return;
    }

    setShowValidateConfirm(true);
  };

  const confirmValidateQC = () => {
    if (qcSubmitRef.current || !selectedDossier) return;
    if (!canRunGuardedAction(`qc-dedicated:${selectedDossier.id}:valide`)) return;
    if (!canAcceptQC(currentUser.role)) {
      const message = "Action refusée : votre rôle ne permet pas cette opération.";
      setValidationError(message);
      recordQCAudit("validation_qc_refusee", message, "blocked", message);
      return;
    }
    qcSubmitRef.current = true;
    setIsSubmittingQC(true);

    const updatedDossier: DossierSAV = {
      ...selectedDossier,
      checklistQC: {
        ...selectedDossier.checklistQC,
        essaiEffectue,
        defautRepare,
        aucunVoyantAllume,
        niveauxVerifies,
        serrageSecurite,
        propreteVehicule,
        documentsPrets,
        photosApresOk,
      }
    };

    try {
      const validated = submitQualityControl(updatedDossier, currentUser.role, "valide", "", new Date());

      // Add custom actor information to logs
      const timestamp = new Date().toISOString();
      const formattedLog = `${timestamp} - [${currentUser.role}] - Contrôle Qualité validé par ${currentUser.displayName}`;
      validated.historiqueLogs = [formattedLog, ...(validated.historiqueLogs || [])];

      onUpdateDossier(validated);
      recordQCAudit("validation_qc", `Contrôle qualité validé pour le dossier ${selectedDossier.id}.`);
      setSuccessMsg(`Contrôle qualité validé pour le dossier ${selectedDossier.id} ! Le véhicule est prêt à être livré.`);
      setSelectedDossierId(null);
      setShowValidateConfirm(false);
    } catch (e: any) {
      setValidationError(e.message || "Une erreur est survenue lors de la validation du contrôle qualité.");
      recordQCAudit("validation_qc_erreur", e.message, "blocked", e.message);
      setShowValidateConfirm(false);
    } finally {
      setIsSubmittingQC(false);
      qcSubmitRef.current = false;
    }
  };

  const handleRefuseQC = () => {
    setValidationError(null);
    setSuccessMsg(null);
    if (!selectedDossier) return;
    if (!canRefuseQC(currentUser.role)) {
      const message = "Action refusée : votre rôle ne permet pas cette opération.";
      setValidationError(message);
      recordQCAudit("refus_qc_refuse", message, "blocked", message);
      return;
    }
    setShowRefuseConfirm(true);
  };

  const confirmRefuseQC = (reason: string, details: string) => {
    if (qcSubmitRef.current || !selectedDossier) return;
    if (!canRunGuardedAction(`qc-dedicated:${selectedDossier.id}:refuse`)) return;
    if (!canRefuseQC(currentUser.role)) {
      const message = "Action refusée : votre rôle ne permet pas cette opération.";
      setValidationError(message);
      recordQCAudit("refus_qc_refuse", message, "blocked", message);
      return;
    }
    qcSubmitRef.current = true;
    setIsSubmittingQC(true);
    const fullReason = sanitizeFreeText(`${reason} : ${details}`);

    const updatedDossier: DossierSAV = {
      ...selectedDossier,
      checklistQC: {
        ...selectedDossier.checklistQC,
        essaiEffectue,
        defautRepare,
        aucunVoyantAllume,
        niveauxVerifies,
        serrageSecurite,
        propreteVehicule,
        documentsPrets,
        photosApresOk,
      }
    };

    const refused = submitQualityControl(updatedDossier, currentUser.role, "refuse", fullReason, new Date());
    
    // Add custom actor information to logs
    const timestamp = new Date().toISOString();
    const formattedLog = `${timestamp} - [${currentUser.role}] - Contrôle Qualité REFUSÉ par ${currentUser.displayName}. Motif: ${fullReason}`;
    refused.historiqueLogs = [formattedLog, ...(refused.historiqueLogs || [])];

    onUpdateDossier(refused);
    recordQCAudit("refus_qc", `Contrôle qualité refusé pour le dossier ${selectedDossier.id}.`);
    setSuccessMsg(`Contrôle qualité refusé pour le dossier ${selectedDossier.id}. Le véhicule est retourné en atelier.`);
    setSelectedDossierId(null);
    setRefusalComment("");
    setShowRefuseConfirm(false);
    setIsSubmittingQC(false);
    qcSubmitRef.current = false;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with gradient and title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Contrôle Qualité dédié</h1>
          <p className="text-sm text-indigo-200 mt-1">
            Validation des essais routiers et de la checklist de conformité avant remise au client.
          </p>
        </div>
        
        {/* KPI First Time Right Card */}
        <div className="flex gap-4">
          <div 
            data-testid="qc-kpi-ftr"
            className="px-5 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 flex flex-col justify-center"
          >
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">First Time Right (FTR)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white">{ftrLabel}</span>
              <span className="text-[10px] text-indigo-200 font-medium">({acceptedFirstTime}/{denominator || 0} validés direct)</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">QC Effectués</span>
            <span className="text-2xl font-black text-white mt-0.5">{denominator}</span>
          </div>
        </div>
      </div>

      {/* Main split screen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Pending list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Véhicules en attente de QC ({pendingDossiers.length})
            </h2>

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg">
                {successMsg}
              </div>
            )}

            {pendingDossiers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Aucun dossier en attente de contrôle qualité.
              </div>
            ) : (
              <div data-testid="qc-dossier-list" className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {pendingDossiers.map(dossier => {
                  const isSelected = selectedDossierId === dossier.id;
                  return (
                    <button
                      key={dossier.id}
                      data-testid={`qc-dossier-row-${dossier.id}`}
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

        {/* Right column: Form / Checklist */}
        <div className="lg:col-span-7">
          {selectedDossier ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {(() => {
                const qcStatus = getDossierQCStatus(selectedDossier);
                const qcLabel = {
                  missing: "Non réalisé",
                  pending: "En cours",
                  conforme: "Conforme",
                  refused: "Refusé",
                  to_recheck: "À refaire",
                }[qcStatus.status];
                return (
                  <div className={`border-b px-4 py-2 text-xs font-black uppercase ${qcStatus.status === "conforme" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : qcStatus.status === "refused" || qcStatus.status === "to_recheck" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}>
                    <span data-testid="qc-status-badge">QC {qcLabel}</span>
                  </div>
                );
              })()}
              {/* Selected vehicle summary header */}
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Dossier en contrôle</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-extrabold text-slate-800">{selectedDossier.id}</span>
                    <LicencePlate plate={selectedDossier.vehiculeImmatriculation} />
                  </div>
                  <p className="text-xs font-bold text-slate-600 mt-1">
                    {selectedDossier.vehiculeMarque} {selectedDossier.vehiculeModele} — {selectedDossier.typeDossier}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Plainte Client</span>
                  <p className="text-[11px] text-slate-500 italic max-w-xs line-clamp-2 mt-0.5" title={selectedDossier.plainteClient}>
                    "{selectedDossier.plainteClient}"
                  </p>
                </div>
              </div>

              {/* Checklist form */}
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                    Points de contrôle obligatoires (8/8)
                  </h3>

                  {validationError && (
                    <div data-testid="action-feedback" className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs font-bold rounded-lg mb-4 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span data-testid="action-error-message">{validationError}</span>
                    </div>
                  )}

                  {/* 8 point grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { id: "qc-check-essai", checked: essaiEffectue, set: setEssaiEffectue, label: "Essai routier effectué" },
                      { id: "qc-check-defaut", checked: defautRepare, set: setDefautRepare, label: "Défaut signalé réparé" },
                      { id: "qc-check-voyants", checked: aucunVoyantAllume, set: setAucunVoyantAllume, label: "Aucun voyant anormal allumé" },
                      { id: "qc-check-niveaux", checked: niveauxVerifies, set: setNiveauxVerifies, label: "Niveaux fluides vérifiés" },
                      { id: "qc-check-serrage", checked: serrageSecurite, set: setSerrageSecurite, label: "Organes de sécurité serrés" },
                      { id: "qc-check-proprete", checked: propreteVehicule, set: setPropreteVehicule, label: "Propreté habitacle et ext." },
                      { id: "qc-check-docs", checked: documentsPrets, set: setDocumentsPrets, label: "Dossier & documents prêts" },
                      { id: "qc-check-photos", checked: photosApresOk, set: setPhotosApresOk, label: "Photos après travaux validées" },
                    ].map(item => (
                      <label
                        key={item.id}
                        data-testid={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          item.checked 
                            ? "bg-indigo-50/30 border-indigo-100 text-indigo-900 font-bold" 
                            : "bg-slate-50/30 hover:bg-slate-50 border-slate-100 text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={e => item.set(e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Refusal comments / Motif refus */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Observations / Motif de refus (Obligatoire si refusé)
                  </label>
                  <textarea
                    data-testid="qc-comment-refus"
                    value={refusalComment}
                    onChange={e => setRefusalComment(e.target.value)}
                    placeholder="Saisir les remarques ou les anomalies constatées si le véhicule doit retourner à l'atelier..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                    data-testid="btn-qc-refuse"
                    onClick={handleRefuseQC}
                    disabled={isSubmittingQC}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <span data-testid="qc-refuse-button" className="sr-only">Refuser QC</span>
                    <XCircle className="w-4 h-4" />
                    Refuser & Retour Atelier
                  </button>
                    <button
                    data-testid="btn-qc-validate"
                    onClick={handleValidateQC}
                    disabled={isSubmittingQC}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <span data-testid="qc-approve-button" className="sr-only">Valider QC conforme</span>
                    <CheckCircle className="w-4 h-4" />
                    Valider le Contrôle Qualité
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center min-h-[300px]">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mb-2" />
              Sélectionnez un véhicule dans la liste pour effectuer le contrôle qualité.
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showValidateConfirm && !!selectedDossier}
        onClose={() => setShowValidateConfirm(false)}
        onConfirm={confirmValidateQC}
        title="Valider le contrôle qualité"
        message={selectedDossier ? `Confirmer la validation QC du dossier ${selectedDossier.id} et son passage en prêt à livrer ?` : ""}
        confirmText="Confirmer"
        isPending={isSubmittingQC}
        modalAliasTestId="modal-qc-validate"
        cancelAliasTestId="modal-qc-validate-cancel"
        confirmAliasTestId="modal-qc-validate-confirm"
      />

      <StandardReasonModal
        isOpen={showRefuseConfirm && !!selectedDossier}
        onClose={() => setShowRefuseConfirm(false)}
        onConfirm={confirmRefuseQC}
        title="Refus du contrôle qualité"
        description="Le retour atelier exige un motif standardisé et un commentaire exploitable."
        reasons={[
          "Essai routier non validé",
          "Défaut d'aspect carrosserie",
          "Bruit ou vibration persistant",
          "Voyant anomalie actif",
          "Autre"
        ]}
        testIdPrefix="modal-qc-refuse"
      />

      {/* QC History Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History className="w-4.5 h-4.5 text-slate-500" />
          Historique des contrôles qualité récents ({historyDossiers.length})
        </h2>

        {historyDossiers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Aucun contrôle qualité archivé pour l'instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Dossier</th>
                  <th className="py-2.5 px-3">Véhicule</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Validateur</th>
                  <th className="py-2.5 px-3">Statut QC</th>
                  <th className="py-2.5 px-3">Observations / Motif</th>
                </tr>
              </thead>
              <tbody data-testid="qc-history-list" className="divide-y divide-slate-50">
                {historyDossiers.map(d => {
                  const result = d.checklistQC.validationGlobale;
                  const dateStr = d.checklistQC.dateValidation 
                    ? new Date(d.checklistQC.dateValidation).toLocaleString("fr-FR") 
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
                      <td className="py-3 px-3 text-slate-500">{dateStr}</td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{d.checklistQC.validePar || "Contrôleur"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {result === "valide" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            <Check className="w-3 h-3" />
                            Accepté
                          </span>
                        ) : result === "a_refaire" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            À refaire
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Refusé
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={d.checklistQC.commentaireRefus}>
                        {d.checklistQC.commentaireRefus || <span className="text-slate-300">-</span>}
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
