/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { canDeliverDossier, normalizeRepairOrderStatus } from "./sav-core";
import { DossierPriority, DossierSAV, DossierStatus, RepairOrderLine, TechnicienResource, WorkshopReservation, WorkshopAvailabilityConfig } from "./types";
import { isWorkshopClosed, isTechnicianAbsent, isBayUnavailable } from "./workshop-availability";

export type DashboardPeriod = "today" | "week" | "month" | "all";

export interface DashboardKpiFilters {
  period?: DashboardPeriod;
  status?: DossierStatus | "all";
  technicianId?: string | "all";
  priority?: DossierPriority | "all";
  now?: Date;
}

export interface DirectorDashboardKpiInput {
  dossiers: DossierSAV[];
  techniciens: TechnicienResource[];
  reservations?: WorkshopReservation[];
  availabilityConfig?: WorkshopAvailabilityConfig;
  filters?: DashboardKpiFilters;
}

export type DashboardTone = "slate" | "blue" | "cyan" | "emerald" | "amber" | "rose" | "violet";

export interface DashboardMetric {
  label: string;
  value: number | string;
  detail: string;
  tone: DashboardTone;
  testId: string;
}

export interface DashboardDelayMetric {
  label: string;
  value: string;
  measurableCount: number;
  totalCount: number;
  averageMs: number | null;
}

export interface DashboardLoadItem {
  id: string;
  label: string;
  hours: number;
  capacityHours: number | null;
  percent: number | null;
  alert: boolean;
}

export interface DashboardTaskRef {
  dossierId: string;
  lineId: string;
  label: string;
  status: string;
  technicianId?: string;
  bayId?: string;
  planningEnd?: string;
}

export interface DashboardAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  dossierId?: string;
}

