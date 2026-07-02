/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-3 — Module pur d'import de devis et extraction main-d'œuvre
 * Migré et adapté depuis l'ancienne application NIMR-SAV (estimate-import.js et planning.js).
 * Ce module est 100% pur (pas d'état global, pas de localStorage, pas de DOM).
 */

import { QuoteLine, QuoteLineType, QuoteImportPreview, QuoteImportResult, RepairOrderLine, DossierSAV } from "./types";
import {
  OLD_APP_PHASE_TO_PRO_STAGE,
  buildOldAppAppliedEstimateLines,
  distributeOldAppLaborHours,
  getOldAppDefaultLaborAllocations,
  getOldAppPhaseLabel,
  normalizeOldAppOriginalLaborLine,
  optimizeOldAppEstimateAllocationsFromOriginalLines,
  OldAppOriginalLaborLine,
} from "./core/old-app-quote-rules";

export function isQualityControlLine(desc: string | undefined): boolean {
  const norm = String(desc || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    norm.includes("controle qualite") ||
    norm.includes("qualite forfaitaire") ||
    norm.includes("qc forfaitaire") ||
    /\bqc\b/.test(norm)
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Constantes de classification
// ───────────────────────────────────────────────────────────────────────────────

const ESTIMATE_LABOR_HOURLY_RATES = [33, 35];
const ESTIMATE_LABOR_MAX_HOURS = 80;

// ───────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────────────────

export function normalizeEstimateOperationText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Normalise un texte : supprime accents, majuscules, espaces multiples */
export function normalizeOperationText(text: string): string {
  return normalizeEstimateOperationText(text);
}

export function isEstimateLegalOrFooterLine(normalized: string): boolean {
  const text = String(normalized || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const legalPatterns = [
    /\bCE\s+DEVIS\s+RESTE\s+ESTIMATIF\b/,
    /\bDEVIS\s+COMPLEMENTAIRE\b/,
    /\bCONFIRMATION\s+DE\s+LA\s+PART\s+DU\s+CLIENT\b/,
    /\bSIGNATURE\s+DU\s+PRESENT\s+DEVIS\b/,
    /\bENGAGEMENT\s+DES\s+TRAVAUX\b/,
    /\bEN\s+CAS\s+D\s+ANNULATION\s+DES\s+TRAVAUX\b/,
    /\bCLIENT\s+EST\s+OBLIGE\b/,
    /\bSUPERSTRUCTURE\s+DE\s+CHARGE\b/,
    /\bPNEUMATIQUES\b/,
    /\bBATTERIES\b/,
    /\bPAYER\s+LES\s+FRAIS\b/,
    /\bFRAIS\s+DE\s+DEMONTAGE\b/,
    /\bFRAIS\s+D\s+ETABLISSEMENT\s+DU\s+DEVIS\b/,
    /\bRECUPERER\s+LE\s+VEHICULE\b/,
    /\b48\s*H\b/,
    /\bSTATIONNEMENT\b/,
    /\b30\s*DT\b/,
    /\bSAUF\s+VENTE\s+ENTRE\s+TEMPS\b/,
    /\bVALABLE\s+SEPT\s+7\s+JOURS\b/,
    /\bLU\s+ET\s+APPROUVE\b/,
    /\bNOM\s+PRENOM\b/,
    /\bIDENTIFIANT\s+CIN\b/,
    /\bCACHET\s+ET\s+SIGNATURE\b/,
  ];
  return legalPatterns.some((pattern) => pattern.test(text));
}

export function isPaintSupplyLine(normalized: string): boolean {
  return /\b(PRODUITS?|FOURNITURES?|MATIERES?|MATERIEL|CONSOMMABLES?|PRODUT)\s+(?:DE\s+)?PEINTURE\b/.test(normalized)
    || /\bPEINTURE\s+(?:PRODUITS?|FOURNITURES?|MATIERES?|MATERIEL|CONSOMMABLES?)\b/.test(normalized)
    || /\bMO-002067\b/.test(normalized);
}

/**
 * Détecte les lignes administratives (en-tête, pied de page, infos client/véhicule/OR).
 * Ces lignes ne doivent jamais être importées comme main-d'œuvre.
 * NOTE : Le texte reçu peut être déjà normalisé par normalizeEstimateOperationText
 *        (accents retirés, symboles spéciaux → espace, MAJUSCULES).
 *        Les patterns doivent donc fonctionner avec OU sans symboles spéciaux (ex. ° devient espace).
 */
export function isAdministrativeQuoteLine(normalized: string): boolean {
  const text = String(normalized || "").trim();
  if (!text) return false;

  // Patterns vehicule / marque / société connus
  const adminPatterns: RegExp[] = [
    /\bCLT[-\s]?\d/,                                // CLT-0018, CLT 0018
    /\bCLT\b/,                                       // CLT seul (entête client)
    /\b(DFM|DFSK|DONGFENG)\b/,                      // Marque constructeur
    /\bCOMET\b/,                                     // Concession COMET
    /\bLUXURY\b/,                                    // LUXURY
    /\bFULL\s+OPTION\b/,                             // Full option
    /^(ESSENCE|ELECTRIQUE|HYBRIDE|DIESEL)$/,         // Motorisation seule
    // N° DEVIS / N° OR / N° IMMAT : le ° peut être remplacé par espace ou absent
    /\bN\s*[°º]?\s*(DEVIS|OR|MOTEUR|IMMAT)\b/i,     // N° Devis, N° OR, N Devis, N OR
    /\bVIN\b/,                                       // VIN
    /\bCHASSIS\b/,                                   // N° châssis
    /\bDATE\s+DEVIS\b/i,
    /\bRECEPTIONNAIRE\b/,
    /\bCREE\s+PAR\b/i,
    /\bCONSEILLER\s+(DE\s+VENTE|CLIENT|COMMERCIAL)/i,
    /\bMARQUE\s+DESCRIPTION\s+MODELE\b/i,           // En-tête tableau véhicule
    /\bKILOMETRAGE\b/,
    /\bLIMITE\s+COMMANDE\b/,
    /\bPREM\b.*\bIMMAT\b/,                           // Prem. Immat.
    /\bCODE\s+MOTEUR\b/,
    /\bTYPE\s+MAIN\b/i,                              // Type main-d'oeuvre
    /\bCODE\s+MODELE\b/,
    /\bIDENTIFIANT\s+(FISCAL|CIN)\b/i,
    /\bTEL\b|\bFAX\b/,
    /\bREPORT\b/,                                    // Report / Montant à reporter
    /\bMONTANT\s+A\s+REPORTER\b/,
    /\bDEVIS\s+ESTIMATIF\s+ATELIER\b/,
    /\bPAGE\s+\d+/,
    /\bTOTAL\s*(DT|TTC|HT)?\b/,                     // Totaux
    /\bTVA\b/,
    /\bTIMBRE\b/,
  ];

  return adminPatterns.some((p) => p.test(text));
}

export function endsWithThreeColumns(line: string): boolean {
  const matches = getEstimateNumberMatches(line);
  if (matches.length < 3) return false;
  const lastThree = matches.slice(-3);
  const firstOfLastThree = lastThree[0];
  const tail = line.slice(firstOfLastThree.index);
  return /^[0-9\s,.\u00a0]+$/.test(tail);
}

export function mergeMultiLineQuoteRows(lines: string[]): string[] {
  const result: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const normalized = normalizeEstimateOperationText(trimmed);
    if (isAdministrativeQuoteLine(normalized) || isEstimateLegalOrFooterLine(normalized)) {
      if (buffer.length > 0) {
        result.push(buffer.join(" "));
        buffer = [];
      }
      result.push(trimmed);
      continue;
    }

    buffer.push(trimmed);
    const joined = buffer.join(" ");

    if (endsWithThreeColumns(joined)) {
      result.push(joined);
      buffer = [];
    }
  }

  // If there's any leftover in buffer, flush it
  if (buffer.length > 0) {
    result.push(buffer.join(" "));
  }

  return result;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  return extractPdfTextFallback(buffer);
}

export async function extractPdfTextFallback(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [raw];
  const streamRegex = /stream\r?\n/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dictionary = raw.slice(Math.max(0, match.index - 1200), match.index);
    const streamBytes = bytes.slice(start, raw[end - 1] === "\r" || raw[end - 1] === "\n" ? end - 1 : end);
    if (/\/FlateDecode\b/.test(dictionary) && typeof globalThis.DecompressionStream !== "undefined") {
      const inflated = await inflatePdfStream(streamBytes).catch(() => "");
      if (inflated) chunks.push(inflated);
    } else {
      chunks.push(new TextDecoder("latin1").decode(streamBytes));
    }
  }
  const decoded = decodePdfTextFragments(chunks.join("\n"));
  return decoded;
}

async function inflatePdfStream(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.DecompressionStream === "undefined") {
    return "";
  }
  for (const mode of ["deflate", "deflate-raw"] as const) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new globalThis.DecompressionStream(mode));
      const arrayBuffer = await new Response(stream).arrayBuffer();
      return new TextDecoder("latin1").decode(new Uint8Array(arrayBuffer));
    } catch (error) {
      // Try next decompression flavor
    }
  }
  return "";
}

