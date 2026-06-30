import assert from "node:assert/strict";
import { createReceptionDossier, canDeliverDossier, invalidateQCAfterWorkshopChange, isRepairOrderDone } from "../src/sav-core";
import { DossierPriority, DossierStatus, InterventionType, RepairOrderLine, UserRole } from "../src/types";

const reception = createReceptionDossier({
  clientNom: "Client Règles",
  clientTelephone: "+216 55 100 100",
  deposantNom: "Client Règles",
  deposantTelephone: "+216 55 100 100",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "Shine",
  vehiculeImmatriculation: "321 TU 7654",
  vehiculeVIN: "1HGCM82633A004352",
  vehiculeKilometrage: 20000,
  vehiculeCouleur: "Gris",
  typeDossier: InterventionType.DIAGNOSTIC,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Diagnostic",
  observationsReception: "RAS",
  photosAvant: [],
  niveauCarburant: 40,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
}, [], new Date("2026-06-30T08:00:00.000Z"));

assert.equal(reception.ordresReparation.length, 0, "La réception ne doit pas créer de travaux automatiques.");
assert.equal(reception.clientNom.includes("Démo"), false);
assert.equal(reception.vehiculeImmatriculation, "321 TU 7654");

const terminalTask: RepairOrderLine = {
  id: "task-terminal",
  designation: "Travail terminé",
  tempsEstime: 1,
  tempsPasse: 1,
  status: "cancelled",
};
assert.equal(isRepairOrderDone(terminalTask), true, "Une tâche annulée administrativement est terminale.");

const qcReady = {
  ...reception,
  statut: DossierStatus.PRET_A_LIVRER,
  ordresReparation: [{ ...terminalTask, status: "done" as const }],
  checklistQC: {
    essaiEffectue: true,
    defautRepare: true,
    aucunVoyantAllume: true,
    niveauxVerifies: true,
    serrageSecurite: true,
    propreteVehicule: true,
    documentsPrets: true,
    photosApresOk: true,
    validationGlobale: "valide" as const,
  },
};
assert.equal(canDeliverDossier(qcReady).allowed, true);

const invalidated = invalidateQCAfterWorkshopChange(qcReady, "Retouche atelier après QC", UserRole.CHEF_ATELIER);
assert.equal(invalidated.checklistQC.validationGlobale, "a_refaire");
assert.equal(canDeliverDossier(invalidated).allowed, false);

