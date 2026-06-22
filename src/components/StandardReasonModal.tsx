/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { TASK_BLOCK_FOLLOW_UP_OWNERS, TaskBlockFollowUpOwner } from "../types";

interface StandardReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    reason: string,
    details: string,
    sparePartRef?: string,
    sparePartEta?: string,
    followUpOwner?: TaskBlockFollowUpOwner,
    resolutionEta?: string
  ) => void;
  title: string;
  description?: string;
  reasons: string[];
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  testIdPrefix: string; // e.g. "modal-qc-refuse", "modal-task-reopen", "modal-task-block"
}

export default function StandardReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  reasons,
  placeholder = "Saisir des détails complémentaires...",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  testIdPrefix,
}: StandardReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [sparePartRef, setSparePartRef] = useState<string>("");
  const [sparePartEta, setSparePartEta] = useState<string>("");
  const [followUpOwner, setFollowUpOwner] = useState<TaskBlockFollowUpOwner>("Chef Atelier");
  const [resolutionEta, setResolutionEta] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Override reasons if blocking modal
  const isBlockingModal = testIdPrefix === "modal-task-block";
  const actualReasons = isBlockingModal
    ? [
        "Attente pièce",
        "Support technique",
        "Outillage indisponible",
        "Accord client requis",
        "Diagnostic complémentaire",
        "Autre"
      ]
    : reasons;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setDetails("");
      setSparePartRef("");
      setSparePartEta("");
      setFollowUpOwner("Chef Atelier");
      setResolutionEta("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAutre = selectedReason === "Autre (saisie libre)" || selectedReason === "Autre";
  
  // Validation rules:
  // - A reason must be selected (not empty)
  // - Comment is mandatory for blockages or QC refusals or "Autre"
  const isCommentMandatory = isBlockingModal || testIdPrefix === "modal-qc-refuse" || isAutre;
  const isValid = selectedReason !== "" && (!isCommentMandatory || details.trim() !== "");

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    onConfirm(
      selectedReason,
      details.trim(),
      selectedReason === "Attente pièce" ? sparePartRef.trim() : undefined,
      selectedReason === "Attente pièce" ? sparePartEta : undefined,
      isBlockingModal ? followUpOwner : undefined,
      isBlockingModal ? resolutionEta : undefined
    );
  };

  return (
    <div 
      data-testid={testIdPrefix}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
    >
      <div 
        className="w-full max-w-md bg-white  rounded-xl border border-slate-200  shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100  bg-slate-50 ">
          <h3 className="text-sm font-black text-slate-900  uppercase tracking-wider flex items-center gap-2 font-display">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600  hover:bg-slate-100  transition"
            aria-label="Fermer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 text-xs font-semibold">
          {description && (
            <p className="text-slate-500  font-medium leading-relaxed">
              {description}
            </p>
          )}

          {/* Reason Select */}
          <div className="space-y-1.5">
            <label className="block text-slate-700  font-bold">
              Sélectionner un motif obligatoire :
            </label>
            <select
              data-testid={`${testIdPrefix}-select`}
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full p-2.5 bg-white  border border-slate-200  rounded-lg text-xs font-semibold text-slate-800  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10"
              required
            >
              <option value="" disabled>-- Choisir un motif --</option>
              {actualReasons.map((r, idx) => (
                <option key={idx} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Attente pièce extra inputs */}
          {selectedReason === "Attente pièce" && (
            <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold">Référence pièce (facultatif) :</label>
                <input
                  type="text"
                  data-testid="block-spare-part-ref"
                  value={sparePartRef}
                  onChange={(e) => setSparePartRef(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1"
                  placeholder="Ex: 12345-ABC"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold">Date estimée de réception (facultatif) :</label>
                <input
                  type="date"
                  data-testid="block-spare-part-eta"
                  value={sparePartEta}
                  onChange={(e) => setSparePartEta(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1"
                />
              </div>
            </div>
          )}

          {isBlockingModal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold">Responsable de suivi :</label>
                <select
                  data-testid={`${testIdPrefix}-owner`}
                  value={followUpOwner}
                  onChange={(e) => setFollowUpOwner(e.target.value as TaskBlockFollowUpOwner)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1"
                >
                  {TASK_BLOCK_FOLLOW_UP_OWNERS.map(owner => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold">ETA résolution (facultatif) :</label>
                <input
                  type="date"
                  data-testid={`${testIdPrefix}-resolution-eta`}
                  value={resolutionEta}
                  onChange={(e) => setResolutionEta(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1"
                />
              </div>
            </div>
          )}

          {/* Details input */}
          <div className="space-y-1.5">
            <label className="block text-slate-700  font-bold">
              {isCommentMandatory ? (
                <span>Commentaire obligatoire : <span className="text-rose-500">*</span></span>
              ) : (
                <span>Observations complémentaires (optionnel) :</span>
              )}
            </label>
            <textarea
              data-testid={`${testIdPrefix}-input`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={isCommentMandatory ? "Veuillez préciser le motif..." : placeholder}
              rows={3}
              className="w-full p-2.5 bg-white  border border-slate-200  rounded-lg text-xs font-semibold text-slate-800  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 placeholder-slate-400 resize-none"
              required={isCommentMandatory}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 ">
            <button
              type="button"
              data-testid={`${testIdPrefix}-cancel`}
              onClick={onClose}
              className="p-2.5 px-4 bg-slate-100 hover:bg-slate-200   text-slate-700  font-extrabold rounded-lg transition"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              data-testid={`${testIdPrefix}-confirm`}
              disabled={!isValid || isSubmitting}
              className={`p-2.5 px-4 font-extrabold rounded-lg transition ${
                isValid && !isSubmitting
                  ? "bg-slate-900  text-white  hover:scale-[1.02] cursor-pointer"
                  : "bg-slate-200  text-slate-400  cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Action en cours...</span>
              ) : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
