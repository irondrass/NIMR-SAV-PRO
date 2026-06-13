/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-4A — Module de gestion des réservations d'atelier
 */

import { 
  DossierSAV, 
  TechnicienResource, 
  WorkshopBay, 
  WorkshopReservation, 
  WorkshopReservationStatus,
  AtelierZone,
  DossierStatus,
  WorkshopAvailabilityConfig
} from "./types";
import { 
  detectTechnicianCollision, 
  detectBayCollision, 
  isWorkingDay, 
  alignToWorkingTime, 
  addWorkingMinutes, 
  buildPlanningSegments, 
  calculateTechnicianDailyLoad,
  isTechnicianCompatible,
  chooseWorkshopBay,
  nextWorkingDay,
  normalizeRepairOrderStatus,
  getWorkingWindowsForDate
} from "./sav-core";
import { 
  findNextAvailableWorkingSlot, 
  validateAvailabilityForSlot 
} from "./workshop-availability";

function segmentsOverlap(
  segA: Array<{ start: string; end: string }>,
  segB: Array<{ start: string; end: string }>
): boolean {
  for (const a of segA) {
    const aStart = new Date(a.start).getTime();
    const aEnd = new Date(a.end).getTime();
    for (const b of segB) {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      if (aStart < bEnd && bStart < aEnd) {
        return true;
      }
    }
  }
  return false;
}

export function detectTechnicianCollisionWithReservations(
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  techId: string,
  start: Date,
  end: Date,
  ignoreDossierId?: string
): boolean {
  if (!techId) return false;
  
  // 1. Collision avec le planning existant
  if (detectTechnicianCollision(dossiers, techId, start, end)) {
    return true;
  }
  
  // 2. Collision avec les réservations actives (proposées ou confirmées)
  const requestedSegments = buildPlanningSegments(start, end);
  for (const res of reservations) {
    if (ignoreDossierId && res.dossierId === ignoreDossierId) continue;
    if (
      res.technicianId === techId &&
      (res.status === "CRENEAU_PROPOSE" || res.status === "RESERVATION_CONFIRMEE") &&
      res.startTime &&
      res.endTime
    ) {
      const resSegments = res.segments || buildPlanningSegments(new Date(res.startTime), new Date(res.endTime));
      if (segmentsOverlap(requestedSegments, resSegments)) {
        return true;
      }
    }
  }
  return false;
}

export function detectBayCollisionWithReservations(
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  bayId: string,
  start: Date,
  end: Date,
  ignoreDossierId?: string
): boolean {
  if (!bayId) return false;
  
  // 1. Collision avec le planning existant
  if (detectBayCollision(dossiers, bayId, start, end)) {
    return true;
  }
  
  // 2. Collision avec les réservations actives (proposées ou confirmées)
  const requestedSegments = buildPlanningSegments(start, end);
  for (const res of reservations) {
    if (ignoreDossierId && res.dossierId === ignoreDossierId) continue;
    if (
      res.bayId === bayId &&
      (res.status === "CRENEAU_PROPOSE" || res.status === "RESERVATION_CONFIRMEE") &&
      res.startTime &&
      res.endTime
    ) {
      const resSegments = res.segments || buildPlanningSegments(new Date(res.startTime), new Date(res.endTime));
      if (segmentsOverlap(requestedSegments, resSegments)) {
        return true;
      }
    }
  }
  return false;
}

export function calculateReservationDuration(dossier: DossierSAV): number {
  if (
    dossier.statut === DossierStatus.LIVRE ||
    dossier.statut === DossierStatus.CLOTURE ||
    dossier.statut === DossierStatus.PRET_FACTURATION
  ) {
    return 0;
  }
  
  return dossier.ordresReparation.reduce((sum, line) => {
    const isDone = normalizeRepairOrderStatus(line.status) === "done";
    const isValidated = line.isEstimatedDurationValidated === true;
    const isPositive = line.tempsEstime > 0;
    
    if (!isDone && isValidated && isPositive) {
      return sum + line.tempsEstime;
    }
    return sum;
  }, 0);
}

