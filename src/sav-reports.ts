/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DossierSAV,
  UserRole,
  DossierStatus,
  DELIVERY_RESTITUTION_STATUSES,
  DeliveryRestitutionStatus,
  InterventionType,
  RepairOrderStatus,
  ComplaintStatus,
  ComplaintCriticity,
  ReclammationClient,
  WorkshopReservation,
  WorkshopAvailabilityConfig,
  VehicleMasterRecord,
  SavReportFilters,
  DossierHistoryEntry,
  VehicleHistoryEntry,
  ClientHistoryEntry,
  ReceptionReport,
  WorkshopReport,
  PlanningReport,
  QcReport,
  DeliveryReport,
  ComplaintReport,
  BlockingReport,
  OperationalKpiReport
} from "./types";
import { normalizeRepairOrderStatus } from "./sav-core";

/**
 * Clean phone numbers and mask them for unauthorized roles.
 * Masquage attendu : +216 ** *** 123
 */
export function maskPhone(phone: string | undefined): string | undefined {
  if (!phone) return phone;
  const trimmed = phone.trim();
  const cleanDigits = trimmed.replace(/\s+/g, "");
  if (cleanDigits.length >= 3) {
    const last3 = cleanDigits.slice(-3);
    return `+216 ** *** ${last3}`;
  }
  return "+216 ** *** ***";
}

/**
 * Helper to detect history event types from messages
 */
function detectEventType(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("créé") || lower.includes("création") || lower.includes("creation") || lower.includes("reception") || lower.includes("réception")) return "creation";
  if (lower.includes("démarr") || lower.includes("demarr")) return "task_started";
  if (lower.includes("pause")) return "task_paused";
  if (lower.includes("blocage") || lower.includes("bloqué") || lower.includes("bloque")) return "task_blocked";
  if (lower.includes("levée") || lower.includes("levee") || lower.includes("débloqu") || lower.includes("debloqu")) return "task_unblocked";
  if (lower.includes("terminé") || lower.includes("termine")) return "task_completed";
  if (lower.includes("réouvert") || lower.includes("reouvert")) return "task_reopened";
  if (lower.includes("qc") || lower.includes("qualité") || lower.includes("qualite")) {
    if (lower.includes("refus")) return "qc_refused";
    return "qc_validated";
  }
  if (lower.includes("livr") || lower.includes("delivery")) return "delivery";
  if (lower.includes("devis") || lower.includes("import")) return "quote_imported";
  if (lower.includes("durée") || lower.includes("duree") || lower.includes("valid")) return "duration_validated";
  if (lower.includes("réclamation") || lower.includes("reclamation")) return "complaint";
  if (lower.includes("réservation") || lower.includes("reservation")) return "reservation";
  if (lower.includes("planning") || lower.includes("planif")) return "planning";
  return "operational_log";
}

/**
 * Parses a single history string into a structured entry
 */
export function parseLogEntry(log: string): DossierHistoryEntry {
  const trimmed = log.trim();
  const firstDash = trimmed.indexOf(" - ");
  if (firstDash === -1) {
    return {
      date: new Date().toISOString(),
      type: "unspecified",
      label: trimmed
    };
  }
  const datePart = trimmed.slice(0, firstDash).trim();
  const rest = trimmed.slice(firstDash + 3).trim();

  // Check bracket role syntax: "[Directeur SAV] - Message"
  if (rest.startsWith("[")) {
    const endBracket = rest.indexOf("]");
    if (endBracket !== -1) {
      const roleStr = rest.slice(1, endBracket).trim();
      const afterBracket = rest.slice(endBracket + 1).trim();
      const msgStr = afterBracket.startsWith("-") ? afterBracket.slice(1).trim() : afterBracket;
      return {
        date: datePart,
        type: detectEventType(msgStr),
        label: msgStr,
        role: roleStr,
        actor: roleStr
      };
    }
  }

  // Check normal space-dash-space syntax: "Réceptionnaire - Message"
  const secondDash = rest.indexOf(" - ");
  if (secondDash !== -1) {
    const actorPart = rest.slice(0, secondDash).trim();
    const msgPart = rest.slice(secondDash + 3).trim();
    return {
      date: datePart,
      type: detectEventType(msgPart),
      label: msgPart,
      actor: actorPart,
      role: actorPart
    };
  }

  return {
    date: datePart,
    type: detectEventType(rest),
    label: rest
  };
}

