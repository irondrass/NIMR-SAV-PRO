/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  normalizeVehicleMasterRecord,
  parseVehicleMasterCsv,
  VEHICLE_MODEL_TO_FILL_PLACEHOLDER,
} from "../src/vehicle-master";

console.log("Démarrage des tests vehicle-description-mapping...");

{
  const result = parseVehicleMasterCsv(
    [
      "VIN,Description,Matricule,Nom",
      "VIN-DESC-001,DONGFENG BOX EV 430,123 TU 456,Client Fictif",
    ].join("\n")
  );

  assert.equal(result.importedCount, 1);
  assert.equal(result.records[0].description, "DONGFENG BOX EV 430");
  assert.equal(result.records[0].brand, "Dongfeng");
  assert.equal(result.records[0].model, "BOX EV 430");
}

{
  const result = parseVehicleMasterCsv(
    [
      "VIN,Description,Matricule,Nom",
      "VIN-DESC-EMPTY,,789 TU 123,Client Fictif",
    ].join("\n")
  );

  assert.equal(result.importedCount, 1);
  assert.equal(result.records[0].model, undefined);
  assert.notEqual(result.records[0].model, VEHICLE_MODEL_TO_FILL_PLACEHOLDER);
}

{
  const normalized = normalizeVehicleMasterRecord({
    vin: "vin-desc-002",
    Description: "DFSK GLORY 580",
  });

  assert.equal(normalized.description, "DFSK GLORY 580");
  assert.equal(normalized.brand, "DFSK");
  assert.equal(normalized.model, "Glory 580");
}

console.log("✅ vehicle-description-mapping OK");
