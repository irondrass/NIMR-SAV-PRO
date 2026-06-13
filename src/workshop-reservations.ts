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
  DossierStatus
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
  normalizeRepairOrderStatus
} from "./sav-core";

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

export function suggestReservationSlot(
  input: {
    reservation: WorkshopReservation;
    dossiers: DossierSAV[];
    reservations: WorkshopReservation[];
    technicians: TechnicienResource[];
    workshopBays: WorkshopBay[];
  },
  now: Date = new Date()
): WorkshopReservation {
  const { reservation, dossiers, reservations, technicians, workshopBays } = input;
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
  
  const usableTechnicians = technicians.filter(t => !["absent", "formation"].includes(t.disponibilite));
  const techsToTry = usableTechnicians.length > 0 ? usableTechnicians : technicians;
  
  let timeCursor: Date | null = null;
  let startTimeStr = "";
  let endTimeStr = "";
  let proposedTechId = "";
  let proposedBayId = "";
  let proposedSegments: Array<{ start: string; end: string }> = [];
  
  let found = false;
  
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const candidateDate = new Date(desiredDate);
    candidateDate.setDate(candidateDate.getDate() + dayOffset);
    
    if (!isWorkingDay(candidateDate)) continue;
    const dateStr = getLocalDateKey(candidateDate);
    
    let dayTimeCursor: Date;
    if (dayOffset === 0 && desiredDateStr === nowDateStr) {
      const startOfToday = new Date(candidateDate);
      startOfToday.setHours(8, 0, 0, 0);
      const alignedNow = new Date(now);
      alignedNow.setSeconds(0, 0);
      
      const mins = alignedNow.getMinutes();
      const roundedMins = Math.ceil(mins / 15) * 15;
      alignedNow.setMinutes(roundedMins);
      
      const earliestStart = alignedNow.getTime() > startOfToday.getTime() ? alignedNow : startOfToday;
      dayTimeCursor = alignToWorkingTime(earliestStart);
    } else {
      dayTimeCursor = new Date(candidateDate);
      dayTimeCursor.setHours(8, 0, 0, 0);
    }
    
    const endOfDayLimit = candidateDate.getDay() === 6
      ? new Date(candidateDate).setHours(12, 0, 0, 0)
      : new Date(candidateDate).setHours(17, 0, 0, 0);
      
    const endLimitDate = new Date(endOfDayLimit);
    
    while (dayTimeCursor.getTime() < endLimitDate.getTime()) {
      const endTime = addWorkingMinutes(dayTimeCursor, durationMinutes);
      
      const sameDay = dayTimeCursor.getFullYear() === endTime.getFullYear() &&
                      dayTimeCursor.getMonth() === endTime.getMonth() &&
                      dayTimeCursor.getDate() === endTime.getDate();
                      
      if (!sameDay || endTime.getTime() > endLimitDate.getTime()) {
        dayTimeCursor = new Date(dayTimeCursor.getTime() + 30 * 60 * 1000);
        continue;
      }
      
      const sortedTechs = [...techsToTry].sort((left, right) => {
        const dossier = dossiers.find(d => d.id === reservation.dossierId);
        if (dossier) {
          const compLeft = isTechnicianCompatible(left, dossier.typeDossier);
          const compRight = isTechnicianCompatible(right, dossier.typeDossier);
          if (compLeft && !compRight) return -1;
          if (!compLeft && compRight) return 1;
        }
        
        let loadLeft = calculateTechnicianDailyLoad(left.id, dateStr, dossiers);
        let loadRight = calculateTechnicianDailyLoad(right.id, dateStr, dossiers);
        if (dayOffset === 0) {
          loadLeft = Math.max(loadLeft, left.chargeActuelle || 0);
          loadRight = Math.max(loadRight, right.chargeActuelle || 0);
        }
        return loadLeft - loadRight;
      });
      
      for (const tech of sortedTechs) {
        if (detectTechnicianCollisionWithReservations(dossiers, reservations, tech.id, dayTimeCursor, endTime, reservation.dossierId)) {
          continue;
        }
        
        const maxCap = candidateDate.getDay() === 6 ? 4 : 8;
        let dailyLoad = calculateTechnicianDailyLoad(tech.id, dateStr, dossiers);
        if (dayOffset === 0) {
          dailyLoad = Math.max(dailyLoad, tech.chargeActuelle || 0);
        }
        if (dailyLoad + durationHours > maxCap) {
          continue;
        }
        
        const compatibleBays = workshopBays.filter(bay => !bay.zone || bay.zone === tech.zoneAffectee);
        const baysToTry = compatibleBays.length > 0 ? compatibleBays : workshopBays;
        
        for (const bay of baysToTry) {
          if (!detectBayCollisionWithReservations(dossiers, reservations, bay.id, dayTimeCursor, endTime, reservation.dossierId)) {
            timeCursor = dayTimeCursor;
            startTimeStr = dayTimeCursor.toISOString();
            endTimeStr = endTime.toISOString();
            proposedTechId = tech.id;
            proposedBayId = bay.id;
            proposedSegments = buildPlanningSegments(dayTimeCursor, endTime);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
      dayTimeCursor = new Date(dayTimeCursor.getTime() + 30 * 60 * 1000);
    }
    if (found) break;
  }
  
  if (!found) {
    const fallbackDate = new Date(nextWorkingDay(desiredDate));
    fallbackDate.setHours(8, 0, 0, 0);
    const fallbackTech = techsToTry[0] || technicians[0];
    const fallbackBay = chooseWorkshopBay(workshopBays, fallbackTech?.zoneAffectee);
    const fallbackEndTime = addWorkingMinutes(fallbackDate, durationMinutes);
    
    return {
      ...reservation,
      startTime: fallbackDate.toISOString(),
      endTime: fallbackEndTime.toISOString(),
      segments: buildPlanningSegments(fallbackDate, fallbackEndTime),
      technicianId: fallbackTech?.id ?? "tech_virtual",
      bayId: fallbackBay.id,
      status: "CRENEAU_PROPOSE",
      history: [
        ...reservation.history,
        `${now.toISOString()} - Créneau proposé par défaut (aucun créneau disponible) : ${fallbackDate.toISOString()} avec le technicien ${fallbackTech?.nom} sur le pont ${fallbackBay.name}`
      ]
    };
  }
  
  const techName = technicians.find(t => t.id === proposedTechId)?.nom || proposedTechId;
  const bayName = workshopBays.find(b => b.id === proposedBayId)?.name || proposedBayId;
  
  return {
    ...reservation,
    startTime: startTimeStr,
    endTime: endTimeStr,
    segments: proposedSegments,
    technicianId: proposedTechId,
    bayId: proposedBayId,
    status: "CRENEAU_PROPOSE",
    history: [
      ...reservation.history,
      `${now.toISOString()} - Créneau proposé : ${startTimeStr} à ${endTimeStr} avec le technicien ${techName} sur le pont ${bayName}`
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
  },
  now: Date = new Date()
): { allowed: boolean; codes: string[]; reasons: string[] } {
  const { reservation, dossiers, reservations, technicians, workshopBays } = input;
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
  
  // Saturday afternoon check
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const isSaturday = start.getDay() === 6;
  
  if (isSaturday && (startMin >= 12 * 60 || endMin > 12 * 60)) {
    codes.push("planning-collision-saturday-afternoon");
    reasons.push("Samedi après-midi fermé.");
  }
  
  // Working hours check
  if (start.getHours() < 8 || end.getHours() > 17 || (end.getHours() === 17 && end.getMinutes() > 0)) {
    if (!isSaturday) {
      codes.push("planning-collision-hours");
      reasons.push("Horaires d'ouverture non respectés (08h-17h).");
    }
  }
  
  // Lunch break check
  const expectedSegments = buildPlanningSegments(start, end);
  const submittedSegments = reservation.segments || expectedSegments;
  
  const overlapsLunch = submittedSegments.some(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = e.getHours() * 60 + e.getMinutes();
    return sMin < 13 * 60 && eMin > 12 * 60;
  });
  
  if (overlapsLunch) {
    codes.push("planning-collision-lunch");
    reasons.push("Le créneau chevauche la pause déjeuner (12h-13h).");
  }
  
  // Technician collision
  if (reservation.technicianId) {
    if (detectTechnicianCollisionWithReservations(dossiers, reservations, reservation.technicianId, start, end, reservation.dossierId)) {
      codes.push("planning-collision-tech");
      reasons.push("Le technicien est déjà affecté ou réservé sur cette période.");
    }
    
    // Daily overload
    const planningDate = start.toISOString().split("T")[0];
    const maxCapacity = isSaturday ? 4 : 8;
    const requestedHours = reservation.totalHours;
    const currentDailyLoad = calculateTechnicianDailyLoad(reservation.technicianId, planningDate, dossiers);
    if (currentDailyLoad + requestedHours > maxCapacity) {
      codes.push("planning-collision-overload");
      reasons.push("La réservation dépasse la capacité journalière du technicien.");
    }
  }
  
  // Bay collision
  if (reservation.bayId) {
    if (detectBayCollisionWithReservations(dossiers, reservations, reservation.bayId, start, end, reservation.dossierId)) {
      codes.push("planning-collision-bay");
      reasons.push("Le pont d'atelier sélectionné est déjà occupé.");
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
  if (!reservation.startTime || !reservation.technicianId || !reservation.bayId) {
    throw new Error("Créneau, technicien ou pont manquant.");
  }
  
  const dossierId = reservation.dossierId;
  const dossierIndex = dossiers.findIndex(d => d.id === dossierId);
  if (dossierIndex < 0) {
    throw new Error("Dossier non trouvé.");
  }
  
  const dossier = dossiers[dossierIndex];
  let currentCursor = new Date(reservation.startTime);
  
  const updatedLines = dossier.ordresReparation.map(line => {
    if (reservation.taskIds.includes(line.id)) {
      const taskDurationMinutes = Math.ceil(line.tempsEstime * 60);
      if (taskDurationMinutes <= 0) {
        return line;
      }
      
      const taskStart = new Date(currentCursor);
      const taskEnd = addWorkingMinutes(taskStart, taskDurationMinutes);
      const taskSegments = buildPlanningSegments(taskStart, taskEnd);
      const planningDate = taskStart.toISOString().split("T")[0];
      
      currentCursor = new Date(taskEnd);
      
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
    datePlanningFin: currentCursor.toISOString(),
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
