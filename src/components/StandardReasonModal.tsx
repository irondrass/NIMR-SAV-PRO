/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

interface StandardReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, details: string) => void;
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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setDetails("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAutre = selectedReason === "Autre (saisie libre)";
  
  // Validation rules:
  // - A reason must be selected (not empty)
  // - If "Autre (saisie libre)", details must not be empty
  const isValid = selectedReason !== "" && (!isAutre || details.trim() !== "");

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onConfirm(selectedReason, details.trim());
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
              {reasons.map((r, idx) => (
                <option key={idx} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Details input */}
          <div className="space-y-1.5">
            <label className="block text-slate-700  font-bold">
              {isAutre ? (
                <span>Précision obligatoire (saisie libre) : <span className="text-rose-500">*</span></span>
              ) : (
                <span>Observations complémentaires (optionnel) :</span>
              )}
            </label>
            <textarea
              data-testid={`${testIdPrefix}-input`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={isAutre ? "Veuillez préciser le motif..." : placeholder}
              rows={3}
              className="w-full p-2.5 bg-white  border border-slate-200  rounded-lg text-xs font-semibold text-slate-800  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 placeholder-slate-400 resize-none"
              required={isAutre}
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
              disabled={!isValid}
              className={`p-2.5 px-4 font-extrabold rounded-lg transition ${
                isValid
                  ? "bg-slate-900  text-white  hover:scale-[1.02] cursor-pointer"
                  : "bg-slate-200  text-slate-400  cursor-not-allowed"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
