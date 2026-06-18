import assert from "node:assert/strict";
import { clearAuditTrail, getAuditTrail, logAuditEvent } from "../src/audit-trail";
import { createReceptionDossier, finishRepairOrder, blockRepairOrder } from "../src/sav-core";
import { DossierPriority, DossierStatus, InterventionType, UserRole } from "../src/types";

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

const dossier = {
  ...createReceptionDossier({
    clientNom: "Client Audit",
    clientTelephone: "+216 20 000 001",
    deposantNom: "Client Audit",
    deposantTelephone: "+216 20 000 001",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Shine Max",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "1HGCM82633A004352",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Bruit de freinage à froid",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
  }, [], new Date("2026-06-18T08:00:00Z")),
  statut: DossierStatus.EN_TRAVAUX,
  technicienId: "tech_01",
  ordresReparation: [
    { id: "ro_audit", designation: "Contrôle frein", tempsEstime: 1, tempsPasse: 0.2, status: "in_progress" as const },
  ],
  historiqueLogs: ["2026-06-18T08:00:00.000Z - Initialisation audit"],
};

const invalidFinish = finishRepairOrder([dossier], dossier.id, "ro_audit", "ok", new Date("2026-06-18T09:00:00Z"));
assert.equal(invalidFinish.ok, false);
assert.equal(dossier.historiqueLogs.length, 1);

const invalidBlock = blockRepairOrder([dossier], dossier.id, "ro_audit", "Attente pièce", UserRole.TECHNICIEN, new Date("2026-06-18T09:00:00Z"));
assert.equal(invalidBlock.ok, false);
assert.equal(dossier.historiqueLogs.length, 1);

console.log("audit-trail.test.ts OK");
