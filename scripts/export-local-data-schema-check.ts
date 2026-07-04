/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs";

const requiredTopLevelCollections = [
  "dossiers",
  "vehicles",
  "clients",
  "workshopTasks",
  "planning",
  "qc",
  "delivery",
  "audit",
  "fileAttachments",
] as const;

type ExportShape = Record<string, unknown>;

function readExport(filePath: string): ExportShape {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Export local invalide: objet JSON attendu.");
  }
  return parsed as ExportShape;
}

export function checkLocalExportSchema(exportData: ExportShape) {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const collection of requiredTopLevelCollections) {
    if (!(collection in exportData)) {
      missing.push(collection);
      continue;
    }
    if (!Array.isArray(exportData[collection])) {
      invalid.push(collection);
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    uploadAttempted: false,
  };
}

if (process.argv[1]?.endsWith("export-local-data-schema-check.ts")) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/export-local-data-schema-check.ts <local-export.json>");
    process.exit(2);
  }

  const result = checkLocalExportSchema(readExport(filePath));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
