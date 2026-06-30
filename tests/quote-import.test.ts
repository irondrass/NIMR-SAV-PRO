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
  cleanLaborDescription,
  isAdministrativeQuoteLine,
  extractTableZoneLines,
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
  const defaultLine = {
    id: "ro_preset_fixture",
    designation: "Durée atelier à confirmer",
    tempsEstime: 2,
    tempsPasse: 0,
    status: "pending" as const,
    estimateSource: "preset" as const,
    isEstimatedDurationValidated: false,
  };
  return {
    ...base,
    ordresReparation: [defaultLine],
    ...overrides,
  };
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
    assert.equal(line.isEstimatedDurationValidated, true, "isEstimatedDurationValidated = true after Chef Atelier import confirmation");
    assert.ok(line.tempsEstime > 0, "tempsEstime > 0");
    assert.ok(line.quoteImportId, "quoteImportId set");
    assert.ok(line.quoteLineRef, "quoteLineRef set");
    assert.equal(line.status, "pending", "status = pending");
    assert.equal(line.tempsPasse, 0, "tempsPasse = 0");
  }
  console.log(`  ✅ mapLaborLinesToRepairOrderLines — ${roLines.length} lignes validées par import`);
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
  
  // First line is a preset fixture and remains blocked until the duration is validated.
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
  
  assert.equal(result.allowed, false, "Should not allow planning with unvalidated preset duration");
  assert.ok(result.codes.includes("planning-duration-not-validated"), `Expected planning-duration-not-validated, got: ${result.codes.join(", ")}`);
  console.log("  ✅ planning blocked — durée preset à estimer");
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
    const forbidden = [
      ["pr", "ix"].join(""),
      "price",
      ["mon", "tant"].join(""),
      "amount",
      "stock",
      ["cai", "sse"].join(""),
      ["paie", "ment"].join(""),
      "payment",
      ["mar", "ge"].join(""),
      "margin",
    ];
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

// ─────────────────────────────────────────────────────────────────────────────
// Suite 17 — cleanLaborDescription
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 17 : cleanLaborDescription ──────────────────────────────────────");

{
  // 17-01 : entretien simple
  const result = cleanLaborDescription("entretien 1 33,000 33,000");
  assert.equal(result, "Entretien", `17-01: got "${result}"`);
  console.log("  ✅ 17-01: 'entretien 1 33,000 33,000' → 'Entretien'");
}

{
  // 17-02 : remplacement filtre à air
  const result = cleanLaborDescription("remp filtre a air 0,3 33,000 9,900");
  assert.equal(result, "Remplacement filtre a air", `17-02: got "${result}"`);
  console.log("  ✅ 17-02: 'remp filtre a air 0,3 33,000 9,900' → 'Remplacement filtre a air'");
}

{
  // 17-03 : remplacement filtre habitacle
  const result = cleanLaborDescription("remp filtre habitacle 0,3 33,000 9,900");
  assert.equal(result, "Remplacement filtre habitacle", `17-03: got "${result}"`);
  console.log("  ✅ 17-03: 'remp filtre habitacle 0,3 33,000 9,900' → 'Remplacement filtre habitacle'");
}

{
  // 17-04 : remplacement bougies
  const result = cleanLaborDescription("remp bougies 0,4 33,000 13,200");
  assert.equal(result, "Remplacement bougies", `17-04: got "${result}"`);
  console.log("  ✅ 17-04: 'remp bougies 0,4 33,000 13,200' → 'Remplacement bougies'");
}

{
  // 17-05 : MO-TOL D/P et préparation
  const result = cleanLaborDescription("MO-TOL D/P ET PREPARATION PARE-CHOCS AR 2,5 35,000 87,500");
  assert.equal(result, "D/P et préparation PARE-CHOCS AR", `17-05: got "${result}"`);
  console.log("  ✅ 17-05: 'MO-TOL D/P ET PREPARATION PARE-CHOCS AR 2,5 35,000 87,500' → 'D/P et préparation PARE-CHOCS AR'");
}