export function createReservationNeed(dossier: DossierSAV, now: Date = new Date()): WorkshopReservation | null {
  const duration = calculateReservationDuration(dossier);
  if (duration <= 0) {
    return null;
  }
  
  const taskIds = dossier.ordresReparation
    .filter(line => {
      const isDone = normalizeRepairOrderStatus(line.status) === "done";
      const isValidated = line.isEstimatedDurationValidated === true;
      const isPositive = line.tempsEstime > 0;
      return !isDone && isValidated && isPositive;
    })
    .map(line => line.id);
    
  if (taskIds.length === 0) {
    return null;
  }
  
  const hasQuoteImport = dossier.ordresReparation.some(
    line => line.estimateSource === "quote-import" && taskIds.includes(line.id)
  );
  const source = hasQuoteImport ? "quote-import" : "manual";
  
  return {
    reservationId: `res_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
    dossierId: dossier.id,
    taskIds,
    totalHours: duration,
    desiredDate: dossier.dateSouhaiteeLivraison || now.toISOString(),
    status: "A_RESERVER",
    source,
    history: [
      `${now.toISOString()} - Besoin de réservation créé pour ${duration}h de main-d'œuvre.`
    ]
  };
}

interface CollisionInterval {
  start: Date;
  end: Date;
}

function findFirstCollisionInInterval(
  techId: string,
  bayId: string,
  start: Date,
  end: Date,
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  ignoreDossierId?: string
): CollisionInterval | null {
  let firstCollision: CollisionInterval | null = null;

  const checkOverlap = (busyStart: Date, busyEnd: Date) => {
    if (start.getTime() < busyEnd.getTime() && busyStart.getTime() < end.getTime()) {
      const overlapStart = start.getTime() > busyStart.getTime() ? start : busyStart;
      if (!firstCollision || overlapStart.getTime() < firstCollision.start.getTime()) {
        firstCollision = { start: overlapStart, end: busyEnd };
      }
    }
  };

  // 1. Check planning lines
  for (const dossier of dossiers) {
    if (dossier.statut === DossierStatus.LIVRE || dossier.statut === DossierStatus.CLOTURE) continue;
    for (const line of dossier.ordresReparation) {
      if (line.planningStart && line.planningEnd && (line.plannedTechnicianId === techId || line.plannedBayId === bayId)) {
        const lineSegs = line.planningSegments || buildPlanningSegments(new Date(line.planningStart), new Date(line.planningEnd));
        for (const seg of lineSegs) {
          checkOverlap(new Date(seg.start), new Date(seg.end));
        }
      }
    }
  }

  // 2. Check active reservations
  for (const res of reservations) {
    if (res.dossierId === ignoreDossierId) continue;
    if (
      (res.status === "CRENEAU_PROPOSE" || res.status === "RESERVATION_CONFIRMEE") &&
      res.startTime &&
      res.endTime
    ) {
      if (res.technicianId === techId || res.bayId === bayId) {
        const resSegs = res.segments || buildPlanningSegments(new Date(res.startTime), new Date(res.endTime));
        for (const seg of resSegs) {
          checkOverlap(new Date(seg.start), new Date(seg.end));
        }
      }
    }
  }

  return firstCollision;
}

