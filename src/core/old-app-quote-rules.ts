/**
 * Old NIMR SAV quote/planning allocation rules.
 *
 * Adapted from the reference app files:
 * - js/estimate-import.js?v=23.2.6
 * - js/business-rules-v2187.js?v=23.2.6
 *
 * Keep this module as the source of truth for quote MO -> workshop stage
 * parity. UI and task creation should consume these helpers instead of
 * inventing separate keyword logic.
 */

import { PlanningStepId } from "../workshop-planning-steps";

export type OldAppPhase =
  | "body"
  | "oilService"
  | "mechanical"
  | "electrical"
  | "prep"
  | "paint"
  | "reassembly"
  | "finish"
  | "quality";

export type OldAppPieceKind = "new" | "repair";
export type OldAppPaintFaces = "outside" | "two_sides";
export type OldAppPaintGroup = "front" | "right" | "left" | "rear" | "center" | "general";

export interface OldAppLaborAllocation {
  phase: OldAppPhase;
  operation: string;
  laborHours: number;
}

export interface OldAppOriginalLaborLine {
  id: string;
  code?: string;
  operation: string;
  laborHours: number;
  rawText?: string;
  allocations: OldAppLaborAllocation[];
  selectedPhases: OldAppPhase[];
  pieceKind: OldAppPieceKind;
  paintFaces: OldAppPaintFaces;
  paintGroup: OldAppPaintGroup;
  paintOptimizationEligible: boolean;
}

export interface OldAppAppliedEstimateLine {
  id: string;
  phase: OldAppPhase;
  operation: string;
  laborHours: number;
  paintOptimized?: boolean;
  paintOptimization?: OldAppPaintGroupResult[];
}

export interface OldAppPaintGroupItem {
  line: OldAppOriginalLaborLine;
  operation: string;
  hours: number;
  rawHours: number;
}

export interface OldAppPaintGroupResult {
  group: OldAppPaintGroup;
  label: string;
  total: number;
  items: OldAppPaintGroupItem[];
}

export interface OldAppOptimizedEstimate {
  totals: Record<OldAppPhase, number>;
  lines: OldAppAppliedEstimateLine[];
  paintOptimization: OldAppPaintGroupResult[];
}

export const OLD_APP_PHASES: OldAppPhase[] = [
  "body",
  "oilService",
  "mechanical",
  "electrical",
  "prep",
  "paint",
  "reassembly",
  "finish",
  "quality",
];

export const OLD_APP_PHASE_LABELS: Record<OldAppPhase, string> = {
  body: "Tolerie + demontage",
  oilService: "Vidange / entretien rapide",
  mechanical: "Reparation mecanique",
  electrical: "Reparation electrique",
  prep: "Preparation",
  paint: "Peinture + vernis",
  reassembly: "Remontage",
  finish: "Finition + lavage",
  quality: "Controle qualite",
};

export const OLD_APP_PHASE_TO_PRO_STAGE: Record<OldAppPhase, PlanningStepId> = {
  body: "body-disassembly",
  oilService: "quick-service",
  mechanical: "mechanical",
  electrical: "electrical",
  prep: "preparation",
  paint: "paint",
  reassembly: "reassembly",
  finish: "finish",
  quality: "quality",
};

export const OLD_APP_PAINT_GROUP_OPTIONS: Array<[OldAppPaintGroup, string]> = [
  ["front", "Avant"],
  ["right", "Cote droit"],
  ["left", "Cote gauche"],
  ["rear", "Arriere"],
  ["center", "Capot / centre"],
  ["general", "General"],
];

export const OLD_APP_FIXED_QUALITY_HOURS = 0.25;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function roundOldAppPlanningHours(value: number): number {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

export function normalizeOldAppEstimateText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function sanitizeOldAppOperation(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[:;\-]+$/g, "")
    .trim();
}

export function removeOldAppKnownOperationPrefix(operation: string): string {
  const withoutPrefix = String(operation || "")
    .replace(/^\s*D\s*\/\s*P\s+ET\s+PREPARAT(?:ION|IN)\s*/i, "")
    .replace(/^\s*PEINTURE\s+ET\s+F(?:I)?NITION\s*/i, "")
    .replace(/^\s*DRESSAGE\s+ET\s+PEINTURE\s*/i, "")
    .trim();
  return withoutPrefix || operation;
}

export function splitOldAppPlanningHours(total: number, weights: number[]): number[] {
  const rounded: number[] = [];
  let consumed = 0;
  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      rounded.push(roundOldAppPlanningHours(total - consumed));
      return;
    }
    const value = roundOldAppPlanningHours(total * weight);
    rounded.push(value);
    consumed += value;
  });
  return rounded;
}

