/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-3 — Module pur d'import de devis et extraction main-d'œuvre
 * Migré et adapté depuis l'ancienne application NIMR-SAV (estimate-import.js).
 * Ce module est 100% pur (pas d'état global, pas de localStorage, pas de DOM).
 */

import { QuoteLine, QuoteLineType, QuoteImportPreview, QuoteImportResult, RepairOrderLine } from "./types";

// ───────────────────────────────────────────────────────────────────────────────
// Constantes de classification
// ───────────────────────────────────────────────────────────────────────────────

const LABOR_KEYWORDS_REGEX = /\b(MO|M\.O\.|MAIN[- ]D['']?OEUVRE|MAIN[- ]D['']?ŒUVRE|OPERATION|DIAGNOSTIC|REMPLACEMENT|CONTROLE|CONTRÔLE|ENTRETIEN|REPARATION|RÉPARATION|DEPOSE|DÉPOSE|REPOSE|VIDANGE|PROGRAMMATION|CALIBRAGE|PASSAGE\s+VALISE|ESSAI\s+ROUTIER|D\/P|DRESSAGE|PEINTURE|PREPARATION|PRÉPARATION|FINITION|DEMONTAGE|DÉMONTAGE|REMONTAGE|REMPL|REMP|MECANIQUE|MÉCANIQUE|ELECTRICITE|ÉLECTRICITÉ|DIAGNOSTIC|ALIGNEMENT|GEOMETRIE|GÉOMÉTRIE|SERRAGE|PURGE|GONFLAGE|RODEAGE|RODÉAGE|SOUDURE|AJUSTAGE|POSE)\b/i;

const PART_KEYWORDS_REGEX = /\b(ARTICLE|REFERENCE|RÉFÉRENCE|FILTRE|HUILE|PLAQUETTE|DISQUE|BOUGIE|BATTERIE|PARE[- ]CHOCS|PARECHOCS|PHARE|CAPTEUR|JOINT|COURROIE|AMORTISSEUR|RESSORT|ROULEMENT|ROTULE|BIELLETTE|SILENT[- ]BLOC|SILENTBLOC|PNEUMATIQUE|PNEU|ESSUIE[- ]GLACE|LAMPE|FUSIBLE|RELAIS|SONDE|INJECTEUR|POMPE|VALVE|SEGMENT|CULASSE|JOINT|VIS|BOULON|ECROU|ÉCROU|AGRAFE|CLIP|EMBOUT)\b/i;

const PAINT_SUPPLY_REGEX = /\b(PRODUITS?\s+(?:DE\s+)?PEINTURE|PEINTURE\s+PRODUITS?|FOURNITURES?\s+PEINTURE|MATIERES?\s+PEINTURE|CONSOMMABLES?\s+PEINTURE)\b/i;

const FOOTER_LEGAL_PATTERNS = [
  /\bCE\s+DEVIS\s+RESTE\s+ESTIMATIF\b/i,
  /\bDEVIS\s+COMPLEMENTAIRE\b/i,
  /\bSIGNATURE\s+DU\s+PRESENT\s+DEVIS\b/i,
  /\bLU\s+ET\s+APPROUVE\b/i,
  /\bNOM\s+PRENOM\b/i,
  /\bCACHET\s+ET\s+SIGNATURE\b/i,
  /\bEN\s+CAS\s+D.{0,4}ANNULATION\b/i,
  /\bPAYER\s+LES\s+FRAIS\b/i,
  /\bFRAIS\s+DE\s+DEMONTAGE\b/i,
  /\bSTATIONNEMENT\b/i,
  /\bTOTAL\s+GENERAL\b/i,
];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────────────────

/** Normalise un texte : supprime accents, majuscules, espaces multiples */
export function normalizeOperationText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, " ")
    .replace(/[^a-zA-Z0-9/ .,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isLegalFooterLine(text: string): boolean {
  const norm = normalizeOperationText(text);
  return FOOTER_LEGAL_PATTERNS.some(p => p.test(norm));
}

function isPaintSupplyLine(text: string): boolean {
  return PAINT_SUPPLY_REGEX.test(normalizeOperationText(text));
}

/**
 * Extrait les heures depuis une ligne texte.
 * Formes supportées : 2.5H, 2,5H, 2.5 h, 2,5 heures, 1H30, 1 h 30, 90 min
 * Retourne 0 si non trouvé.
 */
export function extractLaborHours(text: string): number {
  const src = String(text || "").replace(/\u00a0/g, " ").trim();

  // "90 min", "120 min"
  const minMatch = src.match(/(\d+(?:[,.]\d+)?)\s*min(?:utes?)?(?:\b|$)/i);
  if (minMatch) {
    const val = parseFloat(minMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0) return roundHours(val / 60);
  }

  // "1H30", "1 h 30", "1H 30"
  const hmMatch = src.match(/(\d+)\s*[Hh]\s*(\d{1,2})(?:\b|$)/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return roundHours(h + m / 60);
  }

  // "2.5H", "2,5H", "2.5 h", "2,5 heures"
  const hDecMatch = src.match(/(\d+[,.]\d+|\d+)\s*[Hh](?:eures?)?(?:\b|$)/i);
  if (hDecMatch) {
    const val = parseFloat(hDecMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0 && val <= 80) return roundHours(val);
  }

  return 0;
}

function roundHours(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function generateId(prefix: string): string {
  const rand = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Classification d'une ligne
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Classifie un texte de ligne de devis.
 */
export function classifyQuoteLine(text: string): QuoteLineType {
  const norm = normalizeOperationText(text);
  if (!norm || norm.length < 2) return "unknown";
  if (isLegalFooterLine(text)) return "unknown";
  if (isPaintSupplyLine(text)) return "part"; // fournitures peinture → pièce
  if (PAINT_SUPPLY_REGEX.test(norm)) return "paint";
  if (PART_KEYWORDS_REGEX.test(norm) && !LABOR_KEYWORDS_REGEX.test(norm)) return "part";
  if (LABOR_KEYWORDS_REGEX.test(norm)) return "labor";
  // Si des heures sont détectées sans autre classif → labor probable
  const hrs = extractLaborHours(text);
  if (hrs > 0 && hrs <= 80) return "labor";
  return "unknown";
}

/**
 * Normalise et nettoie une ligne source brute.
 */
export function normalizeQuoteLine(rawText: string): string {
  return String(rawText || "")
    .replace(/\s+/g, " ")
    .replace(/[:;–—]+$/, "")
    .trim();
}

/**
 * Calcule le niveau de confiance de classification.
 */
function computeConfidence(text: string, type: QuoteLineType, hours: number): "high" | "medium" | "low" {
  if (type === "unknown") return "low";
  const norm = normalizeOperationText(text);
  if (type === "part" && PART_KEYWORDS_REGEX.test(norm)) return "high";
  if (type === "labor") {
    const hasKeyword = LABOR_KEYWORDS_REGEX.test(norm);
    if (hasKeyword && hours > 0) return "high";
    if (hasKeyword || hours > 0) return "medium";
    return "low";
  }
  return "medium";
}

// ───────────────────────────────────────────────────────────────────────────────
// Parsing
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Parse un texte copié-collé (un bloc de texte libre).
 * Retourne les QuoteLine détectées.
 */
export function parseQuoteText(text: string): QuoteLine[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length > 2);

  return linesToQuoteLines(lines, "text");
}

/**
 * Parse un CSV (séparateur virgule ou point-virgule).
 */
export function parseQuoteCsv(text: string): QuoteLine[] {
  const rows = parseCsvRaw(text);
  // Pour chaque ligne CSV, on reconstruit un texte plat et on classe
  const lineTexts = rows.map(row => row.join(" ").replace(/\s+/g, " ").trim()).filter(l => l.length > 2);
  return linesToQuoteLines(lineTexts, "csv");
}

/** Parse CSV brut en tableau de tableaux */
function parseCsvRaw(text: string): string[][] {
  const separator = text.includes(";") ? ";" : ",";
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.split(separator).map(cell => cell.replace(/^"|"$/g, "").trim()));
}

function linesToQuoteLines(lineTexts: string[], _sourceType: string): QuoteLine[] {
  const seen = new Set<string>();
  const result: QuoteLine[] = [];

  for (const rawLine of lineTexts) {
    const cleaned = normalizeQuoteLine(rawLine);
    if (!cleaned || isLegalFooterLine(cleaned)) continue;

    // Dédup simple
    const key = normalizeOperationText(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);

    const type = classifyQuoteLine(cleaned);
    const hours = type === "labor" || type === "paint" ? extractLaborHours(cleaned) : 0;
    const confidence = computeConfidence(cleaned, type, hours);

    result.push({
      id: generateId("ql"),
      rawText: rawLine,
      description: cleaned,
      type,
      hours,
      confidence,
      selected: type === "labor", // pré-sélection : seulement MO
    });
  }

  return result;
}

// ───────────────────────────────────────────────────────────────────────────────
// Distribution des heures (adapté depuis le legacy distributeLaborHours)
// ───────────────────────────────────────────────────────────────────────────────

export interface LaborDistribution {
  phase: string;
  operation: string;
  laborHours: number;
}

export function distributeLaborHours(description: string, hours: number): LaborDistribution[] {
  const norm = normalizeOperationText(description);

  // Carrosserie : D/P
  if (/\bD\s*\/\s*P\s+ET\s+PREPARAT(ION|IN)?\b/.test(norm)) {
    const half = roundHours(hours / 2);
    return [
      { phase: "body", operation: `D/P ${description}`, laborHours: half },
      { phase: "reassembly", operation: `REMONTAGE ${description}`, laborHours: roundHours(hours - half) },
    ];
  }
  if (/\bPEINTURE\s+ET\s+F(I)?NITION\b/.test(norm)) {
    const half = roundHours(hours / 2);
    return [
      { phase: "prep", operation: `PREPARATION ${description}`, laborHours: half },
      { phase: "paint", operation: `PEINTURE ${description}`, laborHours: roundHours(hours - half) },
    ];
  }
  if (/\bDRESSAGE\b/.test(norm)) {
    const third = roundHours(hours / 3);
    return [
      { phase: "body", operation: `DRESSAGE ${description}`, laborHours: third },
      { phase: "prep", operation: `PREPARATION ${description}`, laborHours: third },
      { phase: "paint", operation: `PEINTURE ${description}`, laborHours: roundHours(hours - 2 * third) },
    ];
  }
  if (/\b(VIDANGE|ENTRETIEN\s+RAPIDE|FILTRE)\b/.test(norm)) return [{ phase: "oilService", operation: description, laborHours: hours }];
  if (/\b(DIAGNOSTIC|ELECTRICITE|ELECTRICITÉ|ELECTRIQUE|ALTERNATEUR|DEMARREUR|BATTERIE|CAPTEUR)\b/.test(norm)) return [{ phase: "electrical", operation: description, laborHours: hours }];
  if (/\b(MOTEUR|MECANIQUE|EMBRAYAGE|FREIN|SUSPENSION|DISTRIBUTION|BOITE)\b/.test(norm)) return [{ phase: "mechanical", operation: description, laborHours: hours }];
  if (/\bPEINTURE\b/.test(norm)) return [{ phase: "paint", operation: description, laborHours: hours }];
  if (/\bPREPARATION\b/.test(norm)) return [{ phase: "prep", operation: description, laborHours: hours }];
  if (/\bFINITION\b/.test(norm)) return [{ phase: "finish", operation: description, laborHours: hours }];
  if (/\b(DEMONTAGE|DEPOSE|D\/P)\b/.test(norm)) return [{ phase: "body", operation: description, laborHours: hours }];
  if (/\b(REMONTAGE|REPOSE|REMPLACEMENT|REMP|REMPL)\b/.test(norm)) return [{ phase: "reassembly", operation: description, laborHours: hours }];
  if (/\bREPARATION\b/.test(norm)) return [{ phase: "body", operation: description, laborHours: hours }];
  // fallback
  return [{ phase: "general", operation: description, laborHours: hours }];
}

// ───────────────────────────────────────────────────────────────────────────────
// Preview et application
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Construit la prévisualisation (avant confirmation utilisateur).
 * Les lignes ne sont PAS encore appliquées au dossier.
 */
export function buildQuoteImportPreview(
  lines: QuoteLine[],
  options: { sourceType?: "text" | "csv" | "xlsx"; fileName?: string } = {}
): QuoteImportPreview {
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");
  const totalDetectedHours = laborLines.reduce((sum, l) => sum + l.hours, 0);

  return {
    importId: generateId("qimport"),
    sourceType: options.sourceType ?? "text",
    fileName: options.fileName,
    lines,
    laborCount: laborLines.length,
    partCount: partLines.length,
    totalDetectedHours: roundHours(totalDetectedHours),
  };
}

/**
 * Valide la preview avant application.
 * Retourne un tableau de messages d'erreur (vide = OK).
 */
export function validateQuoteImportPreview(preview: QuoteImportPreview): string[] {
  const errors: string[] = [];
  const selectedLabor = preview.lines.filter(l => l.selected && l.type === "labor");
  if (selectedLabor.length === 0) {
    errors.push("Aucune ligne de main-d'œuvre sélectionnée à importer.");
  }
  for (const line of selectedLabor) {
    const hrs = line.editedHours !== undefined ? line.editedHours : line.hours;
    if (hrs <= 0) {
      errors.push(`La ligne "${line.description}" a une durée à 0. Corrigez la durée avant d'importer.`);
    }
  }
  return errors;
}

/**
 * Mappe les lignes MO sélectionnées vers des RepairOrderLine.
 * À appeler UNIQUEMENT après confirmation utilisateur.
 * Les lignes obtenues ont estimateSource = "quote-import" et isEstimatedDurationValidated = true.
 */
export function mapLaborLinesToRepairOrderLines(
  preview: QuoteImportPreview
): RepairOrderLine[] {
  const importId = preview.importId;
  return preview.lines
    .filter(l => l.selected && (l.type === "labor" || l.type === "paint"))
    .map((line): RepairOrderLine => {
      const hours = line.editedHours !== undefined ? line.editedHours : line.hours;
      const description = line.editedDescription?.trim() || line.description;
      return {
        id: generateId("ro_quote"),
        designation: description,
        tempsEstime: hours > 0 ? hours : 1,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "quote-import",
        isEstimatedDurationValidated: true, // validé après confirmation utilisateur
        quoteImportId: importId,
        quoteLineRef: line.id,
      };
    });
}

/**
 * Génère l'entrée d'historique après application.
 */
export function buildQuoteImportHistoryEntry(preview: QuoteImportPreview): string {
  const selectedLabor = preview.lines.filter(l => l.selected && l.type === "labor");
  const parts = preview.lines.filter(l => l.type === "part");
  const totalHours = roundHours(selectedLabor.reduce((s, l) => s + (l.editedHours ?? l.hours), 0));
  const fileName = preview.fileName ? ` depuis ${preview.fileName}` : "";
  return `Import devis${fileName} : ${selectedLabor.length} ligne(s) MO importée(s) (${totalHours}h), ${parts.length} pièce(s) détectée(s) non importées comme tâches.`;
}

/**
 * Construit le QuoteImportResult complet après confirmation.
 */
export function applyQuoteImportPreview(preview: QuoteImportPreview): QuoteImportResult {
  const importedLines = mapLaborLinesToRepairOrderLines(preview);
  const parts = preview.lines.filter(l => l.type === "part");
  const totalHours = roundHours(importedLines.reduce((s, l) => s + l.tempsEstime, 0));
  return {
    importId: preview.importId,
    importedLines,
    laborLinesCount: importedLines.length,
    partLinesCount: parts.length,
    totalHours,
    historyEntry: buildQuoteImportHistoryEntry(preview),
  };
}
