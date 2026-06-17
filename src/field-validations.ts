/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function validateTunisianPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-]+/g, "");
  if (/[a-zA-Z]/.test(cleaned)) return false;
  // Accept 8 digits, with or without +216
  const match = cleaned.match(/^(?:\+216)?\d{8}$/);
  return !!match;
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
  if (num > 1000000) {
    return { valid: false, mustConfirm: false, reason: "Le kilométrage dépasse la limite maximale autorisée (1 000 000 km)." };
  }
  if (num > 500000) {
    return { valid: true, mustConfirm: true, reason: "Kilométrage particulièrement élevé (> 500 000 km). Veuillez confirmer la plausibilité de cette saisie." };
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
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, "");
  const forbidden = ["ok", "fait", "ras", "done"];
  if (forbidden.includes(cleaned)) return false;
  if (isPreset) return cleaned.length > 0;
  return text.trim().length >= 15;
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
