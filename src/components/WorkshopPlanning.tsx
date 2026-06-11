/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AtelierZone, TechnicienResource, DossierSAV, DossierStatus, WorkshopBay, RepairOrderLine } from "../types";
import { 
  normalizeRepairOrderStatus, 
  suggestWorkshopSlot, 
  WorkshopSlotSuggestion,
  isWorkingDay,
  getWorkingWindowsForDate,
  alignToWorkingTime,
  addWorkingMinutes,
  buildPlanningSegments,
  detectTechnicianCollision,
  detectBayCollision,
  calculateTechnicianDailyLoad
} from "../sav-core";
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
  Printer, 
  Save 
} from "lucide-react";
import { LicencePlate, StatusBadge } from "./UIParts";

interface WorkshopPlanningProps {
  techniciens: TechnicienResource[];
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
  onUpdateDossier: (updated: DossierSAV) => void;
}

const DEFAULT_WORKSHOP_BAYS: WorkshopBay[] = [
  { id: "bay_fast_01", name: "Pont rapide 1", zone: AtelierZone.MECANIQUE_RAPIDE },
  { id: "bay_mech_01", name: "Pont mécanique 1", zone: AtelierZone.GRANDS_TRAVAUX },
  { id: "bay_diag_01", name: "Pont diagnostic 1", zone: AtelierZone.ELECTRICITE_DIAG },
  { id: "bay_body_01", name: "Pont carrosserie 1", zone: AtelierZone.CARROSSERIE },
  { id: "bay_general_01", name: "Pont polyvalent" },
];

