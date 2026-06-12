/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-3 — Tests unitaires quote-import.ts
 * Aucune donnée réelle. Données fictives uniquement.
 */

import assert from "node:assert/strict";
import {
  normalizeOperationText,
  extractLaborHours,
  classifyQuoteLine,
  parseQuoteText,
  parseQuoteCsv,
  buildQuoteImportPreview,
  validateQuoteImportPreview,
  mapLaborLinesToRepairOrderLines,
  applyQuoteImportPreview,
} from "../src/quote-import";
import {
  validatePlanningAssignment,
  createReceptionDossier,
} from "../src/sav-core";
import { InterventionType, DossierPriority } from "../src/types";
import { MOCK_TECHNICIENS, INITIAL_DOSSIERS } from "../src/data";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTestDossier(overrides: Record<string, unknown> = {}) {
  const base = createReceptionDossier(
    {
      clientNom: "Client Test",
      clientTelephone: "+216 99 000 000",
      deposantNom: "Client Test",
      deposantTelephone: "+216 99 000 000",
      vehiculeMarque: "TEST",
      vehiculeModele: "Model Fictif",
      vehiculeImmatriculation: "000 TEST 00",
      vehiculeVIN: "VIN-FICTIF-000000000",
      vehiculeKilometrage: 10000,
      vehiculeCouleur: "Blanc fictif",
      typeDossier: InterventionType.ENTRETIEN_RAPIDE,
      priorite: DossierPriority.NORMALE,
      plainteClient: "Test unitaire",
      observationsReception: "Test",
      photosAvant: [],
      niveauCarburant: 50,
      etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
      objetsLaisses: [],
    },
    [],
    new Date("2026-06-12T08:00:00Z")
  );
  return { ...base, ...overrides };
}

// ─── Suite 1 : normalizeOperationText ────────────────────────────────────────

console.log("▶ Suite 1: normalizeOperationText");

{
  const result = normalizeOperationText("Main d'œuvre - remplacement");
  assert.ok(result.includes("MAIN"), `Expected MAIN, got: ${result}`);
  console.log("  ✅ normalizeOperationText — suppress accent");
}
{
  const result = normalizeOperationText("");
  assert.equal(result, "", "empty string returns empty");
  console.log("  ✅ normalizeOperationText — empty");
}

// ─── Suite 2 : extractLaborHours ─────────────────────────────────────────────

console.log("▶ Suite 2: extractLaborHours");

const hourTests: [string, number][] = [
  ["2.5H", 2.5],
  ["2,5H", 2.5],
  ["2.5 h", 2.5],
  ["2,5 heures", 2.5],
  ["1H30", 1.5],
  ["1 h 30", 1.5],
  ["90 min", 1.5],
  ["120 min", 2.0],
  ["3H", 3.0],
  ["0.5h", 0.5],
];

for (const [input, expected] of hourTests) {
  const result = extractLaborHours(input);
  assert.ok(
    Math.abs(result - expected) < 0.001,
    `extractLaborHours("${input}") expected ${expected}, got ${result}`
  );
  console.log(`  ✅ extractLaborHours("${input}") = ${result}`);
}
{
  const result = extractLaborHours("filtre à huile 1 pièce");
  assert.equal(result, 0, "No hours in parts-only line");
  console.log("  ✅ extractLaborHours — no hours in parts line");
}

// ─── Suite 3 : classifyQuoteLine ─────────────────────────────────────────────

console.log("▶ Suite 3: classifyQuoteLine");

const classifyTests: [string, string][] = [
  ["Main d'œuvre remplacement amortisseur 2H", "labor"],
  ["MO diagnostic électrique 1.5H", "labor"],
  ["Remplacement plaquettes frein avant 1H", "labor"],
  ["Contrôle géométrie 1H", "labor"],
  ["Vidange + filtre huile 1H", "labor"],
  ["Filtre à air 1", "part"],
  ["Huile moteur 5W40 5L", "part"],
  ["Plaquette frein avant", "part"],
  ["Disque frein arrière", "part"],
  ["Bougie d'allumage x4", "part"],
  ["CE DEVIS RESTE ESTIMATIF", "unknown"],
  ["SIGNATURE DU PRESENT DEVIS", "unknown"],
  ["", "unknown"],
];

