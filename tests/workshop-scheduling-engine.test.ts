import assert from "node:assert/strict";
import {
  calculateWorkshopCapacityKpi,
  detectSlotConflicts,
  findSchedulingSlots,
  hasRequiredSkills,
  intervalsOverlap,
  replanUnlockedBookings,
  validatePartsForPlanning,
  validateTaskDependencies,
} from "../src/workshop-scheduling/engine";
import {
  SchedulingEmployee,
  SchedulingMaterialResource,
  WorkshopBooking,
  WorkshopTask,
} from "../src/workshop-scheduling/types";

const dayWindow = { start: "2026-08-03T08:00:00.000Z", end: "2026-08-03T17:00:00.000Z" };

const employee: SchedulingEmployee = {
  id: "employee-1",
  name: "Technicien senior",
  siteId: "site-1",
  workshopId: "workshop-1",
  active: true,
  skills: [{ skillId: "electric", level: "senior" }],
  productiveMinutesPerDay: 420,
  targetProductivity: 100,
  allowsParallelTasks: false,
  workingWindows: [dayWindow],
  unavailableWindows: [{ start: "2026-08-03T12:00:00.000Z", end: "2026-08-03T13:00:00.000Z" }],
};

const material: SchedulingMaterialResource = {
  id: "lift-1",
  code: "PONT-01",
  name: "Pont 01",
  typeId: "lift",
  siteId: "site-1",
  workshopId: "workshop-1",
  state: "available",
  active: true,
  shareable: false,
  simultaneousCapacity: 1,
  compatibleOperationFamilies: ["electric"],
  compatibleEnergies: [],
  availableWindows: [dayWindow],
  unavailableWindows: [],
};

function task(overrides: Partial<WorkshopTask> = {}): WorkshopTask {
  return {
    id: "task-1",
    workOrderId: "or-1",
    vehicleId: "vehicle-1",
    siteId: "site-1",
    workshopId: "workshop-1",
    label: "Diagnostic electrique",
    operationFamily: "electric",
    status: "ready_to_plan",
    priority: 4,
    standardDurationMinutes: 60,
    plannedDurationMinutes: 60,
    actualDurationMinutes: 0,
    preparationMinutes: 15,
    executionMinutes: 60,
    dryingMinutes: 0,
    immobilizationMinutes: 0,
    qualityControlMinutes: 15,
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    splittable: false,
    minimumTechnicians: 1,
    maximumTechnicians: 1,
    requiredSkills: [{ skillId: "electric", minimumLevel: "autonomous", required: true }],
    requiredMaterialTypeIds: ["lift"],
    optionalMaterialTypeIds: [],
    dependencies: [],
    parts: [],
    mayStartWithoutAllParts: false,
    promisedAt: "2026-08-03T17:00:00.000Z",
    locked: false,
    ...overrides,
  };
}

function booking(overrides: Partial<WorkshopBooking> = {}): WorkshopBooking {
  return {
    id: "booking-1",
    taskId: "task-existing",
    workOrderId: "or-existing",
    vehicleId: "vehicle-existing",
    start: "2026-08-03T08:00:00.000Z",
    end: "2026-08-03T09:30:00.000Z",
    employeeIds: ["employee-1"],
    materialResourceIds: ["lift-1"],
    status: "server_confirmed",
    locked: false,
    overbooked: false,
    operationId: "operation-1",
    attempts: 1,
    ...overrides,
  };
}

console.log("Running workshop scheduling engine tests...");

assert.equal(intervalsOverlap(dayWindow, { start: dayWindow.end, end: "2026-08-03T18:00:00.000Z" }), false);
assert.equal(intervalsOverlap(dayWindow, { start: "2026-08-03T16:59:00.000Z", end: "2026-08-03T18:00:00.000Z" }), true);
assert.equal(hasRequiredSkills(employee, task()), true);
assert.equal(hasRequiredSkills({ ...employee, skills: [{ skillId: "electric", level: "junior" }] }, task()), false);

const unavailableParts = task({
  parts: [{
    partId: "PART-1",
    quantity: 1,
    availability: "ordered",
    requiredBeforePlanning: true,
    requiredBeforeStart: true,
  }],
});
assert.equal(validatePartsForPlanning(unavailableParts)[0]?.code, "PART_UNAVAILABLE");

const dependent = task({
  dependencies: [{ predecessorTaskId: "previous", type: "finish_start", required: true, minimumLagMinutes: 30 }],
});
assert.equal(validateTaskDependencies(dependent, [], dayWindow.start)[0]?.code, "DEPENDENCY_INCOMPLETE");

const collisionCodes = detectSlotConflicts(
  task(),
  { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
  ["employee-1"],
  ["lift-1"],
  [booking()],
).map(item => item.code);
assert.ok(collisionCodes.includes("EMPLOYEE_OVERLAP"));
assert.ok(collisionCodes.includes("MATERIAL_OVERLAP"));

const shareableMaterial = { ...material, shareable: true, simultaneousCapacity: 2 };
const oneOfTwoSlotsUsed = detectSlotConflicts(
  task(),
  { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
  [],
  ["lift-1"],
  [booking({ employeeIds: [] })],
  [],
  [shareableMaterial],
);
assert.equal(oneOfTwoSlotsUsed.some(item => item.code === "MATERIAL_OVERLAP"), false);

const bothSlotsUsed = detectSlotConflicts(
  task(),
  { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
  [],
  ["lift-1"],
  [
    booking({ id: "booking-capacity-1", employeeIds: [] }),
    booking({ id: "booking-capacity-2", employeeIds: [] }),
  ],
  [],
  [shareableMaterial],
);
assert.equal(bothSlotsUsed.some(item => item.code === "MATERIAL_OVERLAP"), true);

const result = findSchedulingSlots({
  task: task({ dryingMinutes: 30 }),
  employees: [employee],
  materialResources: [material],
  bookings: [booking()],
  tasks: [],
  searchFrom: dayWindow.start,
  searchUntil: dayWindow.end,
  granularityMinutes: 15,
  alternatives: 2,
});
assert.ok(result.recommended);
assert.equal(result.recommended?.start, "2026-08-03T09:30:00.000Z");
assert.equal(new Date(result.recommended!.end).getTime() - new Date(result.recommended!.start).getTime(), 130 * 60_000);
assert.equal(result.alternatives.length, 2);

const lunchResult = findSchedulingSlots({
  task: task(),
  employees: [employee],
  materialResources: [material],
  bookings: [],
  tasks: [],
  searchFrom: "2026-08-03T11:30:00.000Z",
  searchUntil: dayWindow.end,
  granularityMinutes: 15,
  alternatives: 1,
});
assert.equal(lunchResult.recommended?.start, "2026-08-03T13:00:00.000Z");

const replanned = replanUnlockedBookings(
  [booking({ locked: true }), booking({ id: "booking-2", locked: false })],
  () => result.recommended,
);
assert.equal(replanned[0].start, booking().start);
assert.equal(replanned[1].start, result.recommended?.start);
assert.equal(replanned[1].status, "local_pending");

const kpi = calculateWorkshopCapacityKpi([booking()], [employee], [task({ status: "completed", actualDurationMinutes: 55 })], dayWindow);
assert.equal(kpi.plannedMinutes, 90);
assert.equal(kpi.completedMinutes, 55);
assert.equal(kpi.occupancyRate, 21);
assert.equal(kpi.limitingResource, "lift-1");

console.log("workshop-scheduling-engine: OK");
