import assert from "node:assert/strict";
import { isWorkshopClosed } from "../src/workshop-availability";
import { WorkshopAvailabilityConfig } from "../src/types";
import { getDefaultWorkshopSchedule } from "../src/workshop-availability";

console.log("Running closed-workshop-labels.test.ts...");

const config: WorkshopAvailabilityConfig = {
  schedule: getDefaultWorkshopSchedule(),
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: [],
};

// Sunday: Day 0 -> should be closed
const sundayDate = new Date("2026-07-05T10:00:00.000Z"); // Sunday
assert.equal(isWorkshopClosed(sundayDate, config), true);

// Monday 10:00 -> should be open
const mondayWorking = new Date("2026-07-06T10:00:00.000Z"); // Monday
assert.equal(isWorkshopClosed(mondayWorking, config), false);

console.log("closed-workshop-labels.test.ts passed!");
