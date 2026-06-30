import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDossierPlanningOverview } from "../src/workshop-planning-steps";
import { createReceptionDossier } from "../src/sav-core";
import { DossierPriority, InterventionType } from "../src/types";

const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
const deliverySource = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");

assert.ok(detailSource.includes("canDeliverDossier(dossier)"));
assert.ok(deliverySource.includes("canDeliverDossier"));
assert.ok(planningSource.includes("validateReservationSlot"));
assert.ok(detailSource.includes("getWorkshopTaskDeletionReadiness"));
assert.ok(detailSource.includes("releaseWorkshopTaskReservation"));

const dossier = createReceptionDossier({
  clientNom: "Client Planning",
  clientTelephone: "+216 55 200 200",
  deposantNom: "Client Planning",
  deposantTelephone: "+216 55 200 200",
  vehiculeMarque: "DFSK",
  vehiculeModele: "E5",
  vehiculeImmatriculation: "555 TU 1111",
  vehiculeVIN: "1HGCM82633A004352",
  vehiculeKilometrage: 15000,
  vehiculeCouleur: "Noir",
  typeDossier: InterventionType.MECANIQUE_GENERALE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Planning",
  observationsReception: "RAS",
  photosAvant: [],
  niveauCarburant: 60,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
}, [], new Date("2026-06-30T08:00:00.000Z"));

const overview = buildDossierPlanningOverview({
  ...dossier,
  ordresReparation: [
    { id: "task-cancelled", designation: "Tâche annulée", tempsEstime: 1, tempsPasse: 0, status: "cancelled" },
    { id: "task-active", designation: "Diagnostic moteur", tempsEstime: 2, tempsPasse: 0, status: "pending", isEstimatedDurationValidated: true },
  ],
}, []);
assert.equal(overview.activeStepCount, 1);
assert.equal(overview.totalEstimatedHours, 2);