export interface DashboardCriticalDossier {
  id: string;
  client: string;
  vehicle: string;
  status: DossierStatus;
  priority: DossierPriority;
  reason: string;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface DirectorDashboardKpis {
  filters: Required<Omit<DashboardKpiFilters, "now">> & { now: string };
  filteredDossiers: DossierSAV[];
  activity: {
    openDossiers: number;
    inProgressDossiers: number;
    blockedDossiers: number;
    readyToDeliverDossiers: number;
    deliveredDossiers: number;
    readyForErpDossiers: number;
    pendingErpClosureDossiers: number;
    cards: DashboardMetric[];
  };
  workshop: {
    occupancyRate: number | null;
    occupancyLabel: string;
    plannedLoadRate: number | null;
    plannedLoadLabel: string;
    reservedLoadRate: number | null;
    reservedLoadLabel: string;
    inProgressLoadRate: number | null;
    inProgressLoadLabel: string;
    technicianLoad: DashboardLoadItem[];
    bayLoad: DashboardLoadItem[];
    estimatedHours: number;
    spentHours: number;
    lateTasks: DashboardTaskRef[];
    blockedTasks: DashboardTaskRef[];
    planningSaturated: boolean;
    detailsCalcul?: {
      totalCapacity: number;
      plannedHours: number;
      reservedHours: number;
      inProgressHours: number;
      usedCapacityHours: number;
    };
  };
  delays: DashboardDelayMetric[];
  quality: {
    qcAccepted: number;
    qcRefused: number;
    qcPending: number;
    returnedToWorkshop: number;
    firstTimeRightCount: number;
    firstTimeRightRate: number | null;
    firstTimeRightLabel: string;
    refusalReasons: Array<{ reason: string; count: number }>;
  };
  alerts: DashboardAlert[];
  criticalDossiers: DashboardCriticalDossier[];
  charts: {
    entriesExits: DashboardChartPoint[];
    blocked: DashboardChartPoint[];
    workshopLoad: DashboardChartPoint[];
    quality: DashboardChartPoint[];
    weeklyTrend: DashboardChartPoint[];
  };
}

type DateRange = { start: Date; end: Date } | null;
type DossierTiming = {
  reception: Date | null;
  workStart: Date | null;
  workEnd: Date | null;
  qc: Date | null;
  delivery: Date | null;
};

const NON_MEASURABLE = "Non mesurable";
const POST_DELIVERY_STATUSES = new Set([DossierStatus.LIVRE, DossierStatus.PRET_FACTURATION, DossierStatus.CLOTURE]);
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+-\s+/;

export function buildDirectorDashboardKpis(input: DirectorDashboardKpiInput): DirectorDashboardKpis {
  const now = input.filters?.now ?? new Date();
  const filters = {
    period: input.filters?.period ?? "all",
    status: input.filters?.status ?? "all",
    technicianId: input.filters?.technicianId ?? "all",
    priority: input.filters?.priority ?? "all",
  } satisfies Required<Omit<DashboardKpiFilters, "now">>;
  const range = getPeriodRange(filters.period, now);
  const filteredDossiers = input.dossiers.filter(dossier => matchesFilters(dossier, filters, range));

  const openDossiers = filteredDossiers.filter(isOpenDossier).length;
  const inProgressDossiers = filteredDossiers.filter(isInProgressDossier).length;
  const blockedDossiers = filteredDossiers.filter(isBlockedDossier).length;
  const readyToDeliverDossiers = filteredDossiers.filter(isReadyToDeliverDossier).length;
  const deliveredDossiers = filteredDossiers.filter(dossier => dossier.statut === DossierStatus.LIVRE).length;
  const readyForErpDossiers = filteredDossiers.filter(dossier => dossier.statut === DossierStatus.PRET_FACTURATION).length;
  const pendingErpClosureDossiers = filteredDossiers.filter(dossier => (
    dossier.statut === DossierStatus.LIVRE && dossier.livraison.clotureInterne === true
  )).length;

  const workshop = buildWorkshopKpis(filteredDossiers, input.techniciens, range, now, input.reservations, input.availabilityConfig);
  const quality = buildQualityKpis(filteredDossiers);
  const alerts = buildAlerts(filteredDossiers, input.techniciens, workshop, now);

  return {
    filters: { ...filters, now: now.toISOString() },
    filteredDossiers,
    activity: {
      openDossiers,
      inProgressDossiers,
      blockedDossiers,
      readyToDeliverDossiers,
      deliveredDossiers,
      readyForErpDossiers,
      pendingErpClosureDossiers,
      cards: [
        {
          label: "Dossiers ouverts",
          value: openDossiers,
          detail: "Non livrés et encore pilotables SAV",
          tone: "blue",
          testId: "kpi-open-dossiers",
        },
        {
          label: "Dossiers en cours",
          value: inProgressDossiers,
          detail: "Statut travaux ou tâche active",
          tone: "cyan",
          testId: "kpi-in-progress-dossiers",
        },
        {
          label: "Dossiers bloqués",
          value: blockedDossiers,
          detail: "Blocage dossier ou tâche bloquée",
          tone: "rose",
          testId: "kpi-blocked-dossiers",
        },
        {
          label: "Prêts à livrer",
          value: readyToDeliverDossiers,
          detail: "QC accepté et contrôle livraison autorisé",
          tone: "emerald",
          testId: "kpi-ready-delivery",
        },
        {
          label: "Dossiers livrés",
          value: deliveredDossiers,
          detail: "Livraison client confirmée",
          tone: "slate",
          testId: "kpi-delivered",
        },
        {
          label: "Prêt facturation ERP",
          value: readyForErpDossiers,
          detail: "Dossier livré, clôture SAV prête",
          tone: "violet",
          testId: "kpi-ready-erp",
        },
        {
          label: "En attente clôture ERP",
          value: pendingErpClosureDossiers,
          detail: "Livrés à finaliser",
          tone: "amber",
          testId: "kpi-pending-erp",
        },
      ],
    },
    workshop,
    delays: [
      buildDelayMetric("Réception → début travaux", filteredDossiers, timing => [timing.reception, timing.workStart]),
      buildDelayMetric("Début travaux → fin travaux", filteredDossiers, timing => [timing.workStart, timing.workEnd]),
      buildDelayMetric("Fin travaux → QC", filteredDossiers, timing => [timing.workEnd, timing.qc]),
      buildDelayMetric("QC → livraison", filteredDossiers, timing => [timing.qc, timing.delivery]),
      buildDelayMetric("Cycle complet dossier", filteredDossiers, timing => [timing.reception, timing.delivery]),
    ],
    quality,
    alerts,
    criticalDossiers: buildCriticalDossiers(filteredDossiers, alerts),
    charts: {
      entriesExits: buildEntriesExitsChart(filteredDossiers, range, now),
      blocked: [
        { label: "Bloqués", value: blockedDossiers },
        { label: "Ouverts", value: openDossiers },
      ],
      workshopLoad: workshop.technicianLoad.slice(0, 6).map(item => ({
        label: shortLabel(item.label),
        value: Math.round(item.hours * 10) / 10,
        secondaryValue: item.capacityHours ?? undefined,
      })),
      quality: [
        { label: "QC OK", value: quality.qcAccepted },
        { label: "QC refusé", value: quality.qcRefused },
      ],
      weeklyTrend: buildWeeklyTrendChart(filteredDossiers, now),
    },
  };
}

function matchesFilters(
  dossier: DossierSAV,
  filters: Required<Omit<DashboardKpiFilters, "now">>,
  range: DateRange
): boolean {
  if (filters.status !== "all" && dossier.statut !== filters.status) return false;
  if (filters.priority !== "all" && dossier.priorite !== filters.priority) return false;
  if (filters.technicianId !== "all" && !isLinkedToTechnician(dossier, filters.technicianId)) return false;
  if (!range) return true;

  const receptionDate = parseDate(dossier.dateReception);
  return Boolean(receptionDate && receptionDate.getTime() >= range.start.getTime() && receptionDate.getTime() < range.end.getTime());
}

function isLinkedToTechnician(dossier: DossierSAV, technicianId: string): boolean {
  return dossier.technicienId === technicianId || dossier.ordresReparation.some(line => line.plannedTechnicianId === technicianId);
}

function isOpenDossier(dossier: DossierSAV): boolean {
  return !POST_DELIVERY_STATUSES.has(dossier.statut);
}

function isInProgressDossier(dossier: DossierSAV): boolean {
  return dossier.statut === DossierStatus.EN_TRAVAUX || dossier.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) === "in_progress");
}