for (const [input, expected] of classifyTests) {
  const result = classifyQuoteLine(input);
  assert.equal(result, expected, `classifyQuoteLine("${input}") expected ${expected}, got ${result}`);
  console.log(`  ✅ classifyQuoteLine("${input.substring(0, 40)}") = ${result}`);
}

// ─── Suite 4 : parseQuoteText ────────────────────────────────────────────────

console.log("▶ Suite 4: parseQuoteText");

const FICTIF_DEVIS = `
Vidange + filtre huile 1H
Remplacement plaquettes frein avant 2H
Contrôle géométrie 1H30
Filtre à air 1
Huile moteur 5W40 5L
CE DEVIS RESTE ESTIMATIF, SUSCEPTIBLE D'ÊTRE MODIFIÉ
`.trim();

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  assert.ok(lines.length > 0, "parseQuoteText should return lines");
  
  const laborLines = lines.filter(l => l.type === "labor");
  assert.ok(laborLines.length >= 3, `Expected >=3 labor lines, got ${laborLines.length}`);
  
  const partLines = lines.filter(l => l.type === "part");
  assert.ok(partLines.length >= 2, `Expected >=2 part lines, got ${partLines.length}`);
  
  // Legal footer lines should be filtered out entirely (not returned)
  const legalLine = lines.find(l => l.description.toUpperCase().includes("ESTIMATIF"));
  assert.equal(legalLine, undefined, "Legal footer should be entirely filtered out, not returned");
  
  console.log(`  ✅ parseQuoteText — ${laborLines.length} MO, ${partLines.length} pièces`);
}

// ─── Suite 5 : parseQuoteCsv ─────────────────────────────────────────────────

console.log("▶ Suite 5: parseQuoteCsv");

const FICTIF_CSV = `Description;Durée;Montant
Remplacement plaquettes;2H;0
Filtre huile;0;0
Contrôle freins;1H30;0
`;

{
  const lines = parseQuoteCsv(FICTIF_CSV);
  assert.ok(lines.length > 0, "parseQuoteCsv should return lines");
  const laborLines = lines.filter(l => l.type === "labor");
  assert.ok(laborLines.length >= 1, `Expected >=1 labor lines from CSV, got ${laborLines.length}`);
  console.log(`  ✅ parseQuoteCsv — ${laborLines.length} MO from CSV`);
}

// ─── Suite 6 : pré-sélection par défaut ──────────────────────────────────────

console.log("▶ Suite 6: pré-sélection par défaut");

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  const laborSelected = lines.filter(l => l.type === "labor" && l.selected);
  const partSelected = lines.filter(l => l.type === "part" && l.selected);
  assert.ok(laborSelected.length > 0, "Labor lines pre-selected by default");
  assert.equal(partSelected.length, 0, "Part lines NOT pre-selected by default");
  console.log("  ✅ Parts not pre-selected by default");
  console.log("  ✅ Labor lines pre-selected by default");
}

// ─── Suite 7 : buildQuoteImportPreview ───────────────────────────────────────

console.log("▶ Suite 7: buildQuoteImportPreview");

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines, { sourceType: "text" });
  assert.ok(preview.importId.startsWith("qimport_"), "importId has correct prefix");
  assert.ok(preview.laborCount > 0, "laborCount > 0");
  assert.ok(preview.partCount > 0, "partCount > 0");
  assert.ok(preview.totalDetectedHours > 0, "totalDetectedHours > 0");
  console.log(`  ✅ buildQuoteImportPreview — ${preview.laborCount} MO, ${preview.partCount} pièces, ${preview.totalDetectedHours}h`);
}

// ─── Suite 8 : validateQuoteImportPreview ────────────────────────────────────

console.log("▶ Suite 8: validateQuoteImportPreview");

{
  // All lines deselected → should fail
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines.map(l => ({ ...l, selected: false })));
  const errors = validateQuoteImportPreview(preview);
  assert.ok(errors.length > 0, "Should fail when no labor lines selected");
  console.log("  ✅ validateQuoteImportPreview — fails when nothing selected");
}
{
  // Line with editedHours = 0 → should fail
  const lines = parseQuoteText(FICTIF_DEVIS);
  const laborLine = lines.find(l => l.type === "labor");
  assert.ok(laborLine, "Should have labor line");
  const preview = buildQuoteImportPreview(
    lines.map(l => l.id === laborLine.id ? { ...l, selected: true, editedHours: 0 } : l)
  );
  const errors = validateQuoteImportPreview(preview);
  assert.ok(errors.length > 0, "Should fail when labor line has 0 hours");
  console.log("  ✅ validateQuoteImportPreview — fails with 0 hours");
}
{
  // Valid selection → should pass
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines);
  const errors = validateQuoteImportPreview(preview);
  assert.equal(errors.length, 0, `Should pass valid preview. Errors: ${errors.join(", ")}`);
  console.log("  ✅ validateQuoteImportPreview — passes valid selection");
}

