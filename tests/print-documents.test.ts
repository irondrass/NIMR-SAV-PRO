import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage des tests print-documents...");

const source = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
const cssSource = fs.readFileSync("src/index.css", "utf8");

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
assert.match(detailSource, /createPortal\(\s*<div id="technician-task-print-root"[\s\S]*?<\/div>,\s*document\.body\s*\)/, "DossierDetail doit monter la fiche tâche via portal document.body.");
assert.match(planningSource, /createPortal\(\s*<div id="technician-task-print-root"[\s\S]*?<\/div>,\s*document\.body\s*\)/, "WorkshopPlanning doit monter la fiche tâche via portal document.body.");

// Verifying that other prints still use nimr-print-container in DossierDetail
assert.ok(detailSource.includes('id="nimr-print-container"'), "DossierDetail doit utiliser nimr-print-container pour les autres documents.");

// Verifying that task printing does not render inside nimr-print-container
assert.ok(detailSource.includes('printType !== "task"'), "DossierDetail ne doit pas rendre le type task dans nimr-print-container.");
assert.ok(source.includes('data-testid="technician-task-sheet-print"'), "La fiche tâche doit exposer un DOM imprimable testable.");
for (const expected of [
  "Dossier ID",
  "Client",
  "Téléphone",
  "Véhicule",
  "Immatriculation",
  "VIN",
  "Kilométrage",
  "Motif client / Plainte",
  "Tâche / opération",
  "Technicien affecté",
  "Statut",
  "Diagnostic technicien",
  "Observations",
]) {
  assert.ok(source.includes(expected), `Information métier absente de la fiche tâche: ${expected}`);
}
assert.ok(cssSource.includes("@media print"), "Le CSS print doit être défini.");
assert.ok(cssSource.includes(".print-only"), "Le CSS doit masquer la zone print-only à l'écran.");
assert.ok(cssSource.includes("body.printing-task-sheet #technician-task-print-root"), "Le root fiche tâche doit être ciblé en print.");
assert.ok(cssSource.includes("display: block !important"), "Le root fiche tâche doit être affiché en print.");
assert.ok(cssSource.includes("position: absolute !important"), "Le root fiche tâche doit sortir du flux app en print.");
assert.ok(cssSource.includes("body.printing-task-sheet #technician-task-print-root *"), "Les enfants de la fiche tâche doivent rester visibles en print.");
assert.equal(/body\.printing-task-sheet\s+#technician-task-print-root[\s\S]{0,200}display:\s*none/i.test(cssSource), false, "Le root fiche tâche ne doit jamais être masqué en print.");

const lower = source.toLowerCase();
for (const forbidden of ["caisse", "paiement", "montant", "marge", "prix", "facture réelle", "stock réel", "disponibilité réelle pièce"]) {
  assert.equal(lower.includes(forbidden), false, `Terme financier interdit dans les documents: ${forbidden}`);
}

console.log("print-documents.test.ts OK");
