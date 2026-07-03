import assert from "node:assert/strict";
import { MemoryStorageLike } from "../src/data/dataProvider";
import { createLocalStorageProvider } from "../src/data/localStorageProvider";
import { buildStorageDiagnostics } from "../src/data/storageDiagnostics";
import { STORAGE_KEYS } from "../src/storage-keys";

console.log("Démarrage du test: storage-diagnostics...");

const storage = new MemoryStorageLike();
const provider = createLocalStorageProvider(storage);
provider.setItem(STORAGE_KEYS.storageSchemaVersion, "7");
provider.setItem(STORAGE_KEYS.storageMigrationState, JSON.stringify({
  id: "lot7-localstorage-to-indexeddb",
  status: "fallback",
  schemaVersion: 7,
  mode: "localStorage fallback",
  migratedKeys: [],
}));
provider.setItem(STORAGE_KEYS.dossiers, JSON.stringify([
  { id: "NIMR-DIAG-1", repairOrderLines: [{ id: "task-1" }, { id: "task-2" }] },
]));
provider.setItem(STORAGE_KEYS.techs, JSON.stringify([{ id: "tech-1" }]));
provider.setItem(STORAGE_KEYS.reservations, JSON.stringify([{ reservationId: "res-1" }]));
provider.setItem(STORAGE_KEYS.auditLog, JSON.stringify([{ id: "audit-1" }]));
provider.setItem(STORAGE_KEYS.fileAttachments, JSON.stringify([{ id: "file-1" }]));

const diagnostics = await buildStorageDiagnostics({ localStorage: provider, indexedDbProvider: null });
assert.equal(diagnostics.mode, "localStorage fallback");
assert.equal(diagnostics.migrationStatus, "fallback");
assert.equal(diagnostics.schemaVersion, 7);
assert.equal(diagnostics.dossierCount, 1);
assert.equal(diagnostics.taskCount, 2);
assert.equal(diagnostics.reservationCount, 1);
assert.equal(diagnostics.resourceCount, 1);
assert.equal(diagnostics.auditEventCount, 1);
assert.equal(diagnostics.fileMetadataCount, 1);
assert.ok(diagnostics.estimatedBytes! > 0);

console.log("storage-diagnostics.test.ts OK");