export function decodePdfTextFragments(text: string): string {
  const pieces: string[] = [];
  
  // Literal strings like (some text)
  const literalMatches = [...text.matchAll(/\((?:\\.|[^\\)])*\)/g)];
  for (const match of literalMatches) {
    const decoded = decodePdfLiteral(match[0].slice(1, -1));
    if (decoded.trim().length > 1) pieces.push(decoded);
  }
  
  // Hex strings like <0A1B2C>
  const hexMatches = [...text.matchAll(/<([0-9A-Fa-f\s]{4,})>/g)];
  for (const match of hexMatches) {
    const decoded = decodePdfHex(match[1]);
    if (decoded.trim().length > 1) pieces.push(decoded);
  }
  
  const fallback = text
    .replace(/[^\x20-\x7EÀ-ÿ\r\n]/g, " ")
    .replace(/\s+/g, " ");
  return [...pieces, fallback].join("\n").replace(/\s+\n/g, "\n");
}

export function decodePdfHex(value: string): string {
  const hex = value.replace(/\s/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < hex.length - 1; index += 2) {
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  }
  return new TextDecoder("latin1").decode(new Uint8Array(bytes));
}

export function isUsableEstimatePdfText(text: string): boolean {
  const normalized = normalizeEstimateOperationText(text);
  return /\b(CLIENT|DEVIS|D\s*\/\s*P|PEINTURE|DRESSAGE|REMPLACEMENT|REMP|IMMATRICULATION|VIN|VEHICULE)\b/.test(normalized);
}

/**
 * Délimite les zones tableau du devis dans un texte brut (supporte multi-pages).
 * Retourne uniquement les lignes incluses entre les en-têtes de tableau et les lignes de fin de tableau.
 * Plusieurs segments peuvent exister (PDF multi-pages).
 */
export function extractTableZoneLines(rawLines: string[]): string[] {
  // Marqueurs de début de tableau (insensible à la casse, après normalisation)
  const isTableHeader = (line: string): boolean => {
    const n = normalizeEstimateOperationText(line);
    return /^(?:NO\s+)?DESIGNATION\b/.test(n);
  };

  // Marqueurs de fin de tableau (arrête le segment courant)
  const isTableFooter = (line: string): boolean => {
    const n = normalizeEstimateOperationText(line);
    return (
      /^TOTAL\b/.test(n) ||                         // Total DT, Total TTC, Total DT 153,000
      /^TVA\b/.test(n) ||
      /^TIMBRE\b/.test(n) ||
      /^CACHET\s+ET\s+SIGNATURE\b/.test(n) ||
      /^NOM\s+PRENOM\b/.test(n) ||
      /^DEVIS\s+ESTIMATIF\s+ATELIER\b/.test(n) ||
      /^MARQUE\s+DESCRIPTION\s+MODELE\b/.test(n) ||
      /^N\s*[°º]?\s*IMMAT\b/.test(n) ||            // N° Immat. ou N IMMAT (normalisé)
      /^VIN\b/.test(n) ||
      /^CLT[-\s]?\d/.test(n) ||
      /^COMET\b/.test(n) ||
      /^N\s*[°º]?\s*(DEVIS|OR)\b/.test(n)          // N° Devis, N° OR, N DEVIS, N OR (normalisé)
    );
  };

  // Si aucun header trouvé, retourner toutes les lignes (format texte libre sans tableau)
  const hasAnyHeader = rawLines.some(isTableHeader);
  if (!hasAnyHeader) return rawLines;

  const result: string[] = [];
  let inTable = false;

  for (const line of rawLines) {
    if (isTableHeader(line)) {
      inTable = true;
      continue; // Skip the header line itself
    }
    if (inTable && isTableFooter(line)) {
      inTable = false;
      // Don't break — a new header can re-open a new segment (multi-page)
      continue;
    }
    if (inTable) {
      result.push(line);
    }
  }

  return result;
}


