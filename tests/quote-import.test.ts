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

// ─── Suite 16 : Fixtures NIMR réels ─────────────────────────────────────────

console.log("▶ Suite 16: Fixtures NIMR réels anonymisés");

// 1. Entretien simple
{
  const text = `
Désignation Qté Prix unitaire Montant
FILTRE À HUILE 1 14,365 14,365
RONDELLE DE VIDANGE 1 1,795 1,795
HUILE MOTEUR 4 25,370 101,480
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");
  const paintLines = lines.filter(l => l.type === "paint");

  assert.equal(laborLines.length, 3, `Expected 3 labor lines, got ${laborLines.length}`);
  assert.equal(partLines.length, 3, `Expected 3 part lines, got ${partLines.length}`);
  assert.equal(paintLines.length, 0, `Expected 0 paint lines, got ${paintLines.length}`);

  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 1.6) < 0.01, `Expected 1.6H, got ${totalHours}H`);

  // Pré-sélection : seulement MO cochée
  for (const line of lines) {
    if (line.type === "labor") {
      assert.equal(line.selected, true, `Labor line should be selected: ${line.description}`);
    } else {
      assert.equal(line.selected, false, `Non-labor line should not be selected: ${line.description}`);
    }
  }

  console.log("  ✅ Fixture 1: Entretien simple (1.6H labor, 3 pièces) OK");
}

// 2. Entretien avec bougies
{
  const text = `
Désignation Qté Prix unitaire Montant
FILTRE À HUILE 1 14,365 14,365
RONDELLE DE VIDANGE 1 1,795 1,795
HUILE MOTEUR 4 25,370 101,480
BOUGIE D'ALLUMAGE 4 12,000 48,000
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
remp bougies 0,4 33,000 13,200
`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");

  assert.equal(laborLines.length, 4, `Expected 4 labor lines, got ${laborLines.length}`);
  assert.equal(partLines.length, 4, `Expected 4 part lines, got ${partLines.length}`);

  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 2.0) < 0.01, `Expected 2.0H, got ${totalHours}H`);

  console.log("  ✅ Fixture 2: Entretien avec bougies (2.0H labor, 4 pièces) OK");
}

// 3. Entretien lourd 60 000 km
{
  const text = `
Désignation Qté Prix unitaire Montant
FILTRE À HUILE 1 14,365 14,365
RONDELLE DE VIDANGE 1 1,795 1,795
HUILE MOTEUR MOBIL SUPER 4 25,370 101,480
FILTRE D'HABITACLE 1 47,658 47,658
FILTRE A AIR 1 46,821 46,821
BOUGIES 4 15,000 60,000
COURROIE CLIM 1 25,000 25,000
HUILE DE BOITE 2 35,000 70,000
HUILE DE FREIN 1 15,000 15,000
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
remp bougies 0,4 33,000 13,200
remp liquide de refroidissement 1 33,000 33,000
rempl courroie clim 1,5 33,000 49,500
vidange boite 1,5 33,000 49,500
remp huile de frein 0,5 33,000 16,500
`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");

  assert.equal(laborLines.length, 8, `Expected 8 labor lines, got ${laborLines.length}`);
  assert.equal(partLines.length, 9, `Expected 9 part lines, got ${partLines.length}`);

  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 6.5) < 0.01, `Expected 6.5H, got ${totalHours}H`);

  console.log("  ✅ Fixture 3: Entretien lourd 60 000 km (6.5H labor, 9 pièces) OK");
}

// 4. Carrosserie MO-TOL
{
  const text = `
Désignation Qté Prix unitaire Montant
OPTIQUE DE PHARE DROIT LED 1 1 193,576 1 193,576
AILE AVANT DROIT S50 1 404,267 404,267
PARE-CHOCS AVANT S50 1 847,990 847,990
PARE-BOUE AVANT DROIT 1 289,202 289,202
SUPPORT PARE-CHOCS AVANT DROIT 1 25,895 25,895
AGRAFE CALANDRE 30 1,860 55,800
PRODUIT DE PEINTURE 2 180,000 360,000
MO-002067 PRODUIT DE PEINTURE 2 180,000 360,000
PRODUT DE PEINTURE 1 180,000 180,000
CHANG PARE-BOUE AVANT DROIT 1 35,000 35,000
CHANG SUPPORT PARE CHOC AV DR 0,4 35,000 14,000
MO-TOL D/P ET PREPARATION PARE-CHOCS AVANT S50 2,5 35,000 87,500
MO-TOL PEINTURE ET FINITION PARE-CHOCS AVANT S50 4,5 35,000 157,500
CHANG OPTIQUE DE PHARE DROIT LED 1 35,000 35,000
D/P ET PREPARATION AILE AVANT DROIT S50 2 35,000 70,000
PEINTURE ET FINITION AILE AVANT DROIT S50 4 35,000 140,000
`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const paintLines = lines.filter(l => l.type === "paint");
  const partLines = lines.filter(l => l.type === "part");

  // Verify that paint supplies (PRODUIT DE PEINTURE, etc.) are paint/part, never labor
  const hasPaintInLabor = laborLines.some(l => /PRODUIT/i.test(l.description));
  assert.equal(hasPaintInLabor, false, "Paint supplies should not be classified as labor");

  // Sum labor hours
  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 15.4) < 0.01, `Expected 15.4H, got ${totalHours}H`);

  console.log("  ✅ Fixture 4: Carrosserie MO-TOL (15.4H labor, paint supply excluded) OK");
}

// 5. Carrosserie sans MO-TOL
{
  const text = `
Désignation Qté Prix unitaire Montant
POIGNEE DE PORTE AV G 1 85,000 85,000
D/P ET PREPARATION PORTIERRE AV G 1,5 35,000 52,500
PEINTURE ET FINITION PORTIERRE AV G 3,0 35,000 105,000
DRESSAGE DELEST ASS 2,0 35,000 70,000
REMP SERRURE PORTIERRE 0,8 35,000 28,000
`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");

  assert.equal(laborLines.length, 4, `Expected 4 labor lines, got ${laborLines.length}`);
  assert.equal(partLines.length, 1, `Expected 1 part line, got ${partLines.length}`);

  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 7.3) < 0.01, `Expected 7.3H, got ${totalHours}H`);

  console.log("  ✅ Fixture 5: Carrosserie sans MO-TOL (7.3H labor) OK");
}

console.log("\n🎉 Tous les tests Lot 5F-3 (quote-import) sont passés !");
