/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AtelierZone, TechnicienResource, DossierSAV, DossierStatus, WorkshopBay, RepairOrderLine, UserRole, WorkshopReservation, WorkshopAvailabilityConfig } from "../types";
import { 
  normalizeRepairOrderStatus, 
  suggestWorkshopSlot, 
  WorkshopSlotSuggestion,
  isWorkingDay,
  getWorkingWindowsForDate,
  alignToWorkingTime,
  addWorkingMinutes,
  buildPlanningSegments,
  calculateTechnicianDailyLoad,
  calculateBayDailyLoad,
  validatePlanningAssignment
} from "../sav-core";
import { 
  isWorkshopClosed,
  isTechnicianAbsent,
  isBayUnavailable,
  getEffectiveWorkshopWindowsForResource,
  getDefaultWorkshopShiftProfiles
} from "../workshop-availability";
import { 
  Calendar, 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  Hammer, 
  Search, 
  SlidersHorizontal, 
  Settings, 
  Sparkles, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Save,
  FileText
} from "lucide-react";
import { LicencePlate, StatusBadge } from "./UIParts";
import PrintDocuments from "./PrintDocuments";
import * as perm from "../permissions";
import { maskPhoneNumber } from "../field-validations";
import { TASK_STATUS_VISUAL_ORDER, getTaskStatusVisual } from "../task-status-visual";
import {
  findTaskPlanningTarget,
  getCurrentGanttTaskStatus,
  getUnplannedRepairOrderTargets,
} from "../workshop-planning-helpers";
import {
  calculateReservationDuration,
  createReservationNeed,
  suggestReservationSlot,
  validateReservationSlot,
  confirmReservation,
  cancelReservation,
  convertReservationToPlanning
} from "../workshop-reservations";

interface WorkshopPlanningProps {
  techniciens: TechnicienResource[];
  dossiers: DossierSAV[];
  reservations: WorkshopReservation[];
  onUpdateReservations: (updated: WorkshopReservation[]) => void;
  onSelectDossier: (id: string) => void;
  onUpdateDossier: (updated: DossierSAV) => void;
  activeRole: UserRole;
  availabilityConfig?: WorkshopAvailabilityConfig;
  onUpdateAvailabilityConfig?: (updated: WorkshopAvailabilityConfig) => void;
}

const DEFAULT_WORKSHOP_BAYS: WorkshopBay[] = [
  { id: "bay_fast_01", name: "Pont rapide 1", zone: AtelierZone.MECANIQUE_RAPIDE },
  { id: "bay_mech_01", name: "Pont mécanique 1", zone: AtelierZone.GRANDS_TRAVAUX },
  { id: "bay_diag_01", name: "Pont diagnostic 1", zone: AtelierZone.ELECTRICITE_DIAG },
  { id: "bay_body_01", name: "Pont carrosserie 1", zone: AtelierZone.CARROSSERIE },
  { id: "bay_general_01", name: "Pont polyvalent" },
];

