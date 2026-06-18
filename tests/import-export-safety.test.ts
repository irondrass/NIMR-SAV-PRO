import assert from "node:assert/strict";
import {
  buildImportSummary,
  createPreImportBackupPayload,
  createRoleAwareBackupPayload,
  isStrongImportConfirmation,
  STRONG_IMPORT_CONFIRMATION,
} from "../src/import-export-safety";
import { createReceptionDossier, validateBackupPayload } from "../src/sav-core";
import { DossierPriority, InterventionType } from "../src/types";

console.log("Démarrage des tests import-export-safety...");

const dossier = createReceptionDossier({
  clientNom: "Client Export",
  clientTelephone: "+216 55 111 001",
  deposantNom: "Client Export",
  deposantTelephone: "+216 55 111 001",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "Shine Max",
  vehiculeImmatriculation: "123 TU 456",
  vehiculeVIN: "1HGCM82633A004352",
  vehiculeKilometrage: 12000,
  vehiculeCouleur: "Blanc",
  typeDossier: InterventionType.ENTRETIEN_RAPIDE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Bruit moteur à froid",
  observationsReception: "RAS",
  photosAvant: [],
  niveauCarburant: 50,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
}, []);

const maskedExport = createRoleAwareBackupPayload([dossier], [], [], [], [], false);
assert.equal(maskedExport.dossiers[0].clientTelephone, "+216 ** *** 001");
assert.equal(maskedExport.dossiers[0].deposantTelephone, "+216 ** *** 001");

const fullExport = createRoleAwareBackupPayload([dossier], [], [], [], [], true);
assert.equal(fullExport.dossiers[0].clientTelephone, "+216 55 111 001");

const backup = createPreImportBackupPayload([dossier], [], [], [], []);
assert.equal(validateBackupPayload(backup).ok, true);

const summary = buildImportSummary({ dossiers: [dossier], activityLogs: [{ id: "audit_1", timestamp: new Date().toISOString(), user: "QA", role: "Directeur", action: "import_json", details: "test" }] });
assert.equal(summary.dossiers, 1);
assert.equal(summary.activityLogs, 1);
assert.match(summary.label, /1 dossier/);

assert.equal(isStrongImportConfirmation(STRONG_IMPORT_CONFIRMATION), true);
assert.equal(isStrongImportConfirmation("je comprends"), false);

console.log("import-export-safety.test.ts OK");
