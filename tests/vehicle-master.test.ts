/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  parseCsvRaw,
  parseVehicleMasterCsv,
  normalizeDate,
  normalizeVehicleMasterRecord,
  searchVehicleMaster,
  getVehicleWarrantyStatus,
  getVehicleReceptionHints
} from "../src/vehicle-master";
import { VehicleMasterRecord } from "../src/types";

console.log("Démarrage des tests vehicle-master...");

// 1. Parsing CSV colonnes françaises, séparateurs et guillemets
{
  const csvContent = 
    `Châssis;Immatriculation;Client;Téléphone;Marque;Modèle;Date livraison;Date mise en circulation;Date fin garantie pièces;Date fin garantie MO;Dernier entretien;Kilométrage dernier entretien\n` +
    `NIMR111;222 TU 333;"Mhadhbi, Salah";"+216 55 111 001";Dongfeng;Shine Max;15/06/2026;15/06/2026;15/06/2029;15/06/2029;15/06/2027;15000\n` +
    `NIMR222;333 TU 444;Salah;+21655111002;DFSK;Glory 500;10-10-2025;10-10-2025;10-10-2028;10-10-2028;;`;

  const result = parseVehicleMasterCsv(csvContent);
  assert.strictEqual(result.importedCount, 2);
  assert.strictEqual(result.ignoredCount, 0);
  assert.strictEqual(result.records[0].vin, "NIMR111");
  assert.strictEqual(result.records[0].plateNumber, "222 TU 333");
  assert.strictEqual(result.records[0].customerName, "Mhadhbi, Salah");
  assert.strictEqual(result.records[0].customerPhone, "+216 55 111 001");
  assert.strictEqual(result.records[0].brand, "Dongfeng");
  assert.strictEqual(result.records[0].model, "Shine Max");
  assert.strictEqual(result.records[0].deliveryDate, "2026-06-15");
  assert.strictEqual(result.records[0].circulationDate, "2026-06-15");
  assert.strictEqual(result.records[0].warrantyPartsEndDate, "2029-06-15");
  assert.strictEqual(result.records[0].lastServiceMileage, 15000);
}

// 2. Colonnes alternatives et séparateur virgule
{
  const csvContent = 
    `VIN,Plate,Customer Name,Phone,Marque,Description,Warranty parts end date\n` +
    `NIMR333, 444 TU 555 , Bob, 99999999, Forthing, T5 EVO, 2028-12-31`;
  const result = parseVehicleMasterCsv(csvContent);
  assert.strictEqual(result.importedCount, 1);
  assert.strictEqual(result.records[0].vin, "NIMR333");
  assert.strictEqual(result.records[0].plateNumber, "444 TU 555");
  assert.strictEqual(result.records[0].customerName, "Bob");
  assert.strictEqual(result.records[0].model, "T5 EVO");
  assert.strictEqual(result.records[0].warrantyPartsEndDate, "2028-12-31");
}

// 3. Normalisation VIN et immatriculation
{
  const raw = {
    vin: " nimr12345 ",
    plateNumber: " 123  tu  4567 "
  };
  const normalized = normalizeVehicleMasterRecord(raw);
  assert.strictEqual(normalized.vin, "NIMR12345");
  assert.strictEqual(normalized.plateNumber, "123 TU 4567");
}

// 4. Recherche par différents champs
{
  const records: VehicleMasterRecord[] = [
    { id: "1", vin: "NIMRABC", plateNumber: "111 TU 111", customerName: "Salah", model: "Shine" },
    { id: "2", vin: "NIMRXYZ", plateNumber: "222 TU 222", customerName: "Imed", model: "Glory 580" }
  ];

  assert.strictEqual(searchVehicleMaster(records, "abc").length, 1);
  assert.strictEqual(searchVehicleMaster(records, "222").length, 1);
  assert.strictEqual(searchVehicleMaster(records, "salah").length, 1);
  assert.strictEqual(searchVehicleMaster(records, "glory").length, 1);
}

// 5. Garantie active, expirée et inconnue
{
  const activeVehicle: VehicleMasterRecord = {
    id: "1",
    warrantyPartsEndDate: "2028-12-31"
  };
  const expiredVehicle: VehicleMasterRecord = {
    id: "2",
    warrantyPartsEndDate: "2024-01-01",
    warrantyLaborEndDate: "2024-01-01"
  };
  const unknownVehicle: VehicleMasterRecord = {
    id: "3"
  };

  const today = new Date("2026-06-14");
  assert.strictEqual(getVehicleWarrantyStatus(activeVehicle, today), "Garantie active");
  assert.strictEqual(getVehicleWarrantyStatus(expiredVehicle, today), "Garantie expirée");
  assert.strictEqual(getVehicleWarrantyStatus(unknownVehicle, today), "Garantie inconnue");
}

// 6. Doublons VIN et immatriculation signalés
{
  const result = parseVehicleMasterCsv(
    `VIN,Plate\n` +
    `NIMRDUPE,111 TU 111\n` +
    `NIMRDUPE,222 TU 222\n` +
    `NIMRDIFF,111 TU 111`
  );
  assert.strictEqual(result.importedCount, 1);
  assert.strictEqual(result.duplicateVinCount, 1);
  assert.strictEqual(result.duplicatePlateCount, 1);
}

// 7. Lignes invalides ignorées
{
  const result = parseVehicleMasterCsv(
    `VIN,Plate,Client\n` +
    `,,Client sans voiture\n` +
    `NIMR123,,Client avec VIN\n` +
    `,111 TU 111,Client avec plaque`
  );
  assert.strictEqual(result.importedCount, 2);
  assert.strictEqual(result.ignoredCount, 1);
}

// 8. Conversion de dates
{
  assert.strictEqual(normalizeDate("15/06/2026"), "2026-06-15");
  assert.strictEqual(normalizeDate("15-06-2026"), "2026-06-15");
  assert.strictEqual(normalizeDate("15/06/26"), "2026-06-15");
}

console.log("Tous les tests de vehicle-master ont réussi !");
