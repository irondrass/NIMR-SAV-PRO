/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { DossierSAV, DossierStatus, UserRole } from "../types";
import { recordSatisfactionFeedback } from "../sav-core";
import { canRecordSatisfaction } from "../permissions";
import { LicencePlate, StatusBadge } from "./UIParts";

interface SatisfactionViewProps {
  dossiers: DossierSAV[];
  onUpdateDossier: (dossier: DossierSAV) => void;
  currentUser: {
    displayName: string;
    role: UserRole;
  };
}

export default function SatisfactionView({ dossiers, onUpdateDossier, currentUser }: SatisfactionViewProps) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canRecord = canRecordSatisfaction(currentUser.role);
  const deliveredDossiers = useMemo(() => dossiers.filter(dossier => (
    dossier.statut === DossierStatus.LIVRE ||
    dossier.statut === DossierStatus.NON_RETIRE ||
    dossier.statut === DossierStatus.CLOTURE
  )), [dossiers]);
  const selectedDossier = deliveredDossiers.find(dossier => dossier.id === selectedDossierId) ?? deliveredDossiers[0] ?? null;

  const handleSave = () => {
    if (!selectedDossier || !canRecord) return;
    const updated = recordSatisfactionFeedback(selectedDossier, {
      rating,
      comment,
      createdBy: currentUser.displayName,
    });
    onUpdateDossier(updated);
    setMessage("Retour satisfaction pilote enregistré localement.");
  };

  return (
    <div data-testid="satisfaction-view" className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-xl font-black text-slate-950">Satisfaction pilote interne</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Collecte locale simple après restitution, pour pilotage SAV encadré.
            </p>
          </div>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-900">
            Données locales pilote
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Dossiers restitués ({deliveredDossiers.length})</h2>
          <div className="space-y-2">
            {deliveredDossiers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">
                Aucun dossier restitué dans la base locale.
              </div>
            ) : deliveredDossiers.map(dossier => (
              <button
                key={dossier.id}
                type="button"
                data-testid={`satisfaction-dossier-${dossier.id}`}
                onClick={() => {
                  setSelectedDossierId(dossier.id);
                  setRating(dossier.satisfaction?.rating ?? 4);
                  setComment(dossier.satisfaction?.comment ?? "");
                  setMessage(null);
                }}
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
                  <span>{dossier.clientNom}</span>
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
                    {selectedDossier.clientNom} · {selectedDossier.vehiculeMarque} {selectedDossier.vehiculeModele}
                  </p>
                </div>
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>

              {selectedDossier.satisfaction && (
                <div data-testid="satisfaction-existing-feedback" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                  Dernier retour : {selectedDossier.satisfaction.rating}/5 · {selectedDossier.satisfaction.status}
                </div>
              )}

              <div className="mt-5 space-y-4 rounded-lg border border-slate-200 p-4">
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-slate-500">Note pilote</span>
                  <div data-testid="satisfaction-rating-options" className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        type="button"
                        disabled={!canRecord}
                        onClick={() => setRating(value)}
                        className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black ${
                          rating === value
                            ? "border-blue-300 bg-blue-50 text-blue-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <Star className="h-4 w-4" />
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Commentaire opérationnel</span>
                  <textarea
                    data-testid="satisfaction-comment"
                    disabled={!canRecord}
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 p-3 text-xs font-semibold text-slate-800 disabled:bg-slate-50"
                    placeholder="Retour client ou point de vigilance SAV..."
                  />
                </label>
                {message && <div className="rounded-md bg-emerald-50 p-2 text-xs font-bold text-emerald-700">{message}</div>}
                <button
                  type="button"
                  data-testid="satisfaction-save"
                  disabled={!canRecord}
                  onClick={handleSave}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Enregistrer le retour
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

