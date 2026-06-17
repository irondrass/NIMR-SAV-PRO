import assert from "node:assert/strict";
import { clearAuditTrail, getAuditTrail, logAuditEvent } from "../src/audit-trail";
import { DossierStatus } from "../src/types";

console.log("Démarrage des tests audit-trail...");

clearAuditTrail();
assert.equal(getAuditTrail().length, 0);

const entry = logAuditEvent({
  user: "<b>Chef Atelier</b>",
  role: "Chef atelier",
  module: "controle-qualite",
  action: "validation_qc",
  dossierId: "NIMR<script>alert(1)</script>-001",
  ancienStatut: DossierStatus.CONTROLE_QUALITE,
  nouveauStatut: DossierStatus.PRET_A_LIVRER,
  commentaire: "<script>alert(1)</script>Checklist complète",
  source: "local-ui",
});

assert.match(entry.id, /^audit_/);
assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
assert.equal(entry.user, "Chef Atelier");
assert.equal(entry.dossierId, "NIMR-001");
assert.equal(entry.commentaire, "Checklist complète");
assert.equal(entry.ancienStatut, DossierStatus.CONTROLE_QUALITE);
assert.equal(entry.nouveauStatut, DossierStatus.PRET_A_LIVRER);
assert.equal(entry.source, "local-ui");

const logs = getAuditTrail();
assert.equal(logs.length, 1);
assert.equal(logs[0].id, entry.id);

clearAuditTrail();
assert.equal(getAuditTrail().length, 0);

console.log("audit-trail.test.ts OK");
