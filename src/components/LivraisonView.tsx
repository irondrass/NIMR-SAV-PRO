/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { DELIVERY_RESTITUTION_STATUSES, DeliveryRestitutionStatus, DossierSAV, UserRole, DossierStatus } from "../types";
import { archiveDeliveredDossier, canDeliverDossier, confirmDelivery } from "../sav-core";
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
import { maskPhoneNumber, sanitizeFreeText, validateDeliveryRestitutionStatus, validateMileage } from "../field-validations";
import { canArchiveDeliveredDossier, canConfirmDelivery, canViewVehicleSensitiveFields } from "../permissions";
import { canRunGuardedAction } from "../action-guard";
import { PILOT_SIGNATURE_NOTICE } from "../rc-notices";

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
  const [restitutionStatus, setRestitutionStatus] = useState<DeliveryRestitutionStatus>("Livré sans réserve");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Restitution checklist checkboxes
  const [qcOk, setQcOk] = useState(false);
  const [clientInformed, setClientInformed] = useState(false);
  const [clientReceptionConfirmed, setClientReceptionConfirmed] = useState(false);

  // Canvas Signature state
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureUri, setSignatureUri] = useState("");
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Confirm Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const deliveryConfirmRef = useRef(false);

  const selectedDossier = dossiers.find(d => d.id === selectedDossierId);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0f172a"; // slate-900
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureUri(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUri("");
    setHasSigned(false);
  };

  const handleSelectDossier = (dossier: DossierSAV) => {
    setSelectedDossierId(dossier.id);
    setExitKm(dossier.livraison.kilometrageSortie ? String(dossier.livraison.kilometrageSortie) : String(dossier.vehiculeKilometrage));
    setRemarks(dossier.livraison.remarquesLivraison || "");
    setRestitutionStatus(dossier.livraison.statutRestitution || "Livré sans réserve");
    setValidationError(null);
    setSuccessMsg(null);

    setQcOk(dossier.livraison.controleQualiteOk || false);
    setClientInformed(dossier.livraison.clientInforme || false);
    setClientReceptionConfirmed(dossier.livraison.confirmationReceptionClient || false);

    // Reset signature canvas
    setSignatureUri(dossier.livraison.signatureClientUri || "");
    setHasSigned(!!dossier.livraison.signatureClientUri);
  };

  // 1. Filter dossiers
  const readyDossiers = dossiers.filter(d => d.statut === DossierStatus.PRET_A_LIVRER || d.statut === DossierStatus.NON_RETIRE);
  const deliveredDossiers = dossiers
    .filter(d => d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.NON_RETIRE || d.statut === DossierStatus.PRET_FACTURATION || d.statut === DossierStatus.CLOTURE)
    .sort((a, b) => {
      const dateA = a.livraison.dateLivraisonReelle ? new Date(a.livraison.dateLivraisonReelle).getTime() : 0;
      const dateB = b.livraison.dateLivraisonReelle ? new Date(b.livraison.dateLivraisonReelle).getTime() : 0;
      return dateB - dateA;
    });

  const handleConfirmDelivery = () => {
    if (!canConfirmDelivery(currentUser.role)) {
      setValidationError("Rôle non autorisé pour confirmer une livraison.");
      return;
    }
    if (!selectedDossier || !canRunGuardedAction(`delivery-confirm:${selectedDossier.id}`)) return;
    if (deliveryConfirmRef.current) return;
    deliveryConfirmRef.current = true;
    setIsConfirmingDelivery(true);
    setValidationError(null);
    setSuccessMsg(null);
    if (!selectedDossier) {
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    if (!qcOk || !clientInformed || !clientReceptionConfirmed) {
      setValidationError("Toutes les étapes de la checklist de restitution doivent être cochées pour confirmer la livraison.");
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    const parsedExitKm = parseInt(exitKm, 10);
    const mileageCheck = validateMileage(parsedExitKm);
    if (isNaN(parsedExitKm) || !mileageCheck.valid) {
      setValidationError(mileageCheck.reason || "Le kilométrage de sortie est obligatoire et doit être un nombre valide.");
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    if (parsedExitKm < selectedDossier.vehiculeKilometrage) {
      setValidationError(`Le kilométrage de sortie (${parsedExitKm} km) ne peut pas être inférieur au kilométrage d'entrée (${selectedDossier.vehiculeKilometrage} km).`);
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    const statusCheck = validateDeliveryRestitutionStatus(restitutionStatus, remarks);
    if (!statusCheck.valid) {
      setValidationError(statusCheck.reason || "Statut de restitution invalide.");
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    if (!hasSigned) {
      setValidationError("L'acceptation/signature simple client est obligatoire.");
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }
    const safeRemarks = sanitizeFreeText(remarks);

    const withDeliveryInfo: DossierSAV = {
      ...selectedDossier,
      livraison: {
        ...selectedDossier.livraison,
        controleQualiteOk: qcOk,
        clientInforme: clientInformed,
        confirmationReceptionClient: clientReceptionConfirmed,
        remarquesLivraison: safeRemarks,
        statutRestitution: restitutionStatus,
        kilometrageSortie: parsedExitKm,
        signatureClientUri: signatureUri || undefined,
      }
    };

    const deliveryGate = canDeliverDossier(withDeliveryInfo);
    if (!deliveryGate.allowed) {
      setValidationError(deliveryGate.reasons.join(" "));
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    const delivered = confirmDelivery(withDeliveryInfo, new Date(), restitutionStatus);
    if (delivered === withDeliveryInfo) {
      setValidationError("Livraison refusée : prérequis opérationnels incomplets.");
      setIsConfirmingDelivery(false);
      deliveryConfirmRef.current = false;
      return;
    }

    // Add delivery log with actor and details
    const timestamp = new Date().toISOString();
    const formattedLog = `${timestamp} - [${currentUser.role}] - Restitution validée. Statut: ${restitutionStatus}. KM Sortie: ${parsedExitKm}. Obs: ${safeRemarks || "Aucune"}`;
    delivered.historiqueLogs = [formattedLog, ...(delivered.historiqueLogs || [])];

    onUpdateDossier(delivered);
    setSuccessMsg(`Livraison confirmée pour le dossier ${selectedDossier.id} ! Le véhicule est maintenant marqué comme livré.`);
    setSelectedDossierId(null);
    setShowConfirmModal(false);
    setIsConfirmingDelivery(false);
    deliveryConfirmRef.current = false;
  };

  const handleArchiveDelivered = (dossier: DossierSAV) => {
    if (!canArchiveDeliveredDossier(currentUser.role)) return;
    if (!canRunGuardedAction(`archive-delivered:${dossier.id}`)) return;
    const archived = archiveDeliveredDossier(dossier, currentUser.role);
    onUpdateDossier(archived);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with gradient and title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Module Livraison dédié</h1>
          <p className="text-sm text-indigo-200 mt-1">
            Restitution des véhicules aux clients, acceptation simple pilote interne et relevé du kilométrage final.
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
            <>
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
                  <p className="text-[10px] text-slate-500 font-mono">
                    {canViewVehicleSensitiveFields(currentUser.role) ? selectedDossier.clientTelephone : maskPhoneNumber(selectedDossier.clientTelephone)}
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
                    <div data-testid="delivery-validation-error" className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs font-bold rounded-lg mb-4 flex items-center gap-1.5">
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
                        onChange={e => {
                          setClientReceptionConfirmed(e.target.checked);
                          if (e.target.checked) {
                            setHasSigned(true);
                          } else {
                            setHasSigned(Boolean(signatureUri));
                          }
                        }}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs">Confirmation de réception et acceptation/signature simple client (clé remise)</span>
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

                {/* Canvas Signature Pad */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Acceptation / signature simple client (Requis)
                  </label>
                  <p data-testid="delivery-simple-signature-notice" className="text-[10px] font-bold text-amber-700">
                    {PILOT_SIGNATURE_NOTICE}
                  </p>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center gap-2">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="bg-white border border-slate-200 rounded-lg cursor-crosshair touch-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] transition cursor-pointer"
                      >
                        Effacer l'acceptation
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Statut opérationnel de restitution
                  </label>
                  <div data-testid="delivery-status-options" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DELIVERY_RESTITUTION_STATUSES.map(status => {
                      const selected = restitutionStatus === status;
                      const slug = status.toLowerCase().replace(/\s+/g, "-").replace(/[éè]/g, "e");
                      return (
                        <button
                          key={status}
                          type="button"
                          data-testid={`delivery-status-${slug}`}
                          onClick={() => setRestitutionStatus(status)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition ${
                            selected
                              ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Remarks / Remarques de livraison */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Observations de livraison / Commentaires {(restitutionStatus === "Réserve client" || restitutionStatus === "Client mécontent") ? "(Obligatoire)" : "(Optionnel)"}
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
                  onClick={() => {
                    setValidationError(null);
                    setSuccessMsg(null);

                    if (!qcOk || !clientInformed || !clientReceptionConfirmed) {
                      setValidationError("Toutes les étapes de la checklist de restitution doivent être cochées pour confirmer la livraison.");
                      return;
                    }

                    const parsedExitKm = parseInt(exitKm, 10);
                    const mileageCheck = validateMileage(parsedExitKm);
                    if (isNaN(parsedExitKm) || !mileageCheck.valid) {
                      setValidationError(mileageCheck.reason || "Le kilométrage de sortie est obligatoire et doit être un nombre valide.");
                      return;
                    }

                    if (parsedExitKm < selectedDossier.vehiculeKilometrage) {
                      setValidationError(`Le kilométrage de sortie (${parsedExitKm} km) ne peut pas être inférieur au kilométrage d'entrée (${selectedDossier.vehiculeKilometrage} km).`);
                      return;
                    }

                    const statusCheck = validateDeliveryRestitutionStatus(restitutionStatus, remarks);
                    if (!statusCheck.valid) {
                      setValidationError(statusCheck.reason || "Statut de restitution invalide.");
                      return;
                    }

                    if (!hasSigned) {
                      setValidationError("L'acceptation/signature simple client est obligatoire.");
                      return;
                    }

                    setShowConfirmModal(true);
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-xs transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Valider et Confirmer la Livraison
                </button>
              </div>
            </div>

            {/* Generic Confirm Modal Overlay */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">Confirmer livraison</h3>
                      <p className="text-slate-500 text-xs mt-1">
                        Êtes-vous sûr de vouloir confirmer la livraison de ce véhicule et la clôture opérationnelle de son dossier ?
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      data-testid="modal-delivery-confirm"
                      onClick={handleConfirmDelivery}
                      disabled={isConfirmingDelivery}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isConfirmingDelivery ? "Traitement..." : "Confirmer la livraison"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
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
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3">KM Entrée</th>
                  <th className="py-2.5 px-3">KM Sortie</th>
                  <th className="py-2.5 px-3">Observations</th>
                  <th className="py-2.5 px-3 text-right">Archive</th>
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
                      <td className="py-3 px-3">
                        <span data-testid={`delivery-history-status-${d.id}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-700">
                          {d.livraison.statutRestitution || "Livré sans réserve"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono">{d.vehiculeKilometrage} km</td>
                      <td className="py-3 px-3 text-indigo-600 font-mono font-bold">
                        {d.livraison.kilometrageSortie ? `${d.livraison.kilometrageSortie} km` : "-"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={d.livraison.remarquesLivraison}>
                        {d.livraison.remarquesLivraison || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {canArchiveDeliveredDossier(currentUser.role) && !d.archiveOperationnelle && d.statut !== DossierStatus.CLOTURE ? (
                          <button
                            type="button"
                            data-testid={`delivery-archive-${d.id}`}
                            onClick={() => handleArchiveDelivered(d)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-700 hover:border-blue-300"
                          >
                            Archiver
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">-</span>
                        )}
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