export function makeOldAppAllocation(
  phase: OldAppPhase,
  operation: string,
  laborHours: number
): OldAppLaborAllocation {
  return {
    phase,
    operation: sanitizeOldAppOperation(operation),
    laborHours: roundOldAppPlanningHours(laborHours),
  };
}

export function distributeOldAppLaborHours(
  operation: string,
  hours: number,
  options: { claimType?: string } = {}
): OldAppLaborAllocation[] {
  const normalized = normalizeOldAppEstimateText(operation);
  const cleanDetail = removeOldAppKnownOperationPrefix(operation);

  if (/\bD\s*\/\s*P\s+ET\s+PREPARAT(?:ION|IN)\b/.test(normalized)) {
    const [body, reassembly] = splitOldAppPlanningHours(hours, [0.5, 0.5]);
    return [
      makeOldAppAllocation("body", `D/P ${cleanDetail}`, body),
      makeOldAppAllocation("reassembly", `REMONTAGE ${cleanDetail}`, reassembly),
    ];
  }
  if (/\bPEINTURE\s+ET\s+F(?:I)?NITION\b/.test(normalized)) {
    const [prep, paint] = splitOldAppPlanningHours(hours, [0.5, 0.5]);
    return [
      makeOldAppAllocation("prep", `PREPARATION ${cleanDetail}`, prep),
      makeOldAppAllocation("paint", `PEINTURE ${cleanDetail}`, paint),
    ];
  }
  if (/\bDRESSAGE\b/.test(normalized)) {
    const [body, prep, paint] = splitOldAppPlanningHours(hours, [1 / 3, 1 / 3, 1 / 3]);
    return [
      makeOldAppAllocation("body", `DRESSAGE ${cleanDetail}`, body),
      makeOldAppAllocation("prep", `PREPARATION ${cleanDetail}`, prep),
      makeOldAppAllocation("paint", `PEINTURE ${cleanDetail}`, paint),
    ];
  }
  if (/\b(PASSAGE\s+SUR\s+MARBRE|MARBRE)\b/.test(normalized)) return [makeOldAppAllocation("body", operation, hours)];
  if (/\b(VIDANGE|ENTRETIEN\s+RAPIDE|SERVICE\s+RAPIDE|FILTRE|FILTRES)\b/.test(normalized)) return [makeOldAppAllocation("oilService", operation, hours)];

  const isClientOnly = ["client", "vidange", "mechanical_client", "electrical_client"].includes(options.claimType || "");
  const insuranceElectricalPattern = /\b(AIRBAGS?|DIAGNOSTIC|BATTERIE|HAUTE\s+TENSION|HV|PYROTECHNIQUE)\b/;
  const clientElectricalPattern = /\b(AIRBAGS?|DIAGNOSTIC|ELECTRIQUE|ELECTRICITE|ALTERNATEUR|DEMARREUR|BATTERIE|FAISCEAU|CAPTEUR|HAUTE\s+TENSION|HV)\b/;
  if ((isClientOnly ? clientElectricalPattern : insuranceElectricalPattern).test(normalized)) return [makeOldAppAllocation("electrical", operation, hours)];
  if (/\b(REMPLACEMENT\s+BOITE|BOITE\s+VITESSE|EMBRAYAGE|FREIN|SUSPENSION|DISTRIBUTION|MOTEUR|MECANIQUE|MECAN)\b/.test(normalized)) return [makeOldAppAllocation("mechanical", operation, hours)];
  if (/\b(CHANG(?:EMENT)?|REMP|REMPL|REMPLACEMENT)\s+(FEU|OPTIQUE|PHARE|PROJECTEUR|LANTERNE|PARE\s+BOUE|SUPPORT|AILE|PARE\s+CHOC|JUPE|MALLE|CAPOT|PORTE|SERRURE)\b/.test(normalized)) {
    return [makeOldAppAllocation("reassembly", operation, hours)];
  }
  if (/\bCHANG(?:EMENT)?\b/.test(normalized)) return [makeOldAppAllocation("reassembly", operation, hours)];
  if (/\bPREPARATION\b/.test(normalized)) return [makeOldAppAllocation("prep", operation, hours)];
  if (/\bPEINTURE\b/.test(normalized)) return [makeOldAppAllocation("paint", operation, hours)];
  if (/\bD\s*\/\s*P\b/.test(normalized)) {
    const [body, reassembly] = splitOldAppPlanningHours(hours, [0.5, 0.5]);
    return [
      makeOldAppAllocation("body", `D/P ${cleanDetail}`, body),
      makeOldAppAllocation("reassembly", `REMONTAGE ${cleanDetail}`, reassembly),
    ];
  }
  if (/\b(DEMONTAGE|DEPOSE)\b/.test(normalized)) return [makeOldAppAllocation("body", operation, hours)];
  if (/\b(REMONTAGE|REPOSE)\b/.test(normalized)) return [makeOldAppAllocation("reassembly", operation, hours)];
  if (/\bFINITION\b/.test(normalized)) return [makeOldAppAllocation("finish", operation, hours)];
  if (/\b(BOITE|VITESSE)\b/.test(normalized)) return [makeOldAppAllocation("mechanical", operation, hours)];
  if (/\b(REMP|REMPL|REMPLACEMENT)\b/.test(normalized)) return [makeOldAppAllocation("reassembly", operation, hours)];
  if (/\bREPARATION\b/.test(normalized)) return [makeOldAppAllocation("body", operation, hours)];
  return [];
}