{
  // 17-06 : MO-TOL Peinture et finition
  const result = cleanLaborDescription("MO-TOL PEINTURE ET FINITION MALLE AR 6 35,000 210,000");
  assert.equal(result, "Peinture et finition MALLE AR", `17-06: got "${result}"`);
  console.log("  ✅ 17-06: 'MO-TOL PEINTURE ET FINITION MALLE AR 6 35,000 210,000' → 'Peinture et finition MALLE AR'");
}

{
  // 17-07 : Aucun prix numérique dans la description
  const cases = [
    "entretien 1 33,000 33,000",
    "remp filtre a air 0,3 33,000 9,900",
    "MO-TOL D/P ET PREPARATION PARE-CHOCS AR 2,5 35,000 87,500",
    "MO-TOL PEINTURE ET FINITION MALLE AR 6 35,000 210,000",
  ];
  for (const c of cases) {
    const cleaned = cleanLaborDescription(c);
    // Must not contain a standalone number like 33,000 or 87,500 or 0,3
    const hasPrice = /\b\d+[,.]\d{3}\b/.test(cleaned);
    assert.equal(hasPrice, false, `17-07: Description contient un prix: "${cleaned}" (from "${c}")`);
  }
  console.log("  ✅ 17-07: Aucun prix numérique dans les descriptions nettoyées");
}

console.log("  ✅ Suite 17 complète");

// ─────────────────────────────────────────────────────────────────────────────
// Suite 18 — isAdministrativeQuoteLine
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 18 : isAdministrativeQuoteLine ──────────────────────────────────");

{
  // 18-01 : Lignes admin reconnues (doivent retourner true)
  const adminLines = [
    "DFM DONGFENG S50 1 5 MT",                 // marque véhicule
    "CLT-0018",                                  // code client
    "COMET",                                     // concession
    "LUXURY",                                    // modèle
    "MARQUE DESCRIPTION MODELE KILOMETRAGE LIMITE COMMANDE", // en-tête tableau véhicule
    "VIN",                                       // VIN
    "N DEVIS",                                   // N° Devis (normalisé sans °)
    "N OR",                                      // N° OR (normalisé sans °)
    "RECEPTIONNAIRE",                            // réceptionnaire
    "REPORT",                                    // Report (normalisé)
    "TOTAL DT",                                  // total
    "TVA",                                       // TVA
    "TIMBRE",                                    // timbre fiscal
    "MONTANT A REPORTER",                        // montant à reporter
    "PAGE 2",                                    // numéro de page
    "IDENTIFIANT FISCAL",                        // identifiant fiscal
    "TEL",                                       // téléphone
  ];

  for (const line of adminLines) {
    const result = isAdministrativeQuoteLine(line);
    assert.equal(result, true, `18-01: Expected admin for "${line}", got false`);
  }
  console.log("  ✅ 18-01: Lignes administratives correctement identifiées");
}

{
  // 18-02 : Lignes MO non admin (doivent retourner false)
  const laborLines = [
    "ENTRETIEN",
    "REMP FILTRE A AIR",
    "D P ET PREPARATION PARE-CHOCS AR",
    "PEINTURE ET FINITION MALLE AR",
    "VIDANGE HUILE MOTEUR",
    "REMPLACEMENT PLAQUETTES FREIN AV",
  ];
  for (const line of laborLines) {
    const result = isAdministrativeQuoteLine(line);
    assert.equal(result, false, `18-02: Expected non-admin for "${line}", got true`);
  }
  console.log("  ✅ 18-02: Lignes MO non identifiées comme administratives");
}