function findSegmentsForDuration(
  techId: string,
  bayId: string,
  startAfter: Date,
  durationMinutes: number,
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  ignoreDossierId: string
): Array<{ start: string; end: string }> | null {
  let cursor = alignToWorkingTime(startAfter);
  const segments: Array<{ start: string; end: string }> = [];
  let remainingMinutes = durationMinutes;

  const horizon = new Date(cursor);
  horizon.setDate(horizon.getDate() + 90);

  let iterations = 0;
  const maxIterations = 5000;

  while (remainingMinutes > 0 && cursor.getTime() < horizon.getTime() && iterations < maxIterations) {
    iterations += 1;

    const windows = getWorkingWindowsForDate(cursor);
    let progressed = false;

    for (const win of windows) {
      if (cursor.getTime() >= win.end.getTime()) continue;

      const segStart = cursor.getTime() > win.start.getTime() ? cursor : win.start;
      if (segStart.getTime() >= win.end.getTime()) continue;

      const collision = findFirstCollisionInInterval(
        techId,
        bayId,
        segStart,
        win.end,
        dossiers,
        reservations,
        ignoreDossierId
      );

      if (collision) {
        const freeMinutesBefore = Math.max(0, Math.round((collision.start.getTime() - segStart.getTime()) / 60000));
        if (freeMinutesBefore > 0) {
          const taken = Math.min(freeMinutesBefore, remainingMinutes);
          const segEnd = new Date(segStart.getTime() + taken * 60000);
          segments.push({ start: segStart.toISOString(), end: segEnd.toISOString() });
          remainingMinutes -= taken;
          if (remainingMinutes <= 0) {
            return segments;
          }
        }
        cursor = alignToWorkingTime(collision.end);
        progressed = true;
        break; // break the windows loop to re-evaluate at new cursor
      } else {
        const available = Math.max(0, Math.round((win.end.getTime() - segStart.getTime()) / 60000));
        const taken = Math.min(available, remainingMinutes);
        const segEnd = new Date(segStart.getTime() + taken * 60000);
        segments.push({ start: segStart.toISOString(), end: segEnd.toISOString() });
        remainingMinutes -= taken;
        cursor = segEnd;
        progressed = true;
        if (remainingMinutes <= 0) {
          return segments;
        }
      }
    }

    if (!progressed) {
      const nextDay = nextWorkingDay(cursor);
      nextDay.setHours(8, 0, 0, 0);
      cursor = alignToWorkingTime(nextDay);
    }
  }

  return remainingMinutes <= 0 ? segments : null;
}