export default function WorkshopPlanning({ techniciens, dossiers, onSelectDossier, onUpdateDossier }: WorkshopPlanningProps) {
  const [filterZone, setFilterZone] = useState<string>("Toutes");
  const [filterBay, setFilterBay] = useState<string>("Toutes");
  
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Suggestion states
  const [suggestionTargetId, setSuggestionTargetId] = useState("");
  const [suggestion, setSuggestion] = useState<WorkshopSlotSuggestion | null>(null);
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

  // Sync manual select values
  const targetDossiers = dossiers.filter(dossier =>
    dossier.statut !== DossierStatus.LIVRE &&
    dossier.statut !== DossierStatus.CLOTURE &&
    dossier.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) !== "done")
  );

  const selectedTargetIdForSuggest = suggestionTargetId || targetDossiers[0]?.id || "";
  const selectedTargetForSuggest = targetDossiers.find(dossier => dossier.id === selectedTargetIdForSuggest);

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
  };

  const handleNextDay = () => {
    let next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0) { // Skip Sunday
      next.setDate(next.getDate() + 1);
    }
    setSelectedDate(next);
    setSuggestion(null);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setSuggestion(null);
  };

  // Suggest slot
  const handleSuggestSlot = () => {
    if (!selectedTargetForSuggest) {
      setSuggestionError("Aucun dossier actif disponible pour planification.");
      setSuggestion(null);
      return;
    }

    const estimatedHours = selectedTargetForSuggest.ordresReparation.reduce((total, line) => (
      normalizeRepairOrderStatus(line.status) === "done" ? total : total + line.tempsEstime
    ), 0) || 1;
    
    // Set suggestion target date to currently navigated planning date
    const targetDesiredDate = new Date(selectedDate);
    targetDesiredDate.setHours(8, 0, 0, 0);

    const res = suggestWorkshopSlot({
      dossiers,
      technicians: techniciens,
      workshopBays: DEFAULT_WORKSHOP_BAYS,
      estimatedHours,
      desiredDate: targetDesiredDate,
    });

    setSuggestion(res);
    setSuggestionError("");
  };

  // Apply suggestion
  const handleApplySuggestion = () => {
    if (!selectedTargetForSuggest || !suggestion) return;
    
    // Update all pending repair order lines with suggestion
    const start = new Date(suggestion.startTime);
    const end = new Date(suggestion.endTime);
    const segments = suggestion.segments.length > 0 ? suggestion.segments : buildPlanningSegments(start, end);
    const planningDate = getLocalDateStr(start);

    const updatedLines = selectedTargetForSuggest.ordresReparation.map(line => {
      if (normalizeRepairOrderStatus(line.status) !== "done") {
        return {
          ...line,
          planningStart: suggestion.startTime,
          planningEnd: suggestion.endTime,
          planningSegments: segments,
          plannedTechnicianId: suggestion.technicianId,
          plannedBayId: suggestion.bayId,
          planningDate: planningDate
        };
      }
      return line;
    });

    onUpdateDossier({
      ...selectedTargetForSuggest,
      ordresReparation: updatedLines,
      technicienId: suggestion.technicianId,
      workshopBayId: suggestion.bayId,
      datePlanningDebut: suggestion.startTime,
      datePlanningFin: suggestion.endTime,
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      dateDernierStatut: new Date().toISOString(),
      prochaineActionRecommended: `Planifiée sur ${suggestion.bayName} avec ${suggestion.technicianName} le ${new Date(suggestion.startTime).toLocaleDateString("fr-FR")} de ${new Date(suggestion.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(suggestion.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    });

    setSuggestion(null);
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
    
    const { start, end, estimatedHours } = getManualInterval();
    const warnings: string[] = [];

    // 1. Working hours check
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const limitMax = isSat ? 12 * 60 : 17 * 60;
    
    if (isClosedDay) {
      warnings.push("planning-collision-sunday");
    }

    if (isSat && startMin >= 12 * 60) {
      warnings.push("planning-collision-saturday-afternoon");
    }

    if (startMin < 8 * 60 || startMin >= limitMax || endMin > limitMax || getLocalDateStr(start) !== getLocalDateStr(end)) {
      warnings.push("planning-collision-hours");
    }

    // 2. Lunch break check
    if (!isSat && ((startMin >= 12 * 60 && startMin < 13 * 60) || (endMin > 12 * 60 && startMin < 13 * 60))) {
      warnings.push("planning-collision-lunch");
    }

    // 3. Technician collision
    if (detectTechnicianCollision(dossiers, manualTechId, start, end, manualTaskId)) {
      warnings.push("planning-collision-tech");
    }

    // 4. Bay collision
    if (detectBayCollision(dossiers, manualBayId, start, end, manualTaskId)) {
      warnings.push("planning-collision-bay");
    }

    // 5. Daily load overflow
    const maxCap = isSat ? 4 : 8;
    const currentDailyLoad = calculateTechnicianDailyLoad(manualTechId, selectedDateStr, dossiers);
    if (currentDailyLoad + estimatedHours > maxCap) {
      warnings.push("planning-collision-overload");
    }

    return warnings;
  };

  const manualWarnings = checkManualCollisions();

  const handleSaveManualPlanning = () => {
    if (!activeManualDossier || !manualTaskId || !manualTechId || !manualBayId) return;

    const { start, end } = getManualInterval();

    // Prevent saving if there are fatal off-hours or collision errors
    if (
      manualWarnings.includes("planning-collision-hours") ||
      manualWarnings.includes("planning-collision-sunday") ||
      manualWarnings.includes("planning-collision-saturday-afternoon")
    ) {
      alert("Erreur : Impossible de planifier en dehors des heures d'ouverture de l'atelier.");
      return;
    }

    const segments = buildPlanningSegments(start, end);
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

  const handlePrintGantt = () => {
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 1200);
    window.print();
  };

  const handlePrintTable = () => {
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 1200);
    window.print();
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

  // Find all tasks planned on the selected date
  const activePlannedLines: Array<{ dossier: DossierSAV; line: RepairOrderLine }> = [];
  dossiers.forEach(dossier => {
    if (dossier.statut !== DossierStatus.LIVRE && dossier.statut !== DossierStatus.CLOTURE) {
      dossier.ordresReparation.forEach(line => {
        if (line.planningDate === selectedDateStr && line.planningStart && line.planningEnd) {
          activePlannedLines.push({ dossier, line });
        }
      });
    }
  });

  return (
    <div className="space-y-6">
      
      {/* Title, Date selector & Print actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 font-display">
              <Calendar className="w-5 h-5 text-blue-600" />
              PLANNING & CHARGE DES TECHNICIENS (GANTT)
            </h2>
            <p className="text-gray-500 text-xs">Visualisation de la charge journalière et affectation des créneaux de travaux.</p>
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

            {/* Print buttons */}
            <button 
              onClick={handlePrintGantt}
              data-testid="planning-print-gantt"
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer Gantt
            </button>
            <button 
              onClick={handlePrintTable}
              data-testid="planning-print-table"
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer Tableau
            </button>
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
              }}
            />
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
              {isClosedDay ? "Dimanche fermé" : isSat ? "Samedi (08h00 - 12h00 uniquement)" : "Lundi-Vendredi (Ouvert 08h-12h / 13h-17h)"}
            </span>
          </div>
        </div>
      </div>

      {/* Auto suggest & manual form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Automatic Slot Suggestion */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 font-display">
            <Sparkles className="w-4.5 h-4.5 text-blue-600" />
            MOTEUR DE SUGGESTION DE PLANNING
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Véhicule à planifier :</label>
              <select
                data-testid="planning-suggest-dossier"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedTargetIdForSuggest}
                onChange={(e) => {
                  setSuggestionTargetId(e.target.value);
                  setSuggestion(null);
                  setSuggestionError("");
                }}
              >
                {targetDossiers.length === 0 ? (
                  <option value="">Aucun dossier en attente de planification</option>
                ) : (
                  targetDossiers.map(dossier => (
                    <option key={dossier.id} value={dossier.id}>
                      {dossier.id} - {dossier.vehiculeMarque} {dossier.vehiculeModele} ({dossier.clientNom})
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={handleSuggestSlot}
              disabled={targetDossiers.length === 0}
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

          {suggestion && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-xs">
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Technicien proposé</span>
                  <strong data-testid="planning-suggest-tech" className="text-gray-800 text-sm font-black">{suggestion.technicianName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Pont proposé</span>
                  <strong data-testid="planning-suggest-bay" className="text-gray-800 text-sm font-black">{suggestion.bayName}</strong>
                </div>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Horaires de début / fin</span>
                  <strong data-testid="planning-suggest-start" className="text-gray-800 font-bold block">
                    Début : {new Date(suggestion.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                  <strong data-testid="planning-suggest-end" className="text-gray-800 font-bold block">
                    Fin : {new Date(suggestion.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                </div>
                <div className="pt-2 border-t border-blue-100/60">
                  <p className="text-blue-800 font-semibold leading-normal">{suggestion.reason}</p>
                </div>
              </div>
              <button
                onClick={handleApplySuggestion}
                data-testid="planning-suggest-apply"
                className="sm:col-span-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Check className="w-4 h-4" />
                Appliquer la suggestion automatique
              </button>
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
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Manual Assignment Collisions warnings */}
          {manualWarnings.length > 0 && (
            <div className="space-y-1.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
              <span className="text-[10px] text-red-800 font-extrabold block uppercase tracking-wider">
                Alerte de collision détectée :
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
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Filters bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500">Filtres du Gantt :</span>
        </div>

        <div className="flex flex-wrap gap-3">
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
                const dailyLoad = calculateTechnicianDailyLoad(tech.id, selectedDateStr, dossiers);
                const maxCap = isClosedDay ? 0 : isSat ? 4 : 8;
                const chargePercent = Math.min(100, Math.round((dailyLoad / maxCap) * 100));
                const isOverloaded = dailyLoad > maxCap;

                // Determine availability status
                const activeDossier = dossiers.find(d => 
                  d.technicienId === tech.id && 
                  d.ordresReparation.some(l => normalizeRepairOrderStatus(l.status) === "in_progress")
                );
                
                const blockedDossier = dossiers.find(d => 
                  d.technicienId === tech.id && 
                  d.statut === DossierStatus.BLOQUE
                );

                let statusLabel = "Disponible";
                let statusColor = "bg-green-500 text-white";
                
                if (tech.disponibilite === "absent") {
                  statusLabel = "Absent";
                  statusColor = "bg-red-500 text-white";
                } else if (tech.disponibilite === "formation") {
                  statusLabel = "Formation";
                  statusColor = "bg-blue-500 text-white";
                } else {
                  // Check lunch hour
                  const currentHour = new Date().getHours();
                  const isLunch = !isSat && currentHour >= 12 && currentHour < 13;
                  
                  if (isLunch) {
                    statusLabel = "En pause";
                    statusColor = "bg-amber-500 text-white";
                  } else if (blockedDossier) {
                    statusLabel = "Tâche bloquée";
                    statusColor = "bg-red-600 text-white";
                  } else if (activeDossier) {
                    statusLabel = "Occupé";
                    statusColor = "bg-orange-500 text-white";
                  }
                }

                return (
                  <div key={tech.id} data-testid={`tech-row-${tech.id}`} className="grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 p-1.5 rounded-xl transition">
                    {/* Left: tech profile */}
                    <div className="col-span-3 space-y-1 pl-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span data-testid={`tech-name-${tech.id}`} className="font-extrabold text-gray-900 text-xs">{tech.nom}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                        {tech.zoneAffectee} • {tech.specialite}
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-0.5">
                        <span>Charge : <strong className="text-gray-700">{dailyLoad}H</strong></span>
                        <span data-testid={`tech-charge-${tech.id}`} className={`font-mono font-bold ${isOverloaded ? "text-red-500 font-black" : ""}`}>
                          {chargePercent}%{isOverloaded && " (Surcharge)"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Gantt timeline bar row */}
                    <div className="col-span-9 relative h-10 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner">
                      
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

                      {/* Display task blocks on this row */}
                      {techPlannedLines.map(({ dossier, line }) => {
                        const segments = line.planningSegments && line.planningSegments.length > 0
                          ? line.planningSegments
                          : [{ start: line.planningStart!, end: line.planningEnd! }];

                        return segments.map((seg, sIdx) => {
                          const s = new Date(seg.start);
                          const e = new Date(seg.end);
                          const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                          const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                          const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                          const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                          let blockBg = "bg-blue-500 hover:bg-blue-600 border-blue-600";
                          if (line.status === "done") {
                            blockBg = "bg-green-500 hover:bg-green-600 border-green-600";
                          } else if (line.status === "blocked" || dossier.statut === DossierStatus.BLOQUE) {
                            blockBg = "bg-red-500 hover:bg-red-600 border-red-600";
                          }

                          return (
                            <div
                              key={`${line.id}-seg-${sIdx}`}
                              data-testid={`gantt-block-${line.id}`}
                              data-segment-index={sIdx}
                              data-start={s.toISOString()}
                              data-end={e.toISOString()}
                              onClick={() => onSelectDossier(dossier.id)}
                              className={`absolute top-1 bottom-1 ${blockBg} border text-white text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`
                              }}
                              title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele}) ${dossier.vehiculeImmatriculation}`}
                            >
                              <span className="truncate block leading-tight">{dossier.vehiculeModele}</span>
                              <span className="truncate block text-[7px] opacity-90 leading-none">{dossier.vehiculeImmatriculation}</span>
                              <span className="truncate block text-[7px] opacity-80 leading-none">
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
            // Find all tasks planned today on this bay
            const bayPlannedLines = activePlannedLines.filter(item => item.line.plannedBayId === bay.id);
            const isOccupied = bayPlannedLines.length > 0;

            return (
              <div key={bay.id} className="grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 p-1.5 rounded-xl transition">
                {/* Left: bay info */}
                <div className="col-span-3 space-y-1 pl-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-gray-900 text-xs">{bay.name}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase ${
                      isOccupied ? "bg-orange-500 text-white" : "bg-green-500 text-white"
                    }`}>
                      {isOccupied ? "Occupé" : "Libre"}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">
                    {bay.zone || "Zone Polyvalente"}
                  </span>
                </div>

                {/* Right: Gantt timeline bar row */}
                <div className="col-span-9 relative h-10 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner">
                  
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

                  {/* Display task blocks on this row */}
                  {bayPlannedLines.map(({ dossier, line }) => {
                    const segments = line.planningSegments && line.planningSegments.length > 0
                      ? line.planningSegments
                      : [{ start: line.planningStart!, end: line.planningEnd! }];

                    return segments.map((seg, sIdx) => {
                      const s = new Date(seg.start);
                      const e = new Date(seg.end);
                      const startMin = (s.getHours() - 8) * 60 + s.getMinutes();
                      const durMin = Math.round((e.getTime() - s.getTime()) / 60000);

                      const leftPct = Math.max(0, Math.min(100, (startMin / totalGanttMinutes) * 100));
                      const widthPct = Math.max(2, Math.min(100 - leftPct, (durMin / totalGanttMinutes) * 100));

                      let blockBg = "bg-blue-500 hover:bg-blue-600 border-blue-600";
                      if (line.status === "done") {
                        blockBg = "bg-green-500 hover:bg-green-600 border-green-600";
                      } else if (line.status === "blocked" || dossier.statut === DossierStatus.BLOQUE) {
                        blockBg = "bg-red-500 hover:bg-red-600 border-red-600";
                      }

                      return (
                        <div
                          key={`${line.id}-seg-${sIdx}`}
                          data-testid={`gantt-bay-block-${line.id}`}
                          data-segment-index={sIdx}
                          data-start={s.toISOString()}
                          data-end={e.toISOString()}
                          onClick={() => onSelectDossier(dossier.id)}
                          className={`absolute top-1 bottom-1 ${blockBg} border text-white text-[9px] font-black rounded-lg shadow-xs flex flex-col justify-center px-2 cursor-pointer overflow-hidden transition select-none z-20`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          title={`${dossier.id} - ${line.designation} (${dossier.vehiculeMarque} ${dossier.vehiculeModele})`}
                        >
                          <span className="truncate block leading-tight">{dossier.id}</span>
                          <span className="truncate block text-[7px] opacity-80 leading-none">{line.designation}</span>
                        </div>
                      );
                    });
                  })}

                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}
