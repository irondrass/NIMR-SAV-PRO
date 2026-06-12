/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  addComplaintAction,
  assignComplaintOwner,
  canEditComplaint,
  changeComplaintStatus,
  closeComplaint,
  createComplaint,
  filterComplaints,
  getComplaintTimeline,
  isComplaintOverdue,
  reopenComplaint,
  updateComplaint,
} from "../src/complaints-workflow";
import { ReclammationClient, UserRole } from "../src/types";

const fixedNow = new Date("2026-06-12T10:00:00.000Z");
const actor = { user: "Directeur Test", role: UserRole.DIRECTEUR_SAV };

function createComplaintFixture(overrides: Partial<ReclammationClient> = {}): ReclammationClient {
  return {
    id: "REC-2026-001",
    dossierId: "NIMR-2026-001",
    clientNom: "Client Réclamation",
    vehiculeNom: "Forthing T5 EVO",
    immatriculation: "123 TU 456",
    motif: "Retard de restitution",
    criticite: "haute",
    responsable: "Responsable SAV",
    statut: "nouvelle",
    actionCorrective: "Appeler le client",
    delaiCible: "2026-06-12T12:00:00.000Z",
    delaiTraitement: "2026-06-12T12:00:00.000Z",
    dateCreation: "2026-06-12T09:00:00.000Z",
    dateDerniereModification: "2026-06-12T09:00:00.000Z",
    historiqueActions: [],
    historiqueLogs: [],
    ...overrides,
  };
}

function testComplaintCreation() {
  const complaint = createComplaint({
    dossierId: "NIMR-2026-002",
    clientNom: "Client Nouveau",
    vehiculeNom: "Dongfeng Shine",
    immatriculation: "222 TU 333",
    motif: "Client mécontent du délai",
    criticite: "critique",
    responsable: "Chef Atelier",
    actionCorrective: "Analyse immédiate",
    delaiCible: "2026-06-13T10:00:00.000Z",
  }, ["REC-2026-001", "REC-2026-002"], actor, fixedNow);

  assert.equal(complaint.id, "REC-2026-003");
  assert.equal(complaint.statut, "nouvelle");
  assert.equal(complaint.criticite, "critique");
  assert.equal(complaint.dateDerniereModification, fixedNow.toISOString());
  assert.equal(getComplaintTimeline(complaint).length, 1);
}

function testComplaintActionUpdateAndHistory() {
  const base = createComplaintFixture();
  const updated = addComplaintAction(base, "Remplacement véhicule de courtoisie", actor, "Action atelier", fixedNow);

  assert.equal(updated.actionCorrective, "Remplacement véhicule de courtoisie");
  assert.equal(getComplaintTimeline(updated)[0].action, "Action corrective ajoutée");
  assert.match(getComplaintTimeline(updated)[0].commentaire || "", /Action atelier/);
}

function testComplaintStatusChange() {
  const updated = changeComplaintStatus(createComplaintFixture(), "en_analyse", actor, "Analyse démarrée", fixedNow);

  assert.equal(updated.statut, "en_analyse");
  assert.equal(getComplaintTimeline(updated)[0].ancienStatut, "nouvelle");
  assert.equal(getComplaintTimeline(updated)[0].nouveauStatut, "en_analyse");
}

function testComplaintCloseAndReopen() {
  const closed = closeComplaint(createComplaintFixture({ statut: "resolue" }), actor, "Client rappelé", fixedNow);
  assert.equal(closed.statut, "cloturee");
  assert.throws(() => updateComplaint(closed, { actionCorrective: "Ne doit pas passer" }, actor), /clôturée/i);

  const reopened = reopenComplaint(closed, actor, "Retour client", fixedNow);
  assert.equal(reopened.statut, "reouverte");
  assert.equal(getComplaintTimeline(reopened)[0].nouveauStatut, "reouverte");
}

function testComplaintOwnerAndReadOnlyPermission() {
  const assigned = assignComplaintOwner(createComplaintFixture(), "Responsable Qualité", actor, "Transfert qualité", fixedNow);

  assert.equal(assigned.responsable, "Responsable Qualité");
  assert.equal(getComplaintTimeline(assigned)[0].nouveauResponsable, "Responsable Qualité");
  assert.equal(canEditComplaint(UserRole.LECTURE_SEULE, assigned), false);
  assert.equal(canEditComplaint(UserRole.DIRECTEUR_SAV, assigned), true);
  assert.equal(canEditComplaint(UserRole.DIRECTEUR_SAV, closeComplaint(assigned, actor)), false);
}

function testComplaintOverdueDetection() {
  const overdue = createComplaintFixture({ delaiCible: "2026-06-12T08:00:00.000Z", statut: "action_corrective" });
  const resolved = createComplaintFixture({ delaiCible: "2026-06-12T08:00:00.000Z", statut: "resolue" });

  assert.equal(isComplaintOverdue(overdue, fixedNow), true);
  assert.equal(isComplaintOverdue(resolved, fixedNow), false);
}

function testComplaintFilters() {
  const complaints = [
    createComplaintFixture({ id: "REC-A", criticite: "critique", statut: "nouvelle", responsable: "Sarra" }),
    createComplaintFixture({ id: "REC-B", criticite: "moyenne", statut: "en_analyse", responsable: "Anis" }),
    createComplaintFixture({ id: "REC-C", criticite: "haute", statut: "cloturee", responsable: "Sarra" }),
  ];

  assert.deepEqual(filterComplaints(complaints, { criticite: "critique" }).map(c => c.id), ["REC-A"]);
  assert.deepEqual(filterComplaints(complaints, { status: "en_analyse" }).map(c => c.id), ["REC-B"]);
  assert.deepEqual(filterComplaints(complaints, { responsable: "Sarra" }).map(c => c.id), ["REC-A", "REC-C"]);
}

testComplaintCreation();
testComplaintActionUpdateAndHistory();
testComplaintStatusChange();
testComplaintCloseAndReopen();
testComplaintOwnerAndReadOnlyPermission();
testComplaintOverdueDetection();
testComplaintFilters();

console.log("complaints-workflow tests passed");
