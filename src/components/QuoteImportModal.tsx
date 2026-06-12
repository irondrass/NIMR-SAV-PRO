/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-3 — Modal d'import de devis / MO
 */

import React, { useState, useCallback } from "react";
import {
  QuoteImportPreview,
  QuoteLine,
} from "../types";
import {
  parseQuoteText,
  parseQuoteCsv,
  buildQuoteImportPreview,
  validateQuoteImportPreview,
  applyQuoteImportPreview,
} from "../quote-import";
import { FileText, Upload, Check, X, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";

interface QuoteImportModalProps {
  dossierId: string;
  onConfirm: (result: ReturnType<typeof applyQuoteImportPreview>, historyEntry: string) => void;
  onCancel: () => void;
}

type ImportStep = "input" | "preview" | "done";
type SourceType = "text" | "csv";

const TYPE_LABEL: Record<string, string> = {
  labor: "Main-d'œuvre",
  part: "Pièce",
  paint: "Peinture",
  misc: "Divers",
  unknown: "Inconnu",
};

const TYPE_COLOR: Record<string, string> = {
  labor: "bg-blue-50 text-blue-700 border-blue-200",
  part: "bg-amber-50 text-amber-700 border-amber-200",
  paint: "bg-purple-50 text-purple-700 border-purple-200",
  misc: "bg-gray-50 text-gray-600 border-gray-200",
  unknown: "bg-stone-50 text-stone-500 border-stone-200",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Faible",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-green-600",
  medium: "text-amber-500",
  low: "text-red-400",
};

const FICTIVE_DEVIS_EXAMPLE = `Vidange + filtre huile 1H
Remplacement plaquettes frein avant 2H
Contrôle et réglage géométrie 1H30
Filtre à air 1
Huile moteur 5W40 5L`;

export default function QuoteImportModal({ dossierId: _dossierId, onConfirm, onCancel }: QuoteImportModalProps) {
  const [step, setStep] = useState<ImportStep>("input");
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [rawInput, setRawInput] = useState("");
  const [preview, setPreview] = useState<QuoteImportPreview | null>(null);
  const [parseError, setParseError] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const handleParse = useCallback(() => {
    setParseError("");
    setValidationErrors([]);

    const trimmed = rawInput.trim();
    if (!trimmed) {
      setParseError("Veuillez saisir ou coller le texte du devis.");
      return;
    }

    let lines: QuoteLine[];
    try {
      lines = sourceType === "csv" ? parseQuoteCsv(trimmed) : parseQuoteText(trimmed);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Erreur d'analyse du texte.");
      return;
    }

    if (!lines.length) {
      setParseError("Aucune ligne reconnue dans le texte saisi. Vérifiez le format.");
      return;
    }

    const p = buildQuoteImportPreview(lines, {
      sourceType,
      fileName: sourceType === "csv" ? "devis.csv" : undefined,
    });
    setPreview(p);
    setStep("preview");
  }, [rawInput, sourceType]);

  const handleToggleLine = (lineId: string) => {
    if (!preview) return;
    const updated: QuoteImportPreview = {
      ...preview,
      lines: preview.lines.map(l =>
        l.id === lineId ? { ...l, selected: !l.selected } : l
      ),
    };
    setPreview(updated);
    setValidationErrors([]);
  };

  const handleEditHours = (lineId: string, value: string) => {
    if (!preview) return;
    const hrs = parseFloat(value.replace(",", "."));
    setPreview({
      ...preview,
      lines: preview.lines.map(l =>
        l.id === lineId ? { ...l, editedHours: Number.isFinite(hrs) ? hrs : 0 } : l
      ),
    });
    setValidationErrors([]);
  };

  const handleEditDescription = (lineId: string, value: string) => {
    if (!preview) return;
    setPreview({
      ...preview,
      lines: preview.lines.map(l =>
        l.id === lineId ? { ...l, editedDescription: value } : l
      ),
    });
  };

  const handleConfirm = () => {
    if (!preview) return;
    const errors = validateQuoteImportPreview(preview);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    const result = applyQuoteImportPreview(preview);
    onConfirm(result, result.historyEntry);
    setStep("done");
  };

  const handleBack = () => {
    setStep("input");
    setValidationErrors([]);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx") {
      setParseError("Import XLSX sera complété dans une prochaine mise à jour. Veuillez exporter votre devis au format CSV ou copier-coller le texte.");
      return;
    }
    if (ext === "pdf") {
      setParseError("L'import PDF sera traité plus tard. Veuillez utiliser CSV, XLSX ou copier-coller le texte du devis.");
      return;
    }
    if (ext !== "csv" && ext !== "txt") {
      setParseError("Format non supporté. Importez un fichier CSV ou TXT.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawInput(text || "");
      setSourceType("csv");
      setParseError("");
    };
    reader.readAsText(file, "utf-8");
  };

  const selectedLaborCount = preview?.lines.filter(l => l.selected && l.type === "labor").length ?? 0;
  const partCount = preview?.lines.filter(l => l.type === "part").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      data-testid="quote-import-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider font-display">
                Import Devis / Main-d'œuvre
              </h2>
              <p className="text-gray-500 text-xs">
                {step === "input" && "Collez le texte du devis ou importez un fichier CSV."}
                {step === "preview" && "Vérifiez les lignes détectées avant de confirmer l'import."}
                {step === "done" && "Import confirmé avec succès."}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            data-testid="quote-import-close"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Notice PDF */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>PDF non supporté actuellement.</strong> Veuillez utiliser CSV/XLSX ou copier-coller le texte du devis.
              Import XLSX sera complété dans une mise à jour ultérieure.
            </span>
          </div>

          {/* Step 1 : Input */}
          {step === "input" && (
            <div className="space-y-4">
              {/* Source type toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">Format :</span>
                <button
                  onClick={() => setSourceType("text")}
                  data-testid="source-type-text"
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${sourceType === "text" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                >
                  Texte libre
                </button>
                <button
                  onClick={() => setSourceType("csv")}
                  data-testid="source-type-csv"
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${sourceType === "csv" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                >
                  CSV
                </button>
              </div>

              {/* File import */}
              <label
                className="flex items-center gap-2 p-3 border border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 transition text-xs text-blue-700 font-semibold"
                data-testid="quote-file-import-label"
              >
                <Upload className="w-4 h-4" />
                Importer un fichier (CSV ou TXT)
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.pdf"
                  className="hidden"
                  data-testid="quote-file-input"
                  onChange={handleFileImport}
                />
              </label>

              {/* Text area */}
              <textarea
                data-testid="quote-text-input"
                className="w-full min-h-[180px] p-3 border border-gray-200 rounded-xl text-xs font-mono bg-gray-50 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                placeholder={`Collez ici le texte du devis...\n\nExemple :\n${FICTIVE_DEVIS_EXAMPLE}`}
                value={rawInput}
                onChange={e => { setRawInput(e.target.value); setParseError(""); }}
              />

              {/* Help toggle */}
              <button
                onClick={() => setShowHelp(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
              >
                {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Aide — Mots-clés reconnus
              </button>
              {showHelp && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
                  <div>
                    <span className="font-bold text-blue-700">Main-d'œuvre détectée si :</span>
                    <p className="text-gray-600 mt-1">MO, Main d'œuvre, Remplacement, Diagnostic, Contrôle, Entretien, Réparation, Dépose, Repose, Vidange, Programmation, Calibrage, Passage valise, Essai routier, D/P, Peinture, Préparation…</p>
                  </div>
                  <div>
                    <span className="font-bold text-amber-700">Pièces détectées si :</span>
                    <p className="text-gray-600 mt-1">Filtre, Huile, Plaquette, Disque, Bougie, Batterie, Phare, Capteur, Joint, Courroie…</p>
                  </div>
                  <div className="text-gray-500">
                    Les durées sont reconnues sous les formats : 2H, 2.5H, 2,5H, 1H30, 90 min, etc.
                  </div>
                </div>
              )}

              {parseError && (
                <div
                  data-testid="quote-parse-error"
                  className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* Step 2 : Preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-semibold">
                  {preview.laborCount} ligne(s) MO détectée(s)
                </div>
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-semibold">
                  {preview.partCount} pièce(s) détectée(s) — non importées
                </div>
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-semibold">
                  {selectedLaborCount} ligne(s) sélectionnée(s)
                </div>
              </div>

              {/* Notice pièces */}
              {partCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Les lignes pièces sont affichées pour information uniquement. Elles ne seront jamais importées comme tâches atelier.
                </div>
              )}

              {/* Table preview */}
              <div className="overflow-x-auto rounded-xl border border-gray-200" data-testid="quote-preview-table">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 w-8">✓</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Description</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 w-28">Type</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 w-20">Durée (h)</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600 w-20">Confiance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.lines.map(line => {
                      const isLaborOrPaint = line.type === "labor" || line.type === "paint";
                      const currentHours = line.editedHours !== undefined ? line.editedHours : line.hours;
                      return (
                        <tr
                          key={line.id}
                          data-testid={`quote-line-${line.type}`}
                          className={`transition ${line.selected && isLaborOrPaint ? "bg-blue-50/40" : "bg-white"} ${!isLaborOrPaint ? "opacity-60" : ""}`}
                        >
                          {/* Checkbox — seulement pour MO/peinture */}
                          <td className="px-3 py-2">
                            {isLaborOrPaint ? (
                              <input
                                type="checkbox"
                                checked={line.selected}
                                onChange={() => handleToggleLine(line.id)}
                                data-testid={`quote-line-check-${line.id}`}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            ) : (
                              <span className="text-gray-300 text-base">—</span>
                            )}
                          </td>

                          {/* Description */}
                          <td className="px-3 py-2">
                            {isLaborOrPaint && line.selected ? (
                              <input
                                type="text"
                                value={line.editedDescription ?? line.description}
                                onChange={e => handleEditDescription(line.id, e.target.value)}
                                data-testid={`quote-line-desc-${line.id}`}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                              />
                            ) : (
                              <span className="text-gray-700 font-medium">{line.description}</span>
                            )}
                            <span className="block text-[10px] text-gray-400 mt-0.5 truncate max-w-xs">{line.rawText}</span>
                          </td>

                          {/* Type badge */}
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${TYPE_COLOR[line.type] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                              {TYPE_LABEL[line.type] ?? line.type}
                            </span>
                          </td>

                          {/* Durée */}
                          <td className="px-3 py-2">
                            {isLaborOrPaint ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="40"
                                value={currentHours}
                                onChange={e => handleEditHours(line.id, e.target.value)}
                                data-testid={`quote-line-hours-${line.id}`}
                                className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400"
                              />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Confiance */}
                          <td className="px-3 py-2">
                            <span className={`font-semibold ${CONFIDENCE_COLOR[line.confidence]}`}>
                              {CONFIDENCE_LABEL[line.confidence]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="space-y-1">
                  {validationErrors.map((err, i) => (
                    <div key={i} data-testid="quote-validation-error" className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Import confirmé</h3>
                <p className="text-gray-500 text-xs mt-1">Les tâches MO ont été créées dans les ordres de travaux du dossier.</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={step === "preview" ? handleBack : onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            data-testid="quote-import-cancel"
          >
            {step === "preview" ? "Retour" : "Annuler"}
          </button>

          <div className="flex items-center gap-3">
            {step === "input" && (
              <button
                onClick={handleParse}
                data-testid="quote-import-analyze"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                Analyser le devis
              </button>
            )}
            {step === "preview" && (
              <button
                onClick={handleConfirm}
                data-testid="quote-import-confirm"
                disabled={selectedLaborCount === 0}
                className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Confirmer l'import ({selectedLaborCount} tâche{selectedLaborCount > 1 ? "s" : ""})
              </button>
            )}
            {step === "done" && (
              <button
                onClick={onCancel}
                data-testid="quote-import-done"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
