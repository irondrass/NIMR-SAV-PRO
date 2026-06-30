/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, useEffect, useRef } from "react";
import { X, AlertTriangle, Info } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isInfo?: boolean;
  isPending?: boolean;
  modalAliasTestId?: string;
  cancelAliasTestId?: string;
  confirmAliasTestId?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  isDanger = false,
  isInfo = false,
  isPending = false,
  modalAliasTestId,
  cancelAliasTestId,
  confirmAliasTestId,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isPending]);

  // Focus confirm button on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      data-testid="confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
    >
      <div 
        data-testid={modalAliasTestId}
        className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 id="confirm-modal-heading" className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 font-display" data-testid="confirm-modal-title">
            {isDanger ? (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            )}
            {title}
          </h3>
          {!isPending && (
            <button 
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Fermer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 text-xs font-semibold text-slate-700 leading-relaxed" data-testid="confirm-modal-message">
          {message}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 bg-slate-50 border-t border-slate-100">
          {!isInfo && !isPending && (
            <button
              type="button"
              data-testid="confirm-modal-cancel"
              onClick={onClose}
              className="p-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-lg transition cursor-pointer"
            >
              <span data-testid={cancelAliasTestId}>{cancelText}</span>
            </button>
          )}
          <button
            type="button"
            ref={confirmButtonRef}
            data-testid="confirm-modal-confirm"
            disabled={isPending}
            onClick={onConfirm}
            className={`p-2.5 px-4 font-extrabold rounded-lg transition cursor-pointer ${
              isPending
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : isDanger
                  ? "bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02]"
                  : "bg-slate-900 text-white hover:scale-[1.02]"
            }`}
          >
            {isPending ? (
              <span data-testid="action-pending-indicator">Traitement...</span>
            ) : (
              <span data-testid={confirmAliasTestId}>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