export function suggestReservationSlot(
  input: {
    reservation: WorkshopReservation;
    dossiers: DossierSAV[];
    reservations: WorkshopReservation[];
    technicians: TechnicienResource[];
    workshopBays: WorkshopBay[];
    availabilityConfig?: WorkshopAvailabilityConfig;
  },
  now: Date = new Date()
): WorkshopReservation {
  const { reservation, dossiers, reservations, technicians, workshopBays, availabilityConfig } = input;
  const durationHours = reservation.totalHours;
  if (durationHours <= 0) {
    throw new Error("Aucune durée MO validée.");
  }
  const durationMinutes = Math.ceil(durationHours * 60);
  
  const desiredDate = new Date(reservation.desiredDate);
  const getLocalDateKey = (d: Date) => d.toISOString().split("T")[0];
  const desiredDateStr = getLocalDateKey(desiredDate);
  const nowDateStr = getLocalDateKey(now);
  
  if (desiredDateStr < nowDateStr) {
    throw new Error("Impossible de planifier dans le passé.");
  }

  // Align startAfter to working time
  let startAfter = new Date(desiredDate);
  if (desiredDateStr === nowDateStr) {
    const startOfToday = new Date(desiredDate);
    startOfToday.setHours(8, 0, 0, 0);
    const alignedNow = new Date(now);
    alignedNow.setSeconds(0, 0);
    
    const mins = alignedNow.getMinutes();
    const roundedMins = Math.ceil(mins / 15) * 15;
    alignedNow.setMinutes(roundedMins);
    
    if (alignedNow.getTime() > startOfToday.getTime()) {
      startAfter = alignedNow;
    } else {
      startAfter = startOfToday;
    }
  } else {
    startAfter.setHours(8, 0, 0, 0);
  }

  const usableTechnicians = technicians.filter(t => !["absent", "formation"].includes(t.disponibilite));
  const techsToTry = usableTechnicians.length > 0 ? usableTechnicians : technicians;

  // Find the earliest slot across all technician/bay combinations
  let bestSlot: {
    startTime: Date;
    endTime: Date;
    segments: Array<{ start: string; end: string }>;
    techId: string;
    bayId: string;
  } | null = null;

  const dossier = dossiers.find(d => d.id === reservation.dossierId);
  const typeDossier = dossier?.typeDossier;

  // Sort the technicians first so that compatible ones are preferred
  const sortedTechs = [...techsToTry].sort((left, right) => {
    const compLeft = typeDossier ? isTechnicianCompatible(left, typeDossier) : true;
    const compRight = typeDossier ? isTechnicianCompatible(right, typeDossier) : true;
    if (compLeft && !compRight) return -1;
    if (!compLeft && compRight) return 1;
    return 0;
  });

  if (availabilityConfig) {
    for (const tech of sortedTechs) {
      const compatibleBays = workshopBays.filter(bay => !bay.zone || bay.zone === tech.zoneAffectee);
      const baysToTry = compatibleBays.length > 0 ? compatibleBays : workshopBays;
      
      for (const bay of baysToTry) {
        const slot = findNextAvailableWorkingSlot({
          durationMinutes,
          startDate: startAfter,
          technicianId: tech.id,
          bayId: bay.id,
          dossiers,
          reservations,
          excludeDossierId: reservation.dossierId,
          config: availabilityConfig
        });
        
        if (slot) {
          if (!bestSlot || slot.startTime.getTime() < bestSlot.startTime.getTime()) {
            bestSlot = {
              startTime: slot.startTime,
              endTime: slot.endTime,
              segments: slot.segments,
              techId: tech.id,
              bayId: bay.id
            };
          }
        }
      }
    }
  } else {
    startAfter = alignToWorkingTime(startAfter);
    for (const tech of sortedTechs) {
      const compatibleBays = workshopBays.filter(bay => !bay.zone || bay.zone === tech.zoneAffectee);
      const baysToTry = compatibleBays.length > 0 ? compatibleBays : workshopBays;
      
      for (const bay of baysToTry) {
        const segments = findSegmentsForDuration(
          tech.id,
          bay.id,
          startAfter,
          durationMinutes,
          dossiers,
          reservations,
          reservation.dossierId
        );
        
        if (segments && segments.length > 0) {
          const slotStart = new Date(segments[0].start);
          const slotEnd = new Date(segments[segments.length - 1].end);
          
          if (!bestSlot || slotStart.getTime() < bestSlot.startTime.getTime()) {
            bestSlot = {
              startTime: slotStart,
              endTime: slotEnd,
              segments,
              techId: tech.id,
              bayId: bay.id
            };
          }
        }
      }
    }
  }

  if (!bestSlot) {
    const fallbackDate = new Date(nextWorkingDay(startAfter));
    fallbackDate.setHours(8, 0, 0, 0);
    const fallbackTech = sortedTechs[0] || technicians[0];
    const fallbackBay = chooseWorkshopBay(workshopBays, fallbackTech?.zoneAffectee);
    const fallbackEndTime = addWorkingMinutes(fallbackDate, durationMinutes);
    const fallbackSegments = buildPlanningSegments(fallbackDate, fallbackEndTime);
    
    return {
      ...reservation,
      startTime: fallbackDate.toISOString(),
      endTime: fallbackEndTime.toISOString(),
      segments: fallbackSegments,
      technicianId: fallbackTech?.id ?? "tech_virtual",
      bayId: fallbackBay.id,
      status: "CRENEAU_PROPOSE",
      history: [
        ...reservation.history,
        `${now.toISOString()} - Créneau proposé par défaut (aucun créneau disponible) : ${fallbackDate.toISOString()} avec le technicien ${fallbackTech?.nom} sur le pont ${fallbackBay.name}`
      ]
    };
  }

  const techName = technicians.find(t => t.id === bestSlot!.techId)?.nom || bestSlot.techId;
  const bayName = workshopBays.find(b => b.id === bestSlot!.bayId)?.name || bestSlot.bayId;

  return {
    ...reservation,
    startTime: bestSlot.startTime.toISOString(),
    endTime: bestSlot.endTime.toISOString(),
    segments: bestSlot.segments,
    technicianId: bestSlot.techId,
    bayId: bestSlot.bayId,
    status: "CRENEAU_PROPOSE",
    history: [
      ...reservation.history,
      `${now.toISOString()} - Créneau proposé : ${bestSlot.startTime.toISOString()} à ${bestSlot.endTime.toISOString()} avec le technicien ${techName} sur le pont ${bayName}`
    ]
  };
}

