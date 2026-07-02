import assert from "node:assert/strict";
import {
  getDeliveryReadiness,
  submitQualityControl,
} from "../src/sav-core";
import {
  AtelierZone,
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  RepairOrderLine,
  RepairOrderStatus,
  UserRole,
} from "../src/types";

console.log("Démarrage des tests qc-delivery-readiness-terrain...");

function task(status: RepairOrderStatus, id = `task_${status}`): RepairOrderLine {
  return {
    id,
    designation: `Tâche ${status}`,
    tempsEstime: 1,
    tempsPasse: status === "done" ? 1 : 0,
    status,
    estimateSource: "manual",
    isEstimatedDurationValidated: true,
  };
}

function dossierWithTasks(tasks: RepairOrderLine[]): DossierSAV {
  return {
    id: "NIMR-TERRAIN-QC",
    clientNom: "Client Terrain",
    clientTelephone: "+216 20 000 000",
    deposantNom: "Client Terrain",
    deposantTelephone: "+216 20 000 000",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Shine Max",
    vehiculeImmatriculation: "100 TU 1000",
    vehiculeVIN: "LDP43A961SS112183",
    vehiculeKilometrage: 32000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Contrôle terrain",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-07-02T08:00:00.000Z",
    dateSouhaiteeLivraison: "2026-07-03T16:00:00.000Z",
    statut: DossierStatus.CONTROLE_QUALITE,
    zoneAtelier: AtelierZone.GRANDS_TRAVAUX,
    ordresReparation: tasks,
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: true,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: true,
      propreteVehicule: true,
      documentsPrets: true,
      photosApresOk: true,
      validationGlobale: "en_attente",
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-07-03T16:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-07-02T08:00:00.000Z",
    avancementGlobal: 0,
  };
}

for (const status of ["pending", "in_progress", "paused", "blocked", "reopened"] as RepairOrderStatus[]) {
  const dossier = dossierWithTasks([task(status)]);
  assert.throws(
    () => submitQualityControl(dossier, UserRole.CONTROLE_QUALITE, "valide", "", new Date("2026-07-02T10:00:00.000Z")),
    /QC impossible : des tâches atelier sont encore ouvertes\. \(Nombre : 1\)/,
    `QC conforme doit être refusé avec tâche ${status}`
  );
}

const ready = submitQualityControl(
  dossierWithTasks([task("done"), task("cancelled")]),
  UserRole.CONTROLE_QUALITE,
  "valide",
  "",
  new Date("2026-07-02T10:00:00.000Z")
);
assert.equal(ready.statut, DossierStatus.PRET_A_LIVRER);
assert.equal(getDeliveryReadiness(ready).canDeliver, true);

const pendingReady = {
  ...ready,
  id: "NIMR-TERRAIN-PENDING",
  ordresReparation: Array.from({ length: 9 }, (_, index) => task("pending", `pending_${index}`)),
};
const pendingReadiness = getDeliveryReadiness(pendingReady);
assert.equal(pendingReadiness.canDeliver, false);
assert.ok(pendingReadiness.blockingMessages.includes("Livraison impossible : 9 tâches non terminées."));

const detailedReady = {
  ...ready,
  id: "NIMR-TERRAIN-DETAILED",
  ordresReparation: [task("blocked", "blocked_1"), task("blocked", "blocked_2"), task("paused", "paused_1")],
};
const detailedReadiness = getDeliveryReadiness(detailedReady);
assert.equal(detailedReadiness.canDeliver, false);
assert.ok(detailedReadiness.blockingMessages.includes("Livraison impossible : 2 tâches bloquées, 1 tâche en pause."));
assert.ok(detailedReadiness.reasons.includes("Livraison impossible : 2 tâches bloquées, 1 tâche en pause."));

console.log("qc-delivery-readiness-terrain.test.ts OK");
