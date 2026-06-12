/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { DossierSAV, DossierStatus, DossierPriority, InterventionType } from "../src/types";
import {
  getVehicleKey,
  groupDossiersByVehicle,
  getVehicleAggregatedStatus,
  searchVehiclesAndDossiers
} from "../src/vehicle-status";

// Helper to create mock dossiers
function mockDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return {
    id: "NIMR-2026-001",
    clientNom: "Alice",
    clientTelephone: "12345",
    deposantNom: "Alice",
    deposantTelephone: "12345",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 500",
    vehiculeImmatriculation: "123 TU 4567",
    vehiculeVIN: "VIN123",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Revision",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: ""
    },
    objetsLaisses: [],
    dateReception: "2026-06-09T08:00:00.000Z",
    dateSouhaiteeLivraison: "2026-06-09T12:00:00.000Z",
    statut: DossierStatus.NOUVEAU,
    ordresReparation: [],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-09",
      confirmationReceptionClient: false,
      clotureInterne: false,
      remarquesLivraison: ""
    },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-09T08:00:00.000Z",
    avancementGlobal: 0,
    ...overrides
  };
}

console.log("▶ Running tests/vehicle-status.test.ts...");

// 1. groupement par VIN
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "VIN_AAA", vehiculeImmatriculation: "1" });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "VIN_AAA", vehiculeImmatriculation: "2" });
  const groups = groupDossiersByVehicle([d1, d2]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "VIN_AAA");
  assert.equal(groups[0].dossiers.length, 2);
  console.log("✔ Grouping by VIN OK");
}

// 2. groupement par immatriculation si VIN absent
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "", vehiculeImmatriculation: "123 TU 4567" });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "", vehiculeImmatriculation: "123 TU 4567" });
  const groups = groupDossiersByVehicle([d1, d2]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "123 TU 4567");
  assert.equal(groups[0].dossiers.length, 2);
  console.log("✔ Grouping by Immatriculation if VIN absent OK");
}

// 3. véhicule avec plusieurs dossiers
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "VIN_BBB", dateReception: "2026-06-08T08:00:00.000Z" });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "VIN_BBB", dateReception: "2026-06-09T08:00:00.000Z" });
  const groups = groupDossiersByVehicle([d1, d2]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].dossiers.length, 2);
  // Checked that latest reception is first
  assert.equal(groups[0].dossiers[0].id, "D2");
  console.log("✔ Vehicle with multiple dossiers OK");
}

// 4. statut véhicule bloqué si un dossier est bloqué
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "VIN_CCC", statut: DossierStatus.LIVRE });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "VIN_CCC", statut: DossierStatus.BLOQUE });
  const status = getVehicleAggregatedStatus([d1, d2]);

  assert.equal(status, "Bloqué");
  console.log("✔ Vehicle status blocked if one dossier is blocked OK");
}

// 5. statut véhicule en cours si une tâche est in_progress
{
  const d1 = mockDossier({
    id: "D1",
    vehiculeVIN: "VIN_DDD",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "T1", designation: "Task 1", tempsEstime: 1, tempsPasse: 0, status: "in_progress" }
    ]
  });
  const status = getVehicleAggregatedStatus([d1]);

  assert.equal(status, "En cours");
  console.log("✔ Vehicle status in_progress if a task is in_progress OK");
}

// 6. statut véhicule en cours si le statut dossier est EN_TRAVAUX
{
  const d1 = mockDossier({
    id: "D1",
    vehiculeVIN: "VIN_DDD_STATUS",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: []
  });
  const status = getVehicleAggregatedStatus([d1]);

  assert.equal(status, "En cours");
  console.log("✔ Vehicle status in progress if dossier status is EN_TRAVAUX OK");
}

// 7. statut véhicule livré si tous les dossiers sont livrés
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "VIN_EEE", statut: DossierStatus.LIVRE });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "VIN_EEE", statut: DossierStatus.LIVRE });
  const status = getVehicleAggregatedStatus([d1, d2]);

  assert.equal(status, "Livré");
  console.log("✔ Vehicle status delivered if all dossiers are delivered OK");
}

// 8. ancien dossier livré ne masque pas dossier actif
{
  const dOld = mockDossier({ id: "D_OLD", vehiculeVIN: "VIN_FFF", statut: DossierStatus.LIVRE, dateReception: "2026-05-01T08:00:00.000Z" });
  const dNew = mockDossier({ id: "D_NEW", vehiculeVIN: "VIN_FFF", statut: DossierStatus.BLOQUE, dateReception: "2026-06-01T08:00:00.000Z" });
  const status = getVehicleAggregatedStatus([dOld, dNew]);

  assert.equal(status, "Bloqué");
  console.log("✔ Old delivered dossier does not mask active/blocked dossier OK");
}

// 9. recherche par immatriculation
{
  const d1 = mockDossier({ id: "D1", vehiculeImmatriculation: "123 TU 9999", clientNom: "John" });
  const d2 = mockDossier({ id: "D2", vehiculeImmatriculation: "999 TU 8888", clientNom: "Bob" });
  const results = searchVehiclesAndDossiers([d1, d2], "9999");

  assert.equal(results.length, 1);
  assert.equal(results[0].vehiculeImmatriculation, "123 TU 9999");
  console.log("✔ Search by immatriculation OK");
}

// 10. recherche par VIN
{
  const d1 = mockDossier({ id: "D1", vehiculeVIN: "VIN_SEARCH_1" });
  const d2 = mockDossier({ id: "D2", vehiculeVIN: "VIN_SEARCH_2" });
  const results = searchVehiclesAndDossiers([d1, d2], "SEARCH_1");

  assert.equal(results.length, 1);
  assert.equal(results[0].vehiculeVIN, "VIN_SEARCH_1");
  console.log("✔ Search by VIN OK");
}

// 11. recherche par numéro dossier
{
  const d1 = mockDossier({ id: "NIMR-LOT-5E" });
  const d2 = mockDossier({ id: "NIMR-OTHER" });
  const results = searchVehiclesAndDossiers([d1, d2], "LOT-5E");

  assert.equal(results.length, 1);
  assert.equal(results[0].dossiers[0].id, "NIMR-LOT-5E");
  console.log("✔ Search by dossier ID OK");
}

// 12. recherche par client
{
  const d1 = mockDossier({ clientNom: "Monsieur Dupont" });
  const d2 = mockDossier({ clientNom: "Madame Smith" });
  const results = searchVehiclesAndDossiers([d1, d2], "Dupont");

  assert.equal(results.length, 1);
  assert.equal(results[0].clientNom, "Monsieur Dupont");
  console.log("✔ Search by client name OK");
}

console.log("✔ All vehicle-status tests completed successfully!");
