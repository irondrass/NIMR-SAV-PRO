import {
  SchedulingEmployee,
  SchedulingMaterialResource,
  SchedulingSearchInput,
  SchedulingSearchResult,
  SkillLevel,
  SlotConflict,
  SlotRecommendation,
  TimeWindow,
  WorkshopBooking,
  WorkshopCapacityKpi,
  WorkshopTask,
} from "./types";

const SKILL_LEVEL_RANK: Record<SkillLevel, number> = {
  junior: 1,
  intermediate: 2,
  autonomous: 3,
  senior: 4,
  expert: 5,
  trainer: 6,
};

function time(value: string): number {
  return new Date(value).getTime();
}

export function intervalsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return time(a.start) < time(b.end) && time(b.start) < time(a.end);
}

export function containsWindow(container: TimeWindow, requested: TimeWindow): boolean {
  return time(container.start) <= time(requested.start) && time(container.end) >= time(requested.end);
}

export function hasRequiredSkills(employee: SchedulingEmployee, task: WorkshopTask): boolean {
  return task.requiredSkills
    .filter(requirement => requirement.required)
    .every(requirement => {
      const skill = employee.skills.find(candidate => candidate.skillId === requirement.skillId);
      return Boolean(skill) && SKILL_LEVEL_RANK[skill!.level] >= SKILL_LEVEL_RANK[requirement.minimumLevel];
    });
}

export function validateTaskDependencies(task: WorkshopTask, tasks: WorkshopTask[], slotStart: string): SlotConflict[] {
  const conflicts: SlotConflict[] = [];
  for (const dependency of task.dependencies.filter(item => item.required)) {
    const predecessor = tasks.find(item => item.id === dependency.predecessorTaskId);
    if (!predecessor || predecessor.status !== "completed") {
      conflicts.push({
        code: "DEPENDENCY_INCOMPLETE",
        message: `La tache prerequise ${predecessor?.label ?? dependency.predecessorTaskId} n'est pas terminee.`,
        resourceId: dependency.predecessorTaskId,
      });
      continue;
    }
    const completedBookingEnd = predecessor.desiredAt;
    if (completedBookingEnd) {
      const earliest = time(completedBookingEnd) + dependency.minimumLagMinutes * 60_000;
      if (time(slotStart) < earliest) {
        conflicts.push({
          code: "DEPENDENCY_LAG",
          message: "Le delai minimal apres la tache prerequise n'est pas respecte.",
          blockingUntil: new Date(earliest).toISOString(),
        });
      }
    }
  }
  return conflicts;
}

export function validatePartsForPlanning(task: WorkshopTask): SlotConflict[] {
  return task.parts
    .filter(part => part.requiredBeforePlanning && !["available", "reserved"].includes(part.availability))
    .map(part => ({
      code: "PART_UNAVAILABLE",
      message: `La piece ${part.partId} est requise avant planification (${part.availability}).`,
      resourceId: part.partId,
      blockingUntil: part.expectedAt,
    }));
}

function bookingUsesEmployee(booking: WorkshopBooking, employeeId: string): boolean {
  return booking.employeeIds.includes(employeeId) && !["cancelled", "conflict"].includes(booking.status);
}

function bookingUsesMaterial(booking: WorkshopBooking, resourceId: string): boolean {
  return booking.materialResourceIds.includes(resourceId) && !["cancelled", "conflict"].includes(booking.status);
}

function isWindowAvailable(available: TimeWindow[], unavailable: TimeWindow[], slot: TimeWindow): boolean {
  return available.some(window => containsWindow(window, slot)) &&
    !unavailable.some(window => intervalsOverlap(window, slot));
}

export function detectSlotConflicts(
  task: WorkshopTask,
  slot: TimeWindow,
  employeeIds: string[],
  materialResourceIds: string[],
  bookings: WorkshopBooking[],
  tasks: WorkshopTask[] = [],
  materialResources: SchedulingMaterialResource[] = [],
): SlotConflict[] {
  const conflicts = [
    ...validateTaskDependencies(task, tasks, slot.start),
    ...validatePartsForPlanning(task),
  ];

  for (const booking of bookings) {
    if (!intervalsOverlap(slot, booking)) continue;
    if (booking.taskId === task.id) {
      conflicts.push({ code: "TASK_OVERLAP", message: "Cette tache possede deja une reservation sur ce creneau.", resourceId: task.id });
    }
    if (booking.vehicleId === task.vehicleId) {
      conflicts.push({ code: "VEHICLE_OVERLAP", message: "Le vehicule est deja immobilise par une autre tache.", resourceId: task.vehicleId });
    }
    const employee = employeeIds.find(id => bookingUsesEmployee(booking, id));
    if (employee) {
      conflicts.push({ code: "EMPLOYEE_OVERLAP", message: "Un technicien propose est deja reserve.", resourceId: employee, blockingUntil: booking.end });
    }
  }
  for (const materialId of materialResourceIds) {
    const overlapping = bookings.filter(booking =>
      bookingUsesMaterial(booking, materialId) && intervalsOverlap(booking, slot));
    const material = materialResources.find(resource => resource.id === materialId);
    const capacity = material?.shareable ? Math.max(1, material.simultaneousCapacity) : 1;
    if (overlapping.length >= capacity) {
      conflicts.push({
        code: "MATERIAL_OVERLAP",
        message: "La capacite simultanee de cette ressource materielle est atteinte.",
        resourceId: materialId,
        blockingUntil: overlapping.map(booking => booking.end).sort()[0],
      });
    }
  }
  return conflicts;
}