export default function WorkshopPlanning({
  techniciens,
  dossiers,
  reservations,
  onUpdateReservations,
  onSelectDossier,
  onUpdateDossier,
  activeRole,
  availabilityConfig,
  onUpdateAvailabilityConfig
}: WorkshopPlanningProps) {
  const [filterZone, setFilterZone] = useState<string>("Toutes");
  const [filterBay, setFilterBay] = useState<string>("Toutes");
  
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Suggestion states
  const [suggestionTargetId, setSuggestionTargetId] = useState("");
  const [suggestion, setSuggestion] = useState<WorkshopSlotSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<WorkshopSlotSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState("");

  // Manual planning form states
  const [manualDossierId, setManualDossierId] = useState("");
  const [manualTaskId, setManualTaskId] = useState("");
  const [manualTechId, setManualTechId] = useState("");
  const [manualBayId, setManualBayId] = useState("");
  const [manualStartHour, setManualStartHour] = useState("08");
  const [manualStartMin, setManualStartMin] = useState("00");

  // Visual saved feedback indicator
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [ganttSearchQuery, setGanttSearchQuery] = useState("");
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ dossierId: string; lineId: string } | null>(null);
  const [rescheduleTechId, setRescheduleTechId] = useState("");
  const [rescheduleBayId, setRescheduleBayId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("08:00");
  const [rescheduleDurationMinutes, setRescheduleDurationMinutes] = useState(60);
  const [rescheduleError, setRescheduleError] = useState("");
  const [draggingTask, setDraggingTask] = useState<{ dossierId: string; lineId: string } | null>(null);
  const [taskSheetTarget, setTaskSheetTarget] = useState<{ dossier: DossierSAV; line: RepairOrderLine } | null>(null);

  // Local helper to format Date to YYYY-MM-DD
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const selectedDateStr = getLocalDateStr(selectedDate);
  const isSat = selectedDate.getDay() === 6;
  const isClosedDay = !isWorkingDay(selectedDate);

  const isHoliday = availabilityConfig ? availabilityConfig.holidays.some(h => h.date === selectedDateStr) : false;
  const isClosed = availabilityConfig ? isWorkshopClosed(selectedDate, availabilityConfig) : isClosedDay;
  const holidayName = availabilityConfig ? availabilityConfig.holidays.find(h => h.date === selectedDateStr)?.name : null;

  const getDayScheduleDescription = () => {
    if (availabilityConfig) {
      if (isHoliday) {
        return `Jour férié : ${holidayName}`;
      }
      const exception = availabilityConfig.exceptions.find(e => e.date === selectedDateStr);
      if (exception) {
        if (exception.isClosed) {
          return `Fermeture exceptionnelle : ${exception.reason || "Fermé"}`;
        }
        return `Horaire exceptionnel : ${exception.windows?.map(w => `${w.start}-${w.end}`).join(", ")}`;
      }
      const dayOfWeek = selectedDate.getDay();
      const daySched = availabilityConfig.schedule.days.find(d => d.dayOfWeek === dayOfWeek);
      if (!daySched || daySched.isClosed) {
        return "Atelier fermé";
      }
      return `Ouvert : ${daySched.windows.map(w => `${w.start}-${w.end}`).join(" / ")}`;
    }
    return isClosedDay ? "Dimanche fermé" : isSat ? "Samedi (08h00 - 12h00 uniquement)" : "Lundi-Vendredi (Ouvert 08h-12h / 13h-17h)";
  };

  const getSystemTime = () => {
    if (typeof window !== "undefined" && (window as any).__mockNow) {
      return new Date((window as any).__mockNow);
    }
    return new Date();
  };
  const now = getSystemTime();

  // Sync manual select values
  const targetDossiers = dossiers.filter(dossier =>
    dossier.statut !== DossierStatus.LIVRE &&
    dossier.statut !== DossierStatus.CLOTURE &&
    dossier.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) !== "done")
  );

  const taskPlanningTargets = getUnplannedRepairOrderTargets(dossiers);
  const selectedTargetIdForSuggest = suggestionTargetId || taskPlanningTargets[0]?.key || "";
  const selectedTargetForSuggest = findTaskPlanningTarget(taskPlanningTargets, selectedTargetIdForSuggest);

  const activeManualDossier = dossiers.find(d => d.id === manualDossierId);
  const pendingManualTasks = activeManualDossier 
    ? activeManualDossier.ordresReparation.filter(line => normalizeRepairOrderStatus(line.status) !== "done")
    : [];

  useEffect(() => {
    if (targetDossiers.length > 0 && !manualDossierId) {
      setManualDossierId(targetDossiers[0].id);
    }
  }, [targetDossiers, manualDossierId]);

  useEffect(() => {
    if (pendingManualTasks.length > 0) {
      setManualTaskId(pendingManualTasks[0].id);
    } else {
      setManualTaskId("");
    }
  }, [pendingManualTasks]);

  useEffect(() => {
    if (techniciens.length > 0 && !manualTechId) {
      setManualTechId(techniciens[0].id);
    }
  }, [techniciens, manualTechId]);

  useEffect(() => {
    if (DEFAULT_WORKSHOP_BAYS.length > 0 && !manualBayId) {
      setManualBayId(DEFAULT_WORKSHOP_BAYS[0].id);
    }
  }, [manualBayId]);

  // Date Navigation Helpers (skip Sundays)
  const handlePrevDay = () => {
    let prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    while (prev.getDay() === 0) { // Skip Sunday
      prev.setDate(prev.getDate() - 1);
    }
    setSelectedDate(prev);
    setSuggestion(null);
    setSuggestions([]);
  };

  const handleNextDay = () => {
    let next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0) { // Skip Sunday
      next.setDate(next.getDate() + 1);
    }
    setSelectedDate(next);
    setSuggestion(null);
    setSuggestions([]);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setSuggestion(null);
    setSuggestions([]);
  };

  const buildSuggestionCandidates = (): WorkshopSlotSuggestion[] => {
    if (!selectedTargetForSuggest) return [];
    const candidates: WorkshopSlotSuggestion[] = [];
    const seen = new Set<string>();
    const offsets = [0, 30, 60];

    for (const offsetMinutes of offsets) {
      const targetDesiredDate = new Date(selectedDate);
      targetDesiredDate.setHours(8, offsetMinutes, 0, 0);
      const result = suggestWorkshopSlot({
        dossiers,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        estimatedHours: selectedTargetForSuggest.line.tempsEstime || 1,
        desiredDate: targetDesiredDate,
        dossierId: selectedTargetForSuggest.dossier.id,
        reservations,
        availabilityConfig,
      }, getSystemTime());

      const key = `${result.technicianId}-${result.bayId}-${result.startTime}-${result.endTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({
          ...result,
          rankLabel: candidates.length === 0 ? "Meilleur créneau" : `Alternative ${candidates.length + 1}`,
        });
      }
      if (candidates.length >= 3) break;
    }

    return candidates;
  };

  // Suggest slot
  const handleSuggestSlot = () => {
    if (!selectedTargetForSuggest) {
      setSuggestionError("Aucune tâche non planifiée disponible pour suggestion.");
      setSuggestion(null);
      setSuggestions([]);
      return;
    }

    try {
      const candidates = buildSuggestionCandidates();
      if (candidates.length === 0) {
        setSuggestionError("Aucun créneau compatible trouvé.");
        setSuggestion(null);
        setSuggestions([]);
        return;
      }

      setSuggestion(candidates[0]);
      setSuggestions(candidates);
      setSuggestionError("");
    } catch (err: any) {
      setSuggestionError(err.message || "Erreur de suggestion");
      setSuggestion(null);
      setSuggestions([]);
    }
  };

  // Apply suggestion
  const handleApplySuggestion = (selectedSuggestion = suggestion) => {
    if (!selectedTargetForSuggest || !selectedSuggestion) return;
    
    const { dossier, line: targetLine } = selectedTargetForSuggest;
    const start = new Date(selectedSuggestion.startTime);
    const end = new Date(selectedSuggestion.endTime);
    const segments = selectedSuggestion.segments.length > 0 ? selectedSuggestion.segments : buildPlanningSegments(start, end);
    const planningDate = getLocalDateStr(start);

    const updatedLines = dossier.ordresReparation.map(line => {
      if (line.id === targetLine.id) {
        return {
          ...line,
          planningStart: selectedSuggestion.startTime,
          planningEnd: selectedSuggestion.endTime,
          planningSegments: segments,
          plannedTechnicianId: selectedSuggestion.technicianId,
          plannedBayId: selectedSuggestion.bayId,
          planningDate: planningDate
        };
      }
      return line;
    });

    onUpdateDossier({
      ...dossier,
      ordresReparation: updatedLines,
      technicienId: selectedSuggestion.technicianId,
      workshopBayId: selectedSuggestion.bayId,
      datePlanningDebut: selectedSuggestion.startTime,
      datePlanningFin: selectedSuggestion.endTime,
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      dateDernierStatut: new Date().toISOString(),
      prochaineActionRecommended: `Tâche "${targetLine.designation}" planifiée sur ${selectedSuggestion.bayName} avec ${selectedSuggestion.technicianName} le ${new Date(selectedSuggestion.startTime).toLocaleDateString("fr-FR")} de ${new Date(selectedSuggestion.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(selectedSuggestion.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    });

    setSuggestion(null);
    setSuggestions([]);
    setSuggestionTargetId("");
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 3000);
  };

  // Manual planning validation and saving
  const getManualInterval = () => {
    const start = new Date(selectedDate);
    start.setHours(Number(manualStartHour), Number(manualStartMin), 0, 0);
    
    const activeLine = activeManualDossier?.ordresReparation.find(l => l.id === manualTaskId);
    const estimatedHours = activeLine ? activeLine.tempsEstime : 1;
    const durationMinutes = Math.ceil(estimatedHours * 60);
    const end = addWorkingMinutes(start, durationMinutes);
    
    return { start, end, estimatedHours };
  };

  const checkManualCollisions = () => {
    if (!manualDossierId || !manualTaskId || !manualTechId || !manualBayId) return [];
    
    const { start, end } = getManualInterval();
    return validatePlanningAssignment({
      dossiers,
      dossierId: manualDossierId,
      lineId: manualTaskId,
      technicianId: manualTechId,
      bayId: manualBayId,
      start,
      end,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      reservations,
      availabilityConfig,
    }, getSystemTime()).codes;
  };

  const manualWarnings = checkManualCollisions();
  const isManualSaveBlocked = manualWarnings.length > 0;

  const handleSaveManualPlanning = () => {
    if (!activeManualDossier || !manualTaskId || !manualTechId || !manualBayId) return;

    const { start, end } = getManualInterval();
    const validation = validatePlanningAssignment({
      dossiers,
      dossierId: activeManualDossier.id,
      lineId: manualTaskId,
      technicianId: manualTechId,
      bayId: manualBayId,
      start,
      end,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      reservations,
      availabilityConfig,
    }, getSystemTime());

    if (!validation.allowed) {
      return;
    }

    const segments = validation.segments.length > 0 ? validation.segments : buildPlanningSegments(start, end);
    const updatedLines = activeManualDossier.ordresReparation.map(line => {
      if (line.id === manualTaskId) {
        return {
          ...line,
          planningStart: start.toISOString(),
          planningEnd: end.toISOString(),
          planningSegments: segments,
          plannedTechnicianId: manualTechId,
          plannedBayId: manualBayId,
          planningDate: selectedDateStr
        };
      }
      return line;
    });

    onUpdateDossier({
      ...activeManualDossier,
      ordresReparation: updatedLines,
      technicienId: manualTechId,
      workshopBayId: manualBayId,
      datePlanningDebut: start.toISOString(),
      datePlanningFin: end.toISOString(),
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      dateDernierStatut: new Date().toISOString(),
      prochaineActionRecommended: `Planification manuelle sur ${DEFAULT_WORKSHOP_BAYS.find(b => b.id === manualBayId)?.name} le ${selectedDate.toLocaleDateString("fr-FR")} de ${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    });

    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 3000);
  };

  // Filtering technicians and bays
  const filteredTechs = filterZone === "Toutes" 
    ? techniciens 
    : techniciens.filter(t => t.zoneAffectee === filterZone);

  const filteredBays = filterBay === "Toutes"
    ? DEFAULT_WORKSHOP_BAYS
    : DEFAULT_WORKSHOP_BAYS.filter(b => b.id === filterBay);

  // Gantt Chart hours mapping
  const ganttHours = isSat 
    ? [8, 9, 10, 11] 
    : [8, 9, 10, 11, 12, 13, 14, 15, 16];

  const totalGanttMinutes = isSat ? 4 * 60 : 9 * 60; // 240 or 540 minutes

  const todayStrForLine = getLocalDateStr(now);
  const isSelectedDateTodayForLine = selectedDateStr === todayStrForLine;
  const nowHourForLine = now.getHours();
  const nowMinForLine = now.getMinutes();
  const nowMinutesSince8ForLine = (nowHourForLine - 8) * 60 + nowMinForLine;
  const isTimeInWorkingHoursForLine = nowMinutesSince8ForLine >= 0 && nowMinutesSince8ForLine <= totalGanttMinutes;
  const showNowLine = isSelectedDateTodayForLine && isTimeInWorkingHoursForLine;
  const nowPct = showNowLine ? (nowMinutesSince8ForLine / totalGanttMinutes) * 100 : 0;

  // Find all reservations active on the selected date
  const activeReservationsStr = reservations.filter(res => {
    if (res.status === "CRENEAU_PROPOSE" || res.status === "RESERVATION_CONFIRMEE") {
      const hasSegmentOnDate = res.segments && res.segments.length > 0
        ? res.segments.some(seg => seg.start.split("T")[0] === selectedDateStr)
        : res.startTime && res.startTime.split("T")[0] === selectedDateStr;
      if (hasSegmentOnDate) {
          if (ganttSearchQuery.trim()) {
            const query = ganttSearchQuery.toLowerCase().trim();
            const dossier = dossiers.find(d => d.id === res.dossierId);
            if (dossier) {
              const matchesImmat = dossier.vehiculeImmatriculation?.toLowerCase().includes(query);
              const matchesVin = dossier.vehiculeVIN?.toLowerCase().includes(query);
              const matchesDossier = dossier.id?.toLowerCase().includes(query);
              const matchesClient = dossier.clientNom?.toLowerCase().includes(query);
              if (!matchesImmat && !matchesVin && !matchesDossier && !matchesClient) {
                return false;
              }
            } else {
              return false;
            }
          }
          return true;
        }
      }
      return false;
    });

  // Construct reservation needs
  const reservationNeeds = dossiers
    .filter(dossier => calculateReservationDuration(dossier) > 0)
    .map(dossier => {
      const duration = calculateReservationDuration(dossier);
      const res = reservations
        .filter(r => r.dossierId === dossier.id)
        .sort((a, b) => reservations.indexOf(b) - reservations.indexOf(a))[0];
      
      return {
        dossier,
        duration,
        reservation: res || null
      };
    })
    .filter(item => !item.reservation || item.reservation.status !== "TRANSFORMEE_PLANNING");

  const handleSuggestReservation = (dossier: DossierSAV, existingRes: WorkshopReservation | null) => {
    const baseRes = existingRes && existingRes.status !== "ANNULEE" 
      ? existingRes 
      : createReservationNeed(dossier, getSystemTime());
    
    if (!baseRes) return;

    try {
      const suggested = suggestReservationSlot({
        reservation: baseRes,
        dossiers,
        reservations,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        availabilityConfig
      }, getSystemTime());

      const exists = reservations.some(r => r.reservationId === suggested.reservationId);
      const nextRes = exists
        ? reservations.map(r => r.reservationId === suggested.reservationId ? suggested : r)
        : [...reservations, suggested];
      
      onUpdateReservations(nextRes);
    } catch (err: any) {
      console.error(err.message || "Erreur de suggestion.");
    }
  };

  const handleConfirmReservation = (res: WorkshopReservation) => {
    const confirmed = confirmReservation(res, getSystemTime());
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? confirmed : r);
    onUpdateReservations(nextRes);
  };

  const handleCancelReservation = (res: WorkshopReservation) => {
    const cancelled = cancelReservation(res, getSystemTime());
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? cancelled : r);
    onUpdateReservations(nextRes);
  };

  const handleConvertReservation = (res: WorkshopReservation) => {
    const { dossiers: nextDossiers, reservation: nextResObj } = convertReservationToPlanning(res, dossiers, getSystemTime());
    
    const updatedDossier = nextDossiers.find(d => d.id === res.dossierId);
    if (updatedDossier) {
      onUpdateDossier(updatedDossier);
    }
    
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? nextResObj : r);
    onUpdateReservations(nextRes);
  };

  const openRescheduleModal = (
    dossier: DossierSAV,
    line: RepairOrderLine,
    overrides: { technicianId?: string; bayId?: string; start?: Date } = {}
  ) => {
    const currentStart = overrides.start || (line.planningStart ? new Date(line.planningStart) : selectedDate);
    const durationMinutes = line.planningStart && line.planningEnd
      ? Math.max(15, Math.round((new Date(line.planningEnd).getTime() - new Date(line.planningStart).getTime()) / 60000))
      : Math.max(15, Math.ceil((line.tempsEstime || 1) * 60));

    setRescheduleTarget({ dossierId: dossier.id, lineId: line.id });
    setRescheduleTechId(overrides.technicianId || line.plannedTechnicianId || dossier.technicienId || techniciens[0]?.id || "");
    setRescheduleBayId(overrides.bayId || line.plannedBayId || DEFAULT_WORKSHOP_BAYS[0]?.id || "");
    setRescheduleDate(getLocalDateStr(currentStart));
    setRescheduleStart(`${String(currentStart.getHours()).padStart(2, "0")}:${String(currentStart.getMinutes()).padStart(2, "0")}`);
    setRescheduleDurationMinutes(durationMinutes);
    setRescheduleError("");
  };

  const closeRescheduleModal = () => {
    setRescheduleTarget(null);
    setRescheduleError("");
  };

  const handleSaveReschedule = () => {
    if (!rescheduleTarget || !rescheduleTechId || !rescheduleBayId || !rescheduleDate || !rescheduleStart) return;
    const dossier = dossiers.find(current => current.id === rescheduleTarget.dossierId);
    const line = dossier?.ordresReparation.find(current => current.id === rescheduleTarget.lineId);
    if (!dossier || !line) return;

    const [hour, minute] = rescheduleStart.split(":").map(Number);
    const start = new Date(`${rescheduleDate}T00:00:00`);
    start.setHours(hour, minute, 0, 0);
    const end = addWorkingMinutes(start, Math.max(15, rescheduleDurationMinutes));
    const validation = validatePlanningAssignment({
      dossiers,
      dossierId: dossier.id,
      lineId: line.id,
      technicianId: rescheduleTechId,
      bayId: rescheduleBayId,
      start,
      end,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      reservations,
      availabilityConfig,
    }, getSystemTime());

    if (!validation.allowed) {
      setRescheduleError(validation.reasons.join(" "));
      return;
    }

    const techName = techniciens.find(tech => tech.id === rescheduleTechId)?.nom || rescheduleTechId;
    const bayName = DEFAULT_WORKSHOP_BAYS.find(bay => bay.id === rescheduleBayId)?.name || rescheduleBayId;
    const confirmed = window.confirm(`Déplacer la tâche "${line.designation}" vers ${techName} / ${bayName} le ${start.toLocaleString("fr-FR")} ?`);
    if (!confirmed) return;

    const segments = validation.segments.length > 0 ? validation.segments : buildPlanningSegments(start, end);
    const nextLines = dossier.ordresReparation.map(current => current.id === line.id ? {
      ...current,
      planningStart: start.toISOString(),
      planningEnd: end.toISOString(),
      planningSegments: segments,
      plannedTechnicianId: rescheduleTechId,
      plannedBayId: rescheduleBayId,
      planningDate: rescheduleDate,
    } : current);

    onUpdateDossier({
      ...dossier,
      ordresReparation: nextLines,
      technicienId: rescheduleTechId,
      workshopBayId: rescheduleBayId,
      datePlanningDebut: start.toISOString(),
      datePlanningFin: end.toISOString(),
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      dateDernierStatut: new Date().toISOString(),
      prochaineActionRecommended: `Créneau modifié pour "${line.designation}" sur ${bayName} avec ${techName}.`,
    });
    closeRescheduleModal();
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 3000);
  };

  const getDropStartDate = (event: React.DragEvent<HTMLElement>): Date => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const rawMinutes = ratio * totalGanttMinutes;
    const snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const start = new Date(selectedDate);
    start.setHours(8, 0, 0, 0);
    start.setMinutes(start.getMinutes() + snappedMinutes);
    return start;
  };

  const handleDropTask = (
    event: React.DragEvent<HTMLElement>,
    defaults: { technicianId?: string; bayId?: string }
  ) => {
    event.preventDefault();
    if (!draggingTask) return;
    const dossier = dossiers.find(current => current.id === draggingTask.dossierId);
    const line = dossier?.ordresReparation.find(current => current.id === draggingTask.lineId);
    if (!dossier || !line) return;
    openRescheduleModal(dossier, line, { ...defaults, start: getDropStartDate(event) });
    setDraggingTask(null);
  };

  const handlePrintTaskSheet = (dossier: DossierSAV, line: RepairOrderLine | null | undefined) => {
    if (!line) {
      window['alert']("Aucune tâche sélectionnée pour impression.");
      return;
    }
    setTaskSheetTarget({ dossier, line });
    document.body.classList.add("printing-task-sheet");

    const cleanup = () => {
      document.body.classList.remove("printing-task-sheet");
      setTaskSheetTarget(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(cleanup, 1000);
      });
    });
  };

  // Find all tasks planned on the selected date
  const activePlannedLines: Array<{ dossier: DossierSAV; line: RepairOrderLine }> = [];
  dossiers.forEach(dossier => {
    if (dossier.statut !== DossierStatus.LIVRE && dossier.statut !== DossierStatus.CLOTURE) {
      dossier.ordresReparation.forEach(line => {
        const hasSegmentOnDate = line.planningSegments && line.planningSegments.length > 0
          ? line.planningSegments.some(seg => seg.start.split("T")[0] === selectedDateStr)
          : line.planningDate === selectedDateStr;
        if (hasSegmentOnDate && line.planningStart && line.planningEnd) {
          if (ganttSearchQuery.trim()) {
            const query = ganttSearchQuery.toLowerCase().trim();
            const matchesImmat = dossier.vehiculeImmatriculation?.toLowerCase().includes(query);
            const matchesVin = dossier.vehiculeVIN?.toLowerCase().includes(query);
            const matchesDossier = dossier.id?.toLowerCase().includes(query);
            const matchesClient = dossier.clientNom?.toLowerCase().includes(query);
            if (!matchesImmat && !matchesVin && !matchesDossier && !matchesClient) {
              return;
            }
          }
          activePlannedLines.push({ dossier, line });
        }
      });
    }
  });

  const rescheduleDossier = rescheduleTarget
    ? dossiers.find(dossier => dossier.id === rescheduleTarget.dossierId)
    : undefined;
  const rescheduleLine = rescheduleDossier && rescheduleTarget
    ? rescheduleDossier.ordresReparation.find(line => line.id === rescheduleTarget.lineId)
    : undefined;
  const shiftProfiles = availabilityConfig?.shiftProfiles?.length
    ? availabilityConfig.shiftProfiles
    : getDefaultWorkshopShiftProfiles();
  const canShowPhone = perm.canViewVehicleSensitiveFields(activeRole);

  return (
    <div className="space-y-6">
      
      {/* Title & Date selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 font-display">
              <Calendar className="w-5 h-5 text-blue-600" />
              PLANNING & CHARGE DES TECHNICIENS (GANTT)
            </h2>
            <p className="text-gray-500 text-xs">Visualisation de la charge journalière et affectation des créneaux de travaux.</p>
            {isSelectedDateTodayForLine && (
              <p data-testid="planning-current-time" className="text-rose-600 text-xs font-bold flex items-center gap-1 mt-1">
                <Clock className="w-3.5 h-3.5" />
                Heure actuelle : {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Saved indicator */}
            {showSavedIndicator && (
              <span 
                data-testid="planning-saved-indicator"
                className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-200 animate-pulse"
              >
                <Check className="w-3.5 h-3.5" />
                SAUVEGARDÉ
              </span>
            )}

          </div>
        </div>

        {/* Date Navigator Header */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handlePrevDay} 
              data-testid="planning-nav-prev"
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button 
              onClick={handleToday}
              data-testid="planning-nav-today"
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button 
              onClick={handleNextDay}
              data-testid="planning-nav-next"
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="text-right">
            <span data-testid="planning-current-date" className="font-extrabold text-sm text-gray-900 block font-display">
              {selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
            <input
              data-testid="planning-date-input"
              type="date"
              className="mt-2 p-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700"
              value={selectedDateStr}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split("-").map(Number);
                if (!year || !month || !day) return;
                const nextDate = new Date(selectedDate);
                nextDate.setFullYear(year, month - 1, day);
                nextDate.setHours(8, 0, 0, 0);
                setSelectedDate(nextDate);
                setSuggestion(null);
                setSuggestions([]);
              }}
            />
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
              {getDayScheduleDescription()}
            </span>
          </div>
        </div>
      </div>

      {/* Closed / Holiday Banners */}
      {isClosed && (
        <div 
          data-testid="workshop-closed-banner"
          className={`p-4 rounded-xl border text-center font-bold text-xs uppercase tracking-wider ${
            isHoliday 
              ? "bg-amber-100 text-amber-800 border-amber-200" 
              : "bg-rose-100 text-rose-800 border-rose-200"
          }`}
        >
          {isHoliday ? `Jour férié : ${holidayName}` : "Atelier fermé"}
        </div>
      )}

      {/* Auto suggest, manual form & reservations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Automatic Slot Suggestion */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 font-display">
            <Sparkles className="w-4.5 h-4.5 text-blue-600" />
            MOTEUR DE SUGGESTION DE PLANNING
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Tâche à planifier :</label>
              <select
                data-testid="planning-suggest-dossier"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedTargetIdForSuggest}
                onChange={(e) => {
                  setSuggestionTargetId(e.target.value);
                  setSuggestion(null);
                  setSuggestions([]);
                  setSuggestionError("");
                }}
              >
                {taskPlanningTargets.length === 0 ? (
                  <option value="">Aucune tâche en attente de planification</option>
                ) : (
                  <>
                    {taskPlanningTargets
                      .filter((target, index, all) => all.findIndex(current => current.dossier.id === target.dossier.id) === index)
                      .map(target => (
                        <option key={`legacy-${target.dossier.id}`} value={target.dossier.id} hidden>
                          {target.dossier.id}
                        </option>
                      ))}
                    {taskPlanningTargets.map(target => (
                      <option key={target.key} value={target.key}>
                        {target.dossier.id} - {target.line.designation} ({target.dossier.vehiculeImmatriculation})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <button
              onClick={handleSuggestSlot}
              disabled={taskPlanningTargets.length === 0}
              data-testid="planning-suggest-submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <Sparkles className="w-4 h-4" />
              Suggérer meilleur créneau
            </button>
          </div>

          {suggestionError && (
            <p data-testid="planning-suggest-error" className="text-xs font-bold text-rose-600">{suggestionError}</p>
          )}

          {suggestion && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((candidate, index) => (
                <div key={`${candidate.technicianId}-${candidate.bayId}-${candidate.startTime}`} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-xs">
                  <div className="space-y-1.5">
                    <span className="inline-flex w-fit rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 border border-blue-100">
                      {candidate.rankLabel || `Suggestion ${index + 1}`}
                    </span>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Technicien proposé</span>
                      <strong data-testid={index === 0 ? "planning-suggest-tech" : undefined} className="text-gray-800 text-sm font-black">{candidate.technicianName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Pont proposé</span>
                      <strong data-testid={index === 0 ? "planning-suggest-bay" : undefined} className="text-gray-800 text-sm font-black">{candidate.bayName}</strong>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Horaires de début / fin</span>
                      <strong data-testid={index === 0 ? "planning-suggest-start" : undefined} className="text-gray-800 font-bold block">
                        Début : {new Date(candidate.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </strong>
                      <strong data-testid={index === 0 ? "planning-suggest-end" : undefined} className="text-gray-800 font-bold block">
                        Fin : {new Date(candidate.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </strong>
                    </div>
                    <div className="pt-2 border-t border-blue-100/60">
                      <p className="text-blue-800 font-semibold leading-normal">{candidate.reason}</p>
                      {candidate.reason.includes("Créneau proposé à partir de l’heure actuelle.") && (
                        <p data-testid={index === 0 ? "planning-suggest-shifted-warning" : undefined} className="text-amber-600 font-bold text-[10px] mt-1">
                          Créneau proposé à partir de l'heure actuelle.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplySuggestion(candidate)}
                    data-testid={index === 0 ? "planning-suggest-apply" : `planning-suggest-apply-${index + 1}`}
                    className="sm:col-span-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Check className="w-4 h-4" />
                    Appliquer cette suggestion
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual Planning Form & Collision warning panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 font-display">
            <Settings className="w-4.5 h-4.5 text-gray-600" />
            AFFECTATION MANUELLE ET CONTRÔLE DE COLLISION
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Dossier :</label>
              <select
                data-testid="planning-manual-dossier"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                value={manualDossierId}
                onChange={(e) => setManualDossierId(e.target.value)}
              >
                {targetDossiers.map(d => (
                  <option key={d.id} value={d.id}>{d.id} - {d.clientNom}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Tâche :</label>
              <select
                data-testid="planning-manual-task"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                value={manualTaskId}
                onChange={(e) => setManualTaskId(e.target.value)}
              >
                {pendingManualTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.designation} ({t.tempsEstime}H)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Technicien :</label>
              <select
                data-testid="planning-manual-tech"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                value={manualTechId}
                onChange={(e) => setManualTechId(e.target.value)}
              >
                {techniciens.map(t => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Pont d'Atelier :</label>
              <select
                data-testid="planning-manual-bay"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                value={manualBayId}
                onChange={(e) => setManualBayId(e.target.value)}
              >
                {DEFAULT_WORKSHOP_BAYS.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Heure de début :</label>
                <div className="flex items-center gap-1">
                  <select
                    data-testid="planning-manual-hour"
                    className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold flex-1"
                    value={manualStartHour}
                    onChange={(e) => setManualStartHour(e.target.value)}
                  >
                    {["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"].map(h => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                  <select
                    data-testid="planning-manual-minute"
                    className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold flex-1"
                    value={manualStartMin}
                    onChange={(e) => setManualStartMin(e.target.value)}
                  >
                    {["00", "30"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveManualPlanning}
                  data-testid="planning-manual-submit"
                  disabled={isManualSaveBlocked}
                  className="w-full py-3 bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:hover:bg-gray-300 disabled:text-gray-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed transition"
                  title={isManualSaveBlocked ? "Corriger le créneau avant sauvegarde." : "Enregistrer la planification"}
                >
                  <Save className="w-4 h-4" />
                  {isManualSaveBlocked ? "Corriger le créneau" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>

          {/* Manual Assignment Collisions warnings */}
          {manualWarnings.length > 0 && (
            <div className="space-y-1.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
              <span data-testid="planning-save-blocked-message" className="text-[10px] text-red-800 font-extrabold block uppercase tracking-wider">
                Corriger le créneau avant sauvegarde.
              </span>
              <div className="space-y-1">
                {manualWarnings.includes("planning-collision-hours") && (
                  <p data-testid="planning-collision-hours" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Créneau en dehors des horaires d'ouverture (08h-17h, Samedi matin 08h-12h).
                  </p>
                )}
                {manualWarnings.includes("planning-collision-sunday") && (
                  <p data-testid="planning-collision-sunday" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Dimanche fermé : aucun créneau ne peut être enregistré.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-saturday-afternoon") && (
                  <p data-testid="planning-collision-saturday-afternoon" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Samedi après-midi fermé : choisir un créneau samedi matin ou le prochain jour ouvrable.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-lunch") && (
                  <p data-testid="planning-collision-lunch" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Le créneau chevauche la pause déjeuner (12h-13h).
                  </p>
                )}
                {manualWarnings.includes("planning-collision-tech") && (
                  <p data-testid="planning-collision-tech" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Le technicien est déjà affecté sur un autre dossier durant cette période.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-bay") && (
                  <p data-testid="planning-collision-bay" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Le pont d'atelier sélectionné est déjà occupé durant cette période.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-overload") && (
                  <p data-testid="planning-collision-overload" className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                    Surcharge : La tâche dépasse la capacité journalière restante du technicien.
                  </p>
                )}
                {manualWarnings.includes("planning-segments-invalid") && (
                  <p data-testid="planning-segments-invalid" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Segments invalides : aucune plage ne doit couvrir pause midi ou heures fermées.
                  </p>
                )}
                {manualWarnings.includes("planning-in-past") && (
                  <p data-testid="planning-collision-past" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Impossible de planifier dans le passé.
                  </p>
                )}
                {manualWarnings.includes("planning-tech-not-found") && (
                  <p data-testid="planning-collision-tech-not-found" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Technicien inexistant.
                  </p>
                )}
                {manualWarnings.includes("planning-bay-not-found") && (
                  <p data-testid="planning-collision-bay-not-found" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Pont inexistant.
                  </p>
                )}
                {manualWarnings.includes("planning-task-not-found") && (
                  <p data-testid="planning-collision-task-not-found" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Tâche inexistante.
                  </p>
                )}
                {manualWarnings.includes("planning-dossier-not-found") && (
                  <p data-testid="planning-collision-dossier-not-found" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Dossier inexistant.
                  </p>
                )}
                {manualWarnings.includes("planning-duration-missing") && (
                  <p data-testid="planning-duration-missing" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Durée estimée absente ou nulle. Ouvrez le dossier pour saisir ou importer la durée.
                  </p>
                )}
                {manualWarnings.includes("planning-duration-not-validated") && (
                  <p data-testid="planning-duration-not-validated" className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                    Durée estimée à valider. Ouvrez le dossier et validez la durée avant de planifier.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Réservations Atelier Panel */}
        <div 
          data-testid="workshop-reservations-panel"
          className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest flex items-center gap-1.5 font-display">
            <Calendar className="w-4.5 h-4.5 text-indigo-650" />
            RÉSERVATIONS ATELIER
          </h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {reservationNeeds.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun dossier en attente de réservation.</p>
            ) : (
              reservationNeeds.map(({ dossier, duration, reservation }) => {
                const status = reservation ? reservation.status : "A_RESERVER";
                
                // Check if slot has issues
                let validationErrors: string[] = [];
                if (reservation && (status === "CRENEAU_PROPOSE" || status === "RESERVATION_CONFIRMEE")) {
                  const valResult = validateReservationSlot({
                    reservation,
                    dossiers,
                    reservations,
                    technicians: techniciens,
                    workshopBays: DEFAULT_WORKSHOP_BAYS,
                    availabilityConfig
                  }, getSystemTime());
                  if (!valResult.allowed) {
                    validationErrors = valResult.reasons;
                  }
                }

                return (
                  <div 
                    key={dossier.id}
                    data-testid="reservation-need-card"
                    className="p-3 border border-gray-150 rounded-xl space-y-2 hover:border-gray-300 transition text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-gray-900">{dossier.id}</strong>
                      {status === "A_RESERVER" && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-gray-105 text-gray-750 text-[9px] font-black uppercase">À réserver</span>
                      )}
                      {status === "CRENEAU_PROPOSE" && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-blue-105 text-blue-800 text-[9px] font-black uppercase">Créneau proposé</span>
                      )}
                      {status === "RESERVATION_CONFIRMEE" && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-indigo-105 text-indigo-800 text-[9px] font-black uppercase">Réservation confirmée</span>
                      )}
                    </div>
                    
                    <div className="text-gray-650 space-y-0.5">
                      <div>Véhicule : <span className="font-extrabold text-gray-805">{dossier.vehiculeMarque} {dossier.vehiculeModele} ({dossier.vehiculeImmatriculation})</span></div>
                      <div>Durée MO validée : <span className="font-extrabold text-gray-805">{duration}h</span></div>
                      {reservation && reservation.startTime && (() => {
                        const uniqueDays = reservation.segments && reservation.segments.length > 0
                          ? new Set(reservation.segments.map(seg => seg.start.split("T")[0])).size
                          : 1;
                        const numSegments = reservation.segments?.length || 1;
                        const isExpanded = expandedResId === reservation.reservationId;

                        return (
                          <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100 mt-1.5 space-y-1">
                            <div className="font-black text-gray-700 uppercase text-[9px]">Créneau proposé :</div>
                            <div>
                              Début : <span data-testid="res-start" className="font-bold text-gray-800">
                                {new Date(reservation.startTime).toLocaleDateString("fr-FR")} à {new Date(reservation.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div>
                              Fin estimée : <span data-testid="res-end" className="font-bold text-gray-800">
                                {reservation.endTime ? `${new Date(reservation.endTime).toLocaleDateString("fr-FR")} à ${new Date(reservation.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "-"}
                              </span>
                            </div>
                            <div>
                              Charge répartie sur : <span data-testid="res-days" className="font-bold text-gray-800">
                                {uniqueDays} {uniqueDays > 1 ? "jours" : "jour"}
                              </span>
                            </div>
                            <div>
                              Segments : <span data-testid="res-segments-count" className="font-bold text-gray-800">
                                {numSegments} {numSegments > 1 ? "segments" : "segment"}
                              </span>
                            </div>
                            <div>Technicien : <span className="font-bold text-gray-800">{techniciens.find(t => t.id === reservation.technicianId)?.nom || reservation.technicianId}</span></div>
                            <div>Pont : <span className="font-bold text-gray-800">{DEFAULT_WORKSHOP_BAYS.find(b => b.id === reservation.bayId)?.name || reservation.bayId}</span></div>
                            
                            {reservation.segments && reservation.segments.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-gray-200">
                                <button
                                  type="button"
                                  data-testid="res-toggle-segments-btn"
                                  onClick={() => setExpandedResId(isExpanded ? null : reservation.reservationId)}
                                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[9px]"
                                >
                                  {isExpanded ? "Masquer les segments" : "Voir les segments"}
                                </button>
                                {isExpanded && (
                                  <div data-testid="reservation-segments-list" className="mt-1 pl-2 space-y-0.5 border-l-2 border-gray-200 text-[10px] text-gray-650 max-h-[150px] overflow-y-auto">
                                    {reservation.segments.map((seg, idx) => {
                                      const s = new Date(seg.start);
                                      const e = new Date(seg.end);
                                      return (
                                        <div key={idx} data-testid={`res-segment-item-${idx}`} className="font-mono">
                                          {s.toLocaleDateString("fr-FR")} : {s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - {e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {validationErrors.length > 0 && (
                      <div className="bg-red-50 text-red-800 p-2 rounded-lg text-[10px] space-y-0.5 border border-red-150">
                        {validationErrors.map((err, i) => (
                          <div key={i} className="flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 text-red-650" />
                            {err}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {/* Suggérer button */}
                      {(status === "A_RESERVER" || status === "CRENEAU_PROPOSE") && (
                        <button
                          onClick={() => handleSuggestReservation(dossier, reservation)}
                          disabled={!perm.canSuggestReservation(activeRole)}
                          data-testid="reservation-suggest-btn"
                          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Suggérer
                        </button>
                      )}

                      {/* Confirmer button */}
                      {status === "CRENEAU_PROPOSE" && (
                        <button
                          onClick={() => handleConfirmReservation(reservation!)}
                          disabled={!perm.canConfirmReservation(activeRole) || validationErrors.length > 0}
                          data-testid="reservation-confirm-btn"
                          className="px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          Confirmer
                        </button>
                      )}

                      {/* Transformer button */}
                      {(status === "CRENEAU_PROPOSE" || status === "RESERVATION_CONFIRMEE") && (
                        <button
                          onClick={() => handleConvertReservation(reservation!)}
                          disabled={!perm.canConvertReservationToPlanning(activeRole) || validationErrors.length > 0}
                          data-testid="reservation-convert-btn"
                          className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          Planifier
                        </button>
                      )}

                      {/* Annuler button */}
                      {(status === "CRENEAU_PROPOSE" || status === "RESERVATION_CONFIRMEE") && (
                        <button
                          onClick={() => handleCancelReservation(reservation!)}
                          disabled={!perm.canCancelReservation(activeRole)}
                          data-testid="reservation-cancel-btn"
                          className="px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Filters bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500">Filtres du Gantt :</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher immat, VIN, dossier, client..."
              className="p-2 pl-8 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={ganttSearchQuery}
              onChange={(e) => setGanttSearchQuery(e.target.value)}
              data-testid="gantt-search-input"
            />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
          </div>
          <select
            className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
          >
            <option value="Toutes">Toutes les Zones</option>
            {Object.values(AtelierZone).map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>

          <select
            className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
            value={filterBay}
            onChange={(e) => setFilterBay(e.target.value)}
          >
            <option value="Toutes">Tous les Ponts</option>
            {DEFAULT_WORKSHOP_BAYS.map(bay => (
              <option key={bay.id} value={bay.id}>{bay.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gantt chart representation */}
      <div 
        data-testid="planning-gantt-chart"
        className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider font-display">
            Chronologie de charge journalière (Gantt)
          </h4>
          <span className="text-[10px] text-gray-400 font-bold uppercase">
            Ressources en lignes / Heures en colonnes
          </span>
        </div>

        {/* Gantt grid header hours */}
        <div className="grid grid-cols-12 gap-2 text-center text-[10px] font-extrabold text-gray-400 border-b border-gray-50 pb-2">
          <div className="col-span-3 text-left pl-2">Ressource</div>
          <div className="col-span-9 relative h-6">
            <div className="absolute inset-0 flex justify-between">
              {ganttHours.map(h => (
                <span key={h} data-testid={`gantt-hour-${String(h).padStart(2, "0")}`} className="w-1/12 font-mono">{String(h).padStart(2, "0")}:00</span>
              ))}
              <span data-testid={isSat ? "gantt-hour-12-end" : "gantt-hour-17"} className="w-1/12 font-mono">{isSat ? "12:00" : "17:00"}</span>
            </div>
          </div>
        </div>

        {/* Rows: Technicians */}
        <div className="space-y-4 pt-2">
          <h5 className="text-[10px] text-blue-600 font-black uppercase tracking-widest pl-2">
            Techniciens de l'Atelier
          </h5>

          {filteredTechs.length === 0 ? (
            <p className="text-xs text-gray-400 italic pl-2">Aucun technicien correspondant aux filtres.</p>
          ) : (
            <div className="space-y-3">
              {filteredTechs.map(tech => {
                // Find all tasks planned today for this tech
                const techPlannedLines = activePlannedLines.filter(item => item.line.plannedTechnicianId === tech.id);
                
                // Calculate total active/planned hours today
                const dailyLoad = calculateTechnicianDailyLoad(tech.id, selectedDateStr, dossiers, reservations);
                const isAbsent = availabilityConfig ? isTechnicianAbsent(tech.id, selectedDate, availabilityConfig) : false;
                const isClosed = availabilityConfig ? isWorkshopClosed(selectedDate, availabilityConfig) : isClosedDay;

                let techCapacity = 0;
                if (!isClosed && !isAbsent) {
                  if (availabilityConfig) {
                    const effWindows = getEffectiveWorkshopWindowsForResource(selectedDate, availabilityConfig, { technicianId: tech.id });
                    techCapacity = effWindows.reduce((sum, win) => {
                      const [sh, sm] = win.start.split(":").map(Number);
                      const [eh, em] = win.end.split(":").map(Number);
                      return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
                    }, 0);
                  } else {
                    techCapacity = isSat ? 4 : 8;
                  }
                }

                let loadText = "";
                let chargePercentText = "";
                let isOverloaded = false;

                if (techCapacity === 0 && dailyLoad === 0) {
                  loadText = "Non mesurable";
                  chargePercentText = "Non mesurable";
                } else if (dailyLoad > 0 && techCapacity === 0) {
                  loadText = `${dailyLoad}h / 0h`;
                  chargePercentText = "Charge hors capacité";
                  isOverloaded = true;
                } else {
                  loadText = `${dailyLoad}h / ${techCapacity}h`;
                  const percent = Math.round((dailyLoad / techCapacity) * 100);
                  chargePercentText = `${percent}%`;
                  isOverloaded = dailyLoad > techCapacity;
                }

                // Determine availability status
                const isNonDisponible = tech.disponibilite === "absent" || tech.disponibilite === "formation";

                const hasInProgressTask = dossiers.some(d => 
                  d.ordresReparation.some(l => 
                    l.plannedTechnicianId === tech.id && 
                    normalizeRepairOrderStatus(l.status) === "in_progress"
                  )
                ) || dossiers.some(d => 
                  d.technicienId === tech.id && 
                  d.ordresReparation.some(l => normalizeRepairOrderStatus(l.status) === "in_progress")
                );

                const todayTechSegments: Array<{ start: Date; end: Date }> = [];
                const todayStr = getLocalDateStr(now);
                dossiers.forEach(d => {
                  if (d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE) {
                    d.ordresReparation.forEach(l => {
                      if (l.plannedTechnicianId === tech.id && l.planningStart && l.planningEnd) {
                        const segments = l.planningSegments || [{ start: l.planningStart, end: l.planningEnd }];
                        segments.forEach(seg => {
                          if (seg.start.split("T")[0] === todayStr) {
                            todayTechSegments.push({
                              start: new Date(seg.start),
                              end: new Date(seg.end)
                            });
                          }
                        });
                      }
                    });
                  }
                });

                const hasSegmentCoveringNow = todayTechSegments.some(seg => {
                  const t = now.getTime();
                  return t >= seg.start.getTime() && t <= seg.end.getTime();
                });

                const hasSegmentsToday = todayTechSegments.length > 0;

                let statusLabel = "Disponible";
                let statusColor = "bg-green-500 text-white";

                if (isAbsent) {
                  statusLabel = "Absent";
                  statusColor = "bg-red-600 text-white";
                } else if (isNonDisponible) {
                  statusLabel = "Non disponible";
                  statusColor = "bg-red-500 text-white";
                } else if (hasInProgressTask || hasSegmentCoveringNow) {
                  statusLabel = "Occupé maintenant";
                  statusColor = "bg-orange-500 text-white";
                } else if (hasSegmentsToday) {
                  statusLabel = "Planifié aujourd’hui";
                  statusColor = "bg-blue-500 text-white";
                } else {
                  statusLabel = "Disponible";
                  statusColor = "bg-green-500 text-white";
                }

                return (
                  <div key={tech.id} data-testid={`tech-row-${tech.id}`} className="grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 p-1.5 rounded-xl transition">
                    {/* Left: tech profile */}
                    <div className="col-span-3 space-y-1 pl-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span data-testid={`tech-name-${tech.id}`} className="font-extrabold text-gray-900 text-xs">{tech.nom}</span>
                        {isAbsent && (
                          <span 
                            data-testid="technician-absent-badge" 
                            className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-red-600 text-white uppercase animate-pulse"
                          >
                            Absent
                          </span>
                        )}
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                        {tech.zoneAffectee} • {tech.specialite}
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-0.5">
                        <span>Charge : <strong className="text-gray-700" data-testid={`technician-load-hours-${tech.id}`}>{loadText}</strong></span>
                        <span data-testid={`technician-charge-${tech.id}`} className={`font-mono font-bold ${isOverloaded ? "text-red-500 font-black" : ""}`}>
                          {chargePercentText}{isOverloaded && " (Surcharge)"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Gantt timeline bar row */}
                    <div
                      className="col-span-9 relative h-14 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropTask(event, { technicianId: tech.id })}
                    >
                      
                      {/* Midday Lunch break shaded area */}
                      {!isSat && (
                        <div 
                          data-testid="gantt-lunch-break-shading"
                          className="absolute top-0 bottom-0 bg-yellow-500/10 border-l border-r border-yellow-200/40 z-10 flex items-center justify-center"
                          style={{
                            left: `${(240 / 540) * 100}%`,
                            width: `${(60 / 540) * 100}%`
                          }}
                        >
                          <span className="text-[8px] text-amber-600/60 font-black uppercase tracking-widest text-center block rotate-90 sm:rotate-0">
                            Pause Midi
                          </span>
                        </div>
                      )}

                      {showNowLine && (
                        <div 
                          data-testid="gantt-now-indicator"
                          className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-30 pointer-events-none"
                          style={{ left: `${nowPct}%` }}
                        >
                          <span className="absolute top-0 -translate-x-1/2 bg-rose-600 text-white text-[7px] font-extrabold px-1 rounded-sm uppercase tracking-wider select-none">
                            Maintenant
                          </span>
                        </div>
                      )}

                      {/* Display task blocks on this row */}
                      {techPlannedLines.map(({ dossier, line }) => {
                        const segments = (line.planningSegments && line.planningSegments.length > 0
                          ? line.planningSegments
                          : [{ start: line.planningStart!, end: line.planningEnd! }]
                        ).filter(seg => seg.start.split("T")[0] === selectedDateStr);

                        return segments.map((seg, sIdx) => {
                          const s = new Date(seg.start);
                          const e = new Date(seg.end);
                          const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                          const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                          const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                          const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                          const isPast = e.getTime() < now.getTime();
                          const currentStatus = getCurrentGanttTaskStatus(dossier, line.id, line.status);
                          const statusVisual = getTaskStatusVisual(currentStatus);

                          return (
                            <div
                              key={`${line.id}-seg-${sIdx}`}
                              data-testid={`gantt-block-${line.id}`}
                              data-segment-index={sIdx}
                              data-start={s.toISOString()}
                              data-end={e.toISOString()}
                              onClick={() => onSelectDossier(dossier.id)}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                setDraggingTask({ dossierId: dossier.id, lineId: line.id });
                              }}
                              className={`absolute top-1 bottom-1 ${statusVisual.className} border text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20 ${isPast ? "opacity-65" : ""}`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`
                              }}
                              title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele}) ${dossier.vehiculeImmatriculation}`}
                            >
                              <div className="flex items-center justify-between gap-1 overflow-hidden">
                                <span className="truncate block leading-tight font-extrabold">{dossier.vehiculeModele}</span>
                                <span
                                  data-testid={statusVisual.testId}
                                  className={`px-1 py-0.2 text-[7px] rounded border font-black whitespace-nowrap ${statusVisual.badgeClassName}`}
                                >
                                  {statusVisual.label}
                                </span>
                              </div>
                              <span className="truncate block text-[7px] opacity-90 leading-none">
                                {dossier.vehiculeImmatriculation}
                                {(line.complaintBadge || line.sourceComplaintId) && (
                                  <span data-testid={`gantt-complaint-badge-${line.id}`} className="ml-1 rounded bg-red-600 px-1 py-0.2 text-white">REC</span>
                                )}
                              </span>
                              <span className="truncate block text-[7px] opacity-80 leading-none">
                                {s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}-{e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <div className="mt-0.5 flex gap-1">
                                <button
                                  type="button"
                                  data-testid={`gantt-reschedule-${line.id}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openRescheduleModal(dossier, line);
                                  }}
                                  className="rounded bg-white/80 px-1 py-0.5 text-[7px] font-black text-slate-700"
                                >
                                  Modifier créneau
                                </button>
                                <button
                                  type="button"
                                  data-testid={`gantt-task-sheet-${line.id}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handlePrintTaskSheet(dossier, line);
                                  }}
                                  className="rounded bg-white/80 px-1 py-0.5 text-[7px] font-black text-slate-700"
                                  title="Fiche tâche technicien"
                                >
                                  <FileText className="inline h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })}

                      {/* Display reservation ghost blocks on this row */}
                      {activeReservationsStr.filter(res => res.technicianId === tech.id).map(res => {
                        const segments = (res.segments && res.segments.length > 0
                          ? res.segments
                          : [{ start: res.startTime!, end: res.endTime! }]
                        ).filter(seg => seg.start.split("T")[0] === selectedDateStr);

                        const dossier = dossiers.find(d => d.id === res.dossierId);
                        if (!dossier) return null;

                        return segments.map((seg, sIdx) => {
                          const s = new Date(seg.start);
                          const e = new Date(seg.end);
                          const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                          const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                          const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                          const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                          const isProposed = res.status === "CRENEAU_PROPOSE";
                          const blockBg = isProposed
                            ? "bg-blue-50/80 border-dashed border-blue-400 text-blue-800"
                            : "bg-indigo-100/95 border-indigo-500 text-indigo-900";
                          
                          const badgeText = isProposed ? "Réservation proposée" : "Réservation confirmée";
                          const testId = isProposed ? "gantt-reservation-proposed" : "gantt-reservation-confirmed";

                          return (
                            <div
                              key={`${res.reservationId}-seg-${sIdx}`}
                              data-testid={testId}
                              data-segment-index={sIdx}
                              data-start={s.toISOString()}
                              data-end={e.toISOString()}
                              onClick={() => onSelectDossier(dossier.id)}
                              className={`absolute top-1 bottom-1 ${blockBg} border text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20`}
                              style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`
                              }}
                              title={`${dossier.id} - ${badgeText} (${dossier.vehiculeMarque} ${dossier.vehiculeModele}) ${dossier.vehiculeImmatriculation}`}
                            >
                              <div className="flex items-center justify-between gap-1 overflow-hidden">
                                <span className="truncate block leading-tight font-extrabold">{dossier.vehiculeModele}</span>
                                <span className="px-1 py-0.2 text-[7px] bg-black/10 rounded font-black whitespace-nowrap">
                                  {badgeText}
                                </span>
                              </div>
                              <span className="truncate block text-[7px] opacity-90 leading-none">{dossier.vehiculeImmatriculation}</span>
                              <span className="truncate block text-[7px] opacity-80 leading-none font-mono">
                                {s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}-{e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          );
                        });
                      })}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rows: Ponts / Workshop Bays */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h5 className="text-[10px] text-blue-600 font-black uppercase tracking-widest pl-2">
            Ponts / Postes d'Atelier
          </h5>

          {filteredBays.map(bay => {
            // Get all planned segments on this bay today
            const todayBaySegments: Array<{ start: Date; end: Date }> = [];
            const todayStr = getLocalDateStr(now);
            dossiers.forEach(d => {
              if (d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE) {
                d.ordresReparation.forEach(l => {
                  if (l.plannedBayId === bay.id && l.planningStart && l.planningEnd) {
                    const segments = l.planningSegments || [{ start: l.planningStart, end: l.planningEnd }];
                    segments.forEach(seg => {
                      if (seg.start.split("T")[0] === todayStr) {
                        todayBaySegments.push({
                          start: new Date(seg.start),
                          end: new Date(seg.end)
                        });
                      }
                    });
                  }
                });
              }
            });

            const hasBaySegmentCoveringNow = todayBaySegments.some(seg => {
              const t = now.getTime();
              return t >= seg.start.getTime() && t <= seg.end.getTime();
            });

            const hasBaySegmentsToday = todayBaySegments.length > 0;

            const isClosedDay = availabilityConfig ? isWorkshopClosed(selectedDate, availabilityConfig) : selectedDate.getDay() === 0;
            const isBayUnav = availabilityConfig ? isBayUnavailable(bay.id, selectedDate, availabilityConfig) : false;

            let bayCapacity = 0;
            if (!isClosedDay && !isBayUnav) {
              if (availabilityConfig) {
                const effWindows = getEffectiveWorkshopWindowsForResource(selectedDate, availabilityConfig, { bayId: bay.id });
                bayCapacity = effWindows.reduce((sum, win) => {
                  const [sh, sm] = win.start.split(":").map(Number);
                  const [eh, em] = win.end.split(":").map(Number);
                  return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
                }, 0);
              } else {
                bayCapacity = isSat ? 4 : 8;
              }
            }

            const bayDailyLoad = calculateBayDailyLoad(bay.id, selectedDateStr, dossiers, reservations);

            let bayLoadText = "";
            let bayChargePercentText = "";
            let isBayOverloaded = false;

            if (bayCapacity === 0 && bayDailyLoad === 0) {
              bayLoadText = "Non mesurable";
              bayChargePercentText = "Non mesurable";
            } else if (bayDailyLoad > 0 && bayCapacity === 0) {
              bayLoadText = `${bayDailyLoad}h / 0h`;
              bayChargePercentText = "Charge hors capacité";
              isBayOverloaded = true;
            } else {
              bayLoadText = `${bayDailyLoad}h / ${bayCapacity}h`;
              const percent = Math.round((bayDailyLoad / bayCapacity) * 100);
              bayChargePercentText = `${percent}%`;
              isBayOverloaded = bayDailyLoad > bayCapacity;
            }

            let bayStatusLabel = "Libre maintenant";
            let bayStatusColor = "bg-green-500 text-white";

            if (isBayUnav) {
              bayStatusLabel = "Indisponible";
              bayStatusColor = "bg-red-600 text-white";
            } else if (hasBaySegmentCoveringNow) {
              bayStatusLabel = "Occupé maintenant";
              bayStatusColor = "bg-orange-500 text-white";
            } else if (hasBaySegmentsToday) {
              bayStatusLabel = "Planifié aujourd’hui";
              bayStatusColor = "bg-blue-500 text-white";
            } else {
              bayStatusLabel = "Libre maintenant";
              bayStatusColor = "bg-green-500 text-white";
            }

            // Find all tasks planned today on this bay
            const bayPlannedLines = activePlannedLines.filter(item => item.line.plannedBayId === bay.id);

            return (
              <div key={bay.id} className="grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 p-1.5 rounded-xl transition">
                {/* Left: bay info */}
                <div className="col-span-3 space-y-1 pl-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-gray-900 text-xs">{bay.name}</span>
                    {isBayUnav && (
                      <span 
                        data-testid="bay-unavailable-badge" 
                        className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-red-650 text-white uppercase animate-pulse"
                      >
                        Indisponible
                      </span>
                    )}
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase ${bayStatusColor}`}>
                      {bayStatusLabel}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">
                    {bay.zone || "Zone Polyvalente"}
                  </span>
                  <div className="flex justify-between items-center text-[9px] text-gray-500 pt-0.5">
                    <span>Charge : <strong className="text-gray-700" data-testid={`bay-load-hours-${bay.id}`}>{bayLoadText}</strong></span>
                    <span data-testid={`bay-charge-${bay.id}`} className={`font-mono font-bold ${isBayOverloaded ? "text-red-500 font-black" : ""}`}>
                      {bayChargePercentText}{isBayOverloaded && " (Surcharge)"}
                    </span>
                  </div>
                </div>

                {/* Right: Gantt timeline bar row */}
                <div
                  className="col-span-9 relative h-14 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropTask(event, { bayId: bay.id })}
                >
                  
                  {/* Midday Lunch break shaded area */}
                  {!isSat && (
                    <div 
                      className="absolute top-0 bottom-0 bg-yellow-500/10 border-l border-r border-yellow-200/40 z-10 flex items-center justify-center"
                      style={{
                        left: `${(240 / 540) * 100}%`,
                        width: `${(60 / 540) * 100}%`
                      }}
                    >
                      <span className="text-[8px] text-amber-600/60 font-black uppercase tracking-widest text-center block rotate-90 sm:rotate-0">
                        Pause Midi
                      </span>
                    </div>
                  )}

                  {showNowLine && (
                    <div 
                      data-testid="gantt-now-indicator"
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-30 pointer-events-none"
                      style={{ left: `${nowPct}%` }}
                    >
                      <span className="absolute top-0 -translate-x-1/2 bg-rose-600 text-white text-[7px] font-extrabold px-1 rounded-sm uppercase tracking-wider select-none">
                        Maintenant
                      </span>
                    </div>
                  )}

                  {/* Display task blocks on this row */}
                  {bayPlannedLines.map(({ dossier, line }) => {
                    const segments = (line.planningSegments && line.planningSegments.length > 0
                      ? line.planningSegments
                      : [{ start: line.planningStart!, end: line.planningEnd! }]
                    ).filter(seg => seg.start.split("T")[0] === selectedDateStr);

                    return segments.map((seg, sIdx) => {
                      const s = new Date(seg.start);
                      const e = new Date(seg.end);
                      const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                      const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                      const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                      const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                      const isPast = e.getTime() < now.getTime();
                      const currentStatus = getCurrentGanttTaskStatus(dossier, line.id, line.status);
                      const statusVisual = getTaskStatusVisual(currentStatus);

                      return (
                        <div
                          key={`${line.id}-seg-${sIdx}`}
                          data-testid={`gantt-bay-block-${line.id}`}
                          data-segment-index={sIdx}
                          data-start={s.toISOString()}
                          data-end={e.toISOString()}
                          onClick={() => onSelectDossier(dossier.id)}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingTask({ dossierId: dossier.id, lineId: line.id });
                          }}
                          className={`absolute top-1 bottom-1 ${statusVisual.className} border text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20 ${isPast ? "opacity-65" : ""}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele})`}
                        >
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate block leading-tight font-extrabold">{dossier.id}</span>
                            <span
                              data-testid={statusVisual.testId}
                              className={`px-1 py-0.2 text-[7px] rounded border font-black whitespace-nowrap ${statusVisual.badgeClassName}`}
                            >
                              {statusVisual.label}
                            </span>
                          </div>
                          <span className="truncate block text-[7px] opacity-80 leading-none">
                            {line.designation}
                            {(line.complaintBadge || line.sourceComplaintId) && (
                              <span data-testid={`gantt-bay-complaint-badge-${line.id}`} className="ml-1 rounded bg-red-600 px-1 py-0.2 text-white">REC</span>
                            )}
                          </span>
                          <div className="mt-0.5 flex gap-1">
                            <button
                              type="button"
                              data-testid={`gantt-bay-reschedule-${line.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openRescheduleModal(dossier, line);
                              }}
                              className="rounded bg-white/80 px-1 py-0.5 text-[7px] font-black text-slate-700"
                            >
                              Modifier créneau
                            </button>
                            <button
                              type="button"
                              data-testid={`gantt-bay-task-sheet-${line.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePrintTaskSheet(dossier, line);
                              }}
                              className="rounded bg-white/80 px-1 py-0.5 text-[7px] font-black text-slate-700"
                              title="Fiche tâche technicien"
                            >
                              <FileText className="inline h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })}

                  {/* Display reservation ghost blocks on this row */}
                  {activeReservationsStr.filter(res => res.bayId === bay.id).map(res => {
                    const segments = (res.segments && res.segments.length > 0
                      ? res.segments
                      : [{ start: res.startTime!, end: res.endTime! }]
                    ).filter(seg => seg.start.split("T")[0] === selectedDateStr);

                    const dossier = dossiers.find(d => d.id === res.dossierId);
                    if (!dossier) return null;

                    return segments.map((seg, sIdx) => {
                      const s = new Date(seg.start);
                      const e = new Date(seg.end);
                      const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                      const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                      const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                      const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                      const isProposed = res.status === "CRENEAU_PROPOSE";
                      const blockBg = isProposed
                        ? "bg-blue-50/80 border-dashed border-blue-400 text-blue-800"
                        : "bg-indigo-100/95 border-indigo-500 text-indigo-900";
                      
                      const badgeText = isProposed ? "Réservation proposée" : "Réservation confirmée";
                      const testId = isProposed ? "gantt-reservation-proposed" : "gantt-reservation-confirmed";

                      return (
                        <div
                          key={`${res.reservationId}-bay-seg-${sIdx}`}
                          data-testid={testId}
                          data-segment-index={sIdx}
                          data-start={s.toISOString()}
                          data-end={e.toISOString()}
                          onClick={() => onSelectDossier(dossier.id)}
                          className={`absolute top-1 bottom-1 ${blockBg} border text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          title={`${dossier.id} - ${badgeText} (${dossier.vehiculeMarque} ${dossier.vehiculeModele})`}
                        >
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate block leading-tight font-extrabold">{dossier.id}</span>
                            <span className="px-1 py-0.2 text-[7px] bg-black/10 rounded font-black whitespace-nowrap">
                              {badgeText}
                            </span>
                          </div>
                          <span className="truncate block text-[7px] opacity-80 leading-none">Réservation</span>
                        </div>
                      );
                    });
                  })}

                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div data-testid="gantt-status-legend" className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-[10px] text-gray-500">
          <span className="font-bold">Légende :</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span> Tâche planifiée</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border border-dashed border-blue-400 bg-blue-50/70"></span> Réservation proposée</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border border-indigo-500 bg-indigo-100/90"></span> Réservation confirmée</span>

          <span className="font-bold ml-4">Légende statut tâche :</span>
          {TASK_STATUS_VISUAL_ORDER.map(status => {
            const visual = getTaskStatusVisual(status);
            return (
              <span key={status} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded ${visual.dotClassName}`}></span>
                {visual.label}
              </span>
            );
          })}
        </div>

      </div>

      {/* Workshop Availability Configuration Panel */}
      {perm.canViewWorkshopAvailability(activeRole) && availabilityConfig && onUpdateAvailabilityConfig && (
        <div 
          data-testid="workshop-availability-panel"
          className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-6"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest flex items-center gap-1.5 font-display">
              <Settings className="w-4.5 h-4.5 text-indigo-650" />
              Disponibilités de l'Atelier
            </h3>
            <span className="text-[10px] text-gray-400 font-bold uppercase">
              {perm.canManageWorkshopAvailability(activeRole) ? "Gestion administrative" : "Consultation"}
            </span>
          </div>

          {/* 1. Default Working Hours */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Horaires de travail par défaut</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl">
                <strong className="text-gray-900 block mb-1">Lundi - Vendredi</strong>
                08:00 - 12:00 / 13:00 - 17:00
              </div>
              <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl">
                <strong className="text-gray-900 block mb-1">Samedi</strong>
                08:00 - 12:00
              </div>
              <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl">
                <strong className="text-gray-900 block mb-1">Dimanche</strong>
                Fermé
              </div>
            </div>
          </div>

          <div data-testid="workshop-shifts-panel" className="space-y-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Horaires & Équipes</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {shiftProfiles.map(profile => (
                <div key={profile.id} data-testid={`shift-profile-${profile.id}`} className="rounded-xl border border-gray-150 bg-gray-50 p-3">
                  <strong className="block text-gray-900">{profile.name}</strong>
                  <span className="text-[10px] font-semibold text-gray-500">{profile.description}</span>
                </div>
              ))}
            </div>

            {perm.canManageWorkshopAvailability(activeRole) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <form
                  data-testid="shift-assignment-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const technicianId = String(formData.get("technicianId") || "");
                    const shiftProfileId = String(formData.get("shiftProfileId") || "");
                    const startDate = String(formData.get("startDate") || selectedDateStr);
                    const endDate = String(formData.get("endDate") || "");
                    if (!technicianId || !shiftProfileId || !startDate) return;

                    onUpdateAvailabilityConfig({
                      ...availabilityConfig,
                      shiftProfiles,
                      technicianShiftAssignments: [
                        ...(availabilityConfig.technicianShiftAssignments ?? []),
                        {
                          id: `shift_tech_${Date.now()}`,
                          technicianId,
                          shiftProfileId,
                          startDate,
                          endDate: endDate || undefined,
                        },
                      ],
                    });
                    event.currentTarget.reset();
                  }}
                  className="space-y-3 rounded-xl border border-gray-150 bg-gray-50 p-3 text-xs"
                >
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-600">Affecter équipe technicien</h5>
                  <select data-testid="shift-assignment-tech" name="technicianId" className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required>
                    {techniciens.map(tech => <option key={tech.id} value={tech.id}>{tech.nom}</option>)}
                  </select>
                  <select data-testid="shift-assignment-profile" name="shiftProfileId" className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required>
                    {shiftProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input data-testid="shift-assignment-start" name="startDate" type="date" defaultValue={selectedDateStr} className="rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required />
                    <input data-testid="shift-assignment-end" name="endDate" type="date" className="rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" />
                  </div>
                  <button data-testid="shift-assignment-add" type="submit" className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-black text-white hover:bg-indigo-700">
                    Affecter équipe
                  </button>
                </form>

                <form
                  data-testid="shift-bay-assignment-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const bayId = String(formData.get("bayId") || "");
                    const shiftProfileId = String(formData.get("shiftProfileId") || "");
                    const startDate = String(formData.get("startDate") || selectedDateStr);
                    const endDate = String(formData.get("endDate") || "");
                    if (!bayId || !shiftProfileId || !startDate) return;

                    onUpdateAvailabilityConfig({
                      ...availabilityConfig,
                      shiftProfiles,
                      bayShiftAssignments: [
                        ...(availabilityConfig.bayShiftAssignments ?? []),
                        {
                          id: `shift_bay_${Date.now()}`,
                          bayId,
                          shiftProfileId,
                          startDate,
                          endDate: endDate || undefined,
                        },
                      ],
                    });
                    event.currentTarget.reset();
                  }}
                  className="space-y-3 rounded-xl border border-gray-150 bg-gray-50 p-3 text-xs"
                >
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-600">Affecter équipe pont</h5>
                  <select data-testid="shift-assignment-bay" name="bayId" className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required>
                    {DEFAULT_WORKSHOP_BAYS.map(bay => <option key={bay.id} value={bay.id}>{bay.name}</option>)}
                  </select>
                  <select name="shiftProfileId" className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required>
                    {shiftProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="startDate" type="date" defaultValue={selectedDateStr} className="rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" required />
                    <input name="endDate" type="date" className="rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold" />
                  </div>
                  <button data-testid="shift-bay-assignment-add" type="submit" className="w-full rounded-lg bg-slate-900 py-2 text-xs font-black text-white hover:bg-slate-700">
                    Affecter pont
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-semibold text-gray-600">
              <div data-testid="shift-tech-assignments" className="rounded-xl border border-gray-150 p-3">
                <strong className="block text-gray-900 mb-1">Techniciens</strong>
                {(availabilityConfig.technicianShiftAssignments ?? []).length === 0 ? (
                  <span className="text-gray-400">Aucune affectation équipe.</span>
                ) : (
                  (availabilityConfig.technicianShiftAssignments ?? []).map(assignment => (
                    <p key={assignment.id}>{techniciens.find(tech => tech.id === assignment.technicianId)?.nom || assignment.technicianId} → {shiftProfiles.find(profile => profile.id === assignment.shiftProfileId)?.name || assignment.shiftProfileId}</p>
                  ))
                )}
              </div>
              <div data-testid="shift-bay-assignments" className="rounded-xl border border-gray-150 p-3">
                <strong className="block text-gray-900 mb-1">Ponts</strong>
                {(availabilityConfig.bayShiftAssignments ?? []).length === 0 ? (
                  <span className="text-gray-400">Aucune affectation équipe.</span>
                ) : (
                  (availabilityConfig.bayShiftAssignments ?? []).map(assignment => (
                    <p key={assignment.id}>{DEFAULT_WORKSHOP_BAYS.find(bay => bay.id === assignment.bayId)?.name || assignment.bayId} → {shiftProfiles.find(profile => profile.id === assignment.shiftProfileId)?.name || assignment.shiftProfileId}</p>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
            
            {/* 2. Technician Absences */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Absences Techniciens
              </h4>
              
              {perm.canManageWorkshopAvailability(activeRole) && (
                <form 
                  data-testid="technician-absence-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const techId = formData.get("techId") as string;
                    const startDate = formData.get("startDate") as string;
                    const endDate = formData.get("endDate") as string;
                    const startTime = formData.get("startTime") as string;
                    const endTime = formData.get("endTime") as string;
                    const reason = formData.get("reason") as string;

                    if (!techId || !startDate || !endDate || !reason) return;

                    const newAbsence = {
                      id: `abs_${Date.now()}`,
                      technicianId: techId,
                      startDate,
                      endDate,
                      startTime: startTime || undefined,
                      endTime: endTime || undefined,
                      reason
                    };

                    onUpdateAvailabilityConfig({
                      ...availabilityConfig,
                      absences: [...availabilityConfig.absences, newAbsence]
                    });
                    e.currentTarget.reset();
                  }}
                  className="space-y-3 p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Technicien</label>
                    <select name="techId" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required>
                      {techniciens.map(t => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Début</label>
                      <input type="date" name="startDate" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fin</label>
                      <input type="date" name="endDate" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Heure Début (optionnel)</label>
                      <input type="time" name="startTime" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Heure Fin (optionnel)</label>
                      <input type="time" name="endTime" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Motif</label>
                    <input type="text" name="reason" placeholder="Ex: Congés" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                  </div>
                  <button 
                    data-testid="technician-absence-add-btn"
                    type="submit" 
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Ajouter absence
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {availabilityConfig.absences.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune absence enregistrée.</p>
                ) : (
                  availabilityConfig.absences.map(abs => {
                    const tech = techniciens.find(t => t.id === abs.technicianId);
                    return (
                      <div key={abs.id} className="p-2 border border-gray-150 rounded-lg flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <strong className="text-gray-850 block">{tech?.nom || abs.technicianId}</strong>
                          <span className="text-[10px] text-gray-500 block">
                            Du {new Date(abs.startDate).toLocaleDateString("fr-FR")} au {new Date(abs.endDate).toLocaleDateString("fr-FR")}
                            {abs.startTime && ` (${abs.startTime}-${abs.endTime || ""})`}
                          </span>
                          <span className="text-[9px] text-gray-400 block italic">{abs.reason}</span>
                        </div>
                        {perm.canManageWorkshopAvailability(activeRole) && (
                          <button
                            data-testid="technician-absence-delete-btn"
                            onClick={() => {
                              onUpdateAvailabilityConfig({
                                ...availabilityConfig,
                                absences: availabilityConfig.absences.filter(a => a.id !== abs.id)
                              });
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition cursor-pointer"
                            title="Supprimer"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Bay Unavailabilities */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Hammer className="w-4 h-4 text-orange-650" />
                Indisponibilités Ponts
              </h4>
              
              {perm.canManageWorkshopAvailability(activeRole) && (
                <form 
                  data-testid="bay-unavailability-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const bayId = formData.get("bayId") as string;
                    const startDate = formData.get("startDate") as string;
                    const endDate = formData.get("endDate") as string;
                    const startTime = formData.get("startTime") as string;
                    const endTime = formData.get("endTime") as string;
                    const reason = formData.get("reason") as string;

                    if (!bayId || !startDate || !endDate || !reason) return;

                    const newUnav = {
                      id: `unav_${Date.now()}`,
                      bayId,
                      startDate,
                      endDate,
                      startTime: startTime || undefined,
                      endTime: endTime || undefined,
                      reason
                    };

                    onUpdateAvailabilityConfig({
                      ...availabilityConfig,
                      bayUnavailabilities: [...availabilityConfig.bayUnavailabilities, newUnav]
                    });
                    e.currentTarget.reset();
                  }}
                  className="space-y-3 p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Pont</label>
                    <select name="bayId" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required>
                      {DEFAULT_WORKSHOP_BAYS.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Début</label>
                      <input type="date" name="startDate" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fin</label>
                      <input type="date" name="endDate" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Heure Début (optionnel)</label>
                      <input type="time" name="startTime" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Heure Fin (optionnel)</label>
                      <input type="time" name="endTime" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Raison / Travaux</label>
                    <input type="text" name="reason" placeholder="Ex: Maintenance" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                  </div>
                  <button 
                    data-testid="bay-unavailability-add-btn"
                    type="submit" 
                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Ajouter indisponibilité
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {availabilityConfig.bayUnavailabilities.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune indisponibilité enregistrée.</p>
                ) : (
                  availabilityConfig.bayUnavailabilities.map(unav => {
                    const bay = DEFAULT_WORKSHOP_BAYS.find(b => b.id === unav.bayId);
                    return (
                      <div key={unav.id} className="p-2 border border-gray-150 rounded-lg flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <strong className="text-gray-850 block">{bay?.name || unav.bayId}</strong>
                          <span className="text-[10px] text-gray-500 block">
                            Du {new Date(unav.startDate).toLocaleDateString("fr-FR")} au {new Date(unav.endDate).toLocaleDateString("fr-FR")}
                            {unav.startTime && ` (${unav.startTime}-${unav.endTime || ""})`}
                          </span>
                          <span className="text-[9px] text-gray-400 block italic">{unav.reason}</span>
                        </div>
                        {perm.canManageWorkshopAvailability(activeRole) && (
                          <button
                            onClick={() => {
                              onUpdateAvailabilityConfig({
                                ...availabilityConfig,
                                bayUnavailabilities: availabilityConfig.bayUnavailabilities.filter(u => u.id !== unav.id)
                              });
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition cursor-pointer"
                            title="Supprimer"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. Holidays / Closed Days */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-650" />
                Jours Fériés / Fermetures Exceptionnelles
              </h4>
              
              {perm.canManageWorkshopAvailability(activeRole) && (
                <form 
                  data-testid="workshop-holiday-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const date = formData.get("date") as string;
                    const name = formData.get("name") as string;
                    const isClosed = formData.get("type") === "closed";

                    if (!date || !name) return;

                    if (isClosed) {
                      const newException = {
                        id: `exc_${Date.now()}`,
                        date,
                        isClosed: true,
                        reason: name
                      };
                      onUpdateAvailabilityConfig({
                        ...availabilityConfig,
                        exceptions: [...availabilityConfig.exceptions, newException]
                      });
                    } else {
                      const newHoliday = {
                        id: `hol_${Date.now()}`,
                        date,
                        name
                      };
                      onUpdateAvailabilityConfig({
                        ...availabilityConfig,
                        holidays: [...availabilityConfig.holidays, newHoliday]
                      });
                    }
                    e.currentTarget.reset();
                  }}
                  className="space-y-3 p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Type</label>
                    <select name="type" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required>
                      <option value="holiday">Jour Férié</option>
                      <option value="closed">Fermeture Exceptionnelle</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Date</label>
                    <input type="date" name="date" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Libellé / Raison</label>
                    <input type="text" name="name" placeholder="Ex: Jour de l'An" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs" required />
                  </div>
                  <button 
                    data-testid="workshop-holiday-add-btn"
                    type="submit" 
                    className="w-full py-2 bg-rose-650 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Ajouter
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {availabilityConfig.holidays.length === 0 && availabilityConfig.exceptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune fermeture enregistrée.</p>
                ) : (
                  <>
                    {availabilityConfig.holidays.map(hol => (
                      <div key={hol.id} className="p-2 border border-gray-150 rounded-lg flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <strong className="text-gray-850 block">{hol.name}</strong>
                          <span className="text-[10px] text-gray-500 block">
                            Le {new Date(hol.date).toLocaleDateString("fr-FR")} (Jour Férié)
                          </span>
                        </div>
                        {perm.canManageWorkshopAvailability(activeRole) && (
                          <button
                            onClick={() => {
                              onUpdateAvailabilityConfig({
                                ...availabilityConfig,
                                holidays: availabilityConfig.holidays.filter(h => h.id !== hol.id)
                              });
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition cursor-pointer"
                            title="Supprimer"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    ))}
                    {availabilityConfig.exceptions.map(exc => (
                      <div key={exc.id} className="p-2 border border-gray-150 rounded-lg flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <strong className="text-gray-850 block">{exc.reason || "Fermeture exceptionnelle"}</strong>
                          <span className="text-[10px] text-gray-500 block">
                            Le {new Date(exc.date).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        {perm.canManageWorkshopAvailability(activeRole) && (
                          <button
                            onClick={() => {
                              onUpdateAvailabilityConfig({
                                ...availabilityConfig,
                                exceptions: availabilityConfig.exceptions.filter(e => e.id !== exc.id)
                              });
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition cursor-pointer"
                            title="Supprimer"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {rescheduleTarget && rescheduleDossier && rescheduleLine && (
        <div data-testid="planning-reschedule-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs shadow-xl">
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900">Modifier créneau</h3>
              <p className="mt-1 font-semibold text-slate-500">{rescheduleDossier.id} - {rescheduleLine.designation}</p>
            </div>

            {rescheduleError && (
              <div data-testid="planning-reschedule-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">
                {rescheduleError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="block font-black text-slate-600 uppercase">Technicien</span>
                <select data-testid="planning-reschedule-tech" value={rescheduleTechId} onChange={(event) => setRescheduleTechId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold">
                  {techniciens.map(tech => <option key={tech.id} value={tech.id}>{tech.nom}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block font-black text-slate-600 uppercase">Pont</span>
                <select data-testid="planning-reschedule-bay" value={rescheduleBayId} onChange={(event) => setRescheduleBayId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold">
                  {DEFAULT_WORKSHOP_BAYS.map(bay => <option key={bay.id} value={bay.id}>{bay.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block font-black text-slate-600 uppercase">Date</span>
                <input data-testid="planning-reschedule-date" type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold" />
              </label>
              <label className="space-y-1">
                <span className="block font-black text-slate-600 uppercase">Début</span>
                <input data-testid="planning-reschedule-start" type="time" step="900" value={rescheduleStart} onChange={(event) => setRescheduleStart(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="block font-black text-slate-600 uppercase">Durée prévue</span>
                <input
                  data-testid="planning-reschedule-duration"
                  type="number"
                  min={15}
                  step={15}
                  value={rescheduleDurationMinutes}
                  onChange={(event) => setRescheduleDurationMinutes(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 font-bold"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" data-testid="planning-reschedule-cancel" onClick={closeRescheduleModal} className="rounded-lg bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200">
                Annuler
              </button>
              <button type="button" data-testid="planning-reschedule-confirm" onClick={handleSaveReschedule} className="rounded-lg bg-emerald-600 px-4 py-2 font-black text-white hover:bg-emerald-700">
                Valider déplacement
              </button>
            </div>
          </div>
        </div>
      )}

      <div id="technician-task-print-root" className="print-only">
        {taskSheetTarget && taskSheetTarget.line && (
          <PrintDocuments
            type="task"
            dossier={taskSheetTarget.dossier}
            task={taskSheetTarget.line}
            clientPhoneToShow={canShowPhone ? taskSheetTarget.dossier.clientTelephone : maskPhoneNumber(taskSheetTarget.dossier.clientTelephone)}
            technicianName={techniciens.find(tech => tech.id === (taskSheetTarget.line.plannedTechnicianId || taskSheetTarget.dossier.technicienId))?.nom}
            bayName={DEFAULT_WORKSHOP_BAYS.find(bay => bay.id === taskSheetTarget.line.plannedBayId)?.name}
          />
        )}
      </div>

    </div>
  );
}
