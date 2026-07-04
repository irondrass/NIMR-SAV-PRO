import assert from "node:assert/strict";
import { createHybridDataProvider } from "../src/data/hybridDataProvider";
import { createLocalCollectionRepository, MemoryStorageLike } from "../src/data/dataProvider";
import { createIndexedDbProvider, createMemoryIndexedDbProvider, isIndexedDbAvailable } from "../src/data/indexedDbProvider";
import { createFileAttachmentRepository } from "../src/data/fileAttachmentRepository";

console.log("Démarrage du test: local-mode-regression...");

const storage = new MemoryStorageLike();
interface LocalModeItem {
  id: string;
  label: string;
}

const repository = createLocalCollectionRepository<LocalModeItem>({
  key: "local-mode-regression",
  getId: item => item.id,
  storage,
});

repository.create({ id: "local-1", label: "Local OK" });
assert.equal(repository.getById("local-1")?.label, "Local OK");

let remoteCalled = false;
const hybrid = createHybridDataProvider(repository, {
  async list() {
    remoteCalled = true;
    return [];
  },
  async getById() {
    remoteCalled = true;
    return null;
  },
  async create(item) {
    remoteCalled = true;
    return item;
  },
  async update() {
    remoteCalled = true;
    return null;
  },
  async remove() {
    remoteCalled = true;
    return false;
  },
}, {
  mode: "local-only",
  supabaseUrl: null,
  supabaseAnonKey: null,
  backendEnabled: false,
  backendReady: false,
  missing: [],
  warnings: [],
});

assert.equal(hybrid.shouldUseRemote, false);
assert.equal(hybrid.listLocal().length, 1);
assert.equal((await hybrid.listRemote()).length, 1);
assert.equal(remoteCalled, false);

const indexed = isIndexedDbAvailable() ? createIndexedDbProvider() : createMemoryIndexedDbProvider();
await indexed.setItem("local-indexeddb-key", "ok");
assert.equal(await indexed.getItem("local-indexeddb-key"), "ok");

const files = createFileAttachmentRepository(storage);
files.create({
  id: "file-local-1",
  dossierId: "DOSSIER-LOCAL",
  category: "document",
  fileName: "metadata.pdf",
  mimeType: "application/pdf",
  size: 10,
  createdAt: "2026-07-04T08:00:00.000Z",
  uploadedBy: "Local",
  storageProvider: "future-google-drive",
  status: "metadata-only",
});
assert.equal(files.listByDossier("DOSSIER-LOCAL").length, 1);

console.log("local-mode-regression.test.ts OK");
