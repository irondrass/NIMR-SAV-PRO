/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraPhoto, PhotoCategory } from "./types";
import { createRuntimeId } from "./sav-core";

const MAX_PHOTO_EDGE = 1280;
const JPEG_QUALITY = 0.78;

export async function fileToCameraPhoto(
  file: File,
  options: { title: string; category: PhotoCategory; takenBy: string }
): Promise<CameraPhoto> {
  const dataUrl = await readFileAsDataUrl(file);
  const compressed = file.type.startsWith("image/")
    ? await compressImageDataUrl(dataUrl).catch(() => dataUrl)
    : dataUrl;

  return {
    id: createRuntimeId("photo"),
    url: compressed,
    title: options.title.trim() || options.category,
    date: new Date().toISOString(),
    takenBy: options.takenBy,
    category: options.category,
    mimeType: compressed.startsWith("data:image/jpeg") ? "image/jpeg" : file.type,
    sizeBytes: estimateDataUrlBytes(compressed),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas indisponible"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    image.onerror = () => reject(new Error("Image illisible"));
    image.src = dataUrl;
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.split(",")[1] ?? "";
  return Math.round((payload.length * 3) / 4);
}