/**
 * Nettoie la description d'une ligne de main-d'œuvre tabulaire.
 * Retire les colonnes numériques (qté, prix unitaire, montant) de la fin de la ligne.
 * Normalise les abréviations courantes (remp → Remplacement, etc.).
 * Supprime le préfixe "MO-TOL" s'il existe.
 */
export function cleanLaborDescription(line: string): string {
  let text = String(line || "").replace(/\s+/g, " ").trim();

  // 1. Supprimer préfixe MO-TOL (avec ou sans tiret/espace)
  text = text.replace(/^MO[-\s]TOL\s*/i, "");

  // 2. Retirer les colonnes numériques finales (montant, puis prix unitaire, puis quantité)
  //    Format : " 35,000 87,500" ou " 2,5 35,000 87,500"
  //    On retire jusqu'à 3 colonnes numériques depuis la droite
  const numPattern = /\s+\d[\d\s]*(?:[,.][\d]+)?(?:\s+\d[\d\s]*(?:[,.][\d]+)?)?(?:\s+\d[\d\s]*(?:[,.][\d]+)?)?$/;
  text = text.replace(numPattern, "").trim();

  // 3. Normaliser les abréviations (en français lisible)
  const abbreviations: [RegExp, string][] = [
    [/^REMP(?:L(?:ACEMENT)?)?\s+/i, "Remplacement "],
    [/^CHANG(?:EMENT)?\s+/i, "Changement "],
    [/^ENTRETIEN\b/i, "Entretien"],
    [/^D\/P\s+ET\s+PREPARAT(?:ION|IN)\s*/i, "D/P et préparation "],
    [/^D\/P\s*/i, "D/P "],
    [/^PEINTURE\s+ET\s+F(?:I)?NITION\s*/i, "Peinture et finition "],
    [/^DRESSAGE\s+ET\s+PEINTURE\s*/i, "Dressage et peinture "],
    [/^DRESSAGE\s*/i, "Dressage "],
    [/^PREPARAT(?:ION|IN)\s*/i, "Préparation "],
    [/^PEINTURE\s+(?!ET\s+)/i, "Peinture "],
    [/^F(?:I)?NITION\s*/i, "Finition "],
    [/^DEPOSE\s*/i, "Dépose "],
    [/^REPOSE\s*/i, "Repose "],
    [/^VIDANGE\s*/i, "Vidange "],
    [/^CONTROLE\s*/i, "Contrôle "],
    [/^DIAGNOSTIC\s*/i, "Diagnostic "],
  ];

  // Try each abbreviation in order
  let replaced = false;
  for (const [pattern, replacement] of abbreviations) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      replaced = true;
      break;
    }
  }

  // 4. Si aucune abréviation reconnue, garder le texte brut mais capitaliser
  text = text.trim();
  if (!text) return "";

  // Capitalise première lettre
  return text.charAt(0).toUpperCase() + text.slice(1);
}



export function isEstimateLaborHourlyRate(value: number): boolean {
  return ESTIMATE_LABOR_HOURLY_RATES.some((rate) => Math.abs(Number(value || 0) - rate) < 0.01);
}

export function parseEstimateNumber(value: any): number {
  let normalized = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!normalized) return 0;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  normalized = normalized.replace(/\s/g, "");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface EstimateNumberMatch {
  raw: string;
  index: number;
  hours: number;
  embeddedInWord: boolean;
}

export function getBaseMatches(line: string): EstimateNumberMatch[] {
  const source = String(line || "");
  const matches: EstimateNumberMatch[] = [];
  const regex = /\d+(?:[,.]\d+)?/g;
  let m;
  while ((m = regex.exec(source)) !== null) {
    const index = m.index;
    const before = source[index - 1] || "";
    const after = source[index + m[0].length] || "";
    const embeddedInWord = /[A-Za-zÀ-ÿ]/.test(before) || /[A-Za-zÀ-ÿ]/.test(after);
    if (!embeddedInWord) {
      matches.push({
        raw: m[0],
        index,
        hours: parseEstimateNumber(m[0]),
        embeddedInWord: false,
      });
    }
  }
  return matches;
}

export function getEstimateNumberMatches(line: string): EstimateNumberMatch[] {
  const base = getBaseMatches(line);
  
  // Try to merge adjacent matches that look like thousands separator (e.g. "1" and "193,576" separated by a single space)
  const merged: EstimateNumberMatch[] = [];
  let i = 0;
  while (i < base.length) {
    const current = base[i];
    const next = base[i + 1];
    if (next) {
      const spaceBetween = line.slice(current.index + current.raw.length, next.index);
      const isSingleSpace = spaceBetween === " " || spaceBetween === "\u00a0";
      const nextStartsThreeDigits = /^\d{3}\b/.test(next.raw);
      if (isSingleSpace && nextStartsThreeDigits && current.hours < 1000) {
        const raw = line.slice(current.index, next.index + next.raw.length);
        merged.push({
          raw,
          index: current.index,
          hours: parseEstimateNumber(raw),
          embeddedInWord: false,
        });
        i += 2;
        continue;
      }
    }
    merged.push(current);
    i++;
  }
  
  const checkValidation = (list: EstimateNumberMatch[]) => {
    if (list.length < 3) return false;
    const last3 = list.slice(-3);
    const qty = last3[0].hours;
    const price = last3[1].hours;
    const amount = last3[2].hours;
    return Math.abs(qty * price - amount) < 1.0;
  };
  
  const mergedValid = checkValidation(merged);
  const baseValid = checkValidation(base);
  
  if (mergedValid) return merged; // Prefer merged if Candidate B is mathematically valid
  if (baseValid) return base;
  
  // Fallback: prefer merged if it has at least 3 matches, otherwise base
  return merged.length >= 3 ? merged : base;
}

export interface EstimatePricingInfo {
  matches: EstimateNumberMatch[];
  hasNumericTable: boolean;
  hasLaborHourlyRate: boolean;
  hourlyRate: number;
  hoursInfo: EstimateNumberMatch | null;
}

export function extractEstimatePricingInfo(line: string): EstimatePricingInfo {
  const source = String(line || "");
  const matches = getEstimateNumberMatches(source);
  const result: EstimatePricingInfo = {
    matches,
    hasNumericTable: matches.length >= 3,
    hasLaborHourlyRate: false,
    hourlyRate: 0,
    hoursInfo: null,
  };
  for (let index = 1; index < matches.length; index += 1) {
    if (index === matches.length - 1 && matches.length >= 3) {
      continue;
    }
    const current = matches[index];
    const previous = matches[index - 1];
    if (isEstimateLaborHourlyRate(current.hours) && previous.hours >= 0 && previous.hours <= ESTIMATE_LABOR_MAX_HOURS) {
      result.hasLaborHourlyRate = true;
      result.hourlyRate = current.hours;
      result.hoursInfo = previous;
      return result;
    }
  }
  return result;
}

