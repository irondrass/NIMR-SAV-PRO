/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WorkshopAvailabilityConfig,
  WorkshopSchedule,
  TechnicianAbsence,
  BayUnavailability,
  WorkshopHoliday,
  DossierSAV,
  WorkshopReservation,
  DossierStatus,
  WorkshopShiftProfile,
  TechnicianShiftAssignment,
  BayShiftAssignment
} from "./types";

export const SHIFT_PROFILES_STORAGE_KEY = "nimr-sav-pro-shift-profiles";

export interface ShiftProfileDraft {
  name: string;
  dayStart: string;
  dayEnd: string;
  pauseEnabled: boolean;
  pauseStart: string;
  pauseEnd: string;
  activeDays: number[];
}

export interface ShiftProfileValidationResult {
  valid: boolean;
  error?: string;
  capacityMinutes: number;
}

const SHIFT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6];
const SHIFT_DAY_LABELS: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
};

export function getDefaultWorkshopSchedule(): WorkshopSchedule {
  return {
    days: [
      { dayOfWeek: 0, isClosed: true, windows: [] }, // Dimanche
      {
        dayOfWeek: 1,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
      },
      {
        dayOfWeek: 2,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
      },
      {
        dayOfWeek: 3,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
      },
      {
        dayOfWeek: 4,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
      },
      {
        dayOfWeek: 5,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
      },
      {
        dayOfWeek: 6,
        isClosed: false,
        windows: [{ start: "08:00", end: "12:00" }]
      }
    ]
  };
}

export function deriveShiftProfileDraft(profile: WorkshopShiftProfile): ShiftProfileDraft {
  const activeDays = SHIFT_ACTIVE_DAYS.filter(dayOfWeek => {
    const day = profile.schedule.days.find(current => current.dayOfWeek === dayOfWeek);
    return Boolean(day && !day.isClosed && day.windows.length > 0);
  });
  const firstActiveDay = activeDays[0] ?? 1;
  const firstSchedule = profile.schedule.days.find(day => day.dayOfWeek === firstActiveDay);
  const windows = firstSchedule?.windows ?? [];
  const firstWindow = windows[0];
  const lastWindow = windows[windows.length - 1];

  return {
    name: profile.name,
    dayStart: firstWindow?.start ?? "08:00",
    dayEnd: lastWindow?.end ?? "17:00",
    pauseEnabled: windows.length >= 2,
    pauseStart: firstWindow?.end ?? "12:00",
    pauseEnd: windows[1]?.start ?? "13:00",
    activeDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5],
  };
}

export function validateShiftProfileDraft(draft: ShiftProfileDraft): ShiftProfileValidationResult {
  const activeDays = normalizeShiftActiveDays(draft.activeDays);
  const dayStart = parseTimeToMinutesSafe(draft.dayStart);
  const dayEnd = parseTimeToMinutesSafe(draft.dayEnd);
  const pauseStart = parseTimeToMinutesSafe(draft.pauseStart);
  const pauseEnd = parseTimeToMinutesSafe(draft.pauseEnd);

  if (!draft.name.trim()) {
    return { valid: false, error: "Le nom du profil est obligatoire.", capacityMinutes: 0 };
  }
  if (activeDays.length === 0) {
    return { valid: false, error: "Sélectionner au moins un jour actif.", capacityMinutes: 0 };
  }
  if (dayStart === null || dayEnd === null) {
    return { valid: false, error: "Les heures de début et fin de journée sont invalides.", capacityMinutes: 0 };
  }
  if (dayStart >= dayEnd) {
    return { valid: false, error: "Le début de journée doit être avant la fin.", capacityMinutes: 0 };
  }

  let pauseMinutes = 0;
  if (draft.pauseEnabled) {
    if (pauseStart === null || pauseEnd === null) {
      return { valid: false, error: "Les heures de pause sont invalides.", capacityMinutes: 0 };
    }
    if (pauseStart >= pauseEnd) {
      return { valid: false, error: "Le début de pause doit être avant la fin de pause.", capacityMinutes: 0 };
    }
    if (pauseStart < dayStart || pauseEnd > dayEnd) {
      return { valid: false, error: "La pause doit être comprise dans la journée.", capacityMinutes: 0 };
    }
    pauseMinutes = pauseEnd - pauseStart;
  }

  const capacityMinutes = dayEnd - dayStart - pauseMinutes;
  if (capacityMinutes <= 0) {
    return { valid: false, error: "La capacité journalière doit être positive.", capacityMinutes };
  }
  if (capacityMinutes > 12 * 60) {
    return { valid: false, error: "La capacité journalière ne peut pas dépasser 12h.", capacityMinutes };
  }

  return { valid: true, capacityMinutes };
}