function eligibleEmployees(input: SchedulingSearchInput, slot: TimeWindow): SchedulingEmployee[] {
  return input.employees
    .filter(employee =>
      employee.active &&
      employee.siteId === input.task.siteId &&
      employee.workshopId === input.task.workshopId &&
      hasRequiredSkills(employee, input.task) &&
      isWindowAvailable(employee.workingWindows, employee.unavailableWindows, slot))
    .filter(employee => employee.allowsParallelTasks ||
      !input.bookings.some(booking => bookingUsesEmployee(booking, employee.id) && intervalsOverlap(booking, slot)))
    .sort((a, b) => {
      const aLoad = input.bookings.filter(booking => bookingUsesEmployee(booking, a.id)).reduce((sum, booking) => sum + time(booking.end) - time(booking.start), 0);
      const bLoad = input.bookings.filter(booking => bookingUsesEmployee(booking, b.id)).reduce((sum, booking) => sum + time(booking.end) - time(booking.start), 0);
      return aLoad - bLoad;
    });
}

function eligibleMaterials(input: SchedulingSearchInput, slot: TimeWindow): SchedulingMaterialResource[] {
  return input.materialResources
    .filter(resource =>
      resource.active &&
      resource.state === "available" &&
      resource.siteId === input.task.siteId &&
      resource.workshopId === input.task.workshopId &&
      (resource.compatibleOperationFamilies.length === 0 || resource.compatibleOperationFamilies.includes(input.task.operationFamily)) &&
      isWindowAvailable(resource.availableWindows, resource.unavailableWindows, slot))
    .filter(resource => {
      const concurrentBookings = input.bookings.filter(booking =>
        bookingUsesMaterial(booking, resource.id) && intervalsOverlap(booking, slot)).length;
      return concurrentBookings < Math.max(1, resource.shareable ? resource.simultaneousCapacity : 1);
    });
}

function chooseMaterials(task: WorkshopTask, resources: SchedulingMaterialResource[]): SchedulingMaterialResource[] | null {
  const selected: SchedulingMaterialResource[] = [];
  for (const typeId of task.requiredMaterialTypeIds) {
    const resource = resources.find(candidate => candidate.typeId === typeId && !selected.includes(candidate));
    if (!resource) return null;
    selected.push(resource);
  }
  return selected;
}

export function calculateSlotScore(
  task: WorkshopTask,
  slot: TimeWindow,
  employees: SchedulingEmployee[],
  bookings: WorkshopBooking[],
): number {
  const delayHours = task.promisedAt ? Math.max(0, time(slot.end) - time(task.promisedAt)) / 3_600_000 : 0;
  const priorityBonus = Math.max(0, Math.min(100, task.priority * 8));
  const skillFit = employees.reduce((sum, employee) => sum + employee.skills.length, 0);
  const loadPenalty = employees.reduce((sum, employee) =>
    sum + bookings.filter(booking => bookingUsesEmployee(booking, employee.id)).length, 0);
  return Math.max(0, Math.min(100, Math.round(82 + priorityBonus * 0.1 + skillFit - loadPenalty * 2 - delayHours * 1.5)));
}