/**
 * Build a unified chronological timeline for a dossier
 */
export function buildDossierHistory(dossier: DossierSAV): DossierHistoryEntry[] {
  const logs = dossier.historiqueLogs ?? [];
  const entries: DossierHistoryEntry[] = logs.map(parseLogEntry);

  const hasCreation = entries.some(e => e.type === "creation");
  if (!hasCreation && dossier.dateReception) {
    entries.push({
      date: dossier.dateReception,
      type: "creation",
      label: "Réception du véhicule en atelier",
      details: dossier.observationsReception
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}

/**
 * Build vehicle history based on VIN, plate number or fallback
 */
export function buildVehicleHistory(
  dossiers: DossierSAV[],
  vehicleKey: string,
  complaints?: ReclammationClient[]
): VehicleHistoryEntry | null {
  if (!vehicleKey) return null;
  const keyUpper = vehicleKey.trim().toUpperCase().replace(/\s+/g, "");

  const matchedDossiers = dossiers.filter(d => {
    const dVin = d.vehiculeVIN ? d.vehiculeVIN.trim().toUpperCase().replace(/\s+/g, "") : "";
    const dPlate = d.vehiculeImmatriculation ? d.vehiculeImmatriculation.trim().toUpperCase().replace(/\s+/g, "") : "";

    if (dVin && dVin === keyUpper) return true;
    if (dPlate && dPlate.replace(/[^A-Z0-9]/g, "") === keyUpper.replace(/[^A-Z0-9]/g, "")) return true;

    const fallbackKey = `${d.vehiculeMarque}-${d.vehiculeModele}-${d.clientNom}`.trim().toUpperCase().replace(/\s+/g, "");
    if (fallbackKey === keyUpper) return true;

    return false;
  });

  if (matchedDossiers.length === 0) return null;

  const sortedDossiers = [...matchedDossiers].sort(
    (a, b) => new Date(b.dateReception).getTime() - new Date(a.dateReception).getTime()
  );
  const latest = sortedDossiers[0];

  const firstPassageDate = sortedDossiers[sortedDossiers.length - 1].dateReception;
  const lastPassageDate = latest.dateReception;

  let complaintsCount = 0;
  if (complaints) {
    const dIds = matchedDossiers.map(d => d.id);
    complaintsCount = complaints.filter(c => dIds.includes(c.dossierId)).length;
  }

  return {
    vin: latest.vehiculeVIN,
    plateNumber: latest.vehiculeImmatriculation,
    brand: latest.vehiculeMarque,
    model: latest.vehiculeModele,
    clientNom: latest.clientNom,
    dossierIds: matchedDossiers.map(d => d.id),
    passagesCount: matchedDossiers.length,
    firstPassageDate,
    lastPassageDate,
    lastServiceMileage: latest.vehiculeKilometrage,
    lastStatus: latest.statut,
    complaintsCount,
    dossiers: sortedDossiers
  };
}

/**
 * Build client history listing associated vehicles and past dossiers
 */
export function buildClientHistory(
  dossiers: DossierSAV[],
  clientKey: string,
  complaints?: ReclammationClient[]
): ClientHistoryEntry | null {
  if (!clientKey) return null;
  const target = clientKey.trim().toLowerCase();

  const clientDossiers = dossiers.filter(d => d.clientNom && d.clientNom.trim().toLowerCase() === target);
  if (clientDossiers.length === 0) return null;

  const vehiclesMap = new Map<string, { vin?: string; plateNumber?: string; brand?: string; model?: string }>();
  clientDossiers.forEach(d => {
    const vKey = d.vehiculeVIN
      ? d.vehiculeVIN.trim().toUpperCase()
      : d.vehiculeImmatriculation
      ? d.vehiculeImmatriculation.trim().toUpperCase()
      : `${d.vehiculeMarque}-${d.vehiculeModele}`;
    if (!vehiclesMap.has(vKey)) {
      vehiclesMap.set(vKey, {
        vin: d.vehiculeVIN,
        plateNumber: d.vehiculeImmatriculation,
        brand: d.vehiculeMarque,
        model: d.vehiculeModele
      });
    }
  });

  const latestDossier = [...clientDossiers].sort(
    (a, b) => new Date(b.dateReception).getTime() - new Date(a.dateReception).getTime()
  )[0];

  let complaintsCount = 0;
  if (complaints) {
    const dIds = clientDossiers.map(d => d.id);
    complaintsCount = complaints.filter(c => dIds.includes(c.dossierId)).length;
  }

  return {
    clientNom: latestDossier.clientNom,
    clientTelephone: latestDossier.clientTelephone,
    associatedVehicles: Array.from(vehiclesMap.values()),
    passagesCount: clientDossiers.length,
    dossierIds: clientDossiers.map(d => d.id),
    complaintsCount
  };
}

/**
 * Utility to filter dossiers by period, statuses, and custom queries
 */
export function filterDossiersByPeriod(dossiers: DossierSAV[], filters: SavReportFilters): DossierSAV[] {
  let filtered = [...dossiers];

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filtered = filtered.filter(d => new Date(d.dateReception).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate + "T23:59:59").getTime();
    filtered = filtered.filter(d => new Date(d.dateReception).getTime() <= end);
  }

  if (!filters.startDate && !filters.endDate && filters.period !== "tous") {
    const now = new Date();
    const startLimit = new Date();
    if (filters.period === "jour") {
      startLimit.setHours(0, 0, 0, 0);
    } else if (filters.period === "semaine") {
      startLimit.setDate(now.getDate() - 7);
    } else if (filters.period === "mois") {
      startLimit.setDate(now.getDate() - 30);
    }
    const limitTime = startLimit.getTime();
    filtered = filtered.filter(d => new Date(d.dateReception).getTime() >= limitTime);
  }

  if (filters.dossierStatus) {
    filtered = filtered.filter(d => d.statut === filters.dossierStatus);
  }

  if (filters.technicianId) {
    filtered = filtered.filter(
      d =>
        d.technicienId === filters.technicianId ||
        d.ordresReparation.some(t => t.plannedTechnicianId === filters.technicianId)
    );
  }

  if (filters.workshopBayId) {
    filtered = filtered.filter(
      d =>
        d.workshopBayId === filters.workshopBayId ||
        d.ordresReparation.some(t => t.plannedBayId === filters.workshopBayId)
    );
  }

  if (filters.receptionistId) {
    filtered = filtered.filter(d => d.deposantNom === filters.receptionistId); // fallback mapping
  }

  if (filters.typeDossier) {
    filtered = filtered.filter(d => d.typeDossier === filters.typeDossier);
  }

  if (filters.modelQuery) {
    const mq = filters.modelQuery.toLowerCase().trim();
    filtered = filtered.filter(d => d.vehiculeModele && d.vehiculeModele.toLowerCase().includes(mq));
  }

  if (filters.searchQuery) {
    const sq = filters.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      d =>
        (d.vehiculeVIN && d.vehiculeVIN.toLowerCase().includes(sq)) ||
        (d.vehiculeImmatriculation && d.vehiculeImmatriculation.toLowerCase().includes(sq)) ||
        (d.clientNom && d.clientNom.toLowerCase().includes(sq))
    );
  }

  return filtered;
}

/**
 * Build reception reports comparing master DB pre-fill rate
 */
export function buildReceptionReport(dossiers: DossierSAV[], filters: SavReportFilters): ReceptionReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);
  const totalCreated = filtered.length;

  const records = filters.vehicleMasterRecords ?? [];
  let prefilledCount = 0;
  let manualCount = 0;

  filtered.forEach(d => {
    const dVin = d.vehiculeVIN ? d.vehiculeVIN.trim().toUpperCase() : "";
    const dPlate = d.vehiculeImmatriculation ? d.vehiculeImmatriculation.trim().toUpperCase() : "";
    const found = records.some(
      r =>
        (r.vin && r.vin.trim().toUpperCase() === dVin) ||
        (r.plateNumber && r.plateNumber.trim().toUpperCase() === dPlate)
    );
    if (found) {
      prefilledCount++;
    } else {
      manualCount++;
    }
  });

  const prefilledPercentage = totalCreated > 0 ? (prefilledCount / totalCreated) * 100 : 0;
  const notFoundInMasterCount = manualCount;

  const motifCounts: Record<string, number> = {};
  filtered.forEach(d => {
    const motif = d.plainteClient ? d.plainteClient.trim() : "Non spécifié";
    motifCounts[motif] = (motifCounts[motif] || 0) + 1;
  });
  const motifsFrequents = Object.entries(motifCounts)
    .map(([motif, count]) => ({ motif, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const modelCounts: Record<string, number> = {};
  filtered.forEach(d => {
    const model = d.vehiculeModele ? d.vehiculeModele.trim() : "Non spécifié";
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });
  const modelsFrequents = Object.entries(modelCounts)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const incompleteDossiersCount = filtered.filter(
    d => !d.vehiculeVIN || !d.vehiculeImmatriculation || !d.clientTelephone
  ).length;

  return {
    totalCreated,
    manualCount,
    prefilledCount,
    prefilledPercentage,
    notFoundInMasterCount,
    motifsFrequents,
    modelsFrequents,
    incompleteDossiersCount
  };
}

/**
 * Build workshop reports on status counts, labor hours and technician loads
 */
export function buildWorkshopReport(
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  availabilityConfig: WorkshopAvailabilityConfig,
  filters: SavReportFilters
): WorkshopReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);

  const tasksByStatus: Record<RepairOrderStatus, number> = {
    pending: 0,
    in_progress: 0,
    paused: 0,
    blocked: 0,
    done: 0,
    reopened: 0,
    cancelled: 0
  };

  let totalLaborHoursEstimated = 0;
  let totalLaborHoursPlanned = 0;
  let totalLaborHoursSpent = 0;

  const techMap = new Map<string, { id: string; nom: string; count: number; hours: number }>();
  const bayMap = new Map<string, { id: string; name: string; count: number; hours: number }>();

  filtered.forEach(d => {
    d.ordresReparation.forEach(task => {
      const taskStatus = normalizeRepairOrderStatus(task.status);
      tasksByStatus[taskStatus] = (tasksByStatus[taskStatus] || 0) + 1;

      totalLaborHoursEstimated += task.tempsEstime || 0;
      if (task.planningStart) {
        totalLaborHoursPlanned += task.tempsEstime || 0;
      }
      if (taskStatus === "done") {
        totalLaborHoursSpent += task.tempsPasse || task.tempsEstime || 0;
      }

      if (task.plannedTechnicianId) {
        const tId = task.plannedTechnicianId;
        const current = techMap.get(tId) || { id: tId, nom: task.plannedTechnicianId, count: 0, hours: 0 };
        current.count++;
        current.hours += task.tempsEstime || 0;
        techMap.set(tId, current);
      }

      if (task.plannedBayId) {
        const bId = task.plannedBayId;
        const current = bayMap.get(bId) || { id: bId, name: task.plannedBayId, count: 0, hours: 0 };
        current.count++;
        current.hours += task.tempsEstime || 0;
        bayMap.set(bId, current);
      }
    });
  });

  const techniciansLoad = Array.from(techMap.values()).map(t => ({
    technicianId: t.id,
    technicianNom: t.nom,
    plannedTasksCount: t.count,
    plannedHours: t.hours
  }));

  const baysLoad = Array.from(bayMap.values()).map(b => ({
    bayId: b.id,
    bayName: b.name,
    plannedTasksCount: b.count,
    plannedHours: b.hours
  }));

  return {
    tasksByStatus,
    totalLaborHoursEstimated,
    totalLaborHoursPlanned,
    totalLaborHoursSpent,
    techniciansLoad,
    baysLoad
  };
}

