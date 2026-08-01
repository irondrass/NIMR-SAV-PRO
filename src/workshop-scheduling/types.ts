/**
 * Canonical domain model for multi-resource workshop scheduling.
 * Existing SAV types are adapted at the UI boundary.
 */

export type SkillLevel = "junior" | "intermediate" | "autonomous" | "senior" | "expert" | "trainer";
export type DependencyType = "finish_start" | "start_start" | "finish_finish";
export type PartAvailability = "available" | "reserved" | "ordered" | "partial" | "unavailable" | "unknown";
export type BookingSyncStatus = "local_pending" | "server_confirmed" | "conflict" | "retry_pending" | "cancelled";
export type MaterialState = "available" | "occupied" | "reserved" | "maintenance" | "broken" | "blocked" | "out_of_service";
export type TaskExecutionStatus =
  | "draft"
  | "ready_to_plan"
  | "partially_planned"
  | "planned"
  | "in_progress"
  | "paused"
  | "blocked"
  | "waiting_parts"
  | "quality_control"
  | "non_compliant"
  | "completed"
  | "cancelled";

export interface TimeWindow {
  start: string;
  end: string;
}

export interface SkillRequirement {
  skillId: string;
  minimumLevel: SkillLevel;
  required: boolean;
}

export interface EmployeeSkill {
  skillId: string;
  level: SkillLevel;
  validUntil?: string;
}

export interface SchedulingEmployee {
  id: string;
  name: string;
  siteId: string;
  workshopId: string;
  teamId?: string;
  active: boolean;
  skills: EmployeeSkill[];
  productiveMinutesPerDay: number;
  targetProductivity: number;
  allowsParallelTasks: boolean;
  workingWindows: TimeWindow[];
  unavailableWindows: TimeWindow[];
}

export interface SchedulingMaterialResource {
  id: string;
  code: string;
  name: string;
  typeId: string;
  siteId: string;
  workshopId: string;
  state: MaterialState;
  active: boolean;
  shareable: boolean;
  simultaneousCapacity: number;
  compatibleOperationFamilies: string[];
  compatibleEnergies: string[];
  availableWindows: TimeWindow[];
  unavailableWindows: TimeWindow[];
}

export interface TaskPartRequirement {
  partId: string;
  quantity: number;
  availability: PartAvailability;
  expectedAt?: string;
  requiredBeforePlanning: boolean;
  requiredBeforeStart: boolean;
}

export interface TaskDependency {
  predecessorTaskId: string;
  type: DependencyType;
  required: boolean;
  minimumLagMinutes: number;
  maximumLagMinutes?: number;
}

export interface WorkshopTask {
  id: string;
  workOrderId: string;
  vehicleId: string;
  siteId: string;
  workshopId: string;
  label: string;
  description?: string;
  operationFamily: string;
  status: TaskExecutionStatus;
  priority: number;
  standardDurationMinutes: number;
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  preparationMinutes: number;
  executionMinutes: number;
  dryingMinutes: number;
  immobilizationMinutes: number;
  qualityControlMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  splittable: boolean;
  minimumTechnicians: number;
  maximumTechnicians: number;
  requiredSkills: SkillRequirement[];
  requiredMaterialTypeIds: string[];
  optionalMaterialTypeIds: string[];
  dependencies: TaskDependency[];
  parts: TaskPartRequirement[];
  mayStartWithoutAllParts: boolean;
  promisedAt?: string;
  desiredAt?: string;
  locked: boolean;
}

export interface WorkshopBooking {
  id: string;
  taskId: string;
  workOrderId: string;
  vehicleId: string;
  start: string;
  end: string;
  employeeIds: string[];
  materialResourceIds: string[];
  status: BookingSyncStatus;
  locked: boolean;
  overbooked: boolean;
  reason?: string;
  operationId: string;
  serverVersion?: number;
  lastSyncAt?: string;
  attempts: number;
  lastError?: string;
}

export interface SlotConflict {
  code: string;
  message: string;
  resourceId?: string;
  blockingUntil?: string;
}

export interface SlotRecommendation {
  start: string;
  end: string;
  employeeIds: string[];
  materialResourceIds: string[];
  score: number;
  promisedDateAtRisk: boolean;
  conflictsBeforeSlot: SlotConflict[];
  rationale: string[];
}

export interface SchedulingSearchInput {
  task: WorkshopTask;
  employees: SchedulingEmployee[];
  materialResources: SchedulingMaterialResource[];
  bookings: WorkshopBooking[];
  tasks: WorkshopTask[];
  searchFrom: string;
  searchUntil: string;
  granularityMinutes: 5 | 10 | 15 | 30 | 60;
  alternatives: number;
}

export interface SchedulingSearchResult {
  recommended?: SlotRecommendation;
  alternatives: SlotRecommendation[];
  impossibleReasons: SlotConflict[];
  limitingResource?: string;
}

export interface WorkshopSchedulingSettings {
  siteId: string;
  workshopId: string;
  granularityMinutes: 5 | 10 | 15 | 30 | 60;
  alternatives: number;
  defaultBufferMinutes: number;
  defaultQualityControlMinutes: number;
  defaultRoadTestMinutes: number;
  allowOverbooking: boolean;
  requirePartsBeforePlanning: boolean;
  optimizationWeights: {
    promisedDate: number;
    continuity: number;
    workloadBalance: number;
    vehicleImmobilization: number;
    skillFit: number;
  };
}

export interface WorkshopCapacityKpi {
  plannedMinutes: number;
  completedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  onTimeRate: number;
  replanningRate: number;
  qualityFailureRate: number;
  limitingResource?: string;
}

export interface BookingConfirmationRequest {
  taskId: string;
  start: string;
  end: string;
  employeeIds: string[];
  materialResourceIds: string[];
  operationId: string;
  overbook: boolean;
  reason?: string;
}

export interface BookingConfirmationResponse {
  bookingId: string;
  status: "server_confirmed";
  serverVersion: number;
  alternatives?: SlotRecommendation[];
}

export interface BookingConfirmationConflictResponse {
  status: "conflict";
  code: string;
  message: string;
  alternatives?: SlotRecommendation[];
}

export type BookingConfirmationResult =
  | BookingConfirmationResponse
  | BookingConfirmationConflictResponse;