export function findSchedulingSlots(input: SchedulingSearchInput): SchedulingSearchResult {
  const durationMinutes = Math.max(
    input.granularityMinutes,
    input.task.bufferBeforeMinutes +
      input.task.preparationMinutes +
      input.task.plannedDurationMinutes +
      input.task.dryingMinutes +
      input.task.qualityControlMinutes +
      input.task.bufferAfterMinutes,
  );
  const staticConflicts = [...validateTaskDependencies(input.task, input.tasks, input.searchFrom), ...validatePartsForPlanning(input.task)];
  if (staticConflicts.length > 0) {
    return { alternatives: [], impossibleReasons: staticConflicts, limitingResource: staticConflicts[0]?.resourceId };
  }

  const recommendations: SlotRecommendation[] = [];
  const rejected: SlotConflict[] = [];
  for (
    let cursor = time(input.searchFrom);
    cursor + durationMinutes * 60_000 <= time(input.searchUntil) && recommendations.length < input.alternatives + 1;
    cursor += input.granularityMinutes * 60_000
  ) {
    const slot = { start: new Date(cursor).toISOString(), end: new Date(cursor + durationMinutes * 60_000).toISOString() };
    const employees = eligibleEmployees(input, slot).slice(0, input.task.minimumTechnicians);
    if (employees.length < input.task.minimumTechnicians) {
      rejected.push({ code: "NO_SKILLED_EMPLOYEE", message: "Aucun groupe de techniciens competent et disponible.", blockingUntil: slot.end });
      continue;
    }
    const materials = chooseMaterials(input.task, eligibleMaterials(input, slot));
    if (!materials) {
      rejected.push({ code: "NO_MATERIAL_RESOURCE", message: "Une ressource materielle obligatoire est indisponible.", blockingUntil: slot.end });
      continue;
    }
    const conflicts = detectSlotConflicts(
      input.task,
      slot,
      employees.map(employee => employee.id),
      materials.map(resource => resource.id),
      input.bookings,
      input.tasks,
      input.materialResources,
    );
    if (conflicts.length > 0) {
      rejected.push(...conflicts);
      continue;
    }
    recommendations.push({
      ...slot,
      employeeIds: employees.map(employee => employee.id),
      materialResourceIds: materials.map(resource => resource.id),
      score: calculateSlotScore(input.task, slot, employees, input.bookings),
      promisedDateAtRisk: Boolean(input.task.promisedAt && time(slot.end) > time(input.task.promisedAt)),
      conflictsBeforeSlot: rejected.slice(-5),
      rationale: [
        "Toutes les ressources sont disponibles simultanement.",
        employees.length === input.task.minimumTechnicians ? "Effectif minimal respecte." : "Effectif renforce.",
        input.task.promisedAt && time(slot.end) <= time(input.task.promisedAt) ? "Date promise respectee." : "Date promise a surveiller.",
      ],
    });
  }

  const uniqueRejected = rejected.filter((item, index, all) =>
    all.findIndex(candidate => candidate.code === item.code && candidate.resourceId === item.resourceId) === index);
  return {
    recommended: recommendations[0],
    alternatives: recommendations.slice(1),
    impossibleReasons: recommendations.length > 0 ? [] : uniqueRejected,
    limitingResource: uniqueRejected[0]?.resourceId,
  };
}

export function calculateWorkshopCapacityKpi(
  bookings: WorkshopBooking[],
  employees: SchedulingEmployee[],
  tasks: WorkshopTask[],
  period: TimeWindow,
): WorkshopCapacityKpi {
  const periodBookings = bookings.filter(booking => intervalsOverlap(booking, period) && booking.status !== "cancelled");
  const plannedMinutes = Math.round(periodBookings.reduce((sum, booking) => sum + time(booking.end) - time(booking.start), 0) / 60_000);
  const completedTasks = tasks.filter(task => task.status === "completed");
  const completedMinutes = completedTasks.reduce((sum, task) => sum + task.actualDurationMinutes, 0);
  const availableMinutes = employees.filter(employee => employee.active).reduce((sum, employee) => sum + employee.productiveMinutesPerDay, 0);
  const onTimeTasks = completedTasks.filter(task => !task.promisedAt || !task.desiredAt || time(task.desiredAt) <= time(task.promisedAt));
  const qualityFailures = tasks.filter(task => task.status === "non_compliant").length;
  const resourceCounts = new Map<string, number>();
  periodBookings.flatMap(booking => booking.materialResourceIds).forEach(id => resourceCounts.set(id, (resourceCounts.get(id) ?? 0) + 1));
  const limitingResource = [...resourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    plannedMinutes,
    completedMinutes,
    availableMinutes,
    occupancyRate: availableMinutes > 0 ? Math.min(100, Math.round(plannedMinutes / availableMinutes * 100)) : 0,
    onTimeRate: completedTasks.length > 0 ? Math.round(onTimeTasks.length / completedTasks.length * 100) : 100,
    replanningRate: bookings.length > 0 ? Math.round(bookings.filter(booking => booking.attempts > 1).length / bookings.length * 100) : 0,
    qualityFailureRate: tasks.length > 0 ? Math.round(qualityFailures / tasks.length * 100) : 0,
    limitingResource,
  };
}

export function replanUnlockedBookings(
  impacted: WorkshopBooking[],
  makeRecommendation: (booking: WorkshopBooking) => SlotRecommendation | undefined,
): WorkshopBooking[] {
  return impacted.map(booking => {
    if (booking.locked) return booking;
    const recommendation = makeRecommendation(booking);
    if (!recommendation) return { ...booking, status: "conflict", attempts: booking.attempts + 1, lastError: "Aucun creneau de replanification." };
    return {
      ...booking,
      start: recommendation.start,
      end: recommendation.end,
      employeeIds: recommendation.employeeIds,
      materialResourceIds: recommendation.materialResourceIds,
      status: "local_pending",
      attempts: booking.attempts + 1,
    };
  });
}
