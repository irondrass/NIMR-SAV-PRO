/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AtelierZone, TechnicienResource, DossierSAV, DossierStatus, RepairOrderLine, UserRole, WorkshopReservation, WorkshopAvailabilityConfig, WorkshopShiftProfile, User } from "../types";
import { 
  normalizeRepairOrderStatus, 
  suggestWorkshopSlot, 
  WorkshopSlotSuggestion,
  isWorkingDay,
  addWorkingMinutes,
  buildPlanningSegments,
  calculateTechnicianDailyLoad,
  calculateBayDailyLoad,
  validatePlanningAssignment,
  getVehicleETAInfo,
  isSameVehicle,
  isDossierActive,
  buildVehicleAutoReservationPlan,
  reserveSuggestedWorkshopSlot
} from "../sav-core";
import { logAuditEvent } from "../audit-trail";
import { 
  isWorkshopClosed,
  isTechnicianAbsent,
  isBayUnavailable,
  getEffectiveWorkshopWindows,
  getEffectiveWorkshopWindowsForResource,
  getDefaultWorkshopSchedule,
  getDefaultWorkshopShiftProfiles,
  buildScheduleFromShiftProfileDraft,
  calculateShiftProfileCapacityMinutes,
  deriveShiftProfileDraft,
  formatCapacityHours,
  ShiftProfileDraft,
  summarizeShiftProfileDraft,
  validateShiftProfileDraft
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
  FileText,
  X
} from "lucide-react";
import { LicencePlate, StatusBadge } from "./UIParts";
import PrintDocuments from "./PrintDocuments";
import ConfirmModal from "./ConfirmModal";
import * as perm from "../permissions";
import { maskPhoneNumber } from "../field-validations";
import { TASK_STATUS_VISUAL_ORDER, getTaskStatusVisual } from "../task-status-visual";
import { DEFAULT_WORKSHOP_BAYS } from "../workshop-bays";
import { canRunGuardedAction } from "../action-guard";
import {
  findTaskPlanningTarget,
  getCurrentGanttTaskStatus,
  getUnplannedRepairOrderTargets,
  isActivePlannedTask,
  getGanttTaskVisualState,
  GANTT_STATE_VISUALS,
  getRepairOrderPlanningSegmentsForDate,
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
import {
  buildLatestReservationByDossier,
  filterReservationsForGanttDate,
  paginateItems,
  RESERVATION_NEEDS_RENDER_LIMIT,
} from "../performance-lot7";

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
  onUpdateTechnicians?: (updated: TechnicienResource[]) => void;
  users?: any[];
  currentUser?: User | null;
}

const GANTT_LANE_HEIGHT = 56;
const GANTT_BLOCK_HEIGHT = 48;

const SHIFT_EDIT_DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function mergeWorkshopWindows(windows: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
  const sorted = windows
    .map(window => ({ start: timeToMinutes(window.start), end: timeToMinutes(window.end) }))
    .filter(window => Number.isFinite(window.start) && Number.isFinite(window.end) && window.start < window.end)
    .sort((left, right) => left.start - right.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const window of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || window.start > previous.end) {
      merged.push({ ...window });
    } else {
      previous.end = Math.max(previous.end, window.end);
    }
  }

  return merged.map(window => ({
    start: minutesToTime(window.start),
    end: minutesToTime(window.end),
  }));
}

function getScheduleWindowsForDay(profile: WorkshopShiftProfile, dayOfWeek: number): Array<{ start: string; end: string }> {
  const day = profile.schedule.days.find(current => current.dayOfWeek === dayOfWeek);
  return day && !day.isClosed ? day.windows : [];
}

function getCapacityHoursFromWindows(windows: Array<{ start: string; end: string }>): number {
  return windows.reduce((sum, window) => sum + (timeToMinutes(window.end) - timeToMinutes(window.start)) / 60, 0);
}

type GanttLaneItem =
  | {
      type: "task";
      id: string;
      start: Date;
      end: Date;
      leftPct: number;
      widthPct: number;
      data: {
        dossier: DossierSAV;
        line: RepairOrderLine;
        segment: { start: string; end: string };
        segmentIndex: number;
      };
    }
  | {
      type: "reservation";
      id: string;
      start: Date;
      end: Date;
      leftPct: number;
      widthPct: number;
      data: {
        dossier: DossierSAV;
        reservation: WorkshopReservation;
        segment: { start: string; end: string };
        segmentIndex: number;
      };
    };

function assignGanttLanes(items: GanttLaneItem[]): GanttLaneItem[][] {
  const lanes: GanttLaneItem[][] = [];
  const sortedItems = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const item of sortedItems) {
    const availableLane = lanes.find(lane =>
      lane.every(placedItem =>
        item.start.getTime() >= placedItem.end.getTime() ||
        item.end.getTime() <= placedItem.start.getTime()
      )
    );

    if (availableLane) {
      availableLane.push(item);
    } else {
      lanes.push([item]);
    }
  }

  return lanes;
}

function isDurationReadyForPlanning(line?: RepairOrderLine | null): boolean {
  return Boolean(line && line.tempsEstime > 0 && line.isEstimatedDurationValidated);
}

function formatWorkshopDuration(hours: number | undefined): string {
  return hours && hours > 0 ? `${hours}H` : "À estimer";
}

type ReservationFeedback = {
  type: "success" | "error";
  message: string;
};

function hasValidatedReservationDuration(dossier: DossierSAV): boolean {
  return dossier.ordresReparation.some(line => {
    const isDone = normalizeRepairOrderStatus(line.status) === "done" || normalizeRepairOrderStatus(line.status) === "cancelled";
    return !isDone && line.tempsEstime > 0 && line.isEstimatedDurationValidated === true;
  });
}

function formatReservationFailure(codes: string[] = [], fallback = ""): string {
  const normalizedFallback = fallback.toLowerCase();
  if (codes.includes("planning-role-forbidden")) {
    return "Action refusée : votre rôle ne permet pas cette opération.";
  }
  if (codes.includes("planning-duration-not-validated") || normalizedFallback.includes("durée")) {
    return "Réservation impossible : durée non validée.";
  }
  if (codes.includes("planning-collision-tech") || normalizedFallback.includes("technicien est déjà")) {
    return "Réservation impossible : technicien déjà occupé.";
  }
  return "Réservation impossible : aucun créneau disponible.";
}