// ─── Suite 9 : mapLaborLinesToRepairOrderLines ───────────────────────────────

console.log("▶ Suite 9: mapLaborLinesToRepairOrderLines");

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  
  assert.ok(roLines.length > 0, "Should produce RepairOrderLines");
  for (const line of roLines) {
    assert.equal(line.estimateSource, "quote-import", "estimateSource = quote-import");
    assert.equal(line.isEstimatedDurationValidated, true, "isEstimatedDurationValidated = true after confirmation");
    assert.ok(line.tempsEstime > 0, "tempsEstime > 0");
    assert.ok(line.quoteImportId, "quoteImportId set");
    assert.ok(line.quoteLineRef, "quoteLineRef set");
    assert.equal(line.status, "pending", "status = pending");
    assert.equal(line.tempsPasse, 0, "tempsPasse = 0");
  }
  console.log(`  ✅ mapLaborLinesToRepairOrderLines — ${roLines.length} lignes, toutes validées`);
}

// ─── Suite 10 : applyQuoteImportPreview ──────────────────────────────────────

console.log("▶ Suite 10: applyQuoteImportPreview");

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines);
  const result = applyQuoteImportPreview(preview);
  
  assert.ok(result.importedLines.length > 0, "importedLines not empty");
  assert.ok(result.totalHours > 0, "totalHours > 0");
  assert.ok(result.historyEntry.includes("Import devis"), "historyEntry contains 'Import devis'");
  assert.ok(result.partLinesCount > 0, "partLinesCount tracked");
  console.log(`  ✅ applyQuoteImportPreview — ${result.laborLinesCount} MO importées, ${result.partLinesCount} pièces`);
}

// ─── Suite 11 : planning blocking — durée manquante ──────────────────────────

console.log("▶ Suite 11: validatePlanningAssignment — durée manquante");

{
  const now = new Date("2026-06-12T09:00:00");
  const dossier = makeTestDossier();
  
  // Override first line to have tempsEstime = 0
  const dossierWithZeroDuration = {
    ...dossier,
    ordresReparation: [
      { ...dossier.ordresReparation[0], tempsEstime: 0 },
    ],
  };
  
  const start = new Date("2026-06-12T10:00:00");
  const end = new Date("2026-06-12T12:00:00");
  const tech = MOCK_TECHNICIENS[0];
  
  const result = validatePlanningAssignment({
    dossiers: [dossierWithZeroDuration, ...INITIAL_DOSSIERS],
    dossierId: dossierWithZeroDuration.id,
    lineId: dossierWithZeroDuration.ordresReparation[0].id,
    technicianId: tech.id,
    bayId: "bay_fast_01",
    start,
    end,
    technicians: MOCK_TECHNICIENS,
    workshopBays: [{ id: "bay_fast_01", name: "Pont rapide 1" }],
  }, now);
  
  assert.equal(result.allowed, false, "Should not allow planning with 0 duration");
  assert.ok(result.codes.includes("planning-duration-missing"), `Expected planning-duration-missing, got: ${result.codes.join(", ")}`);
  console.log("  ✅ planning blocked — durée absente (tempsEstime = 0)");
}

// ─── Suite 12 : planning blocking — preset non validé ────────────────────────

console.log("▶ Suite 12: validatePlanningAssignment — preset non validé");

{
  const now = new Date("2026-06-12T09:00:00");
  const dossier = makeTestDossier();
  
  // First line is already preset & not validated (from createReceptionDossier)
  const presetLine = dossier.ordresReparation[0];
  assert.equal(presetLine.estimateSource, "preset", "Preset line from createReceptionDossier");
  assert.equal(presetLine.isEstimatedDurationValidated, false, "Not validated by default");
  
  const start = new Date("2026-06-12T10:00:00");
  const end = new Date("2026-06-12T12:30:00");
  const tech = MOCK_TECHNICIENS[0];
  
  const result = validatePlanningAssignment({
    dossiers: [dossier, ...INITIAL_DOSSIERS],
    dossierId: dossier.id,
    lineId: presetLine.id,
    technicianId: tech.id,
    bayId: "bay_fast_01",
    start,
    end,
    technicians: MOCK_TECHNICIENS,
    workshopBays: [{ id: "bay_fast_01", name: "Pont rapide 1" }],
  }, now);
  
  assert.equal(result.allowed, false, "Should not allow planning with non-validated preset");
  assert.ok(result.codes.includes("planning-duration-not-validated"), `Expected planning-duration-not-validated, got: ${result.codes.join(", ")}`);
  console.log("  ✅ planning blocked — preset non validé");
}

