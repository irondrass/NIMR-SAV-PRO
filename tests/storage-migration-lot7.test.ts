import assert from "node:assert/strict";
import { MemoryStorageLike } from "../src/data/dataProvider";
import { createMemoryIndexedDbProvider } from "../src/data/indexedDbProvider";
import { createLocalStorageProvider } from "../src/data/localStorageProvider";
import { bootstrapLot7Storage, mergeArrayWithoutDuplicateIds } from "../src/data/storageMigration";
import { STORAGE_KEYS } from "../src/storage-keys";

console.log("Démarrage du test: storage-migration-lot7...");

const merged = mergeArrayWithoutDuplicateIds(
  JSON.stringify([{ id: "A" }, { id: "B" }]),
  JSON.stringify([{ id: "B", keep: true }, { id: "C" }])
);
assert.deepEqual(JSON.parse(merged).map((item: any) => item.id), ["B", "C", "A"]);
assert.equal(JSON.parse(merged)[0].keep, true);

const memoryLocal = new MemoryStorageLike();
const localProvider = createLocalStorageProvider(memoryLocal);
const indexedProvider = createMemoryIndexedDbProvider({
  [STORAGE_KEYS.dossiers]: JSON.stringify([{ id: "NIMR-EXISTANT" }]),
});

localProvider.setItem(STORAGE_KEYS.dossiers, JSON.stringify([{ id: "NIMR-EXISTANT" }, { id: "NIMR-NOUVEAU" }]));
localProvider.setItem(STORAGE_KEYS.techs, JSON.stringify([{ id: "tech-1", nom: "Compagnon" }]));

const result = await bootstrapLot7Storage({ localStorage: localProvider, indexedDbProvider: indexedProvider });
assert.equal(result.state.status, "migrated");
assert.equal(result.state.mode, "IndexedDB");
assert.equal(localProvider.getItem(STORAGE_KEYS.dossiers)!.includes("NIMR-NOUVEAU"), true);

const indexedDossiers = JSON.parse((await indexedProvider.getItem(STORAGE_KEYS.dossiers))!);
assert.deepEqual(indexedDossiers.map((item: any) => item.id), ["NIMR-EXISTANT", "NIMR-NOUVEAU"]);
assert.equal((await indexedProvider.getItem(STORAGE_KEYS.techs))!.includes("tech-1"), true);
assert.equal(localProvider.getItem(STORAGE_KEYS.storageSchemaVersion), "7");

const emptyLocal = new MemoryStorageLike();
const fallback = await bootstrapLot7Storage({ localStorage: createLocalStorageProvider(emptyLocal), indexedDbProvider: null });
assert.equal(fallback.state.status, "fallback");
assert.equal(fallback.state.mode, "localStorage fallback");

console.log("storage-migration-lot7.test.ts OK");