export function validateReservationSlot(
  input: {
    reservation: WorkshopReservation;
    dossiers: DossierSAV[];
    reservations: WorkshopReservation[];
    technicians: TechnicienResource[];
    workshopBays: WorkshopBay[];
    availabilityConfig?: WorkshopAvailabilityConfig;
  },
  now: Date = new Date()
): { allowed: boolean; codes: string[]; reasons: string[] } {
  const { reservation, dossiers, reservations, technicians, workshopBays, availabilityConfig } = input;
  const codes: string[] = [];
  const reasons: string[] = [];
  
  if (!reservation.startTime || !reservation.endTime) {
    codes.push("reservation-missing-slot");
    reasons.push("Créneau proposé absent.");
    return { allowed: false, codes, reasons };
  }
  
  const start = new Date(reservation.startTime);
  const end = new Date(reservation.endTime);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    codes.push("reservation-invalid-interval");
    reasons.push("Créneau proposé invalide.");
    return { allowed: false, codes, reasons };
  }
  
  // Past check
  const getLocalDateKey = (d: Date) => d.toISOString().split("T")[0];
  const startStr = getLocalDateKey(start);
  const nowStr = getLocalDateKey(now);
  if (startStr < nowStr) {
    codes.push("planning-in-past");
    reasons.push("Impossible de planifier dans le passé.");
  }
  
  // Sunday check
  if (!isWorkingDay(start)) {
    codes.push("planning-collision-sunday");
    reasons.push("Dimanche fermé.");
  }
  
  const expectedSegments = buildPlanningSegments(start, end);
  const submittedSegments = reservation.segments || expectedSegments;
  
  if (availabilityConfig) {
    const avail = validateAvailabilityForSlot({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      segments: submittedSegments,
      technicianId: reservation.technicianId,
      bayId: reservation.bayId,
      config: availabilityConfig
    });
    if (!avail.allowed) {
      avail.codes.forEach(code => {
        if (!codes.includes(code)) {
          codes.push(code);
        }
      });
      avail.reasons.forEach(reason => {
        if (!reasons.includes(reason)) {
          reasons.push(reason);
        }
      });
    }
  }
  
  // Check if any segment is on a Sunday
  const hasSundaySegment = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    return !isWorkingDay(s);
  });
  if (hasSundaySegment) {
    codes.push("planning-collision-sunday");
    reasons.push("Dimanche fermé.");
  }
  
  // Check Saturday afternoon for each segment
  const hasSaturdayAfternoonSegment = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    if (s.getDay() !== 6) return false;
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    return startMin >= 12 * 60 || endMin > 12 * 60;
  });
  if (hasSaturdayAfternoonSegment) {
    codes.push("planning-collision-saturday-afternoon");
    reasons.push("Samedi après-midi fermé.");
  }
  
  // Check if all segments are within working hours (08h-17h on weekdays, 08h-12h on Sat)
  const hasOutOfHoursSegment = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    const isSat = s.getDay() === 6;
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    if (isSat) {
      return startMin < 8 * 60 || endMin > 12 * 60;
    } else {
      return startMin < 8 * 60 || endMin > 17 * 60;
    }
  });
  if (hasOutOfHoursSegment) {
    codes.push("planning-collision-hours");
    reasons.push("Horaires d'ouverture non respectés (08h-17h).");
  }
  
  // Check if any segment overlaps the lunch break (12h-13h) on weekdays
  const overlapsLunch = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    if (s.getDay() === 6) return false;
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = e.getHours() * 60 + e.getMinutes();
    return sMin < 13 * 60 && eMin > 12 * 60;
  });
  if (overlapsLunch) {
    codes.push("planning-collision-lunch");
    reasons.push("Le créneau chevauche la pause déjeuner (12h-13h).");
  }

  // - interdit seulement si un segment individuel dépasse une fenêtre ouvrée
  const segmentExceedsWindow = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    const durationMin = Math.round((e.getTime() - s.getTime()) / 60000);
    return durationMin > 240;
  });
  if (segmentExceedsWindow) {
    codes.push("planning-segment-too-long");
    reasons.push("Un segment individuel dépasse la durée d'une fenêtre ouvrée.");
  }
  
  // - interdit si la somme des segments est inférieure à la durée demandée
  const totalSegmentsDuration = submittedSegments.reduce((sum, seg) => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    return sum + (e.getTime() - s.getTime()) / (3600 * 1000);
  }, 0);
  if (totalSegmentsDuration < reservation.totalHours - 0.01) {
    codes.push("planning-insufficient-duration");
    reasons.push("La somme des segments est inférieure à la durée demandée.");
  }

  // Check collision on any segment for technician
  if (reservation.technicianId) {
    const techObj = technicians.find(t => t.id === reservation.technicianId);
    if (!techObj) {
      codes.push("planning-tech-not-found");
      reasons.push("Technicien inexistant.");
    } else {
      const hasTechColl = submittedSegments.some(seg => {
        const s = new Date(seg.start);
        const e = new Date(seg.end);
        return detectTechnicianCollisionWithReservations(
          dossiers,
          reservations,
          reservation.technicianId!,
          s,
          e,
          reservation.dossierId
        );
      });
      if (hasTechColl) {
        codes.push("planning-collision-tech");
        reasons.push("Le technicien est déjà affecté ou réservé sur cette période.");
      }
    }
  }

  // Check collision on any segment for bay
  if (reservation.bayId) {
    const bayObj = workshopBays.find(b => b.id === reservation.bayId);
    if (!bayObj) {
      codes.push("planning-bay-not-found");
      reasons.push("Pont inexistant.");
    } else {
      const hasBayColl = submittedSegments.some(seg => {
        const s = new Date(seg.start);
        const e = new Date(seg.end);
        return detectBayCollisionWithReservations(
          dossiers,
          reservations,
          reservation.bayId!,
          s,
          e,
          reservation.dossierId
        );
      });
      if (hasBayColl) {
        codes.push("planning-collision-bay");
        reasons.push("Le pont d'atelier sélectionné est déjà occupé.");
      }
    }
  }
  
  return {
    allowed: codes.length === 0,
    codes,
    reasons
  };
}

