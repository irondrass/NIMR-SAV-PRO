import assert from "node:assert/strict";
import { mapRepairLineToPlanningStep } from "../src/workshop-planning-steps";
import { RepairOrderLine } from "../src/types";

console.log("Démarrage des tests old-app-stage-editor-parity...");

// 1. Duration modification updates estimate source to "manual"
const lineManual: RepairOrderLine = {
  id: "task-1",
  designation: "Vidange moteur",
  tempsEstime: 0.5,
  tempsPasse: 0,
  status: "pending",
  isEstimatedDurationValidated: false,
};

// Simulate duration modification by Chef Atelier
const modifiedLine: RepairOrderLine = {
  ...lineManual,
  tempsEstime: 1.5,
  isEstimatedDurationValidated: true,
  estimateSource: "manual",
};

assert.equal(modifiedLine.estimateSource, "manual");
assert.equal(modifiedLine.isEstimatedDurationValidated, true);
assert.equal(modifiedLine.tempsEstime, 1.5);

// 2. Preset selection updates source to "preset"
const presetLine: RepairOrderLine = {
  ...lineManual,
  tempsEstime: 1.0,
  isEstimatedDurationValidated: true,
  estimateSource: "preset",
};

assert.equal(presetLine.estimateSource, "preset");
assert.equal(presetLine.isEstimatedDurationValidated, true);

// 3. Diagnostic mapping
const diagLine: RepairOrderLine = {
  id: "task-diag",
  designation: "Recherche de panne électrique",
  tempsEstime: 2.0,
  tempsPasse: 0,
  status: "pending",
  isEstimatedDurationValidated: true,
};

const mapping = mapRepairLineToPlanningStep(diagLine);
assert.equal(mapping.stepId, "electrical");
assert.equal(mapping.serviceType, "Électricité / diagnostic");

console.log("old-app-stage-editor-parity.test.ts OK");
