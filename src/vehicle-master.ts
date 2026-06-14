/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VehicleMasterRecord,
  VehicleWarrantyStatus,
  VehicleReceptionHint,
  VehicleMasterImportResult
} from "./types";

const MAPPED_KEYS = {
  vin: ["vin", "chassis", "n chassis", "no chassis"],
  plateNumber: ["immatriculation", "n immat", "plate", "matricule"],
  customerName: ["client", "nom client", "customer name"],
  customerPhone: ["telephone", "tel", "phone"],
  brand: ["brand", "marque"],
  model: ["modele", "model", "description", "designation", "description modele"],
  version: ["version"],
  itemNo: ["code article", "item no"],
  deliveryDate: ["date livraison", "delivery date"],
  circulationDate: ["date mise en circulation", "prem immat", "circulation date"],
  saleDate: ["date vente", "sale date"],
  warrantyPartsEndDate: ["date fin garantie pieces", "warranty parts end date"],
  warrantyLaborEndDate: ["date fin garantie mo", "warranty labor end date"],
  lastServiceDate: ["dernier entretien", "last service date"],
  lastServiceMileage: ["kilometrage dernier entretien", "last service mileage"]
};

function normalizeHeader(h: string): string {
  return (h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMappedField(header: string): string | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  for (const [field, aliases] of Object.entries(MAPPED_KEYS)) {
    if (aliases.some(alias => normalizeHeader(alias) === norm)) {
      return field;
    }
  }
  return null;
}

export function parseCsvRaw(text: string): string[][] {
  const lines = (text || "").split(/\r?\n/);
  const result: string[][] = [];
  const separator = text.includes(";") ? ";" : ",";

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let currentCell = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === separator && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

export function normalizeDate(dStr: string | undefined): string | undefined {
  if (!dStr) return undefined;
  const trimmed = dStr.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();

    if (p0.length === 2 && p1.length === 2) {
      if (p2.length === 4) {
        return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
      } else if (p2.length === 2) {
        const year = Number(p2) > 50 ? `19${p2}` : `20${p2}`;
        return `${year}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
      }
    } else if (p0.length === 4 && p1.length === 2 && p2.length === 2) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
  }

  return trimmed;
}

export function normalizeVehicleMasterRecord(row: any): VehicleMasterRecord {
  const vin = row.vin ? row.vin.toUpperCase().replace(/\s+/g, "") : undefined;
  const plateNumber = row.plateNumber ? row.plateNumber.toUpperCase().replace(/\s+/g, " ").trim() : undefined;
  const customerPhone = row.customerPhone ? row.customerPhone.replace(/\s+/g, " ").trim() : undefined;
  const customerName = row.customerName ? row.customerName.replace(/\s+/g, " ").trim() : undefined;
  const brand = row.brand ? row.brand.trim() : undefined;
  const model = row.model ? row.model.trim() : undefined;
  const version = row.version ? row.version.trim() : undefined;
  const itemNo = row.itemNo ? row.itemNo.trim() : undefined;
  const energy = row.energy ? row.energy.trim() : undefined;

  const deliveryDate = normalizeDate(row.deliveryDate);
  const circulationDate = normalizeDate(row.circulationDate);
  const saleDate = normalizeDate(row.saleDate);
  const warrantyPartsEndDate = normalizeDate(row.warrantyPartsEndDate);
  const warrantyLaborEndDate = normalizeDate(row.warrantyLaborEndDate);
  const lastServiceDate = normalizeDate(row.lastServiceDate);

  let lastServiceMileage: number | undefined;
  if (row.lastServiceMileage !== undefined && row.lastServiceMileage !== null && row.lastServiceMileage !== "") {
    const parsed = Number(String(row.lastServiceMileage).replace(/[^0-9]/g, ""));
    if (Number.isFinite(parsed)) {
      lastServiceMileage = parsed;
    }
  }

  const id = row.id || vin || plateNumber || Math.random().toString(36).substr(2, 9);

  return {
    id,
    vin,
    plateNumber,
    customerName,
    customerPhone,
    itemNo,
    brand,
    model,
    version,
    deliveryDate,
    circulationDate,
    saleDate,
    warrantyPartsEndDate,
    warrantyLaborEndDate,
    lastServiceDate,
    lastServiceMileage,
    energy,
    source: row.source || "import",
    importedAt: row.importedAt || new Date().toISOString()
  };
}

export function parseVehicleMasterRows(rows: string[][]): VehicleMasterRecord[] {
  if (rows.length === 0) return [];
  const headers = rows[0];
  const headerMap: { [colIndex: number]: string } = {};

  headers.forEach((h, idx) => {
    const field = findMappedField(h);
    if (field) {
      headerMap[idx] = field;
    }
  });

  const records: VehicleMasterRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && !row[0])) {
      continue;
    }
    const record: any = {};
    row.forEach((cell, idx) => {
      const field = headerMap[idx];
      if (field) {
        record[field] = cell;
      }
    });
    records.push(normalizeVehicleMasterRecord(record));
  }
  return records;
}

export function validateVehicleMasterImport(records: VehicleMasterRecord[]): VehicleMasterImportResult {
  const seenVins = new Set<string>();
  const seenPlates = new Set<string>();
  const validRecords: VehicleMasterRecord[] = [];
  let duplicateVinCount = 0;
  let duplicatePlateCount = 0;
  let ignoredCount = 0;
  const errors: string[] = [];

  for (const r of records) {
    if (!r.vin && !r.plateNumber) {
      ignoredCount++;
      continue;
    }

    let isDuplicate = false;

    if (r.vin) {
      if (seenVins.has(r.vin)) {
        duplicateVinCount++;
        errors.push(`Doublon VIN détecté : ${r.vin}`);
        isDuplicate = true;
      } else {
        seenVins.add(r.vin);
      }
    }

    if (r.plateNumber) {
      const cleanPlate = r.plateNumber.toUpperCase().replace(/\s+/g, "");
      if (seenPlates.has(cleanPlate)) {
        duplicatePlateCount++;
        errors.push(`Doublon immatriculation détectée : ${r.plateNumber}`);
        isDuplicate = true;
      } else {
        seenPlates.add(cleanPlate);
      }
    }

    if (!isDuplicate) {
      validRecords.push(r);
    }
  }

  return {
    records: validRecords,
    importedCount: validRecords.length,
    ignoredCount,
    duplicateVinCount,
    duplicatePlateCount,
    errors,
    warnings: []
  };
}

export function parseVehicleMasterCsv(text: string): VehicleMasterImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rows = parseCsvRaw(text);
  if (rows.length === 0) {
    return {
      records: [],
      importedCount: 0,
      ignoredCount: 0,
      duplicateVinCount: 0,
      duplicatePlateCount: 0,
      errors: ["Le fichier CSV est vide."],
      warnings
    };
  }

  const headers = rows[0];
  const headerFields = headers.map(findMappedField);
  const matchedFields = headerFields.filter(f => f !== null) as string[];

  headers.forEach((h, idx) => {
    if (!headerFields[idx]) {
      warnings.push(`Colonne inconnue ignorée : "${h}"`);
    }
  });

  const hasVinOrPlate = matchedFields.includes("vin") || matchedFields.includes("plateNumber");
  if (!hasVinOrPlate) {
    errors.push("Colonnes obligatoires manquantes : au moins 'VIN' ou 'Immatriculation' doit être présent.");
  }

  const records = parseVehicleMasterRows(rows);
  const validationResult = validateVehicleMasterImport(records);

  return {
    records: validationResult.records,
    importedCount: validationResult.importedCount,
    ignoredCount: validationResult.ignoredCount,
    duplicateVinCount: validationResult.duplicateVinCount,
    duplicatePlateCount: validationResult.duplicatePlateCount,
    errors: [...errors, ...validationResult.errors],
    warnings: [...warnings, ...validationResult.warnings]
  };
}

export function searchVehicleMaster(records: VehicleMasterRecord[], query: string): VehicleMasterRecord[] {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return [];

  return records.filter(r => {
    return (
      (r.vin && r.vin.toLowerCase().includes(cleanQuery)) ||
      (r.plateNumber && r.plateNumber.toLowerCase().includes(cleanQuery)) ||
      (r.customerName && r.customerName.toLowerCase().includes(cleanQuery)) ||
      (r.customerPhone && r.customerPhone.toLowerCase().includes(cleanQuery)) ||
      (r.model && r.model.toLowerCase().includes(cleanQuery)) ||
      (r.brand && r.brand.toLowerCase().includes(cleanQuery)) ||
      (r.itemNo && r.itemNo.toLowerCase().includes(cleanQuery))
    );
  });
}

export function findVehicleByVin(records: VehicleMasterRecord[], vin: string): VehicleMasterRecord | undefined {
  if (!vin) return undefined;
  const cleanVin = vin.toUpperCase().replace(/\s+/g, "");
  return records.find(r => r.vin && r.vin.toUpperCase().replace(/\s+/g, "") === cleanVin);
}

export function findVehicleByPlate(records: VehicleMasterRecord[], plate: string): VehicleMasterRecord | undefined {
  if (!plate) return undefined;
  const cleanPlate = plate.toUpperCase().replace(/\s+/g, "");
  return records.find(r => r.plateNumber && r.plateNumber.toUpperCase().replace(/\s+/g, "") === cleanPlate);
}

export function getVehicleWarrantyStatus(vehicle: VehicleMasterRecord, today: Date): VehicleWarrantyStatus {
  if (!vehicle.warrantyPartsEndDate && !vehicle.warrantyLaborEndDate) {
    return "Garantie inconnue";
  }

  const todayStr = today.toISOString().split("T")[0];
  let hasValid = false;

  if (vehicle.warrantyPartsEndDate && todayStr <= vehicle.warrantyPartsEndDate) {
    hasValid = true;
  }
  if (vehicle.warrantyLaborEndDate && todayStr <= vehicle.warrantyLaborEndDate) {
    hasValid = true;
  }

  return hasValid ? "Garantie active" : "Garantie expirée";
}

export function getVehicleReceptionHints(vehicle: VehicleMasterRecord, today: Date): VehicleReceptionHint {
  const warrantyStatus = getVehicleWarrantyStatus(vehicle, today);
  const hasActiveWarranty = warrantyStatus === "Garantie active";

  let lastServiceInfo: string | undefined;
  if (vehicle.lastServiceDate) {
    const kmStr = vehicle.lastServiceMileage !== undefined ? ` à ${vehicle.lastServiceMileage} km` : "";
    lastServiceInfo = `Dernier entretien le ${vehicle.lastServiceDate}${kmStr}`;
  }

  let recommendedService: string | undefined;
  if (vehicle.lastServiceDate) {
    const lastDate = new Date(vehicle.lastServiceDate);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      recommendedService = "Entretien annuel dépassé. Prévoir révision.";
    }
  }

  return {
    warrantyStatus,
    lastServiceInfo,
    hasActiveWarranty,
    recommendedService
  };
}
