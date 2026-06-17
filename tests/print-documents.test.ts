import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage des tests print-documents...");

const source = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");

for (const expected of [
  "Document interne NIMR SAV PRO",
  "Fiche Réception",
  "Ordre de Réparation Interne",
  "Fiche Contrôle Qualité",
  "Bon de Restitution & Livraison",
]) {
  assert.ok(source.includes(expected), `Document imprimable manquant: ${expected}`);
}

assert.ok(detailSource.includes("data-testid={`print-${doc.type}`}"), "Les boutons d'impression doivent exposer un testid stable.");
for (const docType of ['type: "reception"', 'type: "or"', 'type: "qc"', 'type: "delivery"']) {
  assert.ok(detailSource.includes(docType), `Type de document non intégré: ${docType}`);
}
assert.ok(detailSource.includes("nimr-print-container"), "Conteneur d'impression manquant.");

const lower = source.toLowerCase();
for (const forbidden of ["caisse", "paiement", "montant", "marge", "prix", "facture réelle", "stock réel"]) {
  assert.equal(lower.includes(forbidden), false, `Terme financier interdit dans les documents: ${forbidden}`);
}

console.log("print-documents.test.ts OK");
