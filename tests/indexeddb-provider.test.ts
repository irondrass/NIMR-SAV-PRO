import assert from "node:assert/strict";
import { createMemoryIndexedDbProvider, isIndexedDbAvailable } from "../src/data/indexedDbProvider";

console.log("Démarrage du test: indexeddb-provider...");

const provider = createMemoryIndexedDbProvider();
assert.equal(provider.mode, "memory-indexeddb");
assert.equal(await provider.getItem("nimr-sav-pro-dossiers-v1"), null);

await provider.setItem("nimr-sav-pro-dossiers-v1", JSON.stringify([{ id: "NIMR-IDB-001" }]));
await provider.setItem("nimr-sav-pro-techs-v1", JSON.stringify([{ id: "tech-1" }]));

assert.match((await provider.getItem("nimr-sav-pro-dossiers-v1")) ?? "", /NIMR-IDB-001/);
assert.deepEqual((await provider.keys()).sort(), ["nimr-sav-pro-dossiers-v1", "nimr-sav-pro-techs-v1"]);
assert.ok((await provider.estimateBytes())! > 0);

await provider.removeItem("nimr-sav-pro-techs-v1");
assert.equal(await provider.getItem("nimr-sav-pro-techs-v1"), null);
assert.equal(typeof isIndexedDbAvailable(), "boolean");

console.log("indexeddb-provider.test.ts OK");
