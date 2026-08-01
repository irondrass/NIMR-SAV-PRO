import assert from "node:assert/strict";
import {
  confirmPendingBooking,
  createPendingBooking,
  WorkshopBookingConflictError,
  WorkshopSchedulingGateway,
} from "../src/workshop-scheduling/service";
import { BookingConfirmationRequest } from "../src/workshop-scheduling/types";

const request: BookingConfirmationRequest = {
  taskId: "task-1",
  start: "2026-08-03T08:00:00.000Z",
  end: "2026-08-03T09:00:00.000Z",
  employeeIds: ["employee-1"],
  materialResourceIds: ["lift-1"],
  operationId: "operation-1",
  overbook: false,
};

const pending = createPendingBooking(request, "work-order-1", "vehicle-1");

const conflictGateway: WorkshopSchedulingGateway = {
  canConfirmServerBooking: true,
  async confirmBooking() {
    return {
      status: "conflict",
      code: "EMPLOYEE_OVERLAP",
      message: "Le technicien est deja reserve.",
      alternatives: [],
    };
  },
  async saveSettings() {},
};

await assert.rejects(
  () => confirmPendingBooking(pending, conflictGateway),
  (error: unknown) => {
    assert.ok(error instanceof WorkshopBookingConflictError);
    assert.equal(error.code, "EMPLOYEE_OVERLAP");
    return true;
  },
);

const successGateway: WorkshopSchedulingGateway = {
  ...conflictGateway,
  async confirmBooking() {
    return {
      status: "server_confirmed",
      bookingId: "booking-1",
      serverVersion: 1,
    };
  },
};

const confirmed = await confirmPendingBooking(pending, successGateway);
assert.equal(confirmed.id, "booking-1");
assert.equal(confirmed.status, "server_confirmed");
assert.equal(confirmed.attempts, 1);

console.log("workshop-scheduling-service: OK");
