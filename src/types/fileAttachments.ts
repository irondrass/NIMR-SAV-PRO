/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FileAttachmentCategory =
  | "reception"
  | "atelier"
  | "qc"
  | "livraison"
  | "video"
  | "document";

export type FileAttachmentStorageProvider = "future-google-drive";
export type FileAttachmentStatus = "metadata-only" | "pending-upload" | "uploaded-future";

export interface FileAttachment {
  id: string;
  dossierId: string;
  category: FileAttachmentCategory;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
  storageProvider: FileAttachmentStorageProvider;
  ownerAccountHint?: string;
  futureDriveFileId?: string;
  futureDownloadUrl?: string;
  status: FileAttachmentStatus;
}

export function isFileAttachment(value: unknown): value is FileAttachment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FileAttachment>;
  return Boolean(
    candidate.id &&
    candidate.dossierId &&
    candidate.fileName &&
    candidate.mimeType &&
    typeof candidate.size === "number" &&
    candidate.createdAt &&
    candidate.uploadedBy &&
    candidate.storageProvider === "future-google-drive" &&
    (candidate.status === "metadata-only" || candidate.status === "pending-upload" || candidate.status === "uploaded-future")
  );
}