export function extractLaborHours(line: string): number {
  const src = String(line || "").replace(/\u00a0/g, " ").trim();
  const normalized = normalizeEstimateOperationText(line);

  // If it's a part and has no labor keyword, and no confirmed labor rate, we shouldn't extract hours from it.
  const isPieceKeyword = /\b(ART\w*|FILTRE|HUILE|RONDELLE|BOUGIE|PARE[- ]CHOCS?|AILE|PORTE|CAPTEUR|JOINT|COURROIE|AGRAFE|SUPPORT|PHARE|FEU|LIQUIDE|MOUSSE|RENFORT|EMBLEME|MONOGRAMME|BOUCHON|COLLIER|TUBE|KIT)\b/.test(normalized);
  const pricingInfo = extractEstimatePricingInfo(line);

  if (isPieceKeyword && !hasLaborActionVerb(normalized)) {
    return 0;
  }

  // 1. Check for explicit suffix hours first
  // "90 min", "120 min"
  const minMatch = src.match(/(\d+(?:[,.]\d+)?)\s*min(?:utes?)?(?:\b|$)/i);
  if (minMatch) {
    const val = parseFloat(minMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0) return roundPlanningHours(val / 60);
  }

  // "1H30", "1 h 30", "1H 30"
  const hmMatch = src.match(/(\d+)\s*[Hh]\s*(\d{1,2})(?:\b|$)/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return roundPlanningHours(h + m / 60);
  }

  // "2.5H", "2,5H", "2.5 h", "2,5 heures"
  const hDecMatch = src.match(/(\d+[,.]\d+|\d+)\s*[Hh](?:eures?)?(?:\b|$)/i);
  if (hDecMatch) {
    const val = parseFloat(hDecMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0 && val <= ESTIMATE_LABOR_MAX_HOURS) return roundPlanningHours(val);
  }

  // 2. Fallback to legacy pricing-table and token-based extraction
  if (pricingInfo.hoursInfo) return pricingInfo.hoursInfo.hours;

  const matches = getEstimateNumberMatches(line);
  if (!matches.length) return 0;

  // Fallback réservé aux saisies manuelles / CSV sans prix unitaire.
  const found = matches.find((match) => match.hours > 0 && match.hours <= 40);
  return found ? found.hours : 0;
}

export function sanitizeEstimateOperation(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[:;\-]+$/g, "")
    .trim();
}

export function removeKnownOperationPrefix(operation: string): string {
  const withoutPrefix = String(operation || "")
    .replace(/^\s*D\s*\/\s*P\s+ET\s+PREPARAT(?:ION|IN)\s*/i, "")
    .replace(/^\s*PEINTURE\s+ET\s+F(?:I)?NITION\s*/i, "")
    .replace(/^\s*DRESSAGE\s+ET\s+PEINTURE\s*/i, "")
    .trim();
  return withoutPrefix || operation;
}

export function roundPlanningHours(value: number): number {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

export function splitPlanningHours(total: number, weights: number[]): number[] {
  const rounded: number[] = [];
  let consumed = 0;
  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      rounded.push(roundPlanningHours(total - consumed));
      return;
    }
    const value = roundPlanningHours(total * weight);
    rounded.push(value);
    consumed += value;
  });
  return rounded;
}

export function hasLaborKeyword(normalized: string): boolean {
  return /\b(D\s*\/\s*P|CHANG(?:EMENT)?|DEPOSE|POSE|REPOSE|DEMONTAGE|REMONTAGE|PREPARAT(?:ION|IN)|PEINTURE|F(?:I)?NITION|DRESSAGE|MARBRE|REMPLACEMENT|REMPL|REMP|REPARATION|CONTROLE|DIAGNOSTIC|AIRBAGS?|BOITE|VITESSE|VIDANGE|ENTRETIEN|ELECTRIQUE|ELECTRICITE|MECANIQUE|MECAN|EMBRAYAGE|FREIN|SUSPENSION|DISTRIBUTION|MOTEUR)\b/.test(normalized);
}

export function hasLaborActionVerb(normalized: string): boolean {
  return /\b(D\s*\/\s*P|CHANG(?:EMENT)?|DEPOSE|POSE|REPOSE|DEMONTAGE|REMONTAGE|PREPARAT(?:ION|IN)|PEINTURE|F(?:I)?NITION|DRESSAGE|MARBRE|REMPLACEMENT|REMPL|REMP|REPARATION|CONTROLE|DIAGNOSTIC|VIDANGE|ENTRETIEN|MO[- ]TOL)\b/.test(normalized);
}

export interface LegacyLaborClassificationResult {
  type: "ignored" | "labor";
  reason?: string;
  text: string;
  operation: string;
  hours: number;
  distributions: LaborDistribution[];
}

