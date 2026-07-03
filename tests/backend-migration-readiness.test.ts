import assert from "node:assert/strict";
import { BACKEND_MIGRATION_READINESS, MemoryStorageLike } from "../src/data/dataProvider";
import { createAuditRepository } from "../src/data/auditRepository";
import { createClientRepository } from "../src/data/clientRepository";
import { createDeliveryRepository } from "../src/data/deliveryRepository";
import { createDossierRepository } from "../src/data/dossierRepository";
import { createPlanningRepository } from "../src/data/planningRepository";
import { createQcRepository } from "../src/data/qcRepository";
import { createVehicleRepository } from "../src/data/vehicleRepository";
import { createWorkshopTaskRepository } from "../src/data/workshopTaskRepository";
import { createReceptionDossier } from "../src/sav-core";
import { DossierPriority, InterventionType } from "../src/types";

assert.equal(BACKEND_MIGRATION_READINESS.currentRuntime, "localStorage+IndexedDB");
assert.equal(BACKEND_MIGRATION_READINESS.backendEnabled, false);
assert.equal(BACKEND_MIGRATION_READINESS.authServerEnabled, false);
assert.ok(BACKEND_MIGRATION_READINESS.preparedTargets.includes("IndexedDB"));
assert.ok(BACKEND_MIGRATION_READINESS.preparedTargets.includes("backend-api"));
assert.ok(BACKEND_MIGRATION_READINESS.preparedTargets.includes("Supabase"));
assert.ok(BACKEND_MIGRATION_READINESS.preparedTargets.includes("Google Drive metadata"));

const storage = new MemoryStorageLike();
const dossierRepository = createDossierRepository(storage);
const vehicleRepository = createVehicleRepository(storage);
const clientRepository = createClientRepository(storage);
const planningRepository = createPlanningRepository(storage);
const taskRepository = createWorkshopTaskRepository(storage);
const qcRepository = createQcRepository(storage);
const deliveryRepository = createDeliveryRepository(storage);
const auditRepository = createAuditRepository(storage);

assert.deepEqual(dossierRepository.list(), []);
assert.deepEqual(vehicleRepository.list(), []);

const dossier = createReceptionDossier({
  clientNom: "Client Repository",
  clientTelephone: "+216 55 300 300",
  deposantNom: "Client Repository",
  deposantTelephone: "+216 55 300 300",
  vehiculeMarque: "DFSK",
  vehiculeModele: "Glory 580",
  vehiculeImmatriculation: "777 TU 3333",
  vehiculeVIN: "1HGCM82633A004352",
  vehiculeKilometrage: 30000,
  vehiculeCouleur: "Bleu",
  typeDossier: InterventionType.DIAGNOSTIC,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Repository",
  observationsReception: "RAS",
  photosAvant: [],
  niveauCarburant: 70,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
}, [], new Date("2026-06-30T08:00:00.000Z"));

dossierRepository.create(dossier);
assert.equal(dossierRepository.getById(dossier.id)?.clientNom, "Client Repository");
dossierRepository.update(dossier.id, { clientNom: "Client Repository MAJ" });
assert.equal(dossierRepository.getById(dossier.id)?.clientNom, "Client Repository MAJ");

vehicleRepository.create({
  id: "veh-1",
  vin: "1HGCM82633A004352",
  brand: "DFSK",
  model: "Glory 580",
  description: "DFSK Glory 580",
});
assert.equal(vehicleRepository.list().length, 1);

clientRepository.create({ id: "client-1", name: "Client Repository", updatedAt: "2026-06-30T08:00:00.000Z" });
planningRepository.replaceAll([]);
taskRepository.create({ dossierId: dossier.id, id: "task-1", designation: "Diagnostic", tempsEstime: 1, tempsPasse: 0, status: "pending" });
qcRepository.create({ dossierId: dossier.id, checklist: dossier.checklistQC, updatedAt: "2026-06-30T08:00:00.000Z" });
deliveryRepository.create({ dossierId: dossier.id, delivery: dossier.livraison, updatedAt: "2026-06-30T08:00:00.000Z" });
auditRepository.create({ id: "log-1", timestamp: "2026-06-30T08:00:00.000Z", user: "test", role: "test", action: "audit", details: "repository" });

assert.equal(clientRepository.list().length, 1);
assert.equal(taskRepository.list().length, 1);
assert.equal(qcRepository.list().length, 1);
assert.equal(deliveryRepository.list().length, 1);
assert.equal(auditRepository.list().length, 1);
assert.equal(dossierRepository.remove(dossier.id), true);
assert.equal(dossierRepository.list().length, 0);