function isBlockedDossier(dossier: DossierSAV): boolean {
  return dossier.statut === DossierStatus.BLOQUE || dossier.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) === "blocked");
}

function isReadyToDeliverDossier(dossier: DossierSAV): boolean {
  return dossier.checklistQC.validationGlobale === "valide" && canDeliverDossier(dossier).allowed;
}

function buildWorkshopKpis(
  dossiers: DossierSAV[],
  techniciens: TechnicienResource[],
  range: DateRange,
  now: Date,
  reservations?: WorkshopReservation[],
  availabilityConfig?: WorkshopAvailabilityConfig
): DirectorDashboardKpis["workshop"] {
  const estimatedHours = sum(dossiers.flatMap(dossier => dossier.ordresReparation.map(line => line.tempsEstime)));
  const spentHours = sum(dossiers.flatMap(dossier => dossier.ordresReparation.map(line => line.tempsPasse)));
  const technicianHours = new Map<string, number>();
  const bayHours = new Map<string, number>();
  const lateTasks: DashboardTaskRef[] = [];
  const blockedTasks: DashboardTaskRef[] = [];

  for (const dossier of dossiers) {
    for (const line of dossier.ordresReparation) {
      const status = normalizeRepairOrderStatus(line.status);
      const hours = getPlannedHours(line, range);
      if (line.plannedTechnicianId) {
        technicianHours.set(line.plannedTechnicianId, (technicianHours.get(line.plannedTechnicianId) ?? 0) + hours);
      }
      if (line.plannedBayId) {
        bayHours.set(line.plannedBayId, (bayHours.get(line.plannedBayId) ?? 0) + hours);
      }

      const planningEnd = parseDate(line.planningEnd);
      if (planningEnd && planningEnd.getTime() < now.getTime() && status !== "done") {
        lateTasks.push(toTaskRef(dossier, line));
      }
      if (status === "blocked") {
        blockedTasks.push(toTaskRef(dossier, line));
      }
    }
  }

  const technicianLoad = techniciens.map(technician => {
    const hours = roundHours(technicianHours.get(technician.id) ?? 0);
    const capacityHours = calculateTechEffectiveCapacity(technician.id, technician.capaciteJournaliere, range, dossiers, availabilityConfig);
    const percent = capacityHours > 0 ? Math.round((hours / capacityHours) * 100) : null;
    return {
      id: technician.id,
      label: technician.nom,
      hours,
      capacityHours,
      percent,
      alert: percent !== null && percent > 100,
    };
  });

  for (const [techId, hours] of technicianHours) {
    if (!techniciens.some(technician => technician.id === techId)) {
      technicianLoad.push({
        id: techId,
        label: `Technicien ${techId}`,
        hours: roundHours(hours),
        capacityHours: null,
        percent: null,
        alert: false,
      });
    }
  }

  const bayLoad = Array.from(bayHours.entries()).map(([bayId, hours]) => {
    const capacityHours = calculateBayEffectiveCapacity(bayId, range, dossiers, availabilityConfig);
    const roundedHours = roundHours(hours);
    const percent = capacityHours > 0 ? Math.round((roundedHours / capacityHours) * 100) : null;
    return {
      id: bayId,
      label: `Pont / poste ${bayId}`,
      hours: roundedHours,
      capacityHours,
      percent,
      alert: percent !== null && percent > 100,
    };
  });

  // Calculate Capacity
  const totalCapacity = calculateEffectiveCapacity(techniciens, range, dossiers, availabilityConfig);
  
  // 1. Planned Load
  const plannedHours = sum(Array.from(technicianHours.values()));
  const plannedLoadRate = totalCapacity > 0 
    ? (plannedHours > 0 ? Math.max(1, Math.round((plannedHours / totalCapacity) * 100)) : 0) 
    : null;
  const plannedLoadLabel = plannedLoadRate === null ? NON_MEASURABLE : `${plannedLoadRate}%`;

  // 2. Reserved Load
  let reservedHours = 0;
  if (reservations) {
    const activeRes = reservations.filter(res => 
      res.status === "RESERVATION_CONFIRMEE" || 
      res.status === "AFFECTEE_ATELIER"
    );
    const filteredRes = activeRes.filter(res => {
      if (!range) return true;
      const rDate = parseDate(`${res.desiredDate}T12:00:00.000Z`);
      return Boolean(rDate && rDate.getTime() >= range.start.getTime() && rDate.getTime() < range.end.getTime());
    });
    reservedHours = sum(filteredRes.map(res => res.totalHours));
  }
  const reservedLoadRate = totalCapacity > 0 
    ? (reservedHours > 0 ? Math.max(1, Math.round((reservedHours / totalCapacity) * 100)) : 0) 
    : null;
  const reservedLoadLabel = reservedLoadRate === null ? NON_MEASURABLE : `${reservedLoadRate}%`;

  // 3. In Progress tasks with no Gantt segments
  let inProgressNoPlanningHours = 0;
  for (const dossier of dossiers) {
    for (const line of dossier.ordresReparation) {
      if (normalizeRepairOrderStatus(line.status) === "in_progress") {
        const segments = getPlanningSegments(line);
        if (segments.length === 0) {
          inProgressNoPlanningHours += line.tempsEstime;
        }
      }
    }
  }
  const inProgressLoadRate = totalCapacity > 0
    ? (inProgressNoPlanningHours > 0 ? Math.max(1, Math.round((inProgressNoPlanningHours / totalCapacity) * 100)) : 0)
    : null;
  const inProgressLoadLabel = inProgressLoadRate === null ? NON_MEASURABLE : `${inProgressLoadRate}%`;

  // 4. Combined Occupancy
  const usedCapacityHours = plannedHours + reservedHours + inProgressNoPlanningHours;
  let occupancyRate: number | null = null;
  let occupancyLabel = NON_MEASURABLE;

  if (totalCapacity > 0) {
    occupancyRate = usedCapacityHours > 0 ? Math.max(1, Math.round((usedCapacityHours / totalCapacity) * 100)) : 0;
    occupancyLabel = `${occupancyRate}%`;
  } else if (usedCapacityHours > 0) {
    occupancyLabel = "Charge hors capacité";
  }

  return {
    occupancyRate,
    occupancyLabel,
    plannedLoadRate,
    plannedLoadLabel,
    reservedLoadRate,
    reservedLoadLabel,
    inProgressLoadRate,
    inProgressLoadLabel,
    technicianLoad: technicianLoad.sort((left, right) => right.hours - left.hours),
    bayLoad: bayLoad.sort((left, right) => right.hours - left.hours),
    estimatedHours: roundHours(estimatedHours),
    spentHours: roundHours(spentHours),
    lateTasks,
    blockedTasks,
    planningSaturated: technicianLoad.some(item => item.alert) || bayLoad.some(item => item.alert),
    detailsCalcul: {
      totalCapacity,
      plannedHours,
      reservedHours,
      inProgressHours: inProgressNoPlanningHours,
      usedCapacityHours
    }
  };
}