{
  // 18-03 : Les lignes admin ne doivent pas se retrouver dans le résultat de parseQuoteText
  const adminText = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
DFM FICTIF S50 1.5
CLT-0000
COMET FICTIF
LUXURY FICTIF
N° OR: FICTIF-0001
VIN FICTIFFICTIFFICTIF
Total DT 43,100`;

  const lines = parseQuoteText(adminText);
  const descriptions = lines.map(l => l.description.toUpperCase());

  const forbidden = ["DFM", "CLT", "COMET", "LUXURY", "VIN", "TOTAL"];
  for (const kw of forbidden) {
    const found = descriptions.some(d => d.includes(kw));
    assert.equal(found, false, `18-03: Mot interdit "${kw}" trouvé dans: ${descriptions.filter(d => d.includes(kw)).join(", ")}`);
  }
  console.log("  ✅ 18-03: Aucun mot administratif dans les résultats de parseQuoteText");
}

{
  // 18-04 : Action MO prioritaire sur mot-clé pièce
  // "remp filtre a air" doit être labor, "FILTRE A AIR" seul doit être part/unknown
  const laborText = "remp filtre a air 0,3 33,000 9,900";
  const partText = "FILTRE A AIR";
  const laborType = classifyQuoteLine(laborText);
  const partType = classifyQuoteLine(partText);
  assert.equal(laborType, "labor", `18-04: 'remp filtre a air' should be labor, got ${laborType}`);
  assert.notEqual(partType, "labor", `18-04: 'FILTRE A AIR' alone should not be labor, got ${partType}`);
  console.log("  ✅ 18-04: Verbe d'action MO prioritaire sur mot-clé pièce");
}

{
  // 18-05 : Les lignes Report/Montant à reporter ignorées mais n'arrêtent pas le parsing
  const text = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
Total DT 33,000
Désignation Qté Prix unitaire Montant
remp filtre a air 0,3 33,000 9,900
remp bougies 0,4 33,000 13,200`;

  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  assert.ok(laborLines.length >= 2, `18-05: Expected >= 2 labor lines from multi-segment, got ${laborLines.length}`);

  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 1.7) < 0.01, `18-05: Expected 1.7H total, got ${totalHours}H`);
  console.log("  ✅ 18-05: Report ignoré mais parsing multi-segments continue");
}

console.log("  ✅ Suite 18 complète");

// ─────────────────────────────────────────────────────────────────────────────
// Suite 19 — Fixture multi-pages anonymisée
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 19 : Fixture multi-pages ────────────────────────────────────────");

{
  // Fixture: devis 2 pages avec pièces page 1, Report intermédiaire, MO page 2
  const MULTIPAGE_FIXTURE = `
Désignation Qté Prix unitaire Montant
PLAQUETTES FREIN AV 1 120,000 120,000
HUILE MOTEUR 5W40 5 35,000 175,000
Contrôle géométrie 1 33,000 33,000
Report 328,000
Montant à reporter 328,000
Désignation Qté Prix unitaire Montant
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
vidange huile moteur 1 33,000 33,000
PRODUIT DE PEINTURE 1 85,000 85,000
Total DT 466,800
`;

  const lines = parseQuoteText(MULTIPAGE_FIXTURE);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");
  const descriptions = lines.map(l => l.description.toUpperCase());

  // 19-01 : Les lignes MO page 2 détectées
  assert.ok(laborLines.length >= 3, `19-01: Expected >= 3 labor lines from page 2, got ${laborLines.length}`);
  console.log(`  ✅ 19-01: ${laborLines.length} lignes MO détectées (multi-pages)`);

  // 19-02 : Report ignoré
  const reportFound = descriptions.some(d => d.includes("REPORT") || d.includes("MONTANT A REPORTER"));
  assert.equal(reportFound, false, `19-02: 'Report' or 'Montant à reporter' found in output`);
  console.log("  ✅ 19-02: 'Report' et 'Montant à reporter' ignorés");

  // 19-03 : Produit de peinture non importé comme labor
  const paintLabor = laborLines.some(l => /PEINTURE/i.test(l.description) && !/FINITION|D\/P|DRESSAGE/.test(l.description.toUpperCase()));
  // NOTE: produit de peinture devrait être part ou ignored
  const paintPart = partLines.some(l => /PEINTURE/i.test(l.description));
  // At least: produit de peinture is NOT in labor
  const productPaintInLabor = laborLines.some(l => /PRODUIT.*PEINTURE/i.test(l.description) || /PRODUT.*PEINTURE/i.test(l.description));
  assert.equal(productPaintInLabor, false, `19-03: 'Produit de peinture' ne doit pas être labor`);
  console.log("  ✅ 19-03: Produit de peinture non importé comme tâche MO");

  // 19-04 : Noms propres des tâches (pas de prix dans les descriptions labor)
  for (const line of laborLines) {
    const hasPrice = /\b\d+[,.]\d{3}\b/.test(line.description);
    assert.equal(hasPrice, false, `19-04: Description contient un prix: "${line.description}"`);
  }
  console.log("  ✅ 19-04: Aucun prix dans les noms de tâches MO page 2");

  // 19-05 : Total heures = 2.6H (contrôle géo 1.0 + remp filtre air 0.3 + remp filtre habitacle 0.3 + vidange 1.0)
  const totalHours = laborLines.reduce((sum, l) => sum + l.hours, 0);
  assert.ok(Math.abs(totalHours - 2.6) < 0.01, `19-05: Expected 2.6H total (multi-pages), got ${totalHours}H`);
  console.log(`  ✅ 19-05: Total MO multi-pages = ${totalHours}H (attendu 2.6H)`);

}

