import assert from "node:assert/strict";
import {
  maskPhoneNumber,
  normalizePlateNumber,
  sanitizeFreeText,
  validateConditionalVin,
  validateComplaintText,
  validateCustomerName,
  validateDeliveryRestitutionStatus,
  validateMileage,
  validatePlateNumber,
  validateReceptionDates,
  validateStructuredTechnicianDiagnostic,
  validateTechnicianDiagnostic,
  validateTunisianPhone,
  validateVin,
} from "../src/field-validations";
import { InterventionType } from "../src/types";

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

assert.equal(validateStructuredTechnicianDiagnostic({
  cause: "ok",
  action: "Remplacement du composant concerné effectué avec contrôle visuel.",
  validation: "Essai statique conforme et aucune anomalie résiduelle détectée.",
}).valid, false);
assert.equal(validateStructuredTechnicianDiagnostic({
  cause: "Usure anormale confirmée après contrôle visuel complet.",
  action: "Remplacement de la pièce concernée et serrage contrôlé.",
  validation: "Essai statique conforme et aucune anomalie résiduelle détectée.",
}).valid, true);

assert.deepEqual(validateConditionalVin({
  vin: "",
  typeDossier: InterventionType.GARANTIE_CONSTRUCTEUR,
}).blocking, true);
assert.deepEqual(validateConditionalVin({
  vin: "VIN-COURT",
  typeDossier: InterventionType.ENTRETIEN_RAPIDE,
}).blocking, false);
assert.equal(validateConditionalVin({
  vin: "1HGCM82633A004352",
  vehiculeModele: "Dongfeng EV",
}).valid, true);

assert.equal(validateReceptionDates({
  dateLivraison: "2026-06-20",
  typeDossier: InterventionType.ENTRETIEN_RAPIDE,
  now: new Date("2026-06-18T08:00:00"),
}).valid, false);
assert.equal(validateReceptionDates({
  dateLivraison: "2026-06-20",
  typeDossier: InterventionType.PREPARATION_LIVRAISON,
  now: new Date("2026-06-18T08:00:00"),
}).valid, true);
assert.equal(validateReceptionDates({
  dateLivraison: "2026-06-15",
  dateMiseCirculation: "2026-06-14",
  now: new Date("2026-06-18T08:00:00"),
}).warnings.length, 1);

assert.equal(validateDeliveryRestitutionStatus("Réserve client", "").valid, false);
assert.equal(validateDeliveryRestitutionStatus("Réserve client", "Client signale une réserve sur la propreté.").valid, true);

const sanitized = sanitizeFreeText('Client <script>alert("x")</script><b>OK</b> javascript:alert(1)');
assert.equal(sanitized.includes("<"), false);
assert.equal(sanitized.includes("script"), false);
assert.equal(sanitized.includes("javascript:"), false);
assert.equal(sanitized, "Client OKalert(1)");

assert.equal(maskPhoneNumber("+216 55 111 001"), "+216 ** *** 001");
assert.equal(maskPhoneNumber("55 111 001"), "** *** 001");

console.log("field-validations.test.ts OK");
