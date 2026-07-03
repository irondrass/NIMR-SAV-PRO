import assert from "node:assert/strict";
import fs from "node:fs";
import { MemoryStorageLike } from "../src/data/dataProvider";
import { createFileAttachmentRepository } from "../src/data/fileAttachmentRepository";

console.log("Démarrage du test: google-drive-file-metadata-readiness...");

const storage = new MemoryStorageLike();
const repository = createFileAttachmentRepository(storage);
repository.create({
  id: "file-meta-1",
  dossierId: "NIMR-FILE-001",
  category: "video",
  fileName: "controle-video.mp4",
  mimeType: "video/mp4",
  size: 1024,
  createdAt: "2026-07-03T08:00:00.000Z",
  uploadedBy: "Directeur SAV",
  storageProvider: "future-google-drive",
  status: "metadata-only",
});

assert.equal(repository.listByDossier("NIMR-FILE-001").length, 1);
assert.equal(repository.list()[0].storageProvider, "future-google-drive");
assert.equal(repository.list()[0].status, "metadata-only");

const doc = fs.readFileSync("docs/google-drive-storage-readiness-lot7.md", "utf8");
assert.match(doc, /mhadhbikhaled@gmail\.com/);
assert.match(doc, /aucune clé Google/i);
assert.match(doc, /pas d.upload réel/i);
assert.match(doc, /Backend \/ Supabase Edge Function futur/i);

const source = fs.readFileSync("src/types/fileAttachments.ts", "utf8") + fs.readFileSync("src/data/fileAttachmentRepository.ts", "utf8");
assert.doesNotMatch(source, /mhadhbikhaled@gmail\.com/);
assert.doesNotMatch(source, /client_secret|access_token|refresh_token|AIza/i);

console.log("google-drive-file-metadata-readiness.test.ts OK");