export function calculateShiftProfileCapacityMinutes(draft: ShiftProfileDraft): number {
  return validateShiftProfileDraft({
    ...draft,
    name: draft.name.trim() || "Profil",
    activeDays: draft.activeDays.length > 0 ? draft.activeDays : [1],
  }).capacityMinutes;
}

export function buildScheduleFromShiftProfileDraft(draft: ShiftProfileDraft): WorkshopSchedule {
  const activeDays = new Set(normalizeShiftActiveDays(draft.activeDays));
  const windows = draft.pauseEnabled
    ? [
        { start: draft.dayStart, end: draft.pauseStart },
        { start: draft.pauseEnd, end: draft.dayEnd },
      ]
    : [{ start: draft.dayStart, end: draft.dayEnd }];

  return {
    days: [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
      dayOfWeek,
      isClosed: !activeDays.has(dayOfWeek),
      windows: activeDays.has(dayOfWeek) ? windows : [],
    })),
  };
}

export function summarizeShiftProfileDraft(draft: ShiftProfileDraft): string {
  const windows = draft.pauseEnabled
    ? `${draft.dayStart}-${draft.pauseStart} / ${draft.pauseEnd}-${draft.dayEnd}`
    : `${draft.dayStart}-${draft.dayEnd}`;
  const days = normalizeShiftActiveDays(draft.activeDays).map(day => SHIFT_DAY_LABELS[day]).join("-");
  const capacity = validateShiftProfileDraft({
    ...draft,
    name: draft.name.trim() || "Profil",
    activeDays: draft.activeDays.length > 0 ? draft.activeDays : [1],
  }).capacityMinutes;
  return `${windows} · ${days || "Aucun jour"} · ${formatCapacityHours(capacity)}`;
}

export function formatCapacityHours(capacityMinutes: number): string {
  const hours = Math.floor(Math.max(0, capacityMinutes) / 60);
  const minutes = Math.max(0, capacityMinutes) % 60;
  return minutes === 0 ? `${hours}h/j` : `${hours}h${String(minutes).padStart(2, "0")}/j`;
}

function normalizeShiftActiveDays(activeDays: number[]): number[] {
  const active = new Set(activeDays.filter(day => SHIFT_ACTIVE_DAYS.includes(day)));
  return SHIFT_ACTIVE_DAYS.filter(day => active.has(day));
}

function parseTimeToMinutesSafe(timeStr: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function getDefaultWorkshopShiftProfiles(): WorkshopShiftProfile[] {
  return [
    {
      id: "shift_standard",
      name: "Équipe standard",
      description: "08:00-12:00 / 13:00-17:00",
      active: true,
      schedule: getDefaultWorkshopSchedule(),
    },
    {
      id: "shift_morning",
      name: "Équipe matin",
      description: "07:00-13:00",
      active: true,
      schedule: buildWeeklySchedule([
        { start: "07:00", end: "13:00" },
      ]),
    },
    {
      id: "shift_afternoon",
      name: "Équipe après-midi",
      description: "12:00-18:00",
      active: true,
      schedule: buildWeeklySchedule([
        { start: "12:00", end: "18:00" },
      ]),
    },
    {
      id: "shift_continuous",
      name: "Journée continue",
      description: "08:00-16:00",
      active: true,
      schedule: buildWeeklySchedule([
        { start: "08:00", end: "16:00" },
      ]),
    },
  ];
}

function buildWeeklySchedule(windows: Array<{ start: string; end: string }>): WorkshopSchedule {
  return {
    days: [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
      dayOfWeek,
      isClosed: dayOfWeek === 0,
      windows: dayOfWeek === 0 ? [] : windows,
    })),
  };
}