/**
 * Build planning and reservations report
 */
export function buildPlanningReport(
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  filters: SavReportFilters
): PlanningReport {
  let filteredRes = [...reservations];
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filteredRes = filteredRes.filter(r => new Date(r.desiredDate).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate + "T23:59:59").getTime();
    filteredRes = filteredRes.filter(r => new Date(r.desiredDate).getTime() <= end);
  }

  let reservationsToConfirmCount = 0;
  let reservationsConfirmedCount = 0;
  let reservationsCancelledCount = 0;
  let reservationsConvertedCount = 0;
  let multiDayReservationsCount = 0;

  filteredRes.forEach(r => {
    if (r.status === "A_RESERVER" || r.status === "CRENEAU_PROPOSE") {
      reservationsToConfirmCount++;
    } else if (r.status === "RESERVATION_CONFIRMEE") {
      reservationsConfirmedCount++;
    } else if (r.status === "ANNULEE") {
      reservationsCancelledCount++;
    } else if (r.status === "TRANSFORMEE_PLANNING") {
      reservationsConvertedCount++;
    }

    if (r.totalHours > 8 || (r.segments && r.segments.length > 1)) {
      multiDayReservationsCount++;
    }
  });

  const totalClosed = reservationsConfirmedCount + reservationsConvertedCount + reservationsCancelledCount;
  const conversionRate = totalClosed > 0 ? (reservationsConvertedCount / totalClosed) * 100 : 0;

  const conflictsPreventedCount = reservations.filter(
    r =>
      r.history &&
      r.history.some(
        h =>
          h.toLowerCase().includes("conflit") ||
          h.toLowerCase().includes("collision") ||
          h.toLowerCase().includes("evit") ||
          h.toLowerCase().includes("évit")
      )
  ).length;

  return {
    reservationsToConfirmCount,
    reservationsConfirmedCount,
    reservationsCancelledCount,
    reservationsConvertedCount,
    conversionRate,
    multiDayReservationsCount,
    conflictsPreventedCount
  };
}