function calculateEffectiveCapacity(
  techniciens: TechnicienResource[],
  range: DateRange,
  dossiers: DossierSAV[],
  availabilityConfig?: WorkshopAvailabilityConfig
): number {
  const defaultCapacity = () => {
    const workdayCount = getCapacityDayCount(dossiers, range);
    return techniciens.reduce((total, t) => total + t.capaciteJournaliere * workdayCount, 0);
  };

  if (!availabilityConfig) {
    return defaultCapacity();
  }

  const days: Date[] = [];
  if (range) {
    const cursor = new Date(range.start);
    while (cursor.getTime() < range.end.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const dateKeys = new Set<string>();
    for (const dossier of dossiers) {
      for (const line of dossier.ordresReparation) {
        for (const segment of getPlanningSegments(line)) {
          const start = parseDate(segment.start);
          if (start) dateKeys.add(start.toISOString().slice(0, 10));
        }
      }
    }
    for (const dateKey of dateKeys) {
      const d = parseDate(`${dateKey}T10:00:00.000Z`);
      if (d) days.push(d);
    }
  }

  if (days.length === 0) {
    return defaultCapacity();
  }

  let capacitySum = 0;
  for (const day of days) {
    if (isWorkshopClosed(day, availabilityConfig)) {
      continue;
    }
    const isSat = day.getDay() === 6;
    const isSun = day.getDay() === 0;
    if (isSun) continue;

    for (const tech of techniciens) {
      if (isTechnicianAbsent(tech.id, day, availabilityConfig)) {
        continue;
      }
      let dayCap = tech.capaciteJournaliere;
      if (isSat) {
        dayCap = Math.max(0, dayCap / 2);
      }
      capacitySum += dayCap;
    }
  }

  return capacitySum;
}

function calculateTechEffectiveCapacity(
  techId: string,
  techDailyCap: number,
  range: DateRange,
  dossiers: DossierSAV[],
  availabilityConfig?: WorkshopAvailabilityConfig
): number {
  if (!availabilityConfig) {
    const workdayCount = getCapacityDayCount(dossiers, range);
    return techDailyCap * workdayCount;
  }
  const days: Date[] = [];
  if (range) {
    const cursor = new Date(range.start);
    while (cursor.getTime() < range.end.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const dateKeys = new Set<string>();
    for (const dossier of dossiers) {
      for (const line of dossier.ordresReparation) {
        for (const segment of getPlanningSegments(line)) {
          const start = parseDate(segment.start);
          if (start) dateKeys.add(start.toISOString().slice(0, 10));
        }
      }
    }
    for (const dateKey of dateKeys) {
      const d = parseDate(`${dateKey}T10:00:00.000Z`);
      if (d) days.push(d);
    }
  }
  let capacitySum = 0;
  for (const day of days) {
    if (isWorkshopClosed(day, availabilityConfig)) continue;
    if (day.getDay() === 0) continue;
    if (isTechnicianAbsent(techId, day, availabilityConfig)) continue;
    let dayCap = techDailyCap;
    if (day.getDay() === 6) dayCap = Math.max(0, dayCap / 2);
    capacitySum += dayCap;
  }
  return capacitySum;
}

function calculateBayEffectiveCapacity(
  bayId: string,
  range: DateRange,
  dossiers: DossierSAV[],
  availabilityConfig?: WorkshopAvailabilityConfig
): number {
  if (!availabilityConfig) {
    const workdayCount = getCapacityDayCount(dossiers, range);
    return 8 * workdayCount;
  }
  const days: Date[] = [];
  if (range) {
    const cursor = new Date(range.start);
    while (cursor.getTime() < range.end.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const dateKeys = new Set<string>();
    for (const dossier of dossiers) {
      for (const line of dossier.ordresReparation) {
        for (const segment of getPlanningSegments(line)) {
          const start = parseDate(segment.start);
          if (start) dateKeys.add(start.toISOString().slice(0, 10));
        }
      }
    }
    for (const dateKey of dateKeys) {
      const d = parseDate(`${dateKey}T10:00:00.000Z`);
      if (d) days.push(d);
    }
  }
  let capacitySum = 0;
  for (const day of days) {
    if (isWorkshopClosed(day, availabilityConfig)) continue;
    if (day.getDay() === 0) continue;
    if (isBayUnavailable(bayId, day, availabilityConfig)) continue;
    let dayCap = 8;
    if (day.getDay() === 6) dayCap = 4;
    capacitySum += dayCap;
  }
  return capacitySum;
}

function buildQualityKpis(dossiers: DossierSAV[]): DirectorDashboardKpis["quality"] {
  const qcAccepted = dossiers.filter(dossier => dossier.checklistQC.validationGlobale === "valide").length;
  const qcRefused = dossiers.filter(dossier => dossier.checklistQC.validationGlobale === "refuse").length;
  const qcPending = dossiers.filter(dossier => dossier.checklistQC.validationGlobale === "en_attente").length;
  const acceptedFirstTime = dossiers.filter(dossier => dossier.checklistQC.validationGlobale === "valide" && !hasQualityRefusalTrace(dossier)).length;
  const denominator = qcAccepted + qcRefused;
  const firstTimeRightRate = denominator > 0 ? Math.round((acceptedFirstTime / denominator) * 100) : null;

  return {
    qcAccepted,
    qcRefused,
    qcPending,
    returnedToWorkshop: qcRefused,
    firstTimeRightCount: acceptedFirstTime,
    firstTimeRightRate,
    firstTimeRightLabel: firstTimeRightRate === null ? NON_MEASURABLE : `${firstTimeRightRate}%`,
    refusalReasons: countRefusalReasons(dossiers),
  };
}

function buildAlerts(
  dossiers: DossierSAV[],
  techniciens: TechnicienResource[],
  workshop: DirectorDashboardKpis["workshop"],
  now: Date
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const dossier of dossiers) {
    if (isBlockedDossier(dossier)) {
      alerts.push({
        id: `blocked-${dossier.id}`,
        severity: "critical",
        title: "Dossier bloqué critique",
        detail: `${dossier.id} nécessite une décision atelier${dossier.bloqueRaison ? `: ${dossier.bloqueRaison}` : "."}`,
        dossierId: dossier.id,
      });
    }

    if (isReadyToDeliverDossier(dossier)) {
      alerts.push({
        id: `ready-delivery-${dossier.id}`,
        severity: "warning",
        title: "Prêt à livrer non livré",
        detail: `${dossier.id} peut être remis au client.`,
        dossierId: dossier.id,
      });
    }

    if (dossier.checklistQC.validationGlobale === "refuse" && dossier.statut === DossierStatus.PRET_A_LIVRER) {
      alerts.push({
        id: `qc-status-${dossier.id}`,
        severity: "critical",
        title: "Statut incohérent après QC",
        detail: `${dossier.id} ne doit pas rester prêt à livrer avec QC refusé.`,
        dossierId: dossier.id,
      });
    }

    if (POST_DELIVERY_STATUSES.has(dossier.statut) && dossier.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) !== "done")) {
      alerts.push({
        id: `delivered-active-${dossier.id}`,
        severity: "critical",
        title: "Livraison incohérente",
        detail: `${dossier.id} est livré avec une tâche non terminée.`,
        dossierId: dossier.id,
      });
    }

    for (const line of dossier.ordresReparation) {
      const status = normalizeRepairOrderStatus(line.status);
      if (status === "in_progress" && !(line.plannedTechnicianId || dossier.technicienId)) {
        alerts.push({
          id: `active-no-tech-${dossier.id}-${line.id}`,
          severity: "critical",
          title: "Tâche active anormale",
          detail: `${dossier.id} a une tâche active sans technicien identifié.`,
          dossierId: dossier.id,
        });
      }
      const planningEnd = parseDate(line.planningEnd);
      if (planningEnd && planningEnd.getTime() < now.getTime() && status !== "done") {
        alerts.push({
          id: `late-${dossier.id}-${line.id}`,
          severity: "warning",
          title: "Dossier en retard planning",
          detail: `${dossier.id} dépasse son créneau atelier.`,
          dossierId: dossier.id,
        });
      }
    }
  }

  for (const load of workshop.technicianLoad.filter(item => item.alert)) {
    const technician = techniciens.find(item => item.id === load.id);
    alerts.push({
      id: `overload-${load.id}`,
      severity: "warning",
      title: "Technicien surchargé",
      detail: `${technician?.nom ?? load.label} dépasse sa capacité planifiée.`,
    });
  }

  for (const load of workshop.bayLoad.filter(item => item.alert)) {
    alerts.push({
      id: `bay-saturated-${load.id}`,
      severity: "warning",
      title: "Pont saturé",
      detail: `${load.label} dépasse sa capacité de planning.`,
    });
  }

  return alerts;
}