function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getScheduleWindows(date: Date, schedule: WorkshopSchedule): Array<{ start: string; end: string }> {
  const dayOfWeek = date.getDay();
  const daySched = schedule.days.find(d => d.dayOfWeek === dayOfWeek);
  if (!daySched || daySched.isClosed) {
    return [];
  }
  return daySched.windows || [];
}

export function getEffectiveWorkshopWindows(
  date: Date,
  config: WorkshopAvailabilityConfig
): Array<{ start: string; end: string }> {
  const dateStr = getLocalDateStr(date);

  // 1. Check holiday
  const isHoliday = config.holidays.some(h => h.date === dateStr);
  if (isHoliday) {
    return [];
  }

  // 2. Check exception day
  const exception = config.exceptions.find(e => e.date === dateStr);
  if (exception) {
    if (exception.isClosed) {
      return [];
    }
    return exception.windows || [];
  }

  // 3. Fallback to default schedule
  return getScheduleWindows(date, config.schedule);
}

export function getEffectiveWorkshopWindowsForResource(
  date: Date,
  config: WorkshopAvailabilityConfig,
  options: { technicianId?: string; bayId?: string } = {}
): Array<{ start: string; end: string }> {
  const dateStr = getLocalDateStr(date);
  const hasGlobalOverride =
    config.holidays.some(h => h.date === dateStr) ||
    config.exceptions.some(e => e.date === dateStr);
  const baseWindows = getEffectiveWorkshopWindows(date, config);

  if (hasGlobalOverride) {
    return baseWindows;
  }

  let storedShiftProfiles: WorkshopShiftProfile[] = [];
  try {
    const rawVal = typeof window !== "undefined" ? window.localStorage.getItem(SHIFT_PROFILES_STORAGE_KEY) : null;
    if (rawVal) {
      storedShiftProfiles = JSON.parse(rawVal);
    }
  } catch (e) {
    // ignore
  }

  const rawPool = [
    ...storedShiftProfiles,
    ...(config.shiftProfiles ?? []),
    ...getDefaultWorkshopShiftProfiles(),
  ];

  const profilePool: WorkshopShiftProfile[] = [];
  const seenIds = new Set<string>();
  for (const prof of rawPool) {
    if (prof && !seenIds.has(prof.id)) {
      seenIds.add(prof.id);
      profilePool.push(prof);
    }
  }

  const technicianWindows = options.technicianId
    ? getAssignedShiftWindows(date, config.technicianShiftAssignments ?? [], profilePool, options.technicianId, "technicianId")
    : null;
  const bayWindows = options.bayId
    ? getAssignedShiftWindows(date, config.bayShiftAssignments ?? [], profilePool, options.bayId, "bayId")
    : null;

  if (technicianWindows && bayWindows) {
    return intersectWindows(intersectWindows(baseWindows, technicianWindows), bayWindows);
  }
  if (technicianWindows) return intersectWindows(baseWindows, technicianWindows);
  if (bayWindows) return intersectWindows(baseWindows, bayWindows);
  return baseWindows;
}

function getAssignedShiftWindows<T extends TechnicianShiftAssignment | BayShiftAssignment>(
  date: Date,
  assignments: T[],
  profiles: WorkshopShiftProfile[],
  resourceId: string,
  resourceKey: "technicianId" | "bayId"
): Array<{ start: string; end: string }> | null {
  const dateStr = getLocalDateStr(date);
  const dayOfWeek = date.getDay();
  const assignment = assignments.find(current => {
    const currentResourceId = String((current as unknown as Record<string, unknown>)[resourceKey] ?? "");
    const inDateRange = current.startDate <= dateStr && (!current.endDate || current.endDate >= dateStr);
    const activeDay = !current.daysOfWeek || current.daysOfWeek.includes(dayOfWeek);
    return currentResourceId === resourceId && inDateRange && activeDay;
  });

  if (!assignment) return null;
  const profile = profiles.find(current => current.id === assignment.shiftProfileId && current.active);
  return profile ? getScheduleWindows(date, profile.schedule) : null;
}

