/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  decodeVehicleMasterCsvBuffer,
  findMappedField,
  getVehicleMasterStats,
  normalizeHeader,
  parseCsvRaw,
  parseVehicleMasterCsv,
  normalizeDate,
  normalizeVehicleMasterRecord,
  normalizeSearchText,
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

// 9. Renforcement du mapping de colonnes avec CSV fictif (Lot 6D)
{
  const csvContent = 
    `Item No.,Description,Chassis,Immatriculation,Sell-to Customer Name,Customer Phone,Delivery Date,Warranty End Date\n` +
    `ART-100,Dongfeng Shine Max, VINNORMALISE123 , 123 TU 456 , Jean Dupont , +216 22 222 222 , 15/06/2026 , 15/06/2029 `;

  const result = parseVehicleMasterCsv(csvContent);
  assert.strictEqual(result.importedCount, 1);
  const rec = result.records[0];
  
  // VIN normalisé (majuscules, sans espaces)
  assert.strictEqual(rec.vin, "VINNORMALISE123");
  // immatriculation normalisée
  assert.strictEqual(rec.plateNumber, "123 TU 456");
  // client importé
  assert.strictEqual(rec.customerName, "Jean Dupont");
  // téléphone importé
  assert.strictEqual(rec.customerPhone, "+216 22 222 222");
  // modèle/description importé
  assert.strictEqual(rec.brand, "Dongfeng");
  assert.strictEqual(rec.model, "Shine Max");
  // code article importé
  assert.strictEqual(rec.itemNo, "ART-100");
  // dates normalisées
  assert.strictEqual(rec.deliveryDate, "2026-06-15");
  assert.strictEqual(rec.warrantyPartsEndDate, "2029-06-15");
  assert.strictEqual(rec.warrantyLaborEndDate, "2029-06-15");
  
  // garantie calculée
  const todayActive = new Date("2026-06-14");
  const todayExpired = new Date("2030-06-14");
  assert.strictEqual(getVehicleWarrantyStatus(rec, todayActive), "Garantie active");
  assert.strictEqual(getVehicleWarrantyStatus(rec, todayExpired), "Garantie expirée");
}

// 10. Lot 6G - CSV réel-like Liste Vehicule avec headers terrain
{
  assert.strictEqual(normalizeHeader("No Chassis (VIN)"), "no chassis vin");
  assert.strictEqual(normalizeHeader("N° article"), "n article");
  assert.strictEqual(normalizeHeader("N° téléphone"), "n telephone");
  assert.strictEqual(normalizeHeader("Date Mise en Circulation"), "date mise en circulation");
  assert.strictEqual(findMappedField("No Chassis (VIN)"), "vin");
  assert.strictEqual(findMappedField("Nom"), "customerName");
  assert.strictEqual(findMappedField("N° téléphone"), "customerPhone");

  const csvContent =
    `No Chassis (VIN),N° article,Description,Matricule,N° client,Nom,N° téléphone,Date Mise en Circulation,Date Livraison\n` +
    `LDP43A961SS112183,BOX EV 430 BLANC,DONGFENG BOX EV 430,2318TU259,CLT-DEMO-001,Client Demo,+21622222222,2/25/2026,3/4/2026`;

  const result = parseVehicleMasterCsv(csvContent);
  assert.strictEqual(result.importedCount, 1);
  const rec = result.records[0];
  assert.strictEqual(rec.vin, "LDP43A961SS112183");
  assert.strictEqual(rec.itemNo, "BOX EV 430 BLANC");
  assert.strictEqual(rec.customerName, "Client Demo");
  assert.strictEqual(rec.customerPhone, "+21622222222");
  assert.strictEqual(rec.plateNumber, "2318TU259");
  assert.strictEqual(rec.brand, "Dongfeng");
  assert.strictEqual(rec.model, "BOX EV 430");
  assert.strictEqual(rec.circulationDate, "2026-02-25");
  assert.strictEqual(rec.deliveryDate, "2026-03-04");

  assert.strictEqual(searchVehicleMaster(result.records, "2318TU259").length, 1);
  assert.strictEqual(searchVehicleMaster(result.records, "2318 TU 259").length, 1);
  assert.strictEqual(searchVehicleMaster(result.records, "LDP43A961SS112183").length, 1);
  assert.strictEqual(searchVehicleMaster(result.records, "112183").length, 1);
  assert.strictEqual(searchVehicleMaster(result.records, "client dem").length, 1);
  assert.strictEqual(searchVehicleMaster(result.records, "BOX EV 430").length, 1);
  assert.strictEqual(normalizeSearchText("2318 TU-259/."), "2318TU259");

  const stats = getVehicleMasterStats(result.records);
  assert.deepStrictEqual(stats, {
    total: 1,
    withVin: 1,
    withClient: 1,
    withPhone: 1,
    withPlate: 1,
    withModel: 1
  });
}

// 11. Lot 6G - décodage Windows-1252 conserve N° et téléphone
{
  const windows1252Csv = Uint8Array.from([
    0x4e, 0xb0, 0x20, 0x74, 0xe9, 0x6c, 0xe9, 0x70, 0x68, 0x6f, 0x6e, 0x65, 0x0a,
    0x2b, 0x32, 0x31, 0x36, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32
  ]);
  const decoded = decodeVehicleMasterCsvBuffer(windows1252Csv);
  assert.ok(decoded.includes("N° téléphone"));
  assert.ok(decoded.includes("+21622222222"));
}

console.log("Tous les tests de vehicle-master ont réussi !");
