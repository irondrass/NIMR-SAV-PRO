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
  vin: [
    "vin",
    "no chassis vin",
    "chassis vin",
    "chassis",
    "châssis",
    "n chassis",
    "n chassis vin",
    "no chassis",
    "num chassis",
    "numero chassis",
    "numero chassis vin",
    "serial no",
    "serial no.",
    "serial number",
    "vehicle identification number"
  ],
  plateNumber: [
    "immatriculation",
    "n immat",
    "no immat",
    "plate",
    "matricule",
    "registration no",
    "registration no."
  ],
  customerName: [
    "nom",
    "client",
    "nom client",
    "customer",
    "customer name",
    "sell to customer name",
    "sell-to customer name",
    "bill to name",
    "bill-to name",
    "nom du client",
    "proprietaire",
    "owner",
    "societe"
  ],
  customerPhone: [
    "n telephone",
    "no telephone",
    "telephone",
    "tel",
    "phone",
    "mobile",
    "gsm",
    "customer phone",
    "n° telephone"
  ],
  brand: ["brand", "marque"],
  model: [
    "modele",
    "model",
    "description",
    "designation",
    "description modele",
    "item description",
    "vehicle description"
  ],
  version: ["version"],
  itemNo: ["code article", "item no", "n article", "no article", "article"],
  deliveryDate: ["date livraison", "date de livraison", "delivery date"],
  circulationDate: [
    "date mise en circulation",
    "mise en circulation",
    "prem immat",
    "circulation date",
    "date mec"
  ],
  saleDate: ["date vente", "sale date"],
  warrantyPartsEndDate: [
    "date fin garantie pieces",
    "warranty parts end date",
    "warranty end date"
  ],
  warrantyLaborEndDate: [
    "date fin garantie mo",
    "warranty labor end date",
    "warranty end date"
  ],
  lastServiceDate: ["dernier entretien", "last service date"],
  lastServiceMileage: ["kilometrage dernier entretien", "last service mileage"]
} as const;

const EMPTY_VIN_VALUES = new Set(["", "PAS DE VIN", "N/A", "NA", "-"]);