function intersectWindows(
  first: Array<{ start: string; end: string }>,
  second: Array<{ start: string; end: string }>
): Array<{ start: string; end: string }> {
  const intersections: Array<{ start: string; end: string }> = [];
  for (const a of first) {
    for (const b of second) {
      const startMin = Math.max(parseTimeToMinutes(a.start), parseTimeToMinutes(b.start));
      const endMin = Math.min(parseTimeToMinutes(a.end), parseTimeToMinutes(b.end));
      if (startMin < endMin) {
        intersections.push({
          start: minutesToTime(startMin),
          end: minutesToTime(endMin),
        });
      }
    }
  }
  return intersections;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isWorkshopClosed(date: Date, config: WorkshopAvailabilityConfig): boolean {
  return getEffectiveWorkshopWindows(date, config).length === 0;
}

export function isTechnicianAbsent(
  technicianId: string,
  dateTime: Date,
  config: WorkshopAvailabilityConfig
): boolean {
  const dateStr = getLocalDateStr(dateTime);
  const timeMin = dateTime.getHours() * 60 + dateTime.getMinutes();

  return config.absences.some(abs => {
    if (abs.technicianId !== technicianId) return false;
    const startDay = abs.startDate;
    const endDay = abs.endDate;
    if (dateStr < startDay || dateStr > endDay) return false;

    if (abs.startTime && abs.endTime) {
      const absStartMin = parseTimeToMinutes(abs.startTime);
      const absEndMin = parseTimeToMinutes(abs.endTime);

      if (dateStr === startDay && dateStr === endDay) {
        return timeMin >= absStartMin && timeMin <= absEndMin;
      }
      if (dateStr === startDay) {
        return timeMin >= absStartMin;
      }
      if (dateStr === endDay) {
        return timeMin <= absEndMin;
      }
      return true;
    }

    return true;
  });
}

export function isBayUnavailable(
  bayId: string,
  dateTime: Date,
  config: WorkshopAvailabilityConfig
): boolean {
  const dateStr = getLocalDateStr(dateTime);
  const timeMin = dateTime.getHours() * 60 + dateTime.getMinutes();

  return config.bayUnavailabilities.some(unav => {
    if (unav.bayId !== bayId) return false;
    const startDay = unav.startDate;
    const endDay = unav.endDate;
    if (dateStr < startDay || dateStr > endDay) return false;

    if (unav.startTime && unav.endTime) {
      const unavStartMin = parseTimeToMinutes(unav.startTime);
      const unavEndMin = parseTimeToMinutes(unav.endTime);

      if (dateStr === startDay && dateStr === endDay) {
        return timeMin >= unavStartMin && timeMin <= unavEndMin;
      }
      if (dateStr === startDay) {
        return timeMin >= unavStartMin;
      }
      if (dateStr === endDay) {
        return timeMin <= unavEndMin;
      }
      return true;
    }

    return true;
  });
}

export function getAbsenceIntervalsOnDay(
  technicianId: string,
  date: Date,
  config: WorkshopAvailabilityConfig
): Array<{ start: Date; end: Date }> {
  const dateStr = getLocalDateStr(date);
  const intervals: Array<{ start: Date; end: Date }> = [];

  for (const abs of config.absences) {
    if (abs.technicianId !== technicianId) continue;
    const startDay = abs.startDate;
    const endDay = abs.endDate;
    if (dateStr < startDay || dateStr > endDay) continue;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const s = new Date(dayStart);
    if (dateStr === startDay && abs.startTime) {
      const [sh, sm] = abs.startTime.split(":").map(Number);
      s.setHours(sh, sm, 0, 0);
    }

    const e = new Date(dayEnd);
    if (dateStr === endDay && abs.endTime) {
      const [eh, em] = abs.endTime.split(":").map(Number);
      e.setHours(eh, em, 0, 0);
    }

    intervals.push({ start: s, end: e });
  }
  return intervals;
}

export function getBayUnavailabilityIntervalsOnDay(
  bayId: string,
  date: Date,
  config: WorkshopAvailabilityConfig
): Array<{ start: Date; end: Date }> {
  const dateStr = getLocalDateStr(date);
  const intervals: Array<{ start: Date; end: Date }> = [];

  for (const unav of config.bayUnavailabilities) {
    if (unav.bayId !== bayId) continue;
    const startDay = unav.startDate;
    const endDay = unav.endDate;
    if (dateStr < startDay || dateStr > endDay) continue;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const s = new Date(dayStart);
    if (dateStr === startDay && unav.startTime) {
      const [sh, sm] = unav.startTime.split(":").map(Number);
      s.setHours(sh, sm, 0, 0);
    }

    const e = new Date(dayEnd);
    if (dateStr === endDay && unav.endTime) {
      const [eh, em] = unav.endTime.split(":").map(Number);
      e.setHours(eh, em, 0, 0);
    }

    intervals.push({ start: s, end: e });
  }
  return intervals;
}

export function validateAvailabilityForSlot(input: {
  startTime: string; // ISO
  endTime: string; // ISO
  segments?: Array<{ start: string; end: string }>;
  technicianId?: string;
  bayId?: string;
  config: WorkshopAvailabilityConfig;
}): { allowed: boolean; codes: string[]; reasons: string[] } {
  const codes: string[] = [];
  const reasons: string[] = [];

  const segmentsToCheck = input.segments && input.segments.length > 0
    ? input.segments
    : [{ start: input.startTime, end: input.endTime }];

  for (const seg of segmentsToCheck) {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    const dateStr = getLocalDateStr(s);

    // 1. Check holiday
    const holiday = input.config.holidays.find(h => h.date === dateStr);
    if (holiday) {
      if (!codes.includes("workshop-holiday")) {
        codes.push("workshop-holiday");
        reasons.push(`L'atelier est fermé pour jour férié : ${holiday.name}.`);
      }
    }

    // 2. Check workshop closed or outside working windows
    const windows = getEffectiveWorkshopWindowsForResource(s, input.config, {
      technicianId: input.technicianId,
      bayId: input.bayId,
    });
    if (windows.length === 0) {
      if (!codes.includes("workshop-closed")) {
        codes.push("workshop-closed");
        reasons.push("L'atelier est fermé à cette date.");
      }
    } else {
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();

      const inWindow = windows.some(w => {
        const wStart = parseTimeToMinutes(w.start);
        const wEnd = parseTimeToMinutes(w.end);
        return sMin >= wStart && eMin <= wEnd;
      });

      if (!inWindow) {
        if (!codes.includes("outside-effective-working-hours")) {
          codes.push("outside-effective-working-hours");
          reasons.push("Le créneau est en dehors des horaires d'ouverture effectifs.");
        }
      }
    }

    // 3. Check technician absence
    if (input.technicianId) {
      const absentStart = isTechnicianAbsent(input.technicianId, s, input.config);
      const absentEnd = isTechnicianAbsent(input.technicianId, new Date(e.getTime() - 1000), input.config);
      if (absentStart || absentEnd) {
        if (!codes.includes("technician-absent")) {
          codes.push("technician-absent");
          reasons.push("Le technicien est absent sur cette période.");
        }
      }
    }

    // 4. Check bay unavailability
    if (input.bayId) {
      const unavailableStart = isBayUnavailable(input.bayId, s, input.config);
      const unavailableEnd = isBayUnavailable(input.bayId, new Date(e.getTime() - 1000), input.config);
      if (unavailableStart || unavailableEnd) {
        if (!codes.includes("bay-unavailable")) {
          codes.push("bay-unavailable");
          reasons.push("Le pont d'atelier sélectionné est indisponible.");
        }
      }
    }
  }

  return {
    allowed: codes.length === 0,
    codes,
    reasons
  };
}

function normalizeVehicleIdentityLocal(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function isSameVehicleLocal(dA: DossierSAV, dB: DossierSAV): boolean {
  const vinA = normalizeVehicleIdentityLocal(dA.vehiculeVIN);
  const vinB = normalizeVehicleIdentityLocal(dB.vehiculeVIN);
  const immA = normalizeVehicleIdentityLocal(dA.vehiculeImmatriculation);
  const immB = normalizeVehicleIdentityLocal(dB.vehiculeImmatriculation);

  let matched = false;
  if (vinA && vinB && vinA === vinB) {
    matched = true;
  }
  if (immA && immB && immA === immB) {
    matched = true;
  }
  return matched;
}

function isActiveVehicleDossierLocal(dossier: DossierSAV): boolean {
  return (
    dossier.statut !== DossierStatus.LIVRE &&
    dossier.statut !== DossierStatus.CLOTURE &&
    dossier.statut !== DossierStatus.PRET_FACTURATION &&
    dossier.statut !== DossierStatus.ANNULE &&
    !dossier.archiveOperationnelle
  );
}

export function findNextAvailableWorkingSlot(input: {
  durationMinutes: number;
  startDate: Date;
  technicianId?: string;
  bayId?: string;
  dossiers: DossierSAV[];
  reservations: WorkshopReservation[];
  excludeDossierId?: string;
  config: WorkshopAvailabilityConfig;
  vehicleDossierId?: string;
  ignoreTaskId?: string;
}): { startTime: Date; endTime: Date; segments: Array<{ start: string; end: string }> } | null {
  let cursor = new Date(input.startDate);
  const mins = cursor.getMinutes();
  const roundedMins = Math.ceil(mins / 15) * 15;
  cursor.setMinutes(roundedMins, 0, 0);

  const horizon = new Date(cursor);
  horizon.setDate(horizon.getDate() + 90);

  const segments: Array<{ start: string; end: string }> = [];
  let remainingMinutes = input.durationMinutes;

  const checkOverlapWithTasksAndReservations = (start: Date, end: Date): { start: Date; end: Date } | null => {
    const targetDossier = input.vehicleDossierId ? input.dossiers.find(d => d.id === input.vehicleDossierId) : null;

    // 1. Check planning lines
    for (const dossier of input.dossiers) {
      if (!isActiveVehicleDossierLocal(dossier)) continue;

      const isVehicleMatch = input.vehicleDossierId && (dossier.id === input.vehicleDossierId || (targetDossier && isSameVehicleLocal(targetDossier, dossier)));

      for (const line of dossier.ordresReparation) {
        if (input.ignoreTaskId && line.id === input.ignoreTaskId) continue;
        if (line.status === "done" || line.status === "cancelled") continue;

        const matchTech = line.plannedTechnicianId === input.technicianId;
        const matchBay = line.plannedBayId === input.bayId;
        const matchVehicle = isVehicleMatch;

        if (line.planningStart && line.planningEnd && (matchTech || matchBay || matchVehicle)) {
          const lineSegs = line.planningSegments || [{ start: line.planningStart, end: line.planningEnd }];
          for (const seg of lineSegs) {
            const s = new Date(seg.start);
            const e = new Date(seg.end);
            if (start.getTime() < e.getTime() && s.getTime() < end.getTime()) {
              return { start: s, end: e };
            }
          }
        }
      }
    }

    // 2. Check reservations
    for (const res of input.reservations) {
      if (input.ignoreTaskId && res.taskIds.includes(input.ignoreTaskId)) continue;
      if (!input.vehicleDossierId && res.dossierId === input.excludeDossierId) continue;
      if (
        (
          res.status === "CRENEAU_PROPOSE" ||
          res.status === "RESERVATION_CONFIRMEE" ||
          res.status === "AFFECTEE_ATELIER"
        ) &&
        res.startTime &&
        res.endTime
      ) {
        const resDossier = input.dossiers.find(d => d.id === res.dossierId);
        if (resDossier && !isActiveVehicleDossierLocal(resDossier)) continue;
        const isVehicleMatch = input.vehicleDossierId && resDossier && targetDossier && (
          resDossier.id === input.vehicleDossierId ||
          isSameVehicleLocal(targetDossier, resDossier)
        );

        if (res.technicianId === input.technicianId || res.bayId === input.bayId || isVehicleMatch) {
          const resSegs = res.segments || [{ start: res.startTime, end: res.endTime }];
          for (const seg of resSegs) {
            const s = new Date(seg.start);
            const e = new Date(seg.end);
            if (start.getTime() < e.getTime() && s.getTime() < end.getTime()) {
              return { start: s, end: e };
            }
          }
        }
      }
    }

    // 3. Check technician absences
    if (input.technicianId) {
      const absences = getAbsenceIntervalsOnDay(input.technicianId, start, input.config);
      for (const abs of absences) {
        if (start.getTime() < abs.end.getTime() && abs.start.getTime() < end.getTime()) {
          return abs;
        }
      }
    }

    // 4. Check bay unavailabilities
    if (input.bayId) {
      const unavs = getBayUnavailabilityIntervalsOnDay(input.bayId, start, input.config);
      for (const unav of unavs) {
        if (start.getTime() < unav.end.getTime() && unav.start.getTime() < end.getTime()) {
          return unav;
        }
      }
    }

    return null;
  };

  const alignToNextWorkingWindow = (d: Date): Date => {
    let checkDate = new Date(d);
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const testDate = new Date(checkDate.getTime() + dayOffset * 24 * 3600 * 1000);
      const windows = getEffectiveWorkshopWindowsForResource(testDate, input.config, {
        technicianId: input.technicianId,
        bayId: input.bayId,
      });
      if (windows.length > 0) {
        const lastWin = windows[windows.length - 1];
        const [lh, lm] = lastWin.end.split(":").map(Number);
        const lastWinEnd = new Date(testDate);
        lastWinEnd.setHours(lh, lm, 0, 0);

        if (dayOffset === 0 && d.getTime() >= lastWinEnd.getTime()) {
          continue;
        }

        for (const win of windows) {
          const [wh, wm] = win.start.split(":").map(Number);
          const [weh, wem] = win.end.split(":").map(Number);

          const winStart = new Date(testDate);
          winStart.setHours(wh, wm, 0, 0);
          const winEnd = new Date(testDate);
          winEnd.setHours(weh, wem, 0, 0);

          if (dayOffset === 0) {
            if (d.getTime() < winEnd.getTime()) {
              return d.getTime() < winStart.getTime() ? winStart : d;
            }
          } else {
            return winStart;
          }
        }
      }
    }
    return d;
  };

  cursor = alignToNextWorkingWindow(cursor);

  let iterations = 0;
  const maxIterations = 5000;

  while (remainingMinutes > 0 && cursor.getTime() < horizon.getTime() && iterations < maxIterations) {
    iterations += 1;

    const windows = getEffectiveWorkshopWindowsForResource(cursor, input.config, {
      technicianId: input.technicianId,
      bayId: input.bayId,
    });
    if (windows.length === 0) {
      const nextDay = new Date(cursor.getTime() + 24 * 3600 * 1000);
      nextDay.setHours(8, 0, 0, 0);
      cursor = alignToNextWorkingWindow(nextDay);
      continue;
    }

    let progressed = false;

    for (const win of windows) {
      const [wsh, wsm] = win.start.split(":").map(Number);
      const [weh, wem] = win.end.split(":").map(Number);

      const winStart = new Date(cursor);
      winStart.setHours(wsh, wsm, 0, 0);
      const winEnd = new Date(cursor);
      winEnd.setHours(weh, wem, 0, 0);

      if (cursor.getTime() >= winEnd.getTime()) continue;

      const segStart = cursor.getTime() > winStart.getTime() ? cursor : winStart;
      if (segStart.getTime() >= winEnd.getTime()) continue;

      const collision = checkOverlapWithTasksAndReservations(segStart, winEnd);

      if (collision) {
        const freeMinutes = Math.max(0, Math.round((collision.start.getTime() - segStart.getTime()) / 60000));
        if (freeMinutes > 0) {
          const taken = Math.min(freeMinutes, remainingMinutes);
          const segEnd = new Date(segStart.getTime() + taken * 60000);
          segments.push({ start: segStart.toISOString(), end: segEnd.toISOString() });
          remainingMinutes -= taken;
          if (remainingMinutes <= 0) {
            return {
              startTime: new Date(segments[0].start),
              endTime: segEnd,
              segments
            };
          }
        }
        cursor = alignToNextWorkingWindow(collision.end);
        progressed = true;
        break; // break the windows loop to re-evaluate at new cursor
      } else {
        const available = Math.max(0, Math.round((winEnd.getTime() - segStart.getTime()) / 60000));
        const taken = Math.min(available, remainingMinutes);
        const segEnd = new Date(segStart.getTime() + taken * 60000);
        segments.push({ start: segStart.toISOString(), end: segEnd.toISOString() });
        remainingMinutes -= taken;
        cursor = segEnd;
        progressed = true;
        if (remainingMinutes <= 0) {
          return {
            startTime: new Date(segments[0].start),
            endTime: segEnd,
            segments
          };
        }
      }
    }

    if (!progressed) {
      const nextDay = new Date(cursor.getTime() + 24 * 3600 * 1000);
      nextDay.setHours(8, 0, 0, 0);
      cursor = alignToNextWorkingWindow(nextDay);
    }
  }

  return remainingMinutes <= 0 ? {
    startTime: new Date(segments[0].start),
    endTime: new Date(segments[segments.length - 1].end),
    segments
  } : null;
}