export function getOldAppDefaultLaborAllocations(
  operation: string,
  hours: number,
  options: { claimType?: string } = {}
): OldAppLaborAllocation[] {
  const distributed = distributeOldAppLaborHours(operation, hours, options);
  if (distributed.length) return distributed;
  const normalized = normalizeOldAppEstimateText(operation);
  const defaultPhase: OldAppPhase =
    options.claimType === "vidange" || /\b(VIDANGE|ENTRETIEN|FILTRE)\b/.test(normalized)
      ? "oilService"
      : options.claimType === "electrical_client"
        ? "electrical"
        : options.claimType === "mechanical_client"
          ? "mechanical"
          : "body";
  return [makeOldAppAllocation(defaultPhase, operation, hours)];
}

export function inferOldAppPaintGroup(operation: string): OldAppPaintGroup {
  const n = normalizeOldAppEstimateText(operation || "");
  if (/\b(DR|DROIT|DROITE)\b/.test(n)) return "right";
  if (/\b(GH|GAUCHE)\b/.test(n)) return "left";
  if (/\b(PARE\s*CHOCS?\s*AV|PARECHOCS?\s*AV|CALANDRE|PHARE|OPTIQUE\s+DE\s+PHARE)\b/.test(n)) return "front";
  if (/\b(PARE\s*CHOCS?\s*AR|PARECHOCS?\s*AR|MALLE|JUPE|FEU\s+AR)\b/.test(n)) return "rear";
  if (/\b(CAPOT|PAVILLON|TOIT)\b/.test(n)) return "center";
  return "general";
}

export function inferOldAppPieceKind(operation: string): OldAppPieceKind {
  const n = normalizeOldAppEstimateText(operation || "");
  if (/\b(DRESSAGE|REPARATION|REDRESSAGE)\b/.test(n)) return "repair";
  return "new";
}

export function inferOldAppPaintFaces(operation: string, pieceKind: OldAppPieceKind): OldAppPaintFaces {
  const n = normalizeOldAppEstimateText(operation || "");
  return pieceKind === "new" && /\b(PORTE|CAPOT|MALLE)\b/.test(n) ? "two_sides" : "outside";
}

export function makeOldAppWeightedAllocations(
  operation: string,
  hours: number,
  selectedPhases: string[]
): OldAppLaborAllocation[] {
  const phases = [...new Set(selectedPhases.filter((phase): phase is OldAppPhase =>
    OLD_APP_PHASES.includes(phase as OldAppPhase)
  ))];
  if (!phases.length) return [];
  const weights = phases.map(phase => phase === "prep" ? 2 : phase === "paint" ? 1 : 1);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  let consumed = 0;
  return phases.map((phase, index) => {
    let value: number;
    if (index === phases.length - 1) {
      value = Math.max(0, Number(hours || 0) - consumed);
    } else {
      value = Number(hours || 0) * (weights[index] / totalWeight);
      consumed += roundOldAppPlanningHours(value);
    }
    return makeOldAppAllocation(phase, operation, value);
  }).filter(allocation => allocation.laborHours > 0);
}

export function normalizeOldAppOriginalLaborLine(
  input: Partial<OldAppOriginalLaborLine> & {
    id: string;
    operation: string;
    laborHours: number;
    rawText?: string;
  }
): OldAppOriginalLaborLine {
  const operation = input.operation || input.rawText || "Operation devis";
  const laborHours = roundOldAppPlanningHours(Number(input.laborHours || 0));
  const initialAllocations = input.allocations?.length
    ? input.allocations
    : getOldAppDefaultLaborAllocations(operation, laborHours);
  const selectedPhases = input.selectedPhases?.length
    ? input.selectedPhases
    : [...new Set(initialAllocations.map(allocation => allocation.phase))];
  const pieceKind = input.pieceKind || inferOldAppPieceKind(operation);
  const paintFaces = input.paintFaces || inferOldAppPaintFaces(operation, pieceKind);
  const paintGroup = input.paintGroup || inferOldAppPaintGroup(operation);
  const allocations = makeOldAppWeightedAllocations(operation, laborHours, selectedPhases);
  return {
    ...input,
    id: input.id,
    operation,
    laborHours,
    rawText: input.rawText || operation,
    allocations,
    selectedPhases: [...new Set(allocations.map(allocation => allocation.phase))],
    pieceKind,
    paintFaces,
    paintGroup,
    paintOptimizationEligible: true,
  };
}