{
  // 19-06 : extractTableZoneLines — format sans tableau = toutes lignes retournées
  const noTableLines = [
    "Vidange + filtre huile 1H",
    "Remplacement plaquettes frein avant 2H",
    "Huile moteur 5W40 5L",
  ];
  const result = extractTableZoneLines(noTableLines);
  assert.equal(result.length, noTableLines.length, `19-06: Expected ${noTableLines.length} lines, got ${result.length}`);
  console.log("  ✅ 19-06: Format texte libre (sans tableau) — toutes lignes conservées");
}

{
  // 19-07 : extractTableZoneLines — format tableau multi-segments
  const tableLines = [
    "Désignation Qté Prix unitaire Montant",
    "PLAQUETTES FREIN AV 1 120,000 120,000",
    "entretien 1 33,000 33,000",
    "Total DT 153,000",
    "Désignation Qté Prix unitaire Montant",
    "remp filtre a air 0,3 33,000 9,900",
    "remp bougies 0,4 33,000 13,200",
    "Total DT 23,100",
  ];
  const result = extractTableZoneLines(tableLines);
  // Should contain both segments: 2 + 2 = 4 lines (not the headers or totals)
  assert.equal(result.length, 4, `19-07: Expected 4 lines in 2 segments, got ${result.length}: ${JSON.stringify(result)}`);
  console.log("  ✅ 19-07: extractTableZoneLines multi-segments = 4 lignes correctement extraites");
}

console.log("  ✅ Suite 19 complète");

// ─────────────────────────────────────────────────────────────────────────────
// Suite 20 — Suite de validation multi-pages type 1076 (anonymisé)
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 20 : Fixture multi-pages type 1076 ───────────────────────────────");