export function normalizeHeader(h: string): string {
  if (!h) return "";
  let clean = h.replace(/^\uFEFF/, "").toLowerCase();
  
  // Normalise les accents
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Remplacer ponctuation et séparateurs fréquents des exports DMS par des espaces.
  clean = clean.replace(/[°º'’`´\-_.()[\]{}\\/|,:;]/g, " ");
  
  // Conserver uniquement les caractères alphanumériques et les espaces
  clean = clean.replace(/[^a-z0-9\s]/g, "");
  
  // Espaces multiples -> espace unique
  clean = clean.replace(/\s+/g, " ");
  
  return clean.trim();
}

export function findMappedField(header: string): keyof VehicleMasterRecord | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  for (const [field, aliases] of Object.entries(MAPPED_KEYS)) {
    if (aliases.some(alias => normalizeHeader(alias) === norm)) {
      return field as keyof VehicleMasterRecord;
    }
  }

  const has = (term: string) => norm.split(" ").includes(term);
  if ((has("chassis") && has("vin")) || has("chassis") || norm.includes("vehicle identification number") || norm.includes("serial number")) {
    return "vin";
  }
  if (norm === "nom" || norm.includes("customer name") || norm.includes("sell to customer name") || norm.includes("bill to name")) {
    return "customerName";
  }
  if (has("telephone") || has("tel") || has("phone") || has("mobile") || has("gsm")) {
    return "customerPhone";
  }
  if (norm === "matricule" || has("immatriculation") || norm.includes("immat") || norm.includes("registration") || has("plate")) {
    return "plateNumber";
  }
  if ((has("n") || has("no") || has("code")) && has("article")) {
    return "itemNo";
  }
  if (has("description") || has("modele") || has("model") || has("designation")) {
    return "model";
  }
  if (norm.includes("mise en circulation") || norm.includes("circulation date") || norm.includes("date mec")) {
    return "circulationDate";
  }
  if (norm.includes("date livraison") || norm.includes("delivery date")) {
    return "deliveryDate";
  }
  return null;
}

function countReplacementCharacters(text: string): number {
  return (text.match(/\uFFFD/g) || []).length;
}

export function decodeVehicleMasterCsvBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const candidates = ["utf-8", "windows-1252", "iso-8859-1"].map(encoding => {
    try {
      const text = new TextDecoder(encoding, { fatal: false }).decode(bytes);
      return { encoding, text, invalidCount: countReplacementCharacters(text) };
    } catch {
      return { encoding, text: "", invalidCount: Number.MAX_SAFE_INTEGER };
    }
  });

  candidates.sort((a, b) => a.invalidCount - b.invalidCount);
  return candidates[0]?.text || "";
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

    const buildDate = (year: string, month: number, day: number) => {
      if (!year || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
      if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    if (p0.length === 4) {
      const parsed = buildDate(p0, Number(p1), Number(p2));
      if (parsed) return parsed;
    } else if (p2.length === 4 || p2.length === 2) {
      const year = p2.length === 4 ? p2 : Number(p2) > 50 ? `19${p2}` : `20${p2}`;
      const first = Number(p0);
      const second = Number(p1);
      const separator = trimmed.includes("/") ? "/" : "-";
      const month = first > 12 ? second : second > 12 ? first : separator === "/" ? first : second;
      const day = first > 12 ? first : second > 12 ? second : separator === "/" ? second : first;
      const parsed = buildDate(year, month, day);
      if (parsed) return parsed;
    }
  }

  return trimmed;
}

function normalizeVin(value: unknown): string | undefined {
  const vin = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return EMPTY_VIN_VALUES.has(vin) ? undefined : vin;
}

function normalizePhone(value: unknown): string | undefined {
  const phone = String(value ?? "").replace(/\s+/g, " ").trim();
  return phone || undefined;
}

function normalizeTextValue(value: unknown): string | undefined {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function inferVehicleBrandAndModel(description?: string, explicitBrand?: string): { brand?: string; model?: string } {
  const rawDescription = normalizeTextValue(description);
  const rawBrand = normalizeTextValue(explicitBrand);
  if (!rawDescription) {
    return { brand: rawBrand, model: undefined };
  }

  const upper = rawDescription.toUpperCase();
  const rules: Array<{ prefix: string; brand: string; displayModel?: string }> = [
    { prefix: "DONGFENG BOX EV 430", brand: "Dongfeng", displayModel: "BOX EV 430" },
    { prefix: "DONGFENG ", brand: "Dongfeng" },
    { prefix: "DFSK GLORY 580", brand: "DFSK", displayModel: "Glory 580" },
    { prefix: "DFSK ", brand: "DFSK" },
    { prefix: "FORTHING T5 EVO", brand: "Forthing", displayModel: "T5 EVO" },
    { prefix: "FORTHING ", brand: "Forthing" }
  ];

  for (const rule of rules) {
    if (upper.startsWith(rule.prefix)) {
      const model = rule.displayModel || rawDescription.slice(rule.prefix.length).trim();
      return { brand: rawBrand || rule.brand, model: model || rawDescription };
    }
  }

  if (rawBrand && upper.startsWith(rawBrand.toUpperCase())) {
    const stripped = rawDescription.slice(rawBrand.length).trim();
    return { brand: rawBrand, model: stripped || rawDescription };
  }

  return { brand: rawBrand, model: rawDescription };
}

export function normalizeVehicleMasterRecord(row: any): VehicleMasterRecord {
  const vin = normalizeVin(row.vin);
  const plateNumber = row.plateNumber ? String(row.plateNumber).toUpperCase().replace(/\s+/g, " ").trim() : undefined;
  const customerPhone = normalizePhone(row.customerPhone);
  const customerName = normalizeTextValue(row.customerName);
  const inferred = inferVehicleBrandAndModel(row.model, row.brand);
  const brand = inferred.brand;
  const model = inferred.model;
  const version = normalizeTextValue(row.version);
  const itemNo = normalizeTextValue(row.itemNo);
  const energy = normalizeTextValue(row.energy);

  const deliveryDate = normalizeDate(row.deliveryDate);
  const circulationDate = normalizeDate(row.circulationDate);
  const saleDate = normalizeDate(row.saleDate);
  let warrantyPartsEndDate = normalizeDate(row.warrantyPartsEndDate);
  let warrantyLaborEndDate = normalizeDate(row.warrantyLaborEndDate);
  if (warrantyPartsEndDate && !warrantyLaborEndDate) {
    warrantyLaborEndDate = warrantyPartsEndDate;
  } else if (warrantyLaborEndDate && !warrantyPartsEndDate) {
    warrantyPartsEndDate = warrantyLaborEndDate;
  }
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
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery) return [];

  return records.filter(r => {
    const searchable = [
      r.vin,
      r.plateNumber,
      r.id,
      r.itemNo,
      r.model,
      r.brand,
      r.customerName,
      r.customerPhone,
      r.circulationDate,
      r.deliveryDate
    ];
    return searchable.some(value => normalizeSearchText(value).includes(cleanQuery));
  });
}

export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-\/\\.]+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function getVehicleMasterStats(records: VehicleMasterRecord[]) {
  return {
    total: records.length,
    withVin: records.filter(r => !!normalizeVin(r.vin)).length,
    withClient: records.filter(r => !!normalizeTextValue(r.customerName)).length,
    withPhone: records.filter(r => !!normalizePhone(r.customerPhone)).length,
    withPlate: records.filter(r => !!normalizeTextValue(r.plateNumber)).length,
    withModel: records.filter(r => !!normalizeTextValue(r.model)).length
  };
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