export function classifyLaborLine(line: string, options: any = {}): LegacyLaborClassificationResult | null {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 3) return null;
  const normalized = normalizeEstimateOperationText(text);

  // 1. Ignorer les lignes administratives : Total, TVA, Timbre, Signature, conditions générales, client, VIN, immatriculation, N° devis, N° OR, etc.
  if (isEstimateLegalOrFooterLine(normalized)) {
    return { type: "ignored", reason: "Note client ou pied de page ignoré", text, operation: "", hours: 0, distributions: [] };
  }
  if (/\b(DESIGNATION|QTE|PRIX\s+UNITAIRE|MONTANT|TOTAL|TVA|TIMBRE|DEVIS|RECEPTIONNAIRE|PAGE|CODE\s+MOTEUR|TYPE\s+MAIN|N\s*OR|N\s*DEVIS|CLIENT|VIN|IMMATRICULATION|TELEPHONE|CONSEILLER|DATE)\b/.test(normalized)) {
    return { type: "ignored", reason: "Ligne d'en-tête, administrative ou totale", text, operation: "", hours: 0, distributions: [] };
  }

  // 2. Produit peinture : paint/part, jamais labor
  if (isPaintSupplyLine(normalized)) {
    return { type: "ignored", reason: "Produit de peinture ou consommable ignoré comme main-d'œuvre", text, operation: "", hours: 0, distributions: [] };
  }

  const pricingInfo = extractEstimatePricingInfo(text);
  const isConfirmedLabor = pricingInfo.hasLaborHourlyRate;

  // Pièces / articles keywords:
  const isPieceKeyword = /\b(ART\w*|FILTRE|HUILE|RONDELLE|BOUGIE|PARE[- ]CHOCS?|AILE|PORTE|CAPTEUR|JOINT|COURROIE|AGRAFE|SUPPORT|PHARE|FEU|LIQUIDE|MOUSSE|RENFORT|EMBLEME|MONOGRAMME|BOUCHON|COLLIER|TUBE|KIT)\b/.test(normalized);

  const isFiltreOrHuileLabor = isConfirmedLabor && /\b(FILTRE|HUILE)\b/.test(normalized) && hasLaborActionVerb(normalized);
  const isSuffixLabor = extractLaborHours(text) > 0 && hasLaborActionVerb(normalized);
  const laborException = isFiltreOrHuileLabor || isSuffixLabor || /\b(REMP|REMPL|REMPLACEMENT)\s+FEU\b/.test(normalized) || /\b(CHANG(?:EMENT)?|REMP|REMPL)\b/.test(normalized);

  const hardIgnored = [
    "FOURNITURE",
    "AGRAFE",
    "EMBLEME",
    "MONOGRAMME",
    "HUILE",
    "FILTRE",
    "LIQUIDE",
    "MOUSSE",
    "RENFORT",
    "SUPPORT",
    "FEU ARRIERE",
    "PARE CHOCS COMPLET",
    "TOTAL",
    "TVA",
    "TIMBRE",
  ].some((keyword) => normalized.includes(keyword));

  if (hardIgnored && !laborException) {
    return { type: "ignored", reason: "Pièce, fourniture ou total ignoré", text, operation: "", hours: 0, distributions: [] };
  }

  // Si c'est un mot-clé de pièce et qu'on n'a pas de tarif horaire MO, c'est une pièce !
  if (isPieceKeyword && !isConfirmedLabor) {
    return null; // deviendra "part"
  }

  if (pricingInfo.hasNumericTable && !pricingInfo.hasLaborHourlyRate) {
    return hasLaborKeyword(normalized) ? { type: "ignored", reason: "Prix unitaire non MO", text, operation: "", hours: 0, distributions: [] } : null;
  }

  // Main-d'œuvre explicite ou implicite
  const isMoTol = /\bMO[- ]TOL\b/.test(normalized);
  const isImplicitLaborKw = /\b(ENTRETIEN|REMP|VIDANGE|DEPOSE|REPOSE|PEINTURE|FINITION|DRESSAGE|CHANG|D\/P|PREPARATION)\b/.test(normalized);

  const hoursInfo = pricingInfo.hoursInfo || getEstimateNumberMatches(text).find((match) => match.hours > 0 && match.hours <= 40);
  if (!hoursInfo || hoursInfo.hours <= 0) {
    if (isMoTol || isImplicitLaborKw) {
      const operation = sanitizeEstimateOperation(text);
      return {
        type: "labor",
        text,
        operation,
        hours: 0,
        distributions: [{ phase: "body", operation, laborHours: 0 }]
      };
    }
    return hasLaborKeyword(normalized) ? { type: "ignored", reason: "Quantité MO introuvable", text, operation: "", hours: 0, distributions: [] } : null;
  }

  // Pour les devis tabulaires, si un tableau numérique est détecté mais sans taux horaire validé, et que ce n'est pas MO-TOL, on l'exclut.
  if (pricingInfo.hasNumericTable && !isConfirmedLabor && !isMoTol) {
    return null;
  }

  const operation = sanitizeEstimateOperation(text.slice(0, hoursInfo.index) || text);
  let distributions = distributeLaborHours(operation, hoursInfo.hours, options);
  if (!distributions.length) {
    if (isConfirmedLabor || isMoTol || isImplicitLaborKw) {
      const defaultPhase = options.claimType === "vidange" || /\b(VIDANGE|ENTRETIEN|FILTRE)\b/.test(normalized)
        ? "oilService"
        : options.claimType === "electrical_client"
        ? "electrical"
        : options.claimType === "mechanical_client"
        ? "mechanical"
        : "body";
      distributions = [{ phase: defaultPhase, operation: sanitizeEstimateOperation(operation), laborHours: roundPlanningHours(hoursInfo.hours) }];
    } else {
      return hasLaborKeyword(normalized) ? { type: "ignored", reason: "Phase planning non reconnue", text, operation: "", hours: 0, distributions: [] } : null;
    }
  }

  return {
    type: "labor",
    text,
    operation,
    hours: roundPlanningHours(hoursInfo.hours),
    distributions,
  };
}

export function classifyEstimatePartLine(line: string): any {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 3) return null;
  const normalized = normalizeEstimateOperationText(text);
  if (isEstimateLegalOrFooterLine(normalized)) return null;
  if (/\b(TOTAL|TVA|TIMBRE|DEVIS|RECEPTIONNAIRE|PAGE|CODE\s+MOTEUR|TYPE\s+MAIN|N\s*OR|N\s*DEVIS)\b/.test(normalized)) return null;
  
  const labor = classifyLaborLine(text);
  if (labor?.type === "labor") return null;

  // Let's identify pieces/articles based on numbers
  const pricingInfo = extractEstimatePricingInfo(text);
  if (!pricingInfo.matches.length) return null;
  if (pricingInfo.hasLaborHourlyRate) {
    if (hasLaborActionVerb(normalized)) return null;
  }
  
  const matches = pricingInfo.matches;
  const qtyMatch = matches[0];
  const unitMatch = matches.length >= 2 ? matches[matches.length - 2] : null;
  const amountMatch = matches.length >= 2 ? matches[matches.length - 1] : null;
  const quantity = qtyMatch?.hours || 0;
  const unitPrice = unitMatch?.hours || 0;
  const amount = amountMatch?.hours || 0;
  
  if (!quantity || quantity <= 0 || quantity > 999) return null;
  if (!unitPrice || !amount) return null;
  
  const designation = sanitizeEstimateOperation(text.slice(0, qtyMatch.index) || text);
  if (!designation || designation.length < 2) return null;
  
  return {
    id: `part_${Math.random()}`,
    designation,
    quantity: roundPlanningHours(quantity),
    unitPrice: roundPlanningHours(unitPrice),
    amount: roundPlanningHours(amount),
    rawText: text,
  };
}