function buildCriticalDossiers(dossiers: DossierSAV[], alerts: DashboardAlert[]): DashboardCriticalDossier[] {
  const reasonsByDossier = new Map<string, string>();
  for (const alert of alerts) {
    if (alert.dossierId && !reasonsByDossier.has(alert.dossierId)) {
      reasonsByDossier.set(alert.dossierId, alert.title);
    }
  }

  return dossiers
    .filter(dossier => reasonsByDossier.has(dossier.id))
    .map(dossier => ({
      id: dossier.id,
      client: dossier.clientNom,
      vehicle: `${dossier.vehiculeMarque} ${dossier.vehiculeModele}`,
      status: dossier.statut,
      priority: dossier.priorite,
      reason: reasonsByDossier.get(dossier.id) ?? "À surveiller",
    }))
    .slice(0, 8);
}

function buildDelayMetric(
  label: string,
  dossiers: DossierSAV[],
  selector: (timing: DossierTiming) => [Date | null, Date | null]
): DashboardDelayMetric {
  const durations = dossiers
    .map(dossier => selector(extractDossierTiming(dossier)))
    .map(([start, end]) => start && end && end.getTime() >= start.getTime() ? end.getTime() - start.getTime() : null)
    .filter((duration): duration is number => typeof duration === "number");
  if (durations.length === 0) {
    return { label, value: NON_MEASURABLE, measurableCount: 0, totalCount: dossiers.length, averageMs: null };
  }

  const averageMs = Math.round(sum(durations) / durations.length);
  return {
    label,
    value: formatDuration(averageMs),
    measurableCount: durations.length,
    totalCount: dossiers.length,
    averageMs,
  };
}