export default function WorkshopPlanning({
  techniciens,
  dossiers,
  reservations,
  onUpdateReservations,
  onSelectDossier,
  onUpdateDossier,
  activeRole,
  availabilityConfig,
  onUpdateAvailabilityConfig,
  onUpdateTechnicians,
  users = [],
  currentUser
}: WorkshopPlanningProps) {
  const [filterZone, setFilterZone] = useState<string>("Toutes");
  const [filterBay, setFilterBay] = useState<string>("Toutes");

  // Resource setup states
  const [showResourceSetup, setShowResourceSetup] = useState(false);
  const [techNom, setTechNom] = useState("");
  const [techSpecialite, setTechSpecialite] = useState("Mécanicien");
  const [techZone, setTechZone] = useState<AtelierZone>(AtelierZone.GRANDS_TRAVAUX);
  const [techDisp, setTechDisp] = useState<"disponible" | "occupe" | "absent" | "formation">("disponible");
  const [techActif, setTechActif] = useState(true);
  const [techUserId, setTechUserId] = useState("");
  const [resourceError, setResourceError] = useState("");

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    setResourceError("");
    if (!techNom.trim()) {
      setResourceError("Le nom de la ressource est obligatoire.");
      return;
    }
    const newTech: TechnicienResource = {
      id: "tech_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
      nom: techNom.trim(),
      specialite: techSpecialite,
      zoneAffectee: techZone,
      disponibilite: techDisp,
      compétences: [techSpecialite],
      absencesConges: [],
      capaciteJournaliere: 8,
      chargeActuelle: 0,
      actif: techActif,
      userId: techUserId || undefined
    };
    if (onUpdateTechnicians) {
      onUpdateTechnicians([...techniciens, newTech]);
    }
    setTechNom("");
    setTechUserId("");
  };

  const handleToggleResourceActive = (techId: string) => {
    if (onUpdateTechnicians) {
      const next = techniciens.map(t => t.id === techId ? { ...t, actif: !t.actif } : t);
      onUpdateTechnicians(next);
    }
  };

  const handleSpecialtyChange = (spec: string) => {
    setTechSpecialite(spec);
    if (spec === "Mécanicien") setTechZone(AtelierZone.GRANDS_TRAVAUX);
    else if (spec === "Électricien") setTechZone(AtelierZone.ELECTRICITE_DIAG);
    else if (spec === "Tôlier") setTechZone(AtelierZone.CARROSSERIE);
    else if (spec === "Peintre") setTechZone(AtelierZone.PEINTURE);
    else if (spec === "Contrôleur qualité") setTechZone(AtelierZone.CONTROLE_QUALITE);
    else if (spec === "Finition / Lavage") setTechZone(AtelierZone.LAVAGE_FINITION);
  };
  
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Suggestion states
  const [suggestionTargetId, setSuggestionTargetId] = useState("");
  const [suggestion, setSuggestion] = useState<WorkshopSlotSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<WorkshopSlotSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionFeedback, setSuggestionFeedback] = useState("");

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
  const [autoPlanningError, setAutoPlanningError] = useState("");
  const [autoPlanningSuccess, setAutoPlanningSuccess] = useState("");
  const [lastAutoReservedDetails, setLastAutoReservedDetails] = useState<{
    technician: string;
    bay: string;
    date: string;
    time: string;
    eta: string;
  } | null>(null);
  const [selectedVehicleDossierId, setSelectedVehicleDossierId] = useState("");
  const [autoPlanningWarning, setAutoPlanningWarning] = useState("");
  const [showShiftResetConfirm, setShowShiftResetConfirm] = useState(false);
  const [planningActionError, setPlanningActionError] = useState("");
  const [reservationFeedback, setReservationFeedback] = useState<Record<string, ReservationFeedback>>({});

  // Shift profile editing (Part 3)
  const [editingProfile, setEditingProfile] = useState<WorkshopShiftProfile | null>(null);
  const [editShiftDraft, setEditShiftDraft] = useState<ShiftProfileDraft>({
    name: "",
    dayStart: "08:00",
    dayEnd: "17:00",
    pauseEnabled: true,
    pauseStart: "12:00",
    pauseEnd: "13:00",
    activeDays: [1, 2, 3, 4, 5],
  });
  const [editProfileError, setEditProfileError] = useState<string | null>(null);

  const handleSaveShiftProfile = () => {
    if (!onUpdateAvailabilityConfig || !availabilityConfig || !editingProfile) return;
    const validation = validateShiftProfileDraft(editShiftDraft);
    if (!validation.valid) {
      setEditProfileError(validation.error || "Horaires invalides.");
      return;
    }

    const updatedProfile: WorkshopShiftProfile = {
      ...editingProfile,
      name: editShiftDraft.name.trim(),
      description: summarizeShiftProfileDraft(editShiftDraft),
      schedule: buildScheduleFromShiftProfileDraft(editShiftDraft)
    };

    const profileSource = availabilityConfig.shiftProfiles?.length
      ? availabilityConfig.shiftProfiles
      : getDefaultWorkshopShiftProfiles();
    const hasProfile = profileSource.some(profile => profile.id === updatedProfile.id);
    const newProfiles = hasProfile ? profileSource.map(p =>
      p.id === updatedProfile.id ? updatedProfile : p
    ) : [...profileSource, updatedProfile];

    onUpdateAvailabilityConfig({
      ...availabilityConfig,
      schedule: updatedProfile.id === "shift_standard" ? updatedProfile.schedule : availabilityConfig.schedule,
      shiftProfiles: newProfiles
    });

    setEditingProfile(null);
  };


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
    dossier.ordresReparation.some(line => {
      const status = normalizeRepairOrderStatus(line.status);
      return status !== "done" && status !== "cancelled";
    })
  );

  const taskPlanningTargets = getUnplannedRepairOrderTargets(dossiers);
  const selectedTargetIdForSuggest = suggestionTargetId || taskPlanningTargets[0]?.key || "";
  const selectedTargetForSuggest = findTaskPlanningTarget(taskPlanningTargets, selectedTargetIdForSuggest);

  const activeManualDossier = dossiers.find(d => d.id === manualDossierId);
  const activeManualLine = activeManualDossier?.ordresReparation.find(l => l.id === manualTaskId);
  const pendingManualTasks = useMemo(() => {
    return activeManualDossier
      ? activeManualDossier.ordresReparation.filter(line => {
        const status = normalizeRepairOrderStatus(line.status);
        return status !== "done" && status !== "cancelled";
      })
      : [];
  }, [activeManualDossier?.id, activeManualDossier ? activeManualDossier.ordresReparation.map(t => `${t.id}-${t.status}`).join(",") : ""]);

  useEffect(() => {
    if (targetDossiers.length > 0 && !manualDossierId) {
      setManualDossierId(targetDossiers[0].id);
    }
  }, [targetDossiers, manualDossierId]);

  useEffect(() => {
    if (pendingManualTasks.length > 0) {
      if (!manualTaskId || !pendingManualTasks.some(t => t.id === manualTaskId)) {
        setManualTaskId(pendingManualTasks[0].id);
      }
    } else {
      setManualTaskId("");
    }
  }, [pendingManualTasks, manualTaskId]);

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

  const activeDossiersList = useMemo(
    () => dossiers.filter(isDossierActive),
    [dossiers]
  );

  useEffect(() => {
    if (activeDossiersList.length > 0 && !selectedVehicleDossierId) {
      setSelectedVehicleDossierId(activeDossiersList[0].id);
    }
  }, [activeDossiersList, selectedVehicleDossierId]);

  useEffect(() => {
    if (manualDossierId) {
      setSelectedVehicleDossierId(manualDossierId);
    }
  }, [manualDossierId]);

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
    setSuggestionFeedback("");
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
    setSuggestionFeedback("");
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setSuggestion(null);
    setSuggestions([]);
    setSuggestionFeedback("");
  };

  const buildSuggestionCandidates = (): WorkshopSlotSuggestion[] => {
    if (!selectedTargetForSuggest) return [];
    if (!isDurationReadyForPlanning(selectedTargetForSuggest.line)) return [];
    const candidates: WorkshopSlotSuggestion[] = [];
    const seen = new Set<string>();
    const offsets = [0, 30, 60];

    for (const offsetMinutes of offsets) {
      const targetDesiredDate = new Date(selectedDate);
      const desiredStartMinutes = ganttStartMinutes + offsetMinutes;
      targetDesiredDate.setHours(Math.floor(desiredStartMinutes / 60), desiredStartMinutes % 60, 0, 0);
      const result = suggestWorkshopSlot({
        dossiers,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        estimatedHours: selectedTargetForSuggest.line.tempsEstime,
        desiredDate: targetDesiredDate,
        dossierId: selectedTargetForSuggest.dossier.id,
        lineId: selectedTargetForSuggest.line.id,
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
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    if (!selectedTargetForSuggest) {
      setSuggestionError("Aucune tâche non planifiée disponible pour suggestion.");
      setSuggestion(null);
      setSuggestions([]);
      setSuggestionFeedback("");
      return;
    }
    if (!isDurationReadyForPlanning(selectedTargetForSuggest.line)) {
      setSuggestionError("Durée à valider par Chef Atelier avant planification.");
      setSuggestion(null);
      setSuggestions([]);
      setSuggestionFeedback("");
      return;
    }

    try {
      const candidates = buildSuggestionCandidates();
      if (candidates.length === 0) {
        setSuggestionError("Aucun créneau disponible dans la période sélectionnée.");
        setSuggestion(null);
        setSuggestions([]);
        setSuggestionFeedback("");
        return;
      }

      const previousFingerprint = suggestion
         ? `${suggestion.technicianId}-${suggestion.bayId}-${suggestion.startTime}-${suggestion.endTime}`
         : "";
      const nextFingerprint = `${candidates[0].technicianId}-${candidates[0].bayId}-${candidates[0].startTime}-${candidates[0].endTime}`;
      setSuggestion(candidates[0]);
      setSuggestions(candidates);
      setSuggestionError("");
      setSuggestionFeedback(
        previousFingerprint === nextFingerprint
          ? "Meilleur créneau déjà affiché."
          : "Meilleur créneau disponible."
      );
    } catch (err: any) {
      setSuggestionError(err.message || "Aucun créneau disponible dans la période sélectionnée.");
      setSuggestion(null);
      setSuggestions([]);
      setSuggestionFeedback("");
    }
  };

  // Apply suggestion
  const handleApplySuggestion = (selectedSuggestion = suggestion) => {
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    if (!selectedTargetForSuggest || !selectedSuggestion) return;
    if (!canRunGuardedAction(`planning-apply-suggestion:${selectedTargetForSuggest.dossier.id}:${selectedTargetForSuggest.line.id}`)) return;

    const result = reserveSuggestedWorkshopSlot({
      role: activeRole,
      dossiers,
      reservations,
      dossierId: selectedTargetForSuggest.dossier.id,
      lineId: selectedTargetForSuggest.line.id,
      suggestion: selectedSuggestion,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      availabilityConfig,
    }, getSystemTime());
    if (result.ok === false) {
      setSuggestionError(result.error);
      setSuggestionFeedback("");
      return;
    }

    onUpdateDossier(result.dossier);
    onUpdateReservations(result.reservations);
    setSelectedDate(new Date(selectedSuggestion.startTime));

    setSuggestion(null);
    setSuggestions([]);
    setSuggestionTargetId("");
    setSuggestionError("");
    setSuggestionFeedback("Créneau réservé avec succès.");
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 3000);
  };

  // Manual planning validation and saving
  const getManualInterval = () => {
    const start = new Date(selectedDate);
    start.setHours(Number(manualStartHour), Number(manualStartMin), 0, 0);
    
    const activeLine = activeManualLine;
    const estimatedHours = activeLine ? activeLine.tempsEstime : 0;
    const durationMinutes = Math.ceil(estimatedHours * 60);
    const end = durationMinutes > 0 ? addWorkingMinutes(start, durationMinutes) : new Date(start);
    
    return { start, end, estimatedHours };
  };

  const checkManualCollisions = () => {
    if (!manualDossierId || !manualTaskId || !manualTechId || !manualBayId) return [];
    if (!activeManualLine || activeManualLine.tempsEstime <= 0) return ["planning-duration-missing"];
    if (!activeManualLine.isEstimatedDurationValidated) return ["planning-duration-not-validated"];
    
    const { start, end } = getManualInterval();
    const codes = validatePlanningAssignment({
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
    const mappedCodes: string[] = [];
    const isSunday = start.getDay() === 0;
    const isSaturday = start.getDay() === 6;
    const hourViolationCodes = new Set([
      "outside-effective-working-hours",
      "workshop-closed",
      "planning-collision-hours",
      "planning-collision-sunday",
      "planning-collision-saturday-afternoon",
      "workshop-holiday",
      "planning-segments-invalid",
    ]);

    const hasHourViolation = codes.some(code => hourViolationCodes.has(code));

    codes.forEach(code => {
      if (!hourViolationCodes.has(code)) {
        mappedCodes.push(code);
      }
    });

    if (hasHourViolation) {
      if (isSunday) {
        mappedCodes.push("planning-collision-sunday");
      } else if (isSaturday) {
        mappedCodes.push("planning-collision-saturday-afternoon");
      } else {
        mappedCodes.push("planning-collision-hours");
      }
    }

    return Array.from(new Set(mappedCodes));
  };

  const manualWarnings = checkManualCollisions();
  const isManualSaveBlocked = manualWarnings.length > 0;

  const handleSaveManualPlanning = () => {
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    if (!activeManualDossier || !manualTaskId || !manualTechId || !manualBayId) return;
    if (!canRunGuardedAction(`planning-manual-save:${activeManualDossier.id}:${manualTaskId}`)) return;

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

  const handleAutoReserve = (vehicleDossierId: string) => {
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole) || !vehicleDossierId) return;
    if (!canRunGuardedAction(`planning-auto-reserve:${vehicleDossierId}`)) return;

    setAutoPlanningError("");
    setAutoPlanningSuccess("");
    setAutoPlanningWarning("");
    setLastAutoReservedDetails(null);

    if (!availabilityConfig) {
      setAutoPlanningError("Aucun créneau disponible dans la période sélectionnée.");
      return;
    }

    const result = buildVehicleAutoReservationPlan({
      dossiers,
      reservations,
      targetDossierId: vehicleDossierId,
      selectedDate,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      availabilityConfig,
    }, getSystemTime());
    if (result.ok === false) {
      setAutoPlanningError(result.error);
      return;
    }

    if (result.createdReservations.length === 0) {
      setAutoPlanningSuccess("Toutes les tâches actives du véhicule sont déjà planifiées ou réservées.");
      return;
    }

    onUpdateReservations(result.reservations);
    if (result.dossiers) {
      const targetDossier = result.dossiers.find(d => d.id === vehicleDossierId);
      if (targetDossier) {
        onUpdateDossier(targetDossier);
      }
    }
    setAutoPlanningWarning(result.warning || "");
    setAutoPlanningSuccess(
      `${result.createdReservations.length} tâche(s) du véhicule réservée(s) automatiquement.`
    );

    // Set confirmation details
    const firstRes = result.createdReservations[0];
    const techName = techniciens.find(t => t.id === firstRes.technicianId)?.nom || firstRes.technicianId;
    const bayName = DEFAULT_WORKSHOP_BAYS.find(b => b.id === firstRes.bayId)?.name || firstRes.bayId;
    const startDateObj = new Date(firstRes.startTime!);
    const dateStr = startDateObj.toLocaleDateString("fr-FR");
    const timeStr = startDateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const etaInfo = getVehicleETAInfo(result.dossiers || dossiers, vehicleDossierId, result.reservations);
    const etaStr = etaInfo.etaDateTime ? new Date(etaInfo.etaDateTime).toLocaleString("fr-FR") : "Non définie";

    setLastAutoReservedDetails({
      technician: techName,
      bay: bayName,
      date: dateStr,
      time: timeStr,
      eta: etaStr
    });

    logAuditEvent({
      user: currentUser?.displayName || activeRole,
      role: activeRole,
      module: "planning",
      action: "reservation_automatique",
      dossierId: vehicleDossierId,
      commentaire: `Réservation automatique réussie. Technicien : ${techName}, Baie : ${bayName}, Date : ${dateStr} à ${timeStr}. Nouvelle ETA : ${etaStr}`,
      result: "success"
    });

    logAuditEvent({
      user: currentUser?.displayName || activeRole,
      role: activeRole,
      module: "planning",
      action: "eta_recalculee",
      dossierId: vehicleDossierId,
      commentaire: `Recalcul ETA après réservation automatique. Nouvelle ETA : ${etaStr}`,
      result: "success"
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

  const shiftProfiles = availabilityConfig?.shiftProfiles?.length
    ? availabilityConfig.shiftProfiles
    : getDefaultWorkshopShiftProfiles();

  const effectiveWorkshopWindows = availabilityConfig
    ? getEffectiveWorkshopWindows(selectedDate, { ...availabilityConfig, shiftProfiles })
    : getScheduleWindowsForDay(
        {
          id: "default",
          name: "Atelier",
          active: true,
          schedule: getDefaultWorkshopSchedule(),
        },
        selectedDate.getDay()
      );
  const visibleGanttWindows = mergeWorkshopWindows(effectiveWorkshopWindows);
  const baseTimelineWindows = effectiveWorkshopWindows.length > 0
    ? effectiveWorkshopWindows
    : visibleGanttWindows;
  const ganttStartMinutes = visibleGanttWindows.length > 0
    ? Math.min(...visibleGanttWindows.map(window => timeToMinutes(window.start)))
    : 8 * 60;
  const ganttEndMinutes = visibleGanttWindows.length > 0
    ? Math.max(...visibleGanttWindows.map(window => timeToMinutes(window.end)))
    : (isSat ? 12 * 60 : 17 * 60);
  const totalGanttMinutes = Math.max(60, ganttEndMinutes - ganttStartMinutes);
  const ganttHours = Array.from(
    { length: Math.max(1, Math.ceil(ganttEndMinutes / 60) - Math.floor(ganttStartMinutes / 60)) },
    (_, index) => Math.floor(ganttStartMinutes / 60) + index
  );
  const ganttEndHourLabel = minutesToTime(ganttEndMinutes);
  const ganttEndTestId = isSat && ganttEndMinutes === 12 * 60
    ? "gantt-hour-12-end"
    : `gantt-hour-${String(Math.floor(ganttEndMinutes / 60)).padStart(2, "0")}`;
  const closedGanttRanges = (() => {
    const ranges: Array<{ start: number; end: number; label: string }> = [];
    const sortedBaseWindows = mergeWorkshopWindows(baseTimelineWindows)
      .map(window => ({ start: timeToMinutes(window.start), end: timeToMinutes(window.end) }))
      .sort((left, right) => left.start - right.start);
    let cursor = ganttStartMinutes;
    for (const window of sortedBaseWindows) {
      if (window.start > cursor) {
        ranges.push({ start: cursor, end: window.start, label: "Pause" });
      }
      cursor = Math.max(cursor, window.end);
    }
    if (cursor < ganttEndMinutes) {
      ranges.push({ start: cursor, end: ganttEndMinutes, label: "Hors horaires" });
    }
    return ranges.filter(range => range.end > range.start);
  })();
  const getGanttBlockPosition = (start: Date, end: Date) => {
    const startOffset = start.getHours() * 60 + start.getMinutes() - ganttStartMinutes;
    const endOffset = end.getHours() * 60 + end.getMinutes() - ganttStartMinutes;
    const leftMinutes = Math.max(0, Math.min(totalGanttMinutes, startOffset));
    const rightMinutes = Math.max(leftMinutes, Math.min(totalGanttMinutes, endOffset));
    const leftPct = (leftMinutes / totalGanttMinutes) * 100;
    const widthPct = Math.max(2, ((rightMinutes - leftMinutes) / totalGanttMinutes) * 100);
    return { leftPct, widthPct };
  };
  const manualHourOptions = Array.from(
    { length: 24 },
    (_, index) => String(index).padStart(2, "0")
  );

  const todayStrForLine = getLocalDateStr(now);
  const isSelectedDateTodayForLine = selectedDateStr === todayStrForLine;
  const nowMinutesSinceStartForLine = now.getHours() * 60 + now.getMinutes() - ganttStartMinutes;
  const isTimeInWorkingHoursForLine = nowMinutesSinceStartForLine >= 0 && nowMinutesSinceStartForLine <= totalGanttMinutes;
  const showNowLine = isSelectedDateTodayForLine && isTimeInWorkingHoursForLine;
  const nowPct = showNowLine ? (nowMinutesSinceStartForLine / totalGanttMinutes) * 100 : 0;

  const dossierById = useMemo(() => new Map(dossiers.map(dossier => [dossier.id, dossier])), [dossiers]);
  const latestReservationByDossier = useMemo(() => buildLatestReservationByDossier(reservations), [reservations]);

  // Find all reservations active on the selected date without rendering off-range Gantt items.
  const activeReservationsStr = useMemo(() => {
    const query = ganttSearchQuery.toLowerCase().trim();
    return filterReservationsForGanttDate(reservations, selectedDateStr).filter(res => {
      if (!query) return true;
      const dossier = dossierById.get(res.dossierId);
      if (!dossier) return false;
      const text = `${dossier.vehiculeImmatriculation} ${dossier.vehiculeVIN} ${dossier.id} ${dossier.clientNom}`.toLowerCase();
      return text.includes(query);
    });
  }, [dossierById, ganttSearchQuery, reservations, selectedDateStr]);

  // Construct reservation needs
  const reservationNeeds = useMemo(() => dossiers
    .map(dossier => {
      const duration = calculateReservationDuration(dossier);
      const res = latestReservationByDossier.get(dossier.id);
      const activeReservation = res && res.status !== "ANNULEE" ? res : null;
      
      return {
        dossier,
        duration,
        reservation: activeReservation
      };
    })
    .filter(item =>
      item.duration > 0 ||
      Boolean(item.reservation)
    )
    .filter(item =>
      !item.reservation ||
      item.reservation.status !== "TRANSFORMEE_PLANNING" ||
      item.reservation.source === "planning-suggestion"
    ), [dossiers, latestReservationByDossier]);

  const paginatedReservationNeeds = useMemo(
    () => paginateItems(reservationNeeds, RESERVATION_NEEDS_RENDER_LIMIT),
    [reservationNeeds]
  );

  const handleSuggestReservation = (dossier: DossierSAV, existingRes: WorkshopReservation | null) => {
    const setFeedback = (type: ReservationFeedback["type"], message: string) => {
      setReservationFeedback(current => ({
        ...current,
        [dossier.id]: { type, message }
      }));
    };

    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) {
      setFeedback("error", "Action refusée : votre rôle ne permet pas cette opération.");
      return;
    }
    if (!canRunGuardedAction(`reservation-suggest:${dossier.id}`)) {
      setFeedback("error", "Réservation en cours : veuillez patienter.");
      return;
    }
    if (!hasValidatedReservationDuration(dossier)) {
      setFeedback("error", "Réservation impossible : durée non validée.");
      return;
    }
    const selectedDesiredDate = new Date(selectedDate);
    selectedDesiredDate.setHours(8, 0, 0, 0);
    const rawBaseRes = existingRes && existingRes.status !== "ANNULEE"
      ? existingRes 
      : createReservationNeed(dossier, getSystemTime());
    const baseRes = rawBaseRes
      ? { ...rawBaseRes, desiredDate: selectedDesiredDate.toISOString() }
      : null;
    
    if (!baseRes) {
      setFeedback("error", "Réservation impossible : durée non validée.");
      return;
    }

    try {
      const suggested = suggestReservationSlot({
        reservation: baseRes,
        dossiers,
        reservations,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        availabilityConfig
      }, getSystemTime());

      const validation = validateReservationSlot({
        reservation: suggested,
        dossiers,
        reservations,
        technicians: techniciens,
        workshopBays: DEFAULT_WORKSHOP_BAYS,
        availabilityConfig
      }, getSystemTime());

      if (!validation.allowed) {
        setFeedback("error", formatReservationFailure(validation.codes, validation.reasons.join(" ")));
        return;
      }

      const exists = reservations.some(r => r.reservationId === suggested.reservationId);
      const nextRes = exists
        ? reservations.map(r => r.reservationId === suggested.reservationId ? suggested : r)
        : [...reservations, suggested];
      
      onUpdateReservations(nextRes);
      setFeedback("success", "Suggestion de créneau affichée. Utilisez Réserver ce créneau pour confirmer.");

      logAuditEvent({
        user: currentUser?.displayName || activeRole,
        role: activeRole,
        module: "planning",
        action: "proposition_creneau",
        dossierId: dossier.id,
        commentaire: `Proposition de créneau affichée pour le dossier ${dossier.id}.`,
        result: "success"
      });
    } catch (err: any) {
      setFeedback("error", formatReservationFailure([], err.message || "Erreur de suggestion."));
    }
  };

  const handleConfirmReservation = (res: WorkshopReservation) => {
    const setFeedback = (type: ReservationFeedback["type"], message: string) => {
      setReservationFeedback(current => ({
        ...current,
        [res.dossierId]: { type, message }
      }));
    };

    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) {
      setFeedback("error", "Action refusée : votre rôle ne permet pas cette opération.");
      return;
    }
    if (!canRunGuardedAction(`reservation-confirm:${res.reservationId}`)) {
      setFeedback("error", "Réservation en cours : veuillez patienter.");
      return;
    }
    const confirmed = confirmReservation(res, getSystemTime());
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? confirmed : r);
    onUpdateReservations(nextRes);
    setFeedback("success", "Créneau réservé avec succès.");
  };

  const handleCancelReservation = (res: WorkshopReservation) => {
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    if (!canRunGuardedAction(`reservation-cancel:${res.reservationId}`)) return;
    const cancelled = cancelReservation(res, getSystemTime());
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? cancelled : r);
    onUpdateReservations(nextRes);
    setReservationFeedback(current => ({
      ...current,
      [res.dossierId]: { type: "success", message: "Réservation annulée." }
    }));
  };

  const handleConvertReservation = (res: WorkshopReservation) => {
    const setFeedback = (type: ReservationFeedback["type"], message: string) => {
      setReservationFeedback(current => ({
        ...current,
        [res.dossierId]: { type, message }
      }));
    };

    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) {
      setFeedback("error", "Action refusée : votre rôle ne permet pas cette opération.");
      return;
    }
    if (!canRunGuardedAction(`reservation-convert:${res.reservationId}`)) {
      setFeedback("error", "Réservation en cours : veuillez patienter.");
      return;
    }
    const { dossiers: nextDossiers, reservation: nextResObj } = convertReservationToPlanning(res, dossiers, getSystemTime());
    
    const updatedDossier = nextDossiers.find(d => d.id === res.dossierId);
    if (updatedDossier) {
      onUpdateDossier(updatedDossier);
    }
    
    const nextRes = reservations.map(r => r.reservationId === res.reservationId ? nextResObj : r);
    onUpdateReservations(nextRes);
    setFeedback("success", "Réservation atelier créée et Gantt mis à jour.");
  };

  const openRescheduleModal = (
    dossier: DossierSAV,
    line: RepairOrderLine,
    overrides: { technicianId?: string; bayId?: string; start?: Date } = {}
  ) => {
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    const currentStart = overrides.start || (line.planningStart ? new Date(line.planningStart) : selectedDate);
    const durationMinutes = line.planningStart && line.planningEnd
      ? Math.max(15, Math.round((new Date(line.planningEnd).getTime() - new Date(line.planningStart).getTime()) / 60000))
      : Math.max(0, Math.ceil((line.tempsEstime || 0) * 60));

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
    if (![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)) return;
    if (!rescheduleTarget || !rescheduleTechId || !rescheduleBayId || !rescheduleDate || !rescheduleStart) return;
    if (!canRunGuardedAction(`planning-reschedule:${rescheduleTarget.dossierId}:${rescheduleTarget.lineId}`)) return;
    const dossier = dossiers.find(current => current.id === rescheduleTarget.dossierId);
    const line = dossier?.ordresReparation.find(current => current.id === rescheduleTarget.lineId);
    if (!dossier || !line) return;
    if (!isDurationReadyForPlanning(line)) {
      setRescheduleError("Durée à valider par Chef Atelier avant de modifier le planning.");
      return;
    }
    if (!Number.isFinite(rescheduleDurationMinutes) || rescheduleDurationMinutes <= 0) {
      setRescheduleError("Durée de créneau invalide.");
      return;
    }

    const [hour, minute] = rescheduleStart.split(":").map(Number);
    const start = new Date(`${rescheduleDate}T00:00:00`);
    start.setHours(hour, minute, 0, 0);
    const end = addWorkingMinutes(start, rescheduleDurationMinutes);
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

    const segments = validation.segments.length > 0 ? validation.segments : buildPlanningSegments(start, end);
    const techName = techniciens.find(tech => tech.id === rescheduleTechId)?.nom || rescheduleTechId;
    const bayName = DEFAULT_WORKSHOP_BAYS.find(bay => bay.id === rescheduleBayId)?.name || rescheduleBayId;
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
    start.setHours(Math.floor(ganttStartMinutes / 60), ganttStartMinutes % 60, 0, 0);
    start.setMinutes(start.getMinutes() + snappedMinutes);
    return start;
  };

  const handleDropTask = (
    event: React.DragEvent<HTMLElement>,
    defaults: { technicianId?: string; bayId?: string }
  ) => {
    event.preventDefault();
    if (activeRole !== UserRole.CHEF_ATELIER) return;
    if (!draggingTask) return;
    const dossier = dossiers.find(current => current.id === draggingTask.dossierId);
    const line = dossier?.ordresReparation.find(current => current.id === draggingTask.lineId);
    if (!dossier || !line) return;
    openRescheduleModal(dossier, line, { ...defaults, start: getDropStartDate(event) });
    setDraggingTask(null);
  };

  const handlePrintTaskSheet = (dossier: DossierSAV, line: RepairOrderLine | null | undefined) => {
    if (!line) {
      setPlanningActionError("Aucune tâche sélectionnée pour impression.");
      return;
    }
    setPlanningActionError("");
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
    if (dossier.statut !== DossierStatus.LIVRE && dossier.statut !== DossierStatus.CLOTURE && dossier.statut !== DossierStatus.ANNULE) {
      dossier.ordresReparation.forEach(line => {
        if (isActivePlannedTask(line, dossier, selectedDateStr)) {
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
  const canShowPhone = perm.canViewVehicleSensitiveFields(activeRole);
  const editShiftCapacityLabel = formatCapacityHours(calculateShiftProfileCapacityMinutes(editShiftDraft));
  const updateEditShiftDraft = (patch: Partial<ShiftProfileDraft>) => {
    setEditShiftDraft(current => ({ ...current, ...patch }));
  };
  const toggleEditShiftDay = (day: number) => {
    setEditShiftDraft(current => {
      const activeDays = current.activeDays.includes(day)
        ? current.activeDays.filter(currentDay => currentDay !== day)
        : [...current.activeDays, day].sort((left, right) => left - right);
      return { ...current, activeDays };
    });
  };

  const renderResourceSetupForm = () => {
    return (
      <div className="space-y-6" data-testid="resource-setup-container">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 mb-1">Configuration ressources atelier</h3>
          <p className="text-gray-500 text-[10px]">Créez et liez les ressources compagnons/techniciens de l'atelier.</p>
        </div>

        {resourceError && (
          <div data-testid="resource-error" className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-bold">
            {resourceError}
          </div>
        )}

        <form onSubmit={handleCreateResource} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200" data-testid="resource-creation-form">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nom *</label>
            <input
              type="text"
              data-testid="resource-name"
              className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold"
              placeholder="Ex: Mani"
              value={techNom}
              onChange={e => setTechNom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Spécialité</label>
            <select
              data-testid="resource-specialty"
              className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold"
              value={techSpecialite}
              onChange={e => handleSpecialtyChange(e.target.value)}
            >
              <option value="Mécanicien">Mécanicien</option>
              <option value="Électricien">Électricien</option>
              <option value="Tôlier">Tôlier</option>
              <option value="Peintre">Peintre</option>
              <option value="Contrôleur qualité">Contrôleur qualité</option>
              <option value="Finition / Lavage">Finition / Lavage</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Zone Affectée</label>
            <select
              data-testid="resource-zone"
              className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold"
              value={techZone}
              onChange={e => setTechZone(e.target.value as AtelierZone)}
            >
              {Object.values(AtelierZone).map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Disponibilité initiale</label>
            <select
              data-testid="resource-availability"
              className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold"
              value={techDisp}
              onChange={e => setTechDisp(e.target.value as any)}
            >
              <option value="disponible">Disponible</option>
              <option value="occupe">Occupé</option>
              <option value="absent">Absent</option>
              <option value="formation">En formation</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Liaison utilisateur (Optionnel)</label>
            <select
              data-testid="resource-user-link"
              className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold"
              value={techUserId}
              onChange={e => setTechUserId(e.target.value)}
            >
              <option value="">Aucune liaison</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                data-testid="resource-active-checkbox"
                checked={techActif}
                onChange={e => setTechActif(e.target.checked)}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              Actif (ressource planifiable)
            </label>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              data-testid="submit-resource-button"
              className="px-4 py-2 bg-slate-900 hover:bg-blue-700 text-white rounded text-xs font-black uppercase cursor-pointer"
            >
              Créer la ressource
            </button>
          </div>
        </form>

        {/* Existing resources list */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase">Ressources configurées ({techniciens.length})</h4>
          {techniciens.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune ressource configurée pour le moment.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-bold text-gray-600">Nom</th>
                    <th className="px-4 py-2 font-bold text-gray-600">Spécialité</th>
                    <th className="px-4 py-2 font-bold text-gray-600">Zone</th>
                    <th className="px-4 py-2 font-bold text-gray-600">Liaison utilisateur</th>
                    <th className="px-4 py-2 font-bold text-gray-600">Statut</th>
                    <th className="px-4 py-2 font-bold text-gray-600">Actif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {techniciens.map(t => {
                    const linkedUser = users.find((u: any) => u.id === t.userId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50" data-testid={`resource-row-${t.id}`}>
                        <td className="px-4 py-2 font-extrabold text-slate-900" data-testid="resource-row-name">{t.nom}</td>
                        <td className="px-4 py-2 text-slate-600" data-testid="resource-row-specialty">{t.specialite}</td>
                        <td className="px-4 py-2 text-slate-600" data-testid="resource-row-zone">{t.zoneAffectee}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {linkedUser ? `${linkedUser.displayName} (${linkedUser.role})` : "Aucune"}
                        </td>
                        <td className="px-4 py-2 font-semibold">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            t.disponibilite === "disponible" ? "bg-emerald-50 text-emerald-700" :
                            t.disponibilite === "occupe" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-600"
                          }`}>
                            {t.disponibilite}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={t.actif !== false}
                            onChange={() => handleToggleResourceActive(t.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (techniciens.length === 0) {
    return (
      <div className="space-y-6">
        {/* Title & Date selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 font-display">
            <Calendar className="w-5 h-5 text-blue-600" />
            PLANNING & CHARGE DES TECHNICIENS (GANTT)
          </h2>
          <p className="text-gray-500 text-xs">Visualisation de la charge journalière et affectation des créneaux de travaux.</p>
        </div>

        <div data-testid="empty-resources-warning" className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-bold">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-extrabold">Aucune ressource atelier configurée. Créez les ressources avant planification.</p>
              {!(activeRole === UserRole.DIRECTEUR_SAV || activeRole === UserRole.CHEF_ATELIER) && (
                <p className="mt-1 font-normal text-amber-700">Veuillez contacter un Directeur SAV ou Chef d'atelier pour configurer les ressources.</p>
              )}
            </div>
          </div>
          {(activeRole === UserRole.DIRECTEUR_SAV || activeRole === UserRole.CHEF_ATELIER) && (
            renderResourceSetupForm()
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showResourceSetup && (
        <div data-testid="resource-setup-panel" className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          {renderResourceSetupForm()}
        </div>
      )}
      
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
            {(activeRole === UserRole.DIRECTEUR_SAV || activeRole === UserRole.CHEF_ATELIER) && (
              <button
                type="button"
                data-testid="toggle-resource-setup"
                onClick={() => setShowResourceSetup(!showResourceSetup)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer"
              >
                {showResourceSetup ? "Masquer ressources" : "Gérer les ressources"}
              </button>
            )}

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

        {planningActionError && (
          <div data-testid="action-feedback" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            <span data-testid="action-error-message">{planningActionError}</span>
          </div>
        )}

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
        
        {/* Column 1 containing both Suggestion Engine and ETA/Auto-Reserve */}
        <div className="space-y-6">
          {/* Automatic Slot Suggestion */}
          {activeRole === UserRole.CHEF_ATELIER && (
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
                  setSuggestionFeedback("");
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

          {suggestionFeedback && (
            <p
              data-testid="planning-suggest-feedback"
              className={`text-xs font-bold ${
                suggestionFeedback === "Créneau réservé avec succès."
                  ? "text-emerald-700"
                  : "text-blue-700"
              }`}
            >
              {suggestionFeedback}
            </p>
          )}

          {suggestion && suggestions.length > 0 && (
            <div data-testid="planning-suggest-result" className="space-y-2">
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
                  {activeRole === UserRole.CHEF_ATELIER && (
                    <button
                      onClick={() => handleApplySuggestion(candidate)}
                      disabled={!selectedTargetForSuggest || !isDurationReadyForPlanning(selectedTargetForSuggest.line)}
                      data-testid={index === 0 ? "planning-suggest-apply" : `planning-suggest-apply-${index + 1}`}
                      className="sm:col-span-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      Réserver ce créneau
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {(() => {
          const selectedVehicleDossier = dossiers.find(d => d.id === selectedVehicleDossierId);
          const vehicleETAInfo = selectedVehicleDossierId ? getVehicleETAInfo(dossiers, selectedVehicleDossierId, reservations) : null;
          const otherActiveDossiers = selectedVehicleDossier ? dossiers.filter(d =>
            d.id !== selectedVehicleDossierId &&
            isDossierActive(d) &&
            isSameVehicle(selectedVehicleDossier, d)
          ) : [];

          return (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 font-display">
                <Clock className="w-4.5 h-4.5 text-blue-600" />
                ETA Livraison & Réservation Automatique
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Véhicule à consulter :</label>
                  <select
                    data-testid="planning-eta-vehicle-select"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={selectedVehicleDossierId}
                    onChange={(e) => setSelectedVehicleDossierId(e.target.value)}
                  >
                    {activeDossiersList.length === 0 ? (
                      <option value="">Aucun véhicule actif</option>
                    ) : (
                      activeDossiersList.map(d => (
                        <option key={`eta-select-${d.id}`} value={d.id}>
                          {d.vehiculeModele} ({d.vehiculeImmatriculation}) - {d.id}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedVehicleDossier && vehicleETAInfo && (
                  <div className="space-y-3 border-t border-gray-100 pt-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Modèle</span>
                        <strong className="text-gray-800">{selectedVehicleDossier.vehiculeModele}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Immatriculation</span>
                        <strong className="text-gray-800">{selectedVehicleDossier.vehiculeImmatriculation}</strong>
                      </div>
                      {selectedVehicleDossier.vehiculeVIN && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase block">VIN</span>
                          <strong className="text-gray-800 font-mono text-[10px]">{selectedVehicleDossier.vehiculeVIN}</strong>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">ETA Livraison</span>
                        <strong data-testid="vehicle-eta-value" className="text-gray-800 font-black text-sm">
                          {vehicleETAInfo.etaDateTime
                            ? new Date(vehicleETAInfo.etaDateTime).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                            : "Non définie"}
                        </strong>
                      </div>

                      <div className="pt-1">
                        <span data-testid="vehicle-eta-reliability" className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase border ${
                          vehicleETAInfo.reliability === "Élevée"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : vehicleETAInfo.reliability === "Moyenne"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          Fiabilité : {vehicleETAInfo.reliability}
                        </span>
                      </div>

                      <div className="mt-1 bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
                        <p data-testid="vehicle-eta-message" className="text-gray-800 font-bold leading-normal">{vehicleETAInfo.message}</p>
                        {activeRole === UserRole.RECEPTIONNAIRE && (
                          <p data-testid="vehicle-eta-reception-message" className="text-blue-800 font-bold text-[10px] mt-1">
                            {vehicleETAInfo.receptionMessage}
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <ul className="space-y-1 text-[11px] font-semibold text-gray-500 list-disc list-inside">
                          <li>Tâches planifiées : {vehicleETAInfo.plannedTaskCount}</li>
                          <li>Tâches non réservées : {vehicleETAInfo.unplannedTaskCount}</li>
                          <li>Durées à valider : {vehicleETAInfo.unvalidatedDurationCount}</li>
                        </ul>
                      </div>

                      {otherActiveDossiers.length > 0 && (
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <span className="text-[9px] text-gray-400 font-black uppercase block">Autres dossiers actifs du véhicule :</span>
                          <ul className="space-y-0.5 mt-1 font-mono text-[10px] text-blue-600">
                            {otherActiveDossiers.map(d => (
                              <li key={d.id}>{d.id} ({d.vehiculeModele})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {autoPlanningError && (
                  <p data-testid="auto-planning-error" className="text-xs font-bold text-rose-600">{autoPlanningError}</p>
                )}

                {autoPlanningWarning && (
                  <p data-testid="auto-planning-warning" className="text-xs font-bold text-amber-600">{autoPlanningWarning}</p>
                )}

                {autoPlanningSuccess && (
                  <p data-testid="auto-planning-success" className="text-xs font-bold text-emerald-600">{autoPlanningSuccess}</p>
                )}

                {lastAutoReservedDetails && (
                  <div data-testid="auto-reserve-confirmation" className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl space-y-1 text-emerald-800 text-[11px] font-semibold mt-2">
                    <div className="font-black uppercase text-[10px] text-emerald-900">Confirmation de réservation automatique :</div>
                    <div>Compagnon : <strong data-testid="conf-tech">{lastAutoReservedDetails.technician}</strong></div>
                    <div>Baie : <strong data-testid="conf-bay">{lastAutoReservedDetails.bay}</strong></div>
                    <div>Date : <strong data-testid="conf-date">{lastAutoReservedDetails.date}</strong></div>
                    <div>Heure : <strong data-testid="conf-time">{lastAutoReservedDetails.time}</strong></div>
                    <div>Nouvelle ETA : <strong data-testid="conf-eta">{lastAutoReservedDetails.eta}</strong></div>
                  </div>
                )}

                {[UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole) && (
                  <button
                    onClick={() => handleAutoReserve(selectedVehicleDossierId)}
                    data-testid="planning-auto-reserve-btn"
                    disabled={activeDossiersList.length === 0}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    Réserver automatiquement les tâches du véhicule
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Manual Planning Form & Collision warning panel */}
        {[UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole) && (
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
                  <option key={t.id} value={t.id}>{t.designation} ({formatWorkshopDuration(t.tempsEstime)})</option>
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
                    {manualHourOptions.map(h => (
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
                    Créneau hors horaires configurés.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-sunday") && (
                  <p data-testid="planning-collision-sunday" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Atelier fermé sur ce créneau.
                  </p>
                )}
                {manualWarnings.includes("planning-collision-saturday-afternoon") && (
                  <p data-testid="planning-collision-saturday-afternoon" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Créneau hors horaires configurés.
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
                {manualWarnings.includes("planning-collision-vehicle") && (
                  <p data-testid="planning-collision-vehicle" className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Le véhicule a déjà une autre tâche planifiée sur cette période.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
        )}

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
              paginatedReservationNeeds.visibleItems.map(({ dossier, duration, reservation }) => {
                const status = reservation ? reservation.status : "A_RESERVER";
                const isReservedFromSuggestion =
                  status === "TRANSFORMEE_PLANNING" &&
                  reservation?.source === "planning-suggestion";
                const displayedDuration = isReservedFromSuggestion
                  ? reservation.totalHours
                  : duration;
                const feedback = reservationFeedback[dossier.id];
                
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
                        <span data-testid="planning-reservation-status" className="px-1.5 py-0.5 rounded-lg bg-gray-105 text-gray-750 text-[9px] font-black uppercase">
                          <span data-testid="planning-reservation-pending">À réserver</span>
                        </span>
                      )}
                      {status === "CRENEAU_PROPOSE" && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-blue-105 text-blue-800 text-[9px] font-black uppercase">Créneau proposé</span>
                      )}
                      {status === "RESERVATION_CONFIRMEE" && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-indigo-105 text-indigo-800 text-[9px] font-black uppercase">Réservation confirmée</span>
                      )}
                      {isReservedFromSuggestion && (
                        <span data-testid="planning-reservation-status" className="px-1.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                          <span data-testid="planning-reservation-reserved">Réservé</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="text-gray-650 space-y-0.5">
                      <div>Véhicule : <span className="font-extrabold text-gray-805">{dossier.vehiculeMarque} {dossier.vehiculeModele} ({dossier.vehiculeImmatriculation})</span></div>
                      <div>Durée MO validée : <span className="font-extrabold text-gray-805">{displayedDuration}h</span></div>
                      {reservation && reservation.startTime && (() => {
                        const uniqueDays = reservation.segments && reservation.segments.length > 0
                          ? new Set(reservation.segments.map(seg => seg.start.split("T")[0])).size
                          : 1;
                        const numSegments = reservation.segments?.length || 1;
                        const isExpanded = expandedResId === reservation.reservationId;

                        return (
                          <div
                            data-testid={status === "CRENEAU_PROPOSE" ? "planning-suggestion-panel" : undefined}
                            className="bg-gray-50/50 p-2 rounded-lg border border-gray-100 mt-1.5 space-y-1"
                          >
                            <div className="font-black text-gray-700 uppercase text-[9px]">
                              {isReservedFromSuggestion ? "Créneau réservé :" : "Créneau proposé :"}
                            </div>
                            <div>
                              Début : <span data-testid="planning-suggestion-start" className="font-bold text-gray-800">
                                <span data-testid="res-start">
                                {new Date(reservation.startTime).toLocaleDateString("fr-FR")} à {new Date(reservation.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </span>
                            </div>
                            <div>
                              Fin estimée : <span data-testid="planning-suggestion-end" className="font-bold text-gray-800">
                                <span data-testid="res-end">
                                {reservation.endTime ? `${new Date(reservation.endTime).toLocaleDateString("fr-FR")} à ${new Date(reservation.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "-"}
                                </span>
                              </span>
                            </div>
                            <div>
                              Durée : <span data-testid="planning-suggestion-duration" className="font-bold text-gray-800">{reservation.totalHours}h</span>
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
                            <div>Technicien : <span data-testid="planning-suggestion-technician" className="font-bold text-gray-800">{techniciens.find(t => t.id === reservation.technicianId)?.nom || reservation.technicianId}</span></div>
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

                    {feedback && (
                      <div
                        data-testid="planning-reservation-feedback"
                        className={`flex items-center gap-1 rounded-lg border p-2 text-[10px] font-extrabold ${
                          feedback.type === "success"
                            ? "border-emerald-150 bg-emerald-50 text-emerald-800"
                            : "border-red-150 bg-red-50 text-red-800"
                        }`}
                      >
                        {feedback.type === "error" && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
                        {feedback.type === "success" && <Check className="h-3 w-3 flex-shrink-0" />}
                        <span data-testid={feedback.type === "success" ? "planning-reservation-success" : "planning-reservation-error"}>
                          {feedback.message}
                        </span>
                      </div>
                    )}

                    {[UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole) && (
                    <div className="flex flex-col gap-1.5 pt-1 w-full">
                      {status === "A_RESERVER" && (
                        <div className="flex flex-col gap-1.5 w-full mt-2">
                          <button
                            type="button"
                            onClick={() => handleAutoReserve(dossier.id)}
                            disabled={![UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV].includes(activeRole)}
                            data-testid="planning-reserve-button"
                            className="w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Réserver automatiquement
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSuggestReservation(dossier, reservation)}
                            disabled={!perm.canSuggestReservation(activeRole)}
                            data-testid="planning-suggest-btn"
                            className="w-full px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span data-testid="reservation-suggest-btn">Proposer créneau</span>
                          </button>
                        </div>
                      )}

                      {status === "CRENEAU_PROPOSE" && (
                        <div className="flex flex-wrap gap-1.5 pt-1 w-full">
                          <button
                            type="button"
                            onClick={() => handleSuggestReservation(dossier, reservation)}
                            disabled={!perm.canSuggestReservation(activeRole)}
                            data-testid="planning-suggest-btn"
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3 h-3" />
                            <span data-testid="reservation-suggest-btn">Recalculer créneau</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmReservation(reservation!)}
                            disabled={!perm.canConfirmReservation(activeRole) || validationErrors.length > 0}
                            data-testid="reservation-confirm-btn"
                            className="px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span data-testid="planning-confirm-slot">Réserver ce créneau</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConvertReservation(reservation!)}
                            disabled={!perm.canConvertReservationToPlanning(activeRole) || validationErrors.length > 0}
                            data-testid="reservation-convert-btn"
                            className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            Planifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelReservation(reservation!)}
                            disabled={!perm.canCancelReservation(activeRole)}
                            data-testid="reservation-cancel-btn"
                            className="px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      )}

                      {status === "RESERVATION_CONFIRMEE" && (
                        <div className="flex flex-wrap gap-1.5 pt-1 w-full">
                          <button
                            type="button"
                            onClick={() => handleConvertReservation(reservation!)}
                            disabled={!perm.canConvertReservationToPlanning(activeRole) || validationErrors.length > 0}
                            data-testid="reservation-convert-btn"
                            className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            Planifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelReservation(reservation!)}
                            disabled={!perm.canCancelReservation(activeRole)}
                            data-testid="reservation-cancel-btn"
                            className="px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })
            )}
            {paginatedReservationNeeds.hiddenCount > 0 && (
              <div data-testid="reservation-needs-pagination-summary" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                {paginatedReservationNeeds.visibleItems.length} véhicules affichés sur {paginatedReservationNeeds.total}. Affinez la recherche ou la date pour limiter le planning.
              </div>
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
              <span data-testid={ganttEndTestId} className="w-1/12 font-mono">{ganttEndHourLabel}</span>
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

                // Collect and sort Gantt items for lane assignment
                const ganttItems: GanttLaneItem[] = [];

                techPlannedLines.forEach(({ dossier, line }) => {
                  const segments = getRepairOrderPlanningSegmentsForDate(line, selectedDateStr);
                  segments.forEach((seg, sIdx) => {
                    const s = new Date(seg.start);
                    const e = new Date(seg.end);
                    const { leftPct, widthPct } = getGanttBlockPosition(s, e);
                    ganttItems.push({
                      type: 'task',
                      id: `${line.id}-seg-${sIdx}`,
                      start: s,
                      end: e,
                      leftPct,
                      widthPct,
                      data: { dossier, line, segment: seg, segmentIndex: sIdx }
                    });
                  });
                });

                activeReservationsStr.filter(res => res.technicianId === tech.id).forEach(res => {
                  const segments = (res.segments && res.segments.length > 0
                    ? res.segments
                    : [{ start: res.startTime!, end: res.endTime! }]
                  ).filter(seg => seg.start.split("T")[0] === selectedDateStr);

                  const dossier = dossiers.find(d => d.id === res.dossierId);
                  if (dossier) {
                    segments.forEach((seg, sIdx) => {
                      const s = new Date(seg.start);
                      const e = new Date(seg.end);
                      const { leftPct, widthPct } = getGanttBlockPosition(s, e);
                      ganttItems.push({
                        type: 'reservation',
                        id: `${res.reservationId}-seg-${sIdx}`,
                        start: s,
                        end: e,
                        leftPct,
                        widthPct,
                        data: { dossier, reservation: res, segment: seg, segmentIndex: sIdx }
                      });
                    });
                  }
                });

                const lanes = assignGanttLanes(ganttItems);
                const totalLanes = Math.max(1, lanes.length);
                
                // Calculate total active/planned hours today
                const dailyLoad = calculateTechnicianDailyLoad(tech.id, selectedDateStr, dossiers, reservations);
                const isAbsent = availabilityConfig ? isTechnicianAbsent(tech.id, selectedDate, availabilityConfig) : false;
                const isClosed = availabilityConfig ? isWorkshopClosed(selectedDate, availabilityConfig) : isClosedDay;

                let techCapacity = 0;
                if (!isClosed && !isAbsent) {
                  if (availabilityConfig) {
                    const effWindows = getEffectiveWorkshopWindowsForResource(selectedDate, availabilityConfig, { technicianId: tech.id });
                    techCapacity = getCapacityHoursFromWindows(effWindows);
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

                const hasInProgressTask = techPlannedLines.some(({ line }) =>
                  normalizeRepairOrderStatus(line.status) === "in_progress"
                );

                const todayTechSegments: Array<{ start: Date; end: Date }> = techPlannedLines.flatMap(({ line }) =>
                  getRepairOrderPlanningSegmentsForDate(line, selectedDateStr).map(seg => ({
                    start: new Date(seg.start),
                    end: new Date(seg.end)
                  }))
                );

                const hasSegmentCoveringNow = todayTechSegments.some(seg => {
                  const t = now.getTime();
                  return t >= seg.start.getTime() && t <= seg.end.getTime();
                });

                const hasSegmentsToday = todayTechSegments.length > 0;
                const hasLoadWithoutVisibleBlock = dailyLoad > 0 && techPlannedLines.length === 0;

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
                } else if (hasLoadWithoutVisibleBlock) {
                  statusLabel = "Charge sans bloc visible";
                  statusColor = "bg-amber-500 text-white";
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
                      className="col-span-9 relative bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner"
                      style={{ height: `${totalLanes * GANTT_LANE_HEIGHT}px` }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropTask(event, { technicianId: tech.id })}
                    >
                      
                      {/* Non-working ranges shaded from configured windows */}
                      {closedGanttRanges.map((range, index) => (
                        <div
                          key={`${range.start}-${range.end}`}
                          data-testid={index === 0 ? "gantt-lunch-break-shading" : "gantt-closed-range-shading"}
                          className="absolute top-0 bottom-0 bg-slate-400/10 border-l border-r border-slate-200/60 z-10 flex items-center justify-center"
                          style={{
                            left: `${((range.start - ganttStartMinutes) / totalGanttMinutes) * 100}%`,
                            width: `${((range.end - range.start) / totalGanttMinutes) * 100}%`
                          }}
                        >
                          <span className="text-[8px] text-slate-500/70 font-black uppercase tracking-widest text-center block rotate-90 sm:rotate-0">
                            {range.label}
                          </span>
                        </div>
                      ))}

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

                      {/* Display lanes with tasks/reservations */}
                      {lanes.map((lane, laneIdx) => {
                        return lane.map(item => {
                          const leftPct = item.leftPct;
                          const widthPct = item.widthPct;
                          const topVal = laneIdx * GANTT_LANE_HEIGHT + Math.max(0, (GANTT_LANE_HEIGHT - GANTT_BLOCK_HEIGHT) / 2);

                          if (item.type === "task") {
                            const { dossier, line, segmentIndex } = item.data;
                            const s = item.start;
                            const e = item.end;
                            const isPast = e.getTime() < now.getTime();
                            const visualState = getGanttTaskVisualState(line, now, dossier);
                            const statusVisual = GANTT_STATE_VISUALS[visualState];

                            return (
                              <div
                                key={item.id}
                                data-testid={`gantt-block-${line.id}`}
                                data-segment-index={segmentIndex}
                                data-start={s.toISOString()}
                                data-end={e.toISOString()}
                                onClick={() => onSelectDossier(dossier.id)}
                                draggable={activeRole === UserRole.CHEF_ATELIER}
                                onDragStart={(event) => {
                                  if (activeRole !== UserRole.CHEF_ATELIER) {
                                    event.preventDefault();
                                    return;
                                  }
                                  event.dataTransfer.effectAllowed = "move";
                                  setDraggingTask({ dossierId: dossier.id, lineId: line.id });
                                }}
                                className={`absolute ${statusVisual.className} border text-[9px] font-black rounded-lg shadow-xs px-2 py-1 cursor-pointer overflow-hidden transition select-none z-20 ${isPast ? "opacity-65" : ""}`}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  top: `${topVal}px`,
                                  height: `${GANTT_BLOCK_HEIGHT}px`
                                }}
                                title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele}) ${dossier.vehiculeImmatriculation}`}
                              >
                                <div className="pointer-events-none flex items-center justify-between gap-1 overflow-hidden pr-9">
                                  <span className="truncate block leading-tight font-extrabold">{dossier.vehiculeModele}</span>
                                  <span
                                    data-testid={statusVisual.testId}
                                    className={`px-1 py-0.2 text-[7px] rounded border font-black whitespace-nowrap ${statusVisual.badgeClassName}`}
                                  >
                                    {statusVisual.label}
                                  </span>
                                </div>
                                <span className="pointer-events-none truncate block text-[7px] opacity-90 leading-none pr-9">
                                  {dossier.vehiculeImmatriculation}
                                  {(line.complaintBadge || line.sourceComplaintId) && (
                                    <span data-testid={`gantt-complaint-badge-${line.id}`} className="ml-1 rounded bg-red-600 px-1 py-0.2 text-white">REC</span>
                                  )}
                                </span>
                                <span className="pointer-events-none truncate block text-[7px] opacity-80 leading-none pr-9">
                                  {s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}-{e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <div className="absolute bottom-1 right-1 z-40 flex gap-1">
                                  {activeRole === UserRole.CHEF_ATELIER && (
                                    <button
                                      type="button"
                                      data-testid={`gantt-reschedule-${line.id}`}
                                      aria-label="Modifier créneau"
                                      title="Modifier créneau"
                                      draggable={false}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openRescheduleModal(dossier, line);
                                      }}
                                      className="relative z-40 flex h-4 w-4 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                                    >
                                      <Settings className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    data-testid={`gantt-task-sheet-${line.id}`}
                                    aria-label="Fiche tâche technicien"
                                    draggable={false}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handlePrintTaskSheet(dossier, line);
                                    }}
                                    className="relative z-40 flex h-4 w-4 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                                    title="Fiche tâche technicien"
                                  >
                                    <FileText className="inline h-2.5 w-2.5" />
                                    <span data-testid="print-technician-sheet" className="sr-only">Fiche tâche technicien</span>
                                  </button>
                                </div>
                              </div>
                            );
                          } else {
                            const { dossier, reservation, segmentIndex } = item.data;
                            const s = item.start;
                            const e = item.end;
                            const isProposed = reservation.status === "CRENEAU_PROPOSE";
                            const blockBg = isProposed
                              ? "bg-blue-50/80 border-dashed border-blue-400 text-blue-800"
                              : "bg-indigo-100/95 border-indigo-500 text-indigo-900";

                            const badgeText = isProposed ? "Réservation proposée" : "Réservation confirmée";
                            const testId = isProposed ? "gantt-reservation-proposed" : "gantt-reservation-confirmed";

                            return (
                              <div
                                key={item.id}
                                data-testid={testId}
                                data-segment-index={segmentIndex}
                                data-start={s.toISOString()}
                                data-end={e.toISOString()}
                                onClick={() => onSelectDossier(dossier.id)}
                                className={`absolute ${blockBg} border text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20`}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  top: `${topVal}px`,
                                  height: `${GANTT_BLOCK_HEIGHT}px`
                                }}
                                title={`Réservation : ${dossier.id} (${dossier.vehiculeMarque} ${dossier.vehiculeModele})`}
                              >
                                <div className="flex items-center justify-between gap-1 overflow-hidden">
                                  <span className="truncate block leading-tight font-extrabold">{dossier.vehiculeModele}</span>
                                  <span className="px-1 py-0.2 text-[7px] rounded border border-current font-black whitespace-nowrap">
                                    RES
                                  </span>
                                </div>
                                <span className="truncate block text-[7px] opacity-90 leading-none font-bold">
                                  {dossier.vehiculeImmatriculation}
                                </span>
                                <span className="truncate block text-[7px] opacity-80 leading-none">
                                  {badgeText} ({s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}-{e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                                </span>
                              </div>
                            );
                          }
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
                bayCapacity = getCapacityHoursFromWindows(effWindows);
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
                  
                  {/* Non-working ranges shaded from configured windows */}
                  {closedGanttRanges.map((range, index) => (
                    <div
                      key={`${range.start}-${range.end}`}
                      data-testid={index === 0 ? "gantt-lunch-break-shading" : "gantt-closed-range-shading"}
                      className="absolute top-0 bottom-0 bg-slate-400/10 border-l border-r border-slate-200/60 z-10 flex items-center justify-center"
                      style={{
                        left: `${((range.start - ganttStartMinutes) / totalGanttMinutes) * 100}%`,
                        width: `${((range.end - range.start) / totalGanttMinutes) * 100}%`
                      }}
                    >
                      <span className="text-[8px] text-slate-500/70 font-black uppercase tracking-widest text-center block rotate-90 sm:rotate-0">
                        {range.label}
                      </span>
                    </div>
                  ))}

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
                    const segments = getRepairOrderPlanningSegmentsForDate(line, selectedDateStr);

                    return segments.map((seg, sIdx) => {
                      const s = new Date(seg.start);
                      const e = new Date(seg.end);
                      const { leftPct, widthPct } = getGanttBlockPosition(s, e);

                      const isPast = e.getTime() < now.getTime();
                      const visualState = getGanttTaskVisualState(line, now, dossier);
                      const statusVisual = GANTT_STATE_VISUALS[visualState];

                      return (
                        <div
                          key={`${line.id}-seg-${sIdx}`}
                          data-testid={`gantt-bay-block-${line.id}`}
                          data-segment-index={sIdx}
                          data-start={s.toISOString()}
                          data-end={e.toISOString()}
                          onClick={() => onSelectDossier(dossier.id)}
                          draggable={activeRole === UserRole.CHEF_ATELIER}
                          onDragStart={(event) => {
                            if (activeRole !== UserRole.CHEF_ATELIER) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingTask({ dossierId: dossier.id, lineId: line.id });
                          }}
                          className={`absolute top-1 bottom-1 ${statusVisual.className} border text-[9px] font-black rounded-lg shadow-xs px-2 py-1 cursor-pointer overflow-hidden transition select-none z-20 ${isPast ? "opacity-65" : ""}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele})`}
                        >
                          <div className="pointer-events-none flex items-center justify-between gap-1 overflow-hidden pr-9">
                            <span className="truncate block leading-tight font-extrabold">{dossier.id}</span>
                            <span
                              data-testid={statusVisual.testId}
                              className={`px-1 py-0.2 text-[7px] rounded border font-black whitespace-nowrap ${statusVisual.badgeClassName}`}
                            >
                              {statusVisual.label}
                            </span>
                          </div>
                          <span className="pointer-events-none truncate block text-[7px] opacity-80 leading-none pr-9">
                            {line.designation}
                            {(line.complaintBadge || line.sourceComplaintId) && (
                              <span data-testid={`gantt-bay-complaint-badge-${line.id}`} className="ml-1 rounded bg-red-600 px-1 py-0.2 text-white">REC</span>
                            )}
                          </span>
                          <div className="absolute bottom-1 right-1 z-40 flex gap-1">
                            {activeRole === UserRole.CHEF_ATELIER && (
                              <button
                                type="button"
                                data-testid={`gantt-bay-reschedule-${line.id}`}
                                aria-label="Modifier créneau"
                                title="Modifier créneau"
                                draggable={false}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRescheduleModal(dossier, line);
                                }}
                                className="relative z-40 flex h-4 w-4 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                              >
                                <Settings className="h-2.5 w-2.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              data-testid={`gantt-bay-task-sheet-${line.id}`}
                              aria-label="Fiche tâche technicien"
                              draggable={false}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePrintTaskSheet(dossier, line);
                              }}
                              className="relative z-40 flex h-4 w-4 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm hover:bg-white"
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
                      const { leftPct, widthPct } = getGanttBlockPosition(s, e);

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
                  {perm.canManageWorkshopAvailability(activeRole) && (
                    <button
                      type="button"
                      data-testid={`shift-profile-edit-${profile.id}`}
                      onClick={() => {
                        setEditingProfile(profile);
                        setEditShiftDraft(deriveShiftProfileDraft(profile));
                        setEditProfileError(null);
                      }}
                      className="mt-2 px-2 py-1 bg-white border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              ))}
            </div>

            {perm.canManageWorkshopAvailability(activeRole) && (
              <button
                type="button"
                data-testid="shift-profiles-reset-defaults"
                onClick={() => setShowShiftResetConfirm(true)}
                className="inline-flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                Réinitialiser les horaires par défaut
              </button>
            )}

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

      <ConfirmModal
        isOpen={showShiftResetConfirm}
        onClose={() => setShowShiftResetConfirm(false)}
        onConfirm={() => {
          onUpdateAvailabilityConfig?.({
            ...availabilityConfig,
            schedule: getDefaultWorkshopSchedule(),
            shiftProfiles: getDefaultWorkshopShiftProfiles(),
          });
          setShowShiftResetConfirm(false);
        }}
        title="Réinitialiser les horaires"
        message="Réinitialiser les horaires par défaut de l'atelier ?"
        confirmText="Réinitialiser"
        isDanger
      />

      {createPortal(
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
        </div>,
        document.body
      )}

      {/* Shift Profile Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-black text-slate-900">Modifier les horaires de l'équipe</h3>
              <button onClick={() => setEditingProfile(null)} className="min-h-12 min-w-12 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {editProfileError && (
                <div data-testid="shift-profile-edit-error" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-lg">
                  {editProfileError}
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Nom du profil</span>
                  <input
                    type="text"
                    data-testid="shift-profile-name-input"
                    value={editShiftDraft.name}
                    onChange={event => updateEditShiftDraft({ name: event.target.value })}
                    className="w-full min-h-12 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Heure début journée</span>
                  <input
                    type="time"
                    data-testid="shift-profile-day-start"
                    value={editShiftDraft.dayStart}
                    onChange={event => updateEditShiftDraft({ dayStart: event.target.value })}
                    className="w-full min-h-12 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-900"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Heure fin journée</span>
                  <input
                    type="time"
                    data-testid="shift-profile-day-end"
                    value={editShiftDraft.dayEnd}
                    onChange={event => updateEditShiftDraft({ dayEnd: event.target.value })}
                    className="w-full min-h-12 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-900"
                  />
                </label>

                <label className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 sm:col-span-2">
                  <span className="text-xs font-black uppercase text-slate-700">Pause activée</span>
                  <input
                    type="checkbox"
                    data-testid="shift-profile-pause-enabled"
                    checked={editShiftDraft.pauseEnabled}
                    onChange={event => updateEditShiftDraft({ pauseEnabled: event.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Heure début pause</span>
                  <input
                    type="time"
                    data-testid="shift-profile-pause-start"
                    value={editShiftDraft.pauseStart}
                    disabled={!editShiftDraft.pauseEnabled}
                    onChange={event => updateEditShiftDraft({ pauseStart: event.target.value })}
                    className="w-full min-h-12 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Heure fin pause</span>
                  <input
                    type="time"
                    data-testid="shift-profile-pause-end"
                    value={editShiftDraft.pauseEnd}
                    disabled={!editShiftDraft.pauseEnabled}
                    onChange={event => updateEditShiftDraft({ pauseEnd: event.target.value })}
                    className="w-full min-h-12 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase">Jours actifs lundi à samedi</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SHIFT_EDIT_DAYS.map(day => (
                    <label key={day.value} className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
                      <input
                        type="checkbox"
                        data-testid={`shift-profile-day-${day.value}`}
                        checked={editShiftDraft.activeDays.includes(day.value)}
                        onChange={() => toggleEditShiftDay(day.value)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>

              <div data-testid="shift-profile-capacity" className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs font-black uppercase text-indigo-800">
                Capacité journalière calculée : {editShiftCapacityLabel}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-between gap-3 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  setEditShiftDraft({
                    name: editingProfile.name,
                    dayStart: "08:00",
                    dayEnd: "17:00",
                    pauseEnabled: true,
                    pauseStart: "12:00",
                    pauseEnd: "13:00",
                    activeDays: [1, 2, 3, 4, 5],
                  });
                }}
                className="min-h-12 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
              >
                Réinitialiser horaires standards
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="shift-profile-edit-cancel"
                  onClick={() => setEditingProfile(null)}
                  className="min-h-12 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="shift-profile-edit-save"
                  onClick={handleSaveShiftProfile}
                  className="min-h-12 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Enregistrer modifications
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