/**
 * Build Quality Control report on FTR and rejection motifs
 */
export function buildQcReport(dossiers: DossierSAV[], filters: SavReportFilters): QcReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);

  let totalQcChecked = 0;
  let totalQcPassed = 0;
  let totalQcFailed = 0;

  const motifCounts: Record<string, number> = {};
  let firstTimeRightCount = 0;

  filtered.forEach(d => {
    if (d.checklistQC && d.checklistQC.validationGlobale !== "en_attente") {
      totalQcChecked++;
      if (d.checklistQC.validationGlobale === "valide") {
        totalQcPassed++;

        const hasRefusal =
          d.historiqueLogs?.some(h => h.toLowerCase().includes("qc") && h.toLowerCase().includes("refus")) ?? false;
        if (!hasRefusal) {
          firstTimeRightCount++;
        }
      } else if (d.checklistQC.validationGlobale === "refuse") {
        totalQcFailed++;
      }
    }

    if (d.checklistQC && d.checklistQC.commentaireRefus) {
      const motif = d.checklistQC.commentaireRefus.trim();
      motifCounts[motif] = (motifCounts[motif] || 0) + 1;
    }
  });

  const passRate = totalQcChecked > 0 ? (totalQcPassed / totalQcChecked) * 100 : 0;
  const firstTimeRightRate = totalQcPassed > 0 ? (firstTimeRightCount / totalQcPassed) * 100 : 0;

  const motifsRefus = Object.entries(motifCounts)
    .map(([motif, count]) => ({ motif, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalQcChecked,
    totalQcPassed,
    totalQcFailed,
    passRate,
    motifsRefus,
    firstTimeRightRate
  };
}

/**
 * Build delivery report on duration from QC approval to delivery
 */
export function buildDeliveryReport(dossiers: DossierSAV[], filters: SavReportFilters): DeliveryReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);

  let totalReadyToDeliver = 0;
  let totalDelivered = 0;
  let totalPendingClient = 0;
  const restitutionCounts = DELIVERY_RESTITUTION_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<DeliveryRestitutionStatus, number>);

  let totalDays = 0;
  let count = 0;

  filtered.forEach(d => {
    if (d.statut === "Prêt à livrer") {
      totalReadyToDeliver++;
    } else if (d.statut === "Livré" || d.statut === "Clôturé opérationnellement") {
      totalDelivered++;
      const status = d.livraison?.statutRestitution || "Livré sans réserve";
      restitutionCounts[status] = (restitutionCounts[status] || 0) + 1;
    } else if (d.statut === "En attente accord" || d.statut === "Client absent") {
      totalPendingClient++;
    }

    if (d.checklistQC && d.checklistQC.dateValidation && d.livraison && d.livraison.dateLivraisonReelle) {
      const qcTime = new Date(d.checklistQC.dateValidation).getTime();
      const delTime = new Date(d.livraison.dateLivraisonReelle).getTime();
      if (delTime >= qcTime) {
        totalDays += (delTime - qcTime) / (1000 * 60 * 60 * 24);
        count++;
      }
    }
  });

  const averageQcToDeliveryDays = count > 0 ? totalDays / count : 0;

  return {
    totalReadyToDeliver,
    totalDelivered,
    totalPendingClient,
    averageQcToDeliveryDays,
    restitutionStatuses: DELIVERY_RESTITUTION_STATUSES.map(status => ({ status, count: restitutionCounts[status] || 0 }))
  };
}

