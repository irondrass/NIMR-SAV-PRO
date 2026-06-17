import assert from "node:assert/strict";
import {
  maskPhoneNumber,
  normalizePlateNumber,
  sanitizeFreeText,
  validateComplaintText,
  validateCustomerName,
  validateMileage,
  validatePlateNumber,
  validateTechnicianDiagnostic,
  validateTunisianPhone,
  validateVin,
} from "../src/field-validations";

console.log("Démarrage des tests field-validations...");

assert.equal(validateTunisianPhone("+216 20 000 001"), true);
assert.equal(validateTunisianPhone("20-000-001"), true);
assert.equal(validateTunisianPhone("+216 20 ABC 001"), false);

assert.equal(validateVin("1HGCM82633A004352"), true);
assert.equal(validateVin("1HGCM82633A00435Q"), false);
assert.equal(validateVin("VIN-COURT"), false);

assert.equal(validatePlateNumber("123 TU 456"), true);
assert.equal(normalizePlateNumber("  tn 123  tu 456  "), "TN 123 TU 456");

assert.deepEqual(validateMileage(-1), {
  valid: false,
  mustConfirm: false,
  reason: "Le kilométrage ne peut pas être négatif.",
});
assert.equal(validateMileage(500001).valid, true);
assert.equal(validateMileage(500001).mustConfirm, true);
assert.equal(validateMileage(1000001).valid, false);

assert.equal(validateCustomerName("A"), false);
assert.equal(validateCustomerName("Ali"), true);
assert.equal(validateComplaintText("panne", false), false);
assert.equal(validateComplaintText("Bruit moteur à froid", false), true);
assert.equal(validateTechnicianDiagnostic("ok"), false);
assert.equal(validateTechnicianDiagnostic("Réparation terminée après contrôle complet", false), true);
assert.equal(validateTechnicianDiagnostic("Modèle prédéfini", true), true);

const sanitized = sanitizeFreeText('Client <script>alert("x")</script><b>OK</b> javascript:alert(1)');
assert.equal(sanitized.includes("<"), false);
assert.equal(sanitized.includes("script"), false);
assert.equal(sanitized.includes("javascript:"), false);
assert.equal(sanitized, "Client OKalert(1)");

assert.equal(maskPhoneNumber("+216 55 111 001"), "+216 ** *** 001");
assert.equal(maskPhoneNumber("55 111 001"), "** *** 001");

console.log("field-validations.test.ts OK");
