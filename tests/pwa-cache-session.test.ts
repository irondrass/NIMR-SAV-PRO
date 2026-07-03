import assert from "node:assert/strict";
import fs from "node:fs";
import { APP_CACHE_NAME } from "../src/app-identity";
import { STORAGE_KEYS } from "../src/storage-keys";

console.log("Démarrage du test: pwa-cache-session...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");
const identitySource = fs.readFileSync("src/app-identity.ts", "utf8");

assert.equal(APP_CACHE_NAME, "nimr-sav-pro-v1.1.1");
assert.match(identitySource, /APP_CACHE_NAME/);
assert.doesNotMatch(appSource, /navigator\.serviceWorker\.register/);
assert.ok(appSource.includes("nimr-sav-pro-session-invalidated"));
assert.ok(appSource.includes("removeLocalStorageValue(STORAGE_KEYS.session)"));
assert.equal(STORAGE_KEYS.storageSchemaVersion, "nimr-sav-pro-storage-schema-version");
assert.equal(STORAGE_KEYS.fileAttachments, "nimr-sav-pro-file-attachments-v1");

console.log("pwa-cache-session.test.ts OK");