export function getOldAppPhaseLabel(phase: string): string {
  return OLD_APP_PHASE_LABELS[phase as OldAppPhase] || phase;
}

export function getOldAppPaintGroupLabel(group: string): string {
  return OLD_APP_PAINT_GROUP_OPTIONS.find(([value]) => value === group)?.[1] || group || "General";
}

function oldAppPaintFactor(line: OldAppOriginalLaborLine): number {
  if (line.paintFaces !== "two_sides") return 1;
  const n = normalizeOldAppEstimateText(line.operation || line.rawText || "");
  if (/\bPORTE\b/.test(n)) return 1.6;
  if (/\b(CAPOT|MALLE)\b/.test(n)) return 1.5;
  return 1.5;
}

export function optimizeOldAppEstimateAllocationsFromOriginalLines(
  originalLines: OldAppOriginalLaborLine[]
): OldAppOptimizedEstimate {
  const totals = Object.fromEntries(OLD_APP_PHASES.map(phase => [phase, 0])) as Record<OldAppPhase, number>;
  const appliedLines: OldAppAppliedEstimateLine[] = [];
  const paintGroups = new Map<OldAppPaintGroup, OldAppPaintGroupItem[]>();

  originalLines.map(normalizeOldAppOriginalLaborLine).forEach(line => {
    line.allocations.forEach(allocation => {
      const laborHours = roundOldAppPlanningHours(Number(allocation.laborHours || 0));
      if (laborHours <= 0) return;
      if (allocation.phase === "paint") {
        const group = line.paintGroup || inferOldAppPaintGroup(line.operation || line.rawText || "");
        if (!paintGroups.has(group)) paintGroups.set(group, []);
        paintGroups.get(group)!.push({
          line,
          operation: line.operation || allocation.operation || "Peinture",
          hours: roundOldAppPlanningHours(laborHours * oldAppPaintFactor(line)),
          rawHours: laborHours,
        });
        return;
      }
      totals[allocation.phase] = roundOldAppPlanningHours(totals[allocation.phase] + laborHours);
      appliedLines.push({
        id: uid("estimate-line"),
        phase: allocation.phase,
        operation: allocation.operation || line.operation || getOldAppPhaseLabel(allocation.phase),
        laborHours,
      });
    });
  });

  const groupResults: OldAppPaintGroupResult[] = [];
  paintGroups.forEach((items, group) => {
    const sorted = items.slice().sort((a, b) => b.hours - a.hours);
    const max = sorted[0]?.hours || 0;
    const others = sorted.slice(1).reduce((sum, item) => sum + Number(item.hours || 0), 0);
    const total = roundOldAppPlanningHours(max + others * 0.25);
    groupResults.push({ group, label: getOldAppPaintGroupLabel(group), total, items });
  });
  groupResults.sort((a, b) => b.total - a.total);
  const paintTotal = groupResults.length
    ? roundOldAppPlanningHours((groupResults[0]?.total || 0) + groupResults.slice(1).reduce((sum, group) => sum + Number(group.total || 0), 0) * 0.4)
    : 0;
  totals.paint = paintTotal;
  if (paintTotal > 0) {
    appliedLines.push({
      id: uid("estimate-line"),
      phase: "paint",
      operation: "Peinture mutualisee par zone/cote cabine",
      laborHours: paintTotal,
      paintOptimized: true,
      paintOptimization: groupResults,
    });
  }
  totals.finish = paintTotal > 0 ? roundOldAppPlanningHours(paintTotal * 0.5) : 0;
  totals.quality = OLD_APP_FIXED_QUALITY_HOURS;

  return {
    totals,
    lines: appliedLines,
    paintOptimization: groupResults,
  };
}

export function buildOldAppAppliedEstimateLines(
  originalLines: OldAppOriginalLaborLine[]
): OldAppAppliedEstimateLine[] {
  const optimized = optimizeOldAppEstimateAllocationsFromOriginalLines(originalLines);
  const lines = optimized.lines.slice();
  if (optimized.totals.finish > 0) {
    lines.push({
      id: uid("estimate-line"),
      phase: "finish",
      operation: "Finition + lavage - 50% du temps peinture",
      laborHours: roundOldAppPlanningHours(optimized.totals.finish),
    });
  }
  lines.push({
    id: uid("estimate-line"),
    phase: "quality",
    operation: "Controle qualite forfaitaire",
    laborHours: OLD_APP_FIXED_QUALITY_HOURS,
  });
  return lines;
}

