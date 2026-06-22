/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DELIVERY_RESTITUTION_STATUSES, InterventionType } from "./types";

const FORBIDDEN_SHORT_DIAGNOSTICS = ["ok", "fait", "ras", "done"];
const STRUCTURED_DIAGNOSTIC_MIN_LENGTH = 15;

export interface StructuredTechnicianDiagnosticInput {
  cause: string;
  action: string;
  validation: string;
}

export interface ConditionalVinContext {
  vin: string;
  typeDossier?: InterventionType | string;
  vehiculeModele?: string;
  vehiculeVersion?: string;
  plainteClient?: string;
  vehicleMasterVinAvailable?: boolean;
}

export interface ReceptionDateValidationContext {
  dateLivraison?: string;
  dateMiseCirculation?: string;
  typeDossier?: InterventionType | string;
  vehiculeKilometrage?: number;
  now?: Date;
}

export function validateTunisianPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-]+/g, "");
  if (/[a-zA-Z]/.test(cleaned)) return false;
  // Accept 8 digits with optional +216 or 00216 prefix (Tunisian)
  return /^(?:\+216|00216)?\d{8}$/.test(cleaned);
}

export function validateVin(vin: string): boolean {
  const cleaned = vin.trim().toUpperCase();
  if (!cleaned) return true; // non-blocking if empty
  if (cleaned.length !== 17) return false;
  if (/[IOQ]/i.test(cleaned)) return false;
  return /^[A-Z0-9]{17}$/.test(cleaned);
}

export function validatePlateNumber(plate: string): boolean {
  const cleaned = normalizePlateNumber(plate);
  if (!cleaned) return false;
  return /^[A-Z0-9\s-]+$/i.test(cleaned) && cleaned.length >= 3;
}

export function normalizePlateNumber(plate: string): string {
  return sanitizeFreeText(plate).toUpperCase().replace(/\s+/g, " ").trim();
}

export function validateMileage(km: number | string): { valid: boolean; mustConfirm: boolean; reason?: string } {
  const num = typeof km === "number" ? km : Number(km);
  if (isNaN(num) || num < 0) {
    return { valid: false, mustConfirm: false, reason: "Le kilométrage ne peut pas être négatif." };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, mustConfirm: false, reason: "Le kilométrage doit être un entier." };
  }
  if (num > 999999) {
    return { valid: false, mustConfirm: false, reason: "Le kilométrage dépasse la limite maximale autorisée (999 999 km)." };
  }
  if (num > 500000) {
    return { valid: true, mustConfirm: true, reason: "Kilométrage très élevé, veuillez confirmer." };
  }
  return { valid: true, mustConfirm: false };
}

export function validateCustomerName(name: string): boolean {
  return name.trim().length >= 2;
}

export function validateComplaintText(text: string, isPreset?: boolean): boolean {
  const cleaned = text.trim();
  if (isPreset) return cleaned.length > 0;
  return cleaned.length >= 10;
}

export function validateTechnicianDiagnostic(text: string, isPreset?: boolean): boolean {
  const cleaned = normalizeShortDiagnostic(text);
  if (FORBIDDEN_SHORT_DIAGNOSTICS.includes(cleaned)) return false;
  if (isPreset) return cleaned.length > 0;
  return text.trim().length >= 15;
}

export function buildStructuredTechnicianDiagnostic(input: StructuredTechnicianDiagnosticInput): string {
  const cause = sanitizeFreeText(input.cause);
  const action = sanitizeFreeText(input.action);
  const validation = sanitizeFreeText(input.validation);
  return [
    `Cause constatée: ${cause}`,
    `Action réalisée: ${action}`,
    `Test / validation finale: ${validation}`,
  ].join("\n");
}

export function validateStructuredTechnicianDiagnostic(
  input: StructuredTechnicianDiagnosticInput
): { valid: boolean; reason?: string; diagnostic?: string } {
  const fields = [
    { label: "Cause constatée", value: sanitizeFreeText(input.cause) },
    { label: "Action réalisée", value: sanitizeFreeText(input.action) },
    { label: "Test / validation finale", value: sanitizeFreeText(input.validation) },
  ];

  const missing = fields.find(field => field.value.length < STRUCTURED_DIAGNOSTIC_MIN_LENGTH);
  if (missing) {
    return {
      valid: false,
      reason: `${missing.label} obligatoire (${STRUCTURED_DIAGNOSTIC_MIN_LENGTH} caractères minimum).`,
    };
  }

  const tooShort = fields.find(field => FORBIDDEN_SHORT_DIAGNOSTICS.includes(normalizeShortDiagnostic(field.value)));
  if (tooShort) {
    return {
      valid: false,
      reason: "Diagnostic trop court ou non exploitable.",
    };
  }

  const diagnostic = buildStructuredTechnicianDiagnostic({
    cause: fields[0].value,
    action: fields[1].value,
    validation: fields[2].value,
  });

  if (!validateTechnicianDiagnostic(diagnostic, false)) {
    return {
      valid: false,
      reason: "Diagnostic final non exploitable.",
    };
  }

  return { valid: true, diagnostic };
}

export function isElectricOrHybridVehicle(model?: string, version?: string): boolean {
  const text = `${model || ""} ${version || ""}`.toUpperCase();
  return /\b(EV|HEV|PHEV|HYBRIDE|HYBRID|ELECTRIQUE|ELECTRIQUE|E-POWER)\b/.test(text);
}

