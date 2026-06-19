/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { AlertTriangle, FileCheck, Paperclip } from "lucide-react";
import { DossierSAV, InterventionType, UserRole } from "../types";
import { addWarrantyLocalAttachment } from "../sav-core";
import { canManageWarranty } from "../permissions";
import { WARRANTY_LOCAL_ATTACHMENT_NOTICE } from "../rc-notices";
import { LicencePlate, StatusBadge } from "./UIParts";

interface WarrantyViewProps {
  dossiers: DossierSAV[];
  onUpdateDossier: (dossier: DossierSAV) => void;
  currentUser: {
    displayName: string;
    role: UserRole;
  };
}

export default function WarrantyView({ dossiers, onUpdateDossier, currentUser }: WarrantyViewProps) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ fileName: string; sizeBytes: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageWarranty(currentUser.role);

  const warrantyDossiers = useMemo(() => dossiers.filter(dossier => (
    dossier.typeDossier === InterventionType.GARANTIE_CONSTRUCTEUR ||
    dossier.statutGarantie?.toLowerCase().includes("garantie") ||
    dossier.accords.some(accord => accord.type === "Garantie Constructeur")
  )), [dossiers]);
  const selectedDossier = warrantyDossiers.find(dossier => dossier.id === selectedDossierId) ?? warrantyDossiers[0] ?? null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    const file = event.target.files?.[0];
    if (!file) {
      setPendingFile(null);
      return;
    }
    setPendingFile({ fileName: file.name, sizeBytes: file.size });
  };

  const handleAddAttachment = () => {
    if (!selectedDossier || !pendingFile) return;
    if (!canManage) {
      setError("Accès Garantie réservé aux rôles autorisés.");
      return;
    }
    const updated = addWarrantyLocalAttachment(selectedDossier, {
      ...pendingFile,
      addedBy: currentUser.displayName,
    });
    if (updated === selectedDossier) {
      setError("Pièce jointe refusée : nom manquant ou taille supérieure à 2 Mo.");
      return;
    }
    onUpdateDossier(updated);
    setPendingFile(null);
    setMessage("Pièce jointe locale simulée enregistrée dans le dossier pilote.");
  };

  return (
    <div data-testid="warranty-view" className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-xl font-black text-slate-950">Garantie constructeur pilote</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Suivi opérationnel local des dossiers sous garantie, sans stock, disponibilité réelle ni backend.
            </p>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
            Module minimal Lot 6I
          </span>
        </div>
        <div data-testid="warranty-local-attachment-notice" className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{WARRANTY_LOCAL_ATTACHMENT_NOTICE}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Dossiers garantie ({warrantyDossiers.length})</h2>
          <div className="space-y-2">
            {warrantyDossiers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">
                Aucun dossier garantie dans la base locale.
              </div>
            ) : warrantyDossiers.map(dossier => (
              <button
                key={dossier.id}
                type="button"
                data-testid={`warranty-dossier-${dossier.id}`}
                onClick={() => setSelectedDossierId(dossier.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedDossier?.id === dossier.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-black text-slate-900">{dossier.id}</span>
                  <StatusBadge status={dossier.statut} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <LicencePlate plate={dossier.vehiculeImmatriculation} />
                  <span>{dossier.vehiculeMarque} {dossier.vehiculeModele}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {selectedDossier ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-black text-slate-950">{selectedDossier.id}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {selectedDossier.clientNom} · {selectedDossier.typeDossier}
                  </p>
                </div>
                <FileCheck className="h-5 w-5 text-blue-600" />
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Pièces jointes locales simulées</h3>
                <div className="mt-3 space-y-2">
                  {(selectedDossier.warrantyAttachments ?? []).length === 0 ? (
                    <p className="text-xs font-semibold text-slate-500">Aucune pièce jointe locale simulée.</p>
                  ) : selectedDossier.warrantyAttachments!.map(attachment => (
                    <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                      <span className="font-bold text-slate-800">{attachment.fileName}</span>
                      <span className="font-mono text-slate-500">{Math.ceil(attachment.sizeBytes / 1024)} Ko</span>
                    </div>
                  ))}
                </div>
              </div>

              {canManage ? (
                <div className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Ajouter une pièce jointe locale simulée</span>
                    <input
                      data-testid="warranty-attachment-input"
                      type="file"
                      onChange={handleFileChange}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700"
                    />
                  </label>
                  {pendingFile && (
                    <div className="rounded-md bg-slate-50 p-2 text-xs font-bold text-slate-600">
                      {pendingFile.fileName} · {Math.ceil(pendingFile.sizeBytes / 1024)} Ko
                    </div>
                  )}
                  {error && <div className="rounded-md bg-rose-50 p-2 text-xs font-bold text-rose-700">{error}</div>}
                  {message && <div className="rounded-md bg-emerald-50 p-2 text-xs font-bold text-emerald-700">{message}</div>}
                  <button
                    type="button"
                    data-testid="warranty-attachment-add"
                    disabled={!pendingFile}
                    onClick={handleAddAttachment}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <Paperclip className="h-4 w-4" />
                    Enregistrer localement
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                  Consultation seule du suivi garantie.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

