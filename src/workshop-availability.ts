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
  DossierStatus
} from "./types";

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
  const dayOfWeek = date.getDay();
  const daySched = config.schedule.days.find(d => d.dayOfWeek === dayOfWeek);
  if (!daySched || daySched.isClosed) {
    return [];
  }

  return daySched.windows || [];
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
    const windows = getEffectiveWorkshopWindows(s, input.config);
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

export function findNextAvailableWorkingSlot(input: {
  durationMinutes: number;
  startDate: Date;
  technicianId?: string;
  bayId?: string;
  dossiers: DossierSAV[];
  reservations: WorkshopReservation[];
  excludeDossierId?: string;
  config: WorkshopAvailabilityConfig;
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
    // 1. Check planning lines
    for (const dossier of input.dossiers) {
      if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
      for (const line of dossier.ordresReparation) {
        if (line.planningStart && line.planningEnd && (line.plannedTechnicianId === input.technicianId || line.plannedBayId === input.bayId)) {
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
      if (res.dossierId === input.excludeDossierId) continue;
      if (
        (res.status === "CRENEAU_PROPOSE" || res.status === "RESERVATION_CONFIRMEE") &&
        res.startTime &&
        res.endTime
      ) {
        if (res.technicianId === input.technicianId || res.bayId === input.bayId) {
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
      const windows = getEffectiveWorkshopWindows(testDate, input.config);
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

    const windows = getEffectiveWorkshopWindows(cursor, input.config);
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
