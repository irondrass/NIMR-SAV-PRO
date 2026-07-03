/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { STORAGE_KEYS } from "../storage-keys";
import { FileAttachment, isFileAttachment } from "../types/fileAttachments";
import { createLocalCollectionRepository, DataProvider, StorageLike } from "./dataProvider";

export interface FileAttachmentRepository extends DataProvider<FileAttachment> {
  listByDossier(dossierId: string): FileAttachment[];
  countByDossier(dossierId: string): number;
}

export function createFileAttachmentRepository(storage?: StorageLike | null): FileAttachmentRepository {
  const repository = createLocalCollectionRepository<FileAttachment>({
    key: STORAGE_KEYS.fileAttachments,
    getId: item => item.id,
    guard: isFileAttachment,
    storage,
  });

  return {
    ...repository,
    listByDossier(dossierId) {
      return repository
        .list()
        .filter(item => item.dossierId === dossierId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    countByDossier(dossierId) {
      return repository.list().filter(item => item.dossierId === dossierId).length;
    },
  };
}