function getLogDate(logs: string[] | undefined, predicate: (msg: string) => boolean): Date | null {
  if (!logs) return null;
  const dates: Date[] = [];
  for (const log of logs) {
    const trimmed = log.trim();
    const firstDash = trimmed.indexOf(" - ");
    if (firstDash !== -1) {
      const datePart = trimmed.slice(0, firstDash).trim();
      const rest = trimmed.slice(firstDash + 3).trim();
      let msgStr = rest;
      if (rest.startsWith("[")) {
        const endBracket = rest.indexOf("]");
        if (endBracket !== -1) {
          const afterBracket = rest.slice(endBracket + 1).trim();
          msgStr = afterBracket.startsWith("-") ? afterBracket.slice(1).trim() : afterBracket;
        }
      } else {
        const secondDash = rest.indexOf(" - ");
        if (secondDash !== -1) {
          msgStr = rest.slice(secondDash + 3).trim();
        }
      }
      if (predicate(msgStr.toLowerCase())) {
        const d = new Date(datePart);
        if (Number.isFinite(d.getTime())) {
          dates.push(d);
        }
      }
    }
  }
  return dates.length > 0 ? minDate(dates) : null;
}

export function extractDossierTiming(dossier: DossierSAV): DossierTiming {
  const logs = dossier.historiqueLogs;
  
  // Reception
  let reception = parseDate(dossier.dateReception);
  if (!reception && (dossier as any).createdAt) {
    reception = parseDate((dossier as any).createdAt);
  }
  if (!reception) {
    reception = getLogDate(logs, msg => msg.includes("créé") || msg.includes("création") || msg.includes("creation") || msg.includes("reception") || msg.includes("réception"));
  }

  // WorkStart
  let workStart = getWorkStartDate(dossier);
  if (!workStart) {
    workStart = getLogDate(logs, msg => msg.includes("démarr") || msg.includes("commenc") || msg.includes("travaux") || msg.includes("début"));
  }

  // WorkEnd
  let workEnd = getWorkEndDate(dossier);
  if (!workEnd) {
    workEnd = getLogDate(logs, msg => msg.includes("termin") || msg.includes("fin de tâche") || msg.includes("fin des travaux") || msg.includes("prêt à livrer"));
  }

  // QC
  let qc = parseDate(dossier.checklistQC.dateValidation);
  if (!qc) {
    qc = getLogDate(logs, msg => (msg.includes("qc") || msg.includes("qualité") || msg.includes("qualite")) && (msg.includes("valid") || msg.includes("accept") || msg.includes("valide") || msg.includes("ok")));
  }

  // Delivery
  let delivery = parseDate(dossier.livraison.dateLivraisonReelle);
  if (!delivery) {
    delivery = getLogDate(logs, msg => msg.includes("livr") || msg.includes("remis") || msg.includes("clôtur") || msg.includes("clotur"));
  }

  return { reception, workStart, workEnd, qc, delivery };
}