export function classifyQuoteLine(text: string): QuoteLineType {
  // 1. Ignorer les lignes administratives
  const normalized = normalizeEstimateOperationText(text);
  if (isEstimateLegalOrFooterLine(normalized)) return "unknown";
  if (/\b(DESIGNATION|QTE|PRIX\s+UNITAIRE|MONTANT|TOTAL|TVA|TIMBRE|DEVIS|RECEPTIONNAIRE|PAGE|CODE\s+MOTEUR|TYPE\s+MAIN|N\s*OR|N\s*DEVIS|CLIENT|VIN|IMMATRICULATION|TELEPHONE|CONSEILLER|DATE)\b/.test(normalized)) {
    return "unknown";
  }

  // 2. Produit peinture
  if (isPaintSupplyLine(normalized)) {
    return "paint";
  }

  // 3. Check legacy labor classification
  const labor = classifyLaborLine(text);
  if (labor?.type === "labor") {
    return "labor";
  }
  if (labor?.type === "ignored") {
    if (labor.reason === "Note client ou pied de page ignoré" ||
        labor.reason === "Ligne d'en-tête, administrative ou totale" ||
        labor.reason === "Produit de peinture ou consommable ignoré comme main-d'œuvre" ||
        labor.reason === "Pièce, fourniture ou total ignoré" ||
        labor.reason === "Prix unitaire non MO") {
      const part = classifyEstimatePartLine(text);
      if (part) return "part";
      const isPieceKeyword = /\b(ART\w*|FILTRE|HUILE|RONDELLE|BOUGIE|PARE[- ]CHOCS?|AILE|PORTE|CAPTEUR|JOINT|COURROIE|AGRAFE|SUPPORT|PHARE|FEU|LIQUIDE|MOUSSE|RENFORT|EMBLEME|MONOGRAMME|BOUCHON|COLLIER|TUBE|KIT)\b/.test(normalized);
      if (isPieceKeyword || labor.reason === "Pièce, fourniture ou total ignoré") {
        return "part";
      }
      return "unknown";
    }
  }

  // 4. Suffix check (for manual entries or specs like "Remplacement plaquettes 2H")
  const pricingInfo = extractEstimatePricingInfo(text);
  if (!pricingInfo.hasNumericTable) {
    const hours = extractLaborHours(text);
    if (hours > 0 && hours <= ESTIMATE_LABOR_MAX_HOURS) {
      const isPieceKeyword = /\b(ART\w*|FILTRE|HUILE|RONDELLE|BOUGIE|PARE[- ]CHOCS?|AILE|PORTE|CAPTEUR|JOINT|COURROIE|AGRAFE|SUPPORT|PHARE|FEU|LIQUIDE|MOUSSE|RENFORT|EMBLEME|MONOGRAMME|BOUCHON|COLLIER|TUBE|KIT)\b/.test(normalized);
      if (hasLaborKeyword(normalized) || !isPieceKeyword) {
        return "labor";
      }
    }
  }

  // 5. Check part classification
  const part = classifyEstimatePartLine(text);
  if (part) {
    return "part";
  }

  // 6. Keywords fallback
  if (/\b(ARTICLE|REFERENCE|RÉFÉRENCE|FILTRE|HUILE|PLAQUETTE|DISQUE|BOUGIE|BATTERIE|PARE[- ]CHOCS?|PHARE|CAPTEUR|JOINT|COURROIE|AMORTISSEUR|RESSORT|ROULEMENT|ROTULE|BIELLETTE|SILENT[- ]BLOC|SILENTBLOC|PNEUMATIQUE|PNEU|ESSUIE[- ]GLACE|LAMPE|FUSIBLE|RELAIS|SONDE|INJECTEUR|POMPE|VALVE|SEGMENT|CULASSE|VIS|BOULON|ECROU|AGRAFE|CLIP|EMBOUT)\b/i.test(normalized)) {
    return "part";
  }

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

function extractQuoteSourceCode(text: string): string | undefined {
  const match = String(text || "").match(/\b(MO[-\s]TOL|MO-[A-Z0-9-]+)\b/i);
  return match ? match[1].replace(/\s+/g, "-").toUpperCase() : undefined;
}

/**
 * Calcule le niveau de confiance de classification.
 */
function computeConfidence(text: string, type: QuoteLineType, hours: number): "high" | "medium" | "low" {
  if (type === "unknown") return "low";
  const norm = normalizeEstimateOperationText(text);
  if (type === "part") return "high";
  if (type === "labor") {
    const hasKeyword = hasLaborKeyword(norm);
    if (hasKeyword && hours > 0) return "high";
    if (hasKeyword || hours > 0) return "medium";
    return "low";
  }
  return "medium";
}

// ───────────────────────────────────────────────────────────────────────────────
// PDF & multi-line helpers
// ───────────────────────────────────────────────────────────────────────────────

export function decodePdfLiteral(value: string): string {
  return String(value || "")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

export function extractPdfContentTableRows(text: string): string[] {
  const rows: string[] = [];
  const source = String(text || "");
  const operationPattern =
    "\\(((?:D\\s*\\/\\s*P|PEINTURE|DRESSAGE|REMP|REMPL|REMPLACEMENT|DEPOSE|D\u00C9POSE|DEMONTAGE|D\u00C9MONTAGE|REMONTAGE|REPOSE|PETIT FOURNITURE)[^()]*)\\)\\s*Tj" +
    "[\\s\\S]{0,700}?\\((\\d+(?:[,.]\\d+)?)\\)\\s*Tj" +
    "[\\s\\S]{0,500}?\\((3[35][,.]000)\\)\\s*Tj" +
    "[\\s\\S]{0,500}?\\((\\d+(?:[,.]\\d+)?)\\)\\s*Tj";
  const regex = new RegExp(operationPattern, "gi");
  let match;
  while ((match = regex.exec(source))) {
    const operation = decodePdfLiteral(match[1]).replace(/\s+/g, " ").trim();
    if (!operation) continue;
    rows.push(`${operation} ${match[2]} ${match[3]} ${match[4]}`);
  }
  return [...new Set(rows)];
}

export function isEstimateNumberToken(value: string): boolean {
  const text = String(value || "").replace(/\u00a0/g, " ").trim();
  return /^\d+(?:\s\d{3})*(?:[,.]\d+)?$/.test(text);
}

export function extractColumnarEstimateRows(text: string): string[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const designationIndex = lines.findIndex((line) => normalizeEstimateOperationText(line) === "DESIGNATION");
  if (designationIndex < 0) return [];

  const quantityHeaderIndex = lines.findIndex((line, index) => index > designationIndex && normalizeEstimateOperationText(line) === "QTE");
  const codeModelIndex = lines.findIndex((line, index) => index > designationIndex && normalizeEstimateOperationText(line) === "CODE MODELE");
  let operationEndIndex = [quantityHeaderIndex, codeModelIndex].filter((index) => index > designationIndex).sort((a, b) => a - b)[0];
  if (!operationEndIndex) operationEndIndex = quantityHeaderIndex;
  if (!operationEndIndex || operationEndIndex <= designationIndex) return [];

  const operations = lines
    .slice(designationIndex + 1, operationEndIndex)
    .filter((line) => !/^\d+(?:[,.]\d+)?$/.test(line))
    .filter((line) => !/^(Code modèle|Qté|Prix|unitaire|Montant)$/i.test(line));
  if (!operations.length) return [];

  const headerIndexes = [quantityHeaderIndex];
  ["PRIX", "UNITAIRE", "MONTANT"].forEach((header) => {
    const found = lines.findIndex((line, index) => index > operationEndIndex && normalizeEstimateOperationText(line) === header);
    if (found >= 0) headerIndexes.push(found);
  });
  const qteStart = Math.max(...headerIndexes.filter((index) => index >= 0)) + 1;
  const numbers = lines.slice(qteStart).filter(isEstimateNumberToken);
  const quantities = numbers.slice(0, operations.length);
  if (quantities.length < operations.length) return [];

  const rows: string[] = [];
  operations.forEach((operation, index) => {
    const qty = quantities[index];
    const normalized = normalizeEstimateOperationText(operation);
    if (!qty || !hasLaborKeyword(normalized)) return;
    rows.push(`${operation} ${qty} 33,000`);
  });
  return rows;
}

export function dedupeEstimateSourceRows(rows: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  (rows || []).forEach((row) => {
    const text = String(row || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const labor = classifyLaborLine(text);
    let key = normalizeEstimateOperationText(text);
    if (labor?.type === "labor") {
      key = ["LABOR", normalizeEstimateOperationText(labor.operation), roundPlanningHours(labor.hours)].join("|");
    }
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
}

export function splitEstimateSourceLines(text: string): string[] {
  const source = String(text || "");
  const pdfTableRows = extractPdfContentTableRows(source);
  const columnarRows = extractColumnarEstimateRows(source);
  const dressageMarker = "DRESSAGE__ET__PEINTURE";
  const protectedSource = source.replace(/\bDRESSAGE\s+ET\s+PEINTURE\b/gi, dressageMarker);
  const expanded = protectedSource
    .replace(/\s+(?=(?:D\/P|DRESSAGE__ET__PEINTURE|DRESSAGE|PEINTURE|PRODUITS?\s+(?:DE\s+)?PEINTURE|REMP|REMPL|REMPLACEMENT|DEPOSE|D\u00C9POSE|DEMONTAGE|D\u00C9MONTAGE|REMONTAGE|REPOSE|PETIT(?:E)? FOURNITURE|ENTRETIEN|VIDANGE)\b)/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(new RegExp(dressageMarker, "g"), "DRESSAGE ET PEINTURE"))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Appliquer la délimitation multi-segments de tableau
  const hasTableHeaders = expanded.some((line) => {
    const n = normalizeEstimateOperationText(line);
    return /^(?:NO\s+)?DESIGNATION\b/.test(n);
  });
  const tableFiltered = extractTableZoneLines(expanded);
  const mergedTableLines = hasTableHeaders ? mergeMultiLineQuoteRows(tableFiltered) : tableFiltered;

  if (columnarRows.length) {
    return dedupeEstimateSourceRows([...pdfTableRows, ...columnarRows, ...mergedTableLines]);
  }
  if (pdfTableRows.length) return dedupeEstimateSourceRows([...pdfTableRows, ...mergedTableLines]);
  return dedupeEstimateSourceRows(mergedTableLines);
}

// ───────────────────────────────────────────────────────────────────────────────
// Parsing
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Parse un texte copié-collé (un bloc de texte libre).
 * Retourne les QuoteLine détectées.
 */
export function parseQuoteText(text: string): QuoteLine[] {
  const lines = splitEstimateSourceLines(text);
  return linesToQuoteLines(lines, "text");
}

/**
 * Parse un CSV (séparateur virgule ou point-virgule).
 */
export function parseQuoteCsv(text: string): QuoteLine[] {
  const rows = parseCsvRaw(text);
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
  let pendingSourceCode: string | undefined;

  for (const rawLine of lineTexts) {
    const cleaned = normalizeQuoteLine(rawLine);
    if (!cleaned) continue;
    const explicitSourceCode = extractQuoteSourceCode(cleaned);

    const normalizedForChecks = normalizeEstimateOperationText(cleaned);

    // Rejeter lignes légales / pied de page
    if (isEstimateLegalOrFooterLine(normalizedForChecks)) continue;

    // Rejeter lignes administratives (client, VIN, OR, marque, etc.)
    if (isAdministrativeQuoteLine(normalizedForChecks)) continue;

    // Dédup simple
    const key = normalizedForChecks;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = classifyQuoteLine(cleaned);
    const hours = type === "labor" ? extractLaborHours(cleaned) : 0;
    const confidence = computeConfidence(cleaned, type, hours);
    const sourceCode = explicitSourceCode || (type === "labor" && hours > 0 ? pendingSourceCode : undefined);

    const id = generateId("ql");
    // Pour les lignes labor : utiliser le nom propre nettoyé
    const description = type === "labor" ? cleanLaborDescription(cleaned) || cleaned : cleaned;
    const isQualityControl = type === "labor" && isQualityControlLine(description);
    const effectiveType: QuoteLineType = isQualityControl ? "misc" : type;
    const effectiveHours = isQualityControl ? 0 : hours;
    const oldAppLine = type === "labor" && hours > 0 && !isQualityControl
      ? normalizeOldAppOriginalLaborLine({
          id,
          operation: description,
          rawText: cleaned,
          laborHours: hours,
          allocations: getOldAppDefaultLaborAllocations(description, hours),
        })
      : null;

    result.push({
      id,
      rawText: rawLine,
      sourceCode,
      description,
      type: effectiveType,
      hours: effectiveHours,
      confidence,
      selected: effectiveType === "labor" && effectiveHours > 0, // pré-sélection : seulement MO atelier avec durée > 0
      oldAppPhaseAllocations: oldAppLine?.allocations,
      oldAppSelectedPhases: oldAppLine?.selectedPhases,
      oldAppPieceKind: oldAppLine?.pieceKind,
      oldAppPaintFaces: oldAppLine?.paintFaces,
      oldAppPaintGroup: oldAppLine?.paintGroup,
      oldAppDetectionReason: oldAppLine ? "old-app-v21.96" : undefined,
    });

    if (type === "labor" && hours <= 0 && explicitSourceCode) {
      pendingSourceCode = explicitSourceCode;
    } else if (type === "labor" && hours > 0) {
      pendingSourceCode = undefined;
    } else if (type !== "unknown") {
      pendingSourceCode = undefined;
    }
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

export function distributeLaborHours(operation: string, hours: number, options: any = {}): LaborDistribution[] {
  return distributeOldAppLaborHours(operation, hours, options);
}

function quoteLineToOldAppOriginalLine(line: QuoteLine): OldAppOriginalLaborLine | null {
  if (line.type !== "labor") return null;
  const hours = line.editedHours !== undefined ? line.editedHours : line.hours;
  if (!hours || hours <= 0) return null;
  const operation = line.editedDescription?.trim() || line.description;
  return normalizeOldAppOriginalLaborLine({
    id: line.id,
    operation,
    rawText: line.rawText,
    laborHours: hours,
    allocations: line.oldAppPhaseAllocations?.map(allocation => ({
      phase: allocation.phase as OldAppOriginalLaborLine["selectedPhases"][number],
      operation: allocation.operation,
      laborHours: allocation.laborHours,
    })),
    selectedPhases: line.oldAppSelectedPhases as OldAppOriginalLaborLine["selectedPhases"] | undefined,
    pieceKind: line.oldAppPieceKind,
    paintFaces: line.oldAppPaintFaces,
    paintGroup: line.oldAppPaintGroup as OldAppOriginalLaborLine["paintGroup"] | undefined,
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Preview et application
// ───────────────────────────────────────────────────────────────────────────────

export function buildQuoteImportPreview(
  lines: QuoteLine[],
  options: { sourceType?: "text" | "csv" | "xlsx"; fileName?: string; ignoredCount?: number } = {}
): QuoteImportPreview {
  const laborLines = lines.filter(l => l.type === "labor");
  const workshopLaborLines = laborLines.filter(l => !isQualityControlLine(l.editedDescription ?? l.description));
  const partLines = lines.filter(l => l.type === "part");
  const totalDetectedHours = workshopLaborLines.reduce((sum, l) => sum + l.hours, 0);
  const oldAppOriginalLines = workshopLaborLines
    .map(quoteLineToOldAppOriginalLine)
    .filter((line): line is OldAppOriginalLaborLine => Boolean(line));
  const oldAppOptimized = optimizeOldAppEstimateAllocationsFromOriginalLines(oldAppOriginalLines);

  return {
    importId: generateId("qimport"),
    sourceType: options.sourceType ?? "text",
    fileName: options.fileName,
    lines,
    laborCount: laborLines.length,
    partCount: partLines.length,
    totalDetectedHours: roundPlanningHours(totalDetectedHours),
    ignoredCount: options.ignoredCount ?? 0,
    oldAppTotals: oldAppOptimized.totals,
    oldAppPaintOptimization: oldAppOptimized.paintOptimization.map(group => ({
      group: group.group,
      label: group.label,
      total: group.total,
    })),
  };
}

export function validateQuoteImportPreview(preview: QuoteImportPreview): string[] {
  const errors: string[] = [];
  const selectedLabor = preview.lines.filter(l => l.selected && l.type === "labor" && !isQualityControlLine(l.editedDescription ?? l.description));
  if (selectedLabor.length === 0) {
    errors.push("Aucune ligne de main-d'œuvre sélectionnée à importer.");
  }
  for (const line of selectedLabor) {
    const hrs = line.editedHours !== undefined ? line.editedHours : line.hours;
    if (hrs <= 0) {
      errors.push("Durée à compléter avant import.");
    }
  }
  return errors;
}

export function mapLaborLinesToRepairOrderLines(
  preview: QuoteImportPreview
): RepairOrderLine[] {
  const importId = preview.importId;
  const oldAppOriginalLines = preview.lines
    .filter(l => l.selected && l.type === "labor")
    .filter(l => !isQualityControlLine(l.editedDescription ?? l.description))
    .map(quoteLineToOldAppOriginalLine)
    .filter((line): line is OldAppOriginalLaborLine => Boolean(line));
  if (oldAppOriginalLines.length === 0) return [];
  const appliedLines = buildOldAppAppliedEstimateLines(oldAppOriginalLines);

  return appliedLines
    .filter(line => line.phase !== "quality")
    .filter(line => line.laborHours > 0)
    .map((line): RepairOrderLine => {
      const stageId = OLD_APP_PHASE_TO_PRO_STAGE[line.phase];
      return {
        id: generateId("ro_quote"),
        designation: line.operation,
        tempsEstime: line.laborHours,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "quote-import",
        isEstimatedDurationValidated: line.laborHours > 0,
        quoteImportId: importId,
        quoteLineRef: line.id,
        operationFamily: getOldAppPhaseLabel(line.phase),
        workshopStageId: stageId,
        workshopZoneNote: line.paintOptimized
          ? "Règle ancienne : peinture mutualisée par zone/côté cabine."
          : "Règle ancienne NIMR SAV appliquée.",
      };
    });
}

export function buildQuoteImportHistoryEntry(preview: QuoteImportPreview): string {
  const selectedLabor = preview.lines.filter(l => l.selected && l.type === "labor" && !isQualityControlLine(l.editedDescription ?? l.description));
  const parts = preview.lines.filter(l => l.type === "part");
  const totalHours = roundPlanningHours(selectedLabor.reduce((s, l) => s + (l.editedHours ?? l.hours), 0));
  const fileName = preview.fileName ? ` depuis ${preview.fileName}` : "";
  return `Import devis${fileName} : ${selectedLabor.length} ligne(s) MO importée(s) (${totalHours}h), ${parts.length} pièce(s) détectée(s) non importées comme tâches.`;
}

export function applyQuoteImportPreview(preview: QuoteImportPreview): QuoteImportResult {
  const importedLines = mapLaborLinesToRepairOrderLines(preview);
  const parts = preview.lines.filter(l => l.type === "part");
  const totalHours = roundPlanningHours(importedLines.reduce((s, l) => s + l.tempsEstime, 0));
  return {
    importId: preview.importId,
    importedLines,
    laborLinesCount: importedLines.length,
    partLinesCount: parts.length,
    totalHours,
    historyEntry: buildQuoteImportHistoryEntry(preview),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Planning duration helpers
// ───────────────────────────────────────────────────────────────────────────────

export function repairDurationHours(dossier: DossierSAV): number {
  return dossier.ordresReparation.reduce((sum, line) => sum + (line.tempsEstime || 0), 0);
}

export function getBookingDurationMinutes(booking: { segments?: Array<{ start: string; end: string }> | null }): number {
  const segments = booking?.segments || [];
  return segments.reduce((sum, segment) => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);
    if (end > start) {
      const diffMs = end.getTime() - start.getTime();
      return sum + Math.round(diffMs / 60000);
    }
    return sum;
  }, 0);
}

function generateId(prefix: string): string {
  const rand = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}