/**
 * Build customer complaints report on resolution times
 */
export function buildComplaintsReport(complaints: ReclammationClient[], filters: SavReportFilters): ComplaintReport {
  let filtered = [...complaints];
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filtered = filtered.filter(c => new Date(c.dateCreation).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate + "T23:59:59").getTime();
    filtered = filtered.filter(c => new Date(c.dateCreation).getTime() <= end);
  }

  const byStatus: Record<ComplaintStatus, number> = {
    nouvelle: 0,
    en_analyse: 0,
    action_corrective: 0,
    attente_client: 0,
    tache_corrective_creee: 0,
    en_cours_atelier: 0,
    attente_qc: 0,
    action_realisee: 0,
    rejetee_non_fondee: 0,
    resolue: 0,
    cloturee: 0,
    reouverte: 0,
    en_cours: 0,
    classee: 0
  };

  const byCriticite: Record<ComplaintCriticity, number> = {
    basse: 0,
    moyenne: 0,
    haute: 0,
    critique: 0
  };

  let totalDays = 0;
  let count = 0;

  filtered.forEach(c => {
    byStatus[c.statut] = (byStatus[c.statut] || 0) + 1;
    byCriticite[c.criticite] = (byCriticite[c.criticite] || 0) + 1;

    if ((c.statut === "resolue" || c.statut === "cloturee") && c.dateDerniereModification) {
      const createdTime = new Date(c.dateCreation).getTime();
      const modTime = new Date(c.dateDerniereModification).getTime();
      if (modTime >= createdTime) {
        totalDays += (modTime - createdTime) / (1000 * 60 * 60 * 24);
        count++;
      }
    }
  });

  const averageResolutionDays = count > 0 ? totalDays / count : 0;

  return {
    totalComplaints: filtered.length,
    byStatus,
    byCriticite,
    averageResolutionDays
  };
}