function getWorkStartDate(dossier: DossierSAV): Date | null {
  const historyStarts = dossier.ordresReparation
    .map(line => getHistoryDate(line.history, "Tâche démarrée"))
    .filter((date): date is Date => Boolean(date));
  if (historyStarts.length > 0) return minDate(historyStarts);

  const planningStarts = dossier.ordresReparation
    .map(line => parseDate(line.planningStart))
    .filter((date): date is Date => Boolean(date));
  return planningStarts.length > 0 ? minDate(planningStarts) : null;
}

function getWorkEndDate(dossier: DossierSAV): Date | null {
  const historyEnds = dossier.ordresReparation
    .map(line => getHistoryDate(line.history, "Tâche terminée"))
    .filter((date): date is Date => Boolean(date));
  if (historyEnds.length > 0) return maxDate(historyEnds);

  const donePlanningEnds = dossier.ordresReparation
    .filter(line => normalizeRepairOrderStatus(line.status) === "done")
    .map(line => parseDate(line.planningEnd))
    .filter((date): date is Date => Boolean(date));
  return donePlanningEnds.length > 0 ? maxDate(donePlanningEnds) : null;
}

function getHistoryDate(history: string[] | undefined, marker: string): Date | null {
  const dates = (history ?? [])
    .filter(entry => entry.includes(marker))
    .map(parseHistoryDate)
    .filter((date): date is Date => Boolean(date));
  return dates.length > 0 ? minDate(dates) : null;
}

function getPlannedHours(line: RepairOrderLine, range: DateRange): number {
  return getPlanningSegments(line).reduce((total, segment) => total + getSegmentOverlapHours(segment, range), 0);
}

function getPlanningSegments(line: RepairOrderLine): Array<{ start: string; end: string }> {
  if (line.planningSegments && line.planningSegments.length > 0) return line.planningSegments;
  if (line.planningStart && line.planningEnd) return [{ start: line.planningStart, end: line.planningEnd }];
  return [];
}

function getSegmentOverlapHours(segment: { start: string; end: string }, range: DateRange): number {
  const start = parseDate(segment.start);
  const end = parseDate(segment.end);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  const effectiveStart = range ? Math.max(start.getTime(), range.start.getTime()) : start.getTime();
  const effectiveEnd = range ? Math.min(end.getTime(), range.end.getTime()) : end.getTime();
  return Math.max(0, (effectiveEnd - effectiveStart) / 3600000);
}