// ─── Suite 13 : planning autorisé — quote-import validé ──────────────────────

console.log("▶ Suite 13: validatePlanningAssignment — quote-import validé");

{
  const now = new Date("2026-06-12T09:00:00");
  const dossier = makeTestDossier();
  
  // Replace preset line with a quote-import validated line
  const quoteImportLine = {
    ...dossier.ordresReparation[0],
    tempsEstime: 2.0,
    estimateSource: "quote-import" as const,
    isEstimatedDurationValidated: true,
  };
  const dossierWithQuote = {
    ...dossier,
    ordresReparation: [quoteImportLine],
  };
  
  const start = new Date("2026-06-12T10:00:00");
  const end = new Date("2026-06-12T12:00:00");
  const tech = MOCK_TECHNICIENS[0];
  
  const result = validatePlanningAssignment({
    dossiers: [dossierWithQuote, ...INITIAL_DOSSIERS],
    dossierId: dossierWithQuote.id,
    lineId: quoteImportLine.id,
    technicianId: tech.id,
    bayId: "bay_fast_01",
    start,
    end,
    technicians: MOCK_TECHNICIENS,
    workshopBays: [{ id: "bay_fast_01", name: "Pont rapide 1" }],
  }, now);
  
  assert.ok(
    !result.codes.includes("planning-duration-missing") && !result.codes.includes("planning-duration-not-validated"),
    `Should not have duration blocking code, got: ${result.codes.join(", ")}`
  );
  console.log("  ✅ planning autorisé — quote-import validé");
}

// ─── Suite 14 : planning autorisé — manual validé ────────────────────────────

console.log("▶ Suite 14: validatePlanningAssignment — saisie manuelle validée");

{
  const now = new Date("2026-06-12T09:00:00");
  const dossier = makeTestDossier();
  
  const manualLine = {
    ...dossier.ordresReparation[0],
    tempsEstime: 1.5,
    estimateSource: "manual" as const,
    isEstimatedDurationValidated: true,
  };
  const dossierManual = {
    ...dossier,
    ordresReparation: [manualLine],
  };
  
  const start = new Date("2026-06-12T10:00:00");
  const end = new Date("2026-06-12T11:30:00");
  const tech = MOCK_TECHNICIENS[0];
  
  const result = validatePlanningAssignment({
    dossiers: [dossierManual, ...INITIAL_DOSSIERS],
    dossierId: dossierManual.id,
    lineId: manualLine.id,
    technicianId: tech.id,
    bayId: "bay_fast_01",
    start,
    end,
    technicians: MOCK_TECHNICIENS,
    workshopBays: [{ id: "bay_fast_01", name: "Pont rapide 1" }],
  }, now);
  
  assert.ok(
    !result.codes.includes("planning-duration-missing") && !result.codes.includes("planning-duration-not-validated"),
    `Should not have duration blocking code, got: ${result.codes.join(", ")}`
  );
  console.log("  ✅ planning autorisé — saisie manuelle validée");
}

// ─── Suite 15 : aucun prix/paiement/stock ────────────────────────────────────

console.log("▶ Suite 15: aucun prix/paiement/stock dans les RepairOrderLines");

{
  const lines = parseQuoteText(FICTIF_DEVIS);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  
  for (const line of roLines) {
    const lineStr = JSON.stringify(line);
    const forbidden = ["prix", "price", "montant", "amount", "stock", "caisse", "paiement", "payment", "marge", "margin"];
    for (const kw of forbidden) {
      assert.ok(!lineStr.toLowerCase().includes(kw), `RepairOrderLine must not contain "${kw}"`);
    }
  }
  console.log("  ✅ Aucun champ prix/paiement/stock dans les RepairOrderLines importées");
}

console.log("\n🎉 Tous les tests Lot 5F-3 (quote-import) sont passés !");