export function isSecurityRelatedIntervention(text?: string): boolean {
  const cleaned = sanitizeFreeText(text || "").toLowerCase();
  return /(sécurité|securite|frein|airbag|direction|ceinture|abs|esp|adblue|haute tension|batterie traction)/i.test(cleaned);
}

export function validateConditionalVin(context: ConditionalVinContext): {
  required: boolean;
  valid: boolean;
  blocking: boolean;
  reason?: string;
  warning?: string;
} {
  const vin = sanitizeFreeText(context.vin).toUpperCase();
  const reasons: string[] = [];

  if (context.typeDossier === InterventionType.GARANTIE_CONSTRUCTEUR || context.typeDossier === "garantie constructeur") {
    reasons.push("garantie constructeur");
  }
  if (isElectricOrHybridVehicle(context.vehiculeModele, context.vehiculeVersion)) {
    reasons.push("véhicule EV / HEV / PHEV");
  }
  if (isSecurityRelatedIntervention(context.plainteClient)) {
    reasons.push("intervention liée sécurité");
  }
  if (context.vehicleMasterVinAvailable) {
    reasons.push("VIN disponible dans le référentiel véhicule");
  }

  const required = reasons.length > 0;
  const vinValid = validateVin(vin);

  if (required && !vin) {
    return {
      required,
      valid: false,
      blocking: true,
      reason: `VIN obligatoire pour ${reasons.join(", ")}.`,
    };
  }

  if (required && !vinValid) {
    return {
      required,
      valid: false,
      blocking: true,
      reason: "VIN invalide : 17 caractères requis, sans I, O, Q.",
    };
  }

  if (vin && !vinValid) {
    return {
      required,
      valid: false,
      blocking: false,
      warning: "VIN invalide : saisie acceptée en réception rapide simple, à corriger avant garantie/sécurité.",
    };
  }

  return { required, valid: true, blocking: false };
}

export function validateReceptionDates(context: ReceptionDateValidationContext): {
  valid: boolean;
  blockingReasons: string[];
  warnings: string[];
} {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const now = context.now || new Date();
  const pdiOrNewVehicle = isPdiOrNewVehicle(context.typeDossier);
  const deliveryDate = parseDateOnly(context.dateLivraison);
  const circulationDate = parseDateOnly(context.dateMiseCirculation);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (deliveryDate && deliveryDate.getTime() > today && !pdiOrNewVehicle) {
    blockingReasons.push("Date livraison future interdite hors PDI/VN.");
  }

  // MEC date validations
  if (circulationDate) {
    if (circulationDate.getTime() > today && !pdiOrNewVehicle) {
      blockingReasons.push("La date de mise en circulation ne peut pas être dans le futur.");
    } else if (!pdiOrNewVehicle) {
      // Age in months
      const ageMs = today - circulationDate.getTime();
      const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);
      const km = context.vehiculeKilometrage;
      if (km !== undefined && ageMonths > 36 && km < 1000) {
        warnings.push("Véhicule de plus de 3 ans avec moins de 1000 km : vérifier la cohérence du kilométrage.");
      }
      if (km !== undefined && ageMonths < 3 && km > 30000) {
        warnings.push("Véhicule de moins de 3 mois avec plus de 30000 km : vérifier la cohérence du kilométrage.");
      }
    }
  } else if (!pdiOrNewVehicle) {
    warnings.push("Date de mise en circulation manquante.");
  }

  if (context.vehiculeKilometrage !== undefined && context.vehiculeKilometrage > 500000) {
    warnings.push("Kilométrage très élevé, veuillez confirmer.");
  }

  if (deliveryDate && circulationDate && circulationDate.getTime() < deliveryDate.getTime()) {
    warnings.push("Date de mise en circulation antérieure à la date de livraison : vérifier la cohérence dossier.");
  }

  return {
    valid: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
}

export function validateDeliveryRestitutionStatus(status: string | undefined, comment: string): { valid: boolean; reason?: string } {
  if (!status || !DELIVERY_RESTITUTION_STATUSES.includes(status as any)) {
    return { valid: false, reason: "Statut de restitution obligatoire." };
  }
  if ((status === "Réserve client" || status === "Client mécontent") && !sanitizeFreeText(comment).trim()) {
    return { valid: false, reason: "Commentaire obligatoire pour une réserve client ou un client mécontent." };
  }
  return { valid: true };
}

export function sanitizeFreeText(text: string): string {
  if (!text) return "";
  // Strip script tags and their content
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/\s*javascript\s*:/gi, "");
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/[<>{}`]/g, "");
  return sanitized.trim();
}

export function maskPhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  const suffix = digits.slice(-3);
  if (trimmed.startsWith("+216")) {
    return `+216 ** *** ${suffix || "***"}`;
  }
  return `** *** ${suffix || "***"}`;
}

function normalizeShortDiagnostic(text: string): string {
  return sanitizeFreeText(text).trim().toLowerCase().replace(/\s+/g, "");
}

function isPdiOrNewVehicle(type?: InterventionType | string): boolean {
  const cleaned = String(type || "").toLowerCase();
  return cleaned.includes("préparation livraison") || cleaned.includes("preparation livraison") || cleaned.includes("pdi") || cleaned.includes("vn");
}

function parseDateOnly(value?: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  return new Date(year, month - 1, day);
}
