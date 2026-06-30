/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { createReceptionDossier } from "../src/sav-core";
import { DossierPriority, InterventionType } from "../src/types";
import { buildDossierPlanningOverview } from "../src/workshop-planning-steps";
import { createManualWorkshopTaskLine } from "../src/workshop-task-intake";

console.log("Démarrage des tests workshop-task-creation...");

const dossier = createReceptionDossier({
  clientNom: "Client Fictif",
  clientTelephone: "+216 20 000 000",
  deposantNom: "Client Fictif",
  deposantTelephone: "+216 20 000 000",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "BOX EV 430",
  vehiculeImmatriculation: "123 TU 456",
  vehiculeVIN: "VIN-WORKSHOP-001",
  vehiculeKilometrage: 1200,
  vehiculeCouleur: "Blanc",
  typeDossier: InterventionType.MECANIQUE_GENERALE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Création tâche atelier fictive",
  observationsReception: "",
  photosAvant: [],
  niveauCarburant: 50,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
}, [], new Date("2026-06-30T08:00:00Z"));

assert.equal(dossier.ordresReparation.length, 0, "La réception ne doit pas créer de tâches automatiques.");

const task = createManualWorkshopTaskLine({
  id: "ro_manual_mech",
  label: "Remplacement support moteur",
  shortDescription: "Vibration à contrôler après pose",
  stageId: "mechanical",
  estimatedHours: 2.25,
  preferredTechnicianId: "tech_02",
  requiredBayId: "bay_mech_01",
  priority: "haute",
  chefComment: "Essai statique après serrage.",
});

assert.equal(task.estimateSource, "manual");
assert.equal(task.isEstimatedDurationValidated, true);
assert.equal(task.workshopStageId, "mechanical");
assert.equal(task.tempsEstime, 2.25);
assert.equal(task.preferredTechnicianId, "tech_02");
assert.equal(task.requiredBayId, "bay_mech_01");

const withTask = { ...dossier, ordresReparation: [task] };
const overview = buildDossierPlanningOverview(withTask, []);
const mechanical = overview.steps.find(step => step.stepId === "mechanical");

assert.equal(mechanical?.active, true);
assert.equal(mechanical?.estimatedHours, 2.25);
assert.equal(mechanical?.unvalidatedDurationCount, 0);

console.log("✅ workshop-task-creation OK");