function toTaskRef(dossier: DossierSAV, line: RepairOrderLine): DashboardTaskRef {
  return {
    dossierId: dossier.id,
    lineId: line.id,
    label: line.designation,
    status: normalizeRepairOrderStatus(line.status),
    technicianId: line.plannedTechnicianId ?? dossier.technicienId,
    bayId: line.plannedBayId,
    planningEnd: line.planningEnd,
  };
}

function buildEntriesExitsChart(dossiers: DossierSAV[], range: DateRange, now: Date): DashboardChartPoint[] {
  const buckets = getChartBuckets(range, now);
  return buckets.map(bucket => ({
    label: bucket.label,
    value: dossiers.filter(dossier => isInsideBucket(parseDate(dossier.dateReception), bucket)).length,
    secondaryValue: dossiers.filter(dossier => isInsideBucket(parseDate(dossier.livraison.dateLivraisonReelle), bucket)).length,
  }));
}

function buildWeeklyTrendChart(dossiers: DossierSAV[], now: Date): DashboardChartPoint[] {
  const range = getPeriodRange("week", now);
  return getChartBuckets(range, now).map(bucket => ({
    label: bucket.label,
    value: dossiers.filter(dossier => isInsideBucket(parseDate(dossier.dateReception), bucket)).length,
  }));
}

function getChartBuckets(range: DateRange, now: Date): Array<{ label: string; start: Date; end: Date }> {
  const effectiveRange = range ?? getPeriodRange("week", now)!;
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];
  const cursor = startOfDay(effectiveRange.start);
  const maxBuckets = 7;

  while (cursor.getTime() < effectiveRange.end.getTime() && buckets.length < maxBuckets) {
    const start = new Date(cursor);
    const end = addDays(start, 1);
    buckets.push({ label: formatDayLabel(start), start, end });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function isInsideBucket(date: Date | null, bucket: { start: Date; end: Date }): boolean {
  return Boolean(date && date.getTime() >= bucket.start.getTime() && date.getTime() < bucket.end.getTime());
}

function countRefusalReasons(dossiers: DossierSAV[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const dossier of dossiers) {
    if (dossier.checklistQC.validationGlobale !== "refuse") continue;
    const reason = dossier.checklistQC.commentaireRefus?.trim() || "Motif non renseigné";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

function hasQualityRefusalTrace(dossier: DossierSAV): boolean {
  const logText = [
    dossier.bloqueRaison,
    dossier.checklistQC.commentaireRefus,
    ...(dossier.historiqueLogs ?? []),
    ...dossier.ordresReparation.flatMap(line => line.history ?? []),
  ].join(" ").toLowerCase();
  return logText.includes("refus qualité") || logText.includes("qc refus") || logText.includes("contrôle qualité refus");
}

function getPeriodRange(period: DashboardPeriod, now: Date): DateRange {
  if (period === "all") return null;
  if (period === "today") {
    const start = startOfDay(now);
    return { start, end: addDays(start, 1) };
  }
  if (period === "week") {
    const start = startOfWeek(now);
    return { start, end: addDays(start, 7) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

function getCapacityDayCount(dossiers: DossierSAV[], range: DateRange): number {
  if (range) return Math.max(1, countWorkingDays(range.start, range.end));
  const dates = new Set<string>();
  for (const dossier of dossiers) {
    for (const line of dossier.ordresReparation) {
      for (const segment of getPlanningSegments(line)) {
        const start = parseDate(segment.start);
        if (start) dates.add(start.toISOString().slice(0, 10));
      }
    }
  }
  return Math.max(1, Array.from(dates).filter(dateKey => {
    const date = parseDate(`${dateKey}T00:00:00.000Z`);
    return date ? date.getDay() !== 0 : false;
  }).length);
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cursor = startOfDay(start);
  while (cursor.getTime() < end.getTime()) {
    if (cursor.getDay() !== 0) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseHistoryDate(entry: string): Date | null {
  const match = entry.match(DATE_PREFIX);
  return parseDate(match?.[1]);
}

function formatDuration(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 24) return `${roundHours(hours)} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days} j ${remainingHours} h` : `${days} j`;
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "");
}

function shortLabel(label: string): string {
  const parts = label.split(" ");
  if (parts.length <= 2) return label;
  return parts.slice(0, 2).join(" ");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minDate(dates: Date[]): Date {
  return dates.reduce((min, date) => date.getTime() < min.getTime() ? date : min, dates[0]);
}

function maxDate(dates: Date[]): Date {
  return dates.reduce((max, date) => date.getTime() > max.getTime() ? date : max, dates[0]);
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