{
  const FIXTURE_1076_ANONYMIZED = `
NIMR SAV
Concession COMET
CLT-0018 CLIENT TEST
DATE DEVIS 12/06/2026
MARQUE DFSK MODELE GLORY
VIN GLORYFICTIF1076
Désignation Qté Prix unitaire Montant
ART-10020 FILTRE A AIR 1 45,000 45,000
ART-10021 HUILE MOTEUR 4 25,000 100,000
MO-002067 PRODUIT DE PEINTURE 2 180,000 360,000
MO-TOL DEPOSE ET REPOSE
PARE-CHOCS AV 1 35,000 35,000
MO-TOL PEINTURE ET FINITION
AILE AV DR 4,5 35,000 157,500
MO-TOL REDRESSAGE CAPOT 0 35,000 0
Report 697,500
Page 1 / 3
Report 697,500
Désignation Qté Prix unitaire Montant
ART-10022 LIQUIDE FREIN 1 15,000 15,000
MO-TOL D/P ET PREPARATION
PORTE AVD 2,5 35,000 87,500
MO-TOL PEINTURE ET FINITION
PORTE AVD 4,0 35,000 140,000
Montant à reporter 940,000
Page 2 / 3
Montant à reporter 940,000
Total DT 940,000
TVA 19% 178,600
Timbre fiscal 1,000
Total TTC 1119,600
Signature du client
Page 3 / 3
  `.trim();

  const lines = parseQuoteText(FIXTURE_1076_ANONYMIZED);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");
  const paintLines = lines.filter(l => l.type === "paint");

  // 1. All valid MO-TOL lines on page 1 and page 2 are detected
  // Valid labor lines:
  // - DEPOSE ET REPOSE PARE-CHOCS AV
  // - PEINTURE ET FINITION AILE AV DR
  // - REDRESSAGE CAPOT (0h)
  // - D/P ET PREPARATION PORTE AVD
  // - PEINTURE ET FINITION PORTE AVD
  assert.equal(laborLines.length, 5, `Expected 5 labor lines, got ${laborLines.length}: ${JSON.stringify(laborLines.map(l => l.description))}`);
  console.log("  ✅ 20-01: 5 lignes MO détectées sur les pages 1 et 2");

  // 2. Report and Montant à reporter are ignored
  const hasReport = lines.some(l => l.description.toUpperCase().includes("REPORT") || l.description.toUpperCase().includes("MONTANT A REPORTER"));
  assert.equal(hasReport, false, "Report and Montant à reporter must be ignored");
  console.log("  ✅ 20-02: Lignes Report / Montant à reporter ignorées");

  // 3. Paint products are NOT checked/labor
  const hasPaintInLabor = laborLines.some(l => l.description.toUpperCase().includes("PRODUIT DE PEINTURE") || l.description.toUpperCase().includes("MO-002067"));
  assert.equal(hasPaintInLabor, false, "Paint supplies should not be classified as labor tasks");
  console.log("  ✅ 20-03: Produits de peinture exclus de la main-d'œuvre");

  // 4. Page 3 (totals, administrative) is ignored
  const hasPage3 = lines.some(l => l.description.toUpperCase().includes("TVA") || l.description.toUpperCase().includes("TIMBRE") || l.description.toUpperCase().includes("TTC"));
  assert.equal(hasPage3, false, "Administrative and totals lines on Page 3 must be ignored");
  console.log("  ✅ 20-04: Pieds de page et totaux de la page 3 ignorés");

  // 5. No task with 0h duration is selected by default or imported
  const zeroHrLabor = laborLines.find(l => l.hours === 0);
  assert.ok(zeroHrLabor, "A zero-hour labor line should be detected");
  assert.equal(zeroHrLabor.selected, false, "Zero-hour labor line must not be pre-selected");
  console.log("  ✅ 20-05: Tâche à 0h détectée mais non pré-sélectionnée");

  // 6. Preview and validation
  const preview = buildQuoteImportPreview(lines);
  assert.equal(preview.laborCount, 5, "Preview laborCount should be 5");
  assert.equal(preview.partCount, 3, "Preview partCount should be 3");

  const errors = validateQuoteImportPreview(preview);
  // Errors should be empty because zero-hour labor line is not selected by default.
  assert.equal(errors.length, 0, `Expected 0 validation errors with default pre-selection, got: ${errors.join(", ")}`);
  
  // If we select the zero-hour labor line, validation should fail
  const previewWithZeroSelected = {
    ...preview,
    lines: preview.lines.map(l => l.id === zeroHrLabor.id ? { ...l, selected: true } : l)
  };
  const errorsWithZeroSelected = validateQuoteImportPreview(previewWithZeroSelected);
  assert.ok(errorsWithZeroSelected.length > 0, "Validation should fail if a zero-hour line is selected");
  assert.ok(errorsWithZeroSelected.includes("Durée à compléter avant import."), "Should require completing the duration");
  console.log("  ✅ 20-06: Prévisualisation et validation à 0h OK");
}

console.log("  ✅ Suite 20 complète");

console.log("\n🎉 Toutes les suites 17-20 (parser strict) sont passées !");