/**
 * Build blockages report categorizing reasons by family
 */
export function buildBlockingReport(
  dossiers: DossierSAV[],
  complaints: ReclammationClient[],
  filters: SavReportFilters
): BlockingReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);

  let totalBlockedDossiers = 0;
  let totalBlockedTasks = 0;

  const motifCounts: Record<string, number> = {};
  const familyCounts: Record<string, number> = {
    "Attente Pièces": 0,
    "Attente Assurance": 0,
    "Attente Accord Client": 0,
    "Autre": 0
  };

  let totalHours = 0;
  let count = 0;
  const now = new Date().getTime();

  filtered.forEach(d => {
    if (d.statut === "Bloqué") {
      totalBlockedDossiers++;
      if (d.bloqueRaison) {
        const motif = d.bloqueRaison.trim();
        motifCounts[motif] = (motifCounts[motif] || 0) + 1;

        const lower = motif.toLowerCase();
        if (lower.includes("pièce") || lower.includes("magasin") || lower.includes("rechange")) {
          familyCounts["Attente Pièces"]++;
        } else if (
          lower.includes("assurance") ||
          lower.includes("expert") ||
          lower.includes("gat") ||
          lower.includes("star") ||
          lower.includes("comar")
        ) {
          familyCounts["Attente Assurance"]++;
        } else if (lower.includes("client") || lower.includes("accord") || lower.includes("devis")) {
          familyCounts["Attente Accord Client"]++;
        } else {
          familyCounts["Autre"]++;
        }
      }

      const blockLog = d.historiqueLogs?.find(
        h => h.toLowerCase().includes("blocage") || h.toLowerCase().includes("bloqué")
      );
      if (blockLog) {
        const parsed = parseLogEntry(blockLog);
        const blockTime = new Date(parsed.date).getTime();
        if (now >= blockTime) {
          totalHours += (now - blockTime) / (1000 * 60 * 60);
          count++;
        }
      }
    }

    d.ordresReparation.forEach(t => {
      if (t.status === "blocked") {
        totalBlockedTasks++;
      }
    });
  });

  const averageBlockingDurationHours = count > 0 ? totalHours / count : 0;

  const motifsBlocage = Object.entries(motifCounts)
    .map(([motif, count]) => ({ motif, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const blockingByFamily = Object.entries(familyCounts)
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalBlockedDossiers,
    totalBlockedTasks,
    motifsBlocage,
    averageBlockingDurationHours,
    blockingByFamily
  };
}

/**
 * Build consolidated operational KPI report
 */
export function buildOperationalKpis(
  dossiers: DossierSAV[],
  reservations: WorkshopReservation[],
  complaints: ReclammationClient[],
  filters: SavReportFilters
): OperationalKpiReport {
  const filtered = filterDossiersByPeriod(dossiers, filters);

  const dossiersStatusCounts: Record<DossierStatus, number> = {
    "Nouveau dossier": 0,
    "RDV à fixer": 0,
    "RDV fixé": 0,
    "Client absent": 0,
    "En attente réception": 0,
    "Véhicule reçu": 0,
    "En attente accord": 0,
    "Travaux planifiés": 0,
    "En travaux": 0,
    "Bloqué": 0,
    "Immobilisé": 0,
    "Contrôle qualité": 0,
    "Prêt à livrer": 0,
    "Non retiré": 0,
    "Livré": 0,
    "Clôturé opérationnellement": 0,
    "Prêt pour facturation ERP": 0,
    "Annulé": 0,
    "Quarantaine données": 0
  };

  let activeDossiersCount = 0;
  let criticalPriorityDossiersCount = 0;

  let totalDays = 0;
  let count = 0;

  filtered.forEach(d => {
    dossiersStatusCounts[d.statut] = (dossiersStatusCounts[d.statut] || 0) + 1;

    if (d.statut !== "Livré" && d.statut !== "Non retiré" && d.statut !== "Clôturé opérationnellement" && d.statut !== "Prêt pour facturation ERP" && d.statut !== "Annulé") {
      activeDossiersCount++;
    }

    if (d.priorite === "véhicule immobilisé" || d.priorite === "client VIP" || d.priorite === "urgente") {
      criticalPriorityDossiersCount++;
    }

    const startTime = new Date(d.dateReception).getTime();
    const endTime =
      d.livraison && d.livraison.dateLivraisonReelle
        ? new Date(d.livraison.dateLivraisonReelle).getTime()
        : new Date().getTime();
    if (endTime >= startTime) {
      totalDays += (endTime - startTime) / (1000 * 60 * 60 * 24);
      count++;
    }
  });

  const averageStayDays = count > 0 ? totalDays / count : 0;

  return {
    dossiersStatusCounts,
    activeDossiersCount,
    criticalPriorityDossiersCount,
    averageStayDays
  };
}
