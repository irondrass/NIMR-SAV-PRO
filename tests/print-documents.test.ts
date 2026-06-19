import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage des tests print-documents...");

const source = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");

for (const expected of [
  "Document interne NIMR SAV PRO",
  "Fiche Réception",
  "Ordre de Réparation Interne",
  "Fiche Contrôle Qualité",
  "Bon de Restitution & Livraison",
  "Fiche tâche technicien",
  "Signature Technicien",
  "Signature Chef Atelier",
  "Contrôle Qualité",
]) {
  assert.ok(source.includes(expected), `Document imprimable manquant: ${expected}`);
}

assert.ok(detailSource.includes("data-testid={`print-${doc.type}`}"), "Les boutons d'impression doivent exposer un testid stable.");
for (const docType of ['type: "reception"', 'type: "or"', 'type: "qc"', 'type: "delivery"']) {
  assert.ok(detailSource.includes(docType), `Type de document non intégré: ${docType}`);
}
assert.ok(detailSource.includes('"task" | null'), "Le détail dossier doit gérer le type de document task.");
assert.ok(source.includes('type: "reception" | "or" | "qc" | "delivery" | "task"'), "PrintDocuments doit accepter le type task.");
assert.ok(source.includes('type === "task"'), "PrintDocuments doit rendre la fiche tâche technicien.");
assert.ok(detailSource.includes("nimr-print-container"), "Conteneur d'impression manquant.");
assert.ok(detailSource.includes("print-task-sheet"), "Bouton fiche tâche technicien manquant.");

// New tests for TechnicianTaskSheetPrint and containers:
assert.ok(source.includes("TechnicianTaskSheetPrint"), "Le composant TechnicianTaskSheetPrint doit exister.");
assert.ok(detailSource.includes("technician-task-print-root"), "DossierDetail doit utiliser le root technician-task-print-root.");
assert.ok(planningSource.includes("technician-task-print-root"), "WorkshopPlanning doit utiliser le root technician-task-print-root.");

// Verifying that other prints still use nimr-print-container in DossierDetail
assert.ok(detailSource.includes('id="nimr-print-container"'), "DossierDetail doit utiliser nimr-print-container pour les autres documents.");

// Verifying that task printing does not render inside nimr-print-container
assert.ok(detailSource.includes('printType !== "task"'), "DossierDetail ne doit pas rendre le type task dans nimr-print-container.");

const lower = source.toLowerCase();
for (const forbidden of ["caisse", "paiement", "montant", "marge", "prix", "facture réelle", "stock réel"]) {
  assert.equal(lower.includes(forbidden), false, `Terme financier interdit dans les documents: ${forbidden}`);
}

console.log("print-documents.test.ts OK");
