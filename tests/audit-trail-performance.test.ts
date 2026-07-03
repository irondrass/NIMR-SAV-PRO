import assert from "node:assert/strict";
import { clearAuditTrail, getAuditTrailPage, logAuditEvent, MAX_AUDIT_TRAIL_ENTRIES } from "../src/audit-trail";
import { UserRole } from "../src/types";

console.log("Démarrage du test: audit-trail-performance...");

clearAuditTrail();
for (let index = 0; index < 8000; index += 1) {
  const dossierId = index % 2 === 0 ? "NIMR-AUDIT-PAIR" : "NIMR-AUDIT-IMPAIR";
  logAuditEvent({
    user: "QA Lot 7",
    role: UserRole.DIRECTEUR_SAV,
    module: index % 5 === 0 ? "planning" : "atelier",
    action: index % 5 === 0 ? "reservation_automatique" : "affectation_par_tache",
    dossierId,
    summary: "Événement audit volumineux Lot 7",
    result: "success",
    source: index % 5 === 0 ? "workshop-planning" : "atelier",
  });
}

assert.equal(MAX_AUDIT_TRAIL_ENTRIES, 8000);
const page = getAuditTrailPage({ dossierId: "NIMR-AUDIT-PAIR", limit: 50 });
assert.equal(page.entries.length, 50);
assert.equal(page.total, 4000);
assert.ok(page.entries.every(entry => entry.dossierId === "NIMR-AUDIT-PAIR"));
assert.ok(page.entries.some(entry => entry.action === "reservation_automatique" || entry.action === "affectation_par_tache"));

clearAuditTrail();
console.log("audit-trail-performance.test.ts OK");