export function confirmReservation(reservation: WorkshopReservation, now: Date = new Date()): WorkshopReservation {
  if (reservation.status !== "CRENEAU_PROPOSE" && reservation.status !== "A_RESERVER") {
    throw new Error("Impossible de confirmer une réservation dans cet état.");
  }
  if (!reservation.startTime) {
    throw new Error("Aucun créneau proposé à confirmer.");
  }
  return {
    ...reservation,
    status: "RESERVATION_CONFIRMEE",
    history: [
      ...reservation.history,
      `${now.toISOString()} - Réservation confirmée pour le créneau ${reservation.startTime} à ${reservation.endTime}.`
    ]
  };
}

export function cancelReservation(reservation: WorkshopReservation, now: Date = new Date()): WorkshopReservation {
  return {
    ...reservation,
    status: "ANNULEE",
    history: [
      ...reservation.history,
      `${now.toISOString()} - Réservation annulée.`
    ]
  };
}

export function convertReservationToPlanning(
  reservation: WorkshopReservation,
  dossiers: DossierSAV[],
  now: Date = new Date()
): { dossiers: DossierSAV[]; reservation: WorkshopReservation } {
  if (reservation.status !== "RESERVATION_CONFIRMEE" && reservation.status !== "CRENEAU_PROPOSE") {
    throw new Error("Seule une réservation confirmée ou proposée peut être transformée en planning.");
  }
  if (!reservation.startTime || !reservation.technicianId || !reservation.bayId || !reservation.segments || reservation.segments.length === 0) {
    throw new Error("Créneau, technicien, pont ou segments manquants.");
  }
  
  const dossierId = reservation.dossierId;
  const dossierIndex = dossiers.findIndex(d => d.id === dossierId);
  if (dossierIndex < 0) {
    throw new Error("Dossier non trouvé.");
  }
  
  const dossier = dossiers[dossierIndex];
  
  // We distribute the tasks sequentially inside the reservation.segments
  let segmentIndex = 0;
  let segmentCursor = new Date(reservation.segments[0].start);
  
  const updatedLines = dossier.ordresReparation.map(line => {
    if (reservation.taskIds.includes(line.id)) {
      const taskDurationMinutes = Math.ceil(line.tempsEstime * 60);
      if (taskDurationMinutes <= 0) {
        return line;
      }
      
      const taskSegments: Array<{ start: string; end: string }> = [];
      let taskRemainingMinutes = taskDurationMinutes;
      const taskStart = new Date(segmentCursor);
      
      while (taskRemainingMinutes > 0) {
        if (segmentIndex >= reservation.segments!.length) {
          const fallbackEnd = addWorkingMinutes(segmentCursor, taskRemainingMinutes);
          taskSegments.push(...buildPlanningSegments(segmentCursor, fallbackEnd));
          segmentCursor = fallbackEnd;
          break;
        }
        
        const currentSegment = reservation.segments![segmentIndex];
        const segEnd = new Date(currentSegment.end);
        
        if (segmentCursor.getTime() >= segEnd.getTime()) {
          segmentIndex += 1;
          if (segmentIndex < reservation.segments!.length) {
            segmentCursor = new Date(reservation.segments![segmentIndex].start);
          }
          continue;
        }
        
        const availableMinutes = Math.max(0, Math.round((segEnd.getTime() - segmentCursor.getTime()) / 60000));
        if (availableMinutes <= 0) {
          segmentIndex += 1;
          if (segmentIndex < reservation.segments!.length) {
            segmentCursor = new Date(reservation.segments![segmentIndex].start);
          }
          continue;
        }
        
        const taken = Math.min(availableMinutes, taskRemainingMinutes);
        const nextCursor = new Date(segmentCursor.getTime() + taken * 60000);
        taskSegments.push({ start: segmentCursor.toISOString(), end: nextCursor.toISOString() });
        taskRemainingMinutes -= taken;
        segmentCursor = nextCursor;
      }
      
      const taskEnd = segmentCursor;
      const planningDate = taskStart.toISOString().split("T")[0];
      
      return {
        ...line,
        planningStart: taskStart.toISOString(),
        planningEnd: taskEnd.toISOString(),
        planningSegments: taskSegments,
        plannedTechnicianId: reservation.technicianId,
        plannedBayId: reservation.bayId,
        planningDate: planningDate
      };
    }
    return line;
  });
  
  const updatedDossier: DossierSAV = {
    ...dossier,
    ordresReparation: updatedLines,
    technicienId: reservation.technicianId,
    workshopBayId: reservation.bayId,
    datePlanningDebut: reservation.startTime,
    datePlanningFin: segmentCursor.toISOString(),
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    dateDernierStatut: now.toISOString(),
    historiqueLogs: [
      `${now.toISOString()} - Réservation convertie en planning Gantt avec le technicien ${reservation.technicianId} sur le pont ${reservation.bayId}.`,
      ...(dossier.historiqueLogs ?? [])
    ]
  };
  
  const updatedDossiers = dossiers.map(d => d.id === dossierId ? updatedDossier : d);
  
  const updatedReservation: WorkshopReservation = {
    ...reservation,
    status: "TRANSFORMEE_PLANNING",
    history: [
      ...reservation.history,
      `${now.toISOString()} - Réservation transformée en planning Gantt.`
    ]
  };
  
  return {
    dossiers: updatedDossiers,
    reservation: updatedReservation
  };
}

export function getReservationTimeline(reservation: WorkshopReservation): string[] {
  return reservation.history || [];
}
