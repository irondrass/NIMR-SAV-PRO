/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Calendar,
  FileText,
  UserCheck,
  ShieldAlert,
  SlidersHorizontal,
  Search,
  Download,
  Eye,
  History,
  TrendingUp,
  Inbox,
  Truck
} from "lucide-react";
import {
  DossierSAV,
  UserRole,
  DossierStatus,
  InterventionType,
  RepairOrderStatus,
  ComplaintStatus,
  ComplaintCriticity,
  ReclammationClient,
  WorkshopReservation,
  WorkshopAvailabilityConfig,
  VehicleMasterRecord,
  SavReportFilters,
  SavReportPeriod
} from "../types";
import {
  canViewSavReports,
  canViewSensitiveReportFields,
  canExportSavReports
} from "../permissions";
import {
  maskPhone,
  buildDossierHistory,
  buildVehicleHistory,
  buildClientHistory,
  buildReceptionReport,
  buildWorkshopReport,
  buildPlanningReport,
  buildQcReport,
  buildDeliveryReport,
  buildComplaintsReport,
  buildBlockingReport,
  buildOperationalKpis
} from "../sav-reports";

interface PerformanceSAVProps {
  dossiers: DossierSAV[];
  reservations: WorkshopReservation[];
  complaints: ReclammationClient[];
  availabilityConfig: WorkshopAvailabilityConfig;
  vehicleMasterRecords: VehicleMasterRecord[];
  currentUserRole: UserRole;
}

export default function PerformanceSAV({
  dossiers,
  reservations,
  complaints,
  availabilityConfig,
  vehicleMasterRecords,
  currentUserRole
}: PerformanceSAVProps) {
  // 1. Role-based report tabs access
  const availableReports = useMemo(() => {
    const list: Array<{ id: string; label: string; icon: any }> = [];
    
    const hasAccess = canViewSavReports(currentUserRole);
    if (!hasAccess) return list;

    if (currentUserRole === UserRole.DIRECTEUR_SAV || currentUserRole === UserRole.LECTURE_SEULE) {
      list.push({ id: "kpis", label: "KPIs Opérationnels", icon: TrendingUp });
      list.push({ id: "reception", label: "Rapport Réception", icon: Inbox });
      list.push({ id: "workshop", label: "Rapport Atelier", icon: Activity });
      list.push({ id: "planning", label: "Rapport Planning", icon: Calendar });
      list.push({ id: "qc", label: "Rapport QC", icon: CheckCircle2 });
      list.push({ id: "delivery", label: "Rapport Livraison", icon: Truck });
      list.push({ id: "complaints", label: "Réclamations", icon: ShieldAlert });
      list.push({ id: "blockings", label: "Blocages", icon: AlertTriangle });
      list.push({ id: "vehicle-history", label: "Historique Véhicule", icon: History });
      list.push({ id: "dossier-history", label: "Historique Dossier", icon: FileText });
    } else if (currentUserRole === UserRole.CHEF_ATELIER) {
      list.push({ id: "workshop", label: "Rapport Atelier", icon: Activity });
      list.push({ id: "planning", label: "Rapport Planning", icon: Calendar });
      list.push({ id: "qc", label: "Rapport QC", icon: CheckCircle2 });
      list.push({ id: "blockings", label: "Blocages", icon: AlertTriangle });
      list.push({ id: "vehicle-history", label: "Historique Véhicule", icon: History });
      list.push({ id: "dossier-history", label: "Historique Dossier", icon: FileText });
    } else if (currentUserRole === UserRole.RECEPTIONNAIRE) {
      list.push({ id: "reception", label: "Rapport Réception", icon: Inbox });
      list.push({ id: "vehicle-history", label: "Historique Véhicule", icon: History });
      list.push({ id: "dossier-history", label: "Historique Dossier", icon: FileText });
    } else if (currentUserRole === UserRole.CONTROLE_QUALITE) {
      list.push({ id: "qc", label: "Rapport QC", icon: CheckCircle2 });
    } else if (currentUserRole === UserRole.LIVRAISON) {
      list.push({ id: "delivery", label: "Rapport Livraison", icon: Truck });
    }

    return list;
  }, [currentUserRole]);

  const [selectedReport, setSelectedReport] = useState<string>(
    availableReports[0]?.id || "kpis"
  );

  // 2. Filters State
  const [period, setPeriod] = useState<SavReportPeriod>("tous");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dossierStatus, setDossierStatus] = useState<DossierStatus | "">("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [workshopBayId, setWorkshopBayId] = useState<string>("");
  const [typeDossier, setTypeDossier] = useState<InterventionType | "">("");
  const [modelQuery, setModelQuery] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // History Target Keys
  const [historyVinOrPlate, setHistoryVinOrPlate] = useState<string>("");
  const [historyDossierId, setHistoryDossierId] = useState<string>("");

  // Build active filters object
  const activeFilters = useMemo<SavReportFilters>(() => {
    return {
      period,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      dossierStatus: dossierStatus || undefined,
      technicianId: technicianId || undefined,
      workshopBayId: workshopBayId || undefined,
      typeDossier: typeDossier || undefined,
      modelQuery: modelQuery || undefined,
      searchQuery: searchQuery || undefined,
      vehicleMasterRecords
    };
  }, [
    period,
    startDate,
    endDate,
    dossierStatus,
    technicianId,
    workshopBayId,
    typeDossier,
    modelQuery,
    searchQuery,
    vehicleMasterRecords
  ]);

  // Sensitive fields checking
  const showPhone = canViewSensitiveReportFields(currentUserRole);

  // Compute reports dynamically
  const kpiData = useMemo(() => buildOperationalKpis(dossiers, reservations, complaints, activeFilters), [dossiers, reservations, complaints, activeFilters]);
  const receptionData = useMemo(() => buildReceptionReport(dossiers, activeFilters), [dossiers, activeFilters]);
  const workshopData = useMemo(() => buildWorkshopReport(dossiers, reservations, availabilityConfig, activeFilters), [dossiers, reservations, availabilityConfig, activeFilters]);
  const planningData = useMemo(() => buildPlanningReport(dossiers, reservations, activeFilters), [dossiers, reservations, activeFilters]);
  const qcData = useMemo(() => buildQcReport(dossiers, activeFilters), [dossiers, activeFilters]);
  const deliveryData = useMemo(() => buildDeliveryReport(dossiers, activeFilters), [dossiers, activeFilters]);
  const complaintsData = useMemo(() => buildComplaintsReport(complaints, activeFilters), [complaints, activeFilters]);
  const blockingData = useMemo(() => buildBlockingReport(dossiers, complaints, activeFilters), [dossiers, complaints, activeFilters]);

  // Histories computations
  const activeVehicleHistory = useMemo(() => {
    if (!historyVinOrPlate.trim()) return null;
    return buildVehicleHistory(dossiers, historyVinOrPlate, complaints);
  }, [dossiers, historyVinOrPlate, complaints]);

  const activeDossierHistory = useMemo(() => {
    if (!historyDossierId.trim()) return null;
    const dossier = dossiers.find(d => d.id === historyDossierId.trim());
    if (!dossier) return null;
    return buildDossierHistory(dossier);
  }, [dossiers, historyDossierId]);

  // Export handlers
  const handleExportJSON = (reportName: string, reportData: any) => {
    if (!canExportSavReports(currentUserRole)) return;
    
    // Sanitize phone if not allowed
    const sanitized = JSON.parse(JSON.stringify(reportData));
    if (!showPhone) {
      const recursiveSanitize = (obj: any) => {
        if (typeof obj !== "object" || obj === null) return;
        for (const k in obj) {
          if (k === "clientTelephone" || k === "customerPhone") {
            obj[k] = maskPhone(obj[k]);
          } else {
            recursiveSanitize(obj[k]);
          }
        }
      };
      recursiveSanitize(sanitized);
    }

    const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_${reportName}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  const handleExportCSV = (reportName: string, headers: string[], rows: any[][]) => {
    if (!canExportSavReports(currentUserRole)) return;

    const csvContent = [
      headers.join(";"),
      ...rows.map(row =>
        row
          .map(cell => {
            let valStr = String(cell === undefined || cell === null ? "" : cell);
            if (!showPhone && valStr.includes("+216")) {
              valStr = maskPhone(valStr) || "";
            }
            return `"${valStr.replace(/"/g, '""')}"`;
          })
          .join(";")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_${reportName}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Helper lists for filters dropdowns
  const uniqueTechIds = useMemo(() => {
    const ids = new Set<string>();
    dossiers.forEach(d => {
      if (d.technicienId) ids.add(d.technicienId);
      d.ordresReparation.forEach(t => {
        if (t.plannedTechnicianId) ids.add(t.plannedTechnicianId);
      });
    });
    return Array.from(ids);
  }, [dossiers]);

  const uniqueBays = useMemo(() => {
    const ids = new Set<string>();
    dossiers.forEach(d => {
      if (d.workshopBayId) ids.add(d.workshopBayId);
      d.ordresReparation.forEach(t => {
        if (t.plannedBayId) ids.add(t.plannedBayId);
      });
    });
    return Array.from(ids);
  }, [dossiers]);

  if (availableReports.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold bg-white border rounded-xl shadow-sm">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        Accès restreint. Vous ne disposez pas des permissions nécessaires pour afficher les rapports SAV.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title & Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 font-display">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Rapports SAV NIMR
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Indicateurs de performance opérationnelle et historique d'activité de l'atelier.
          </p>
        </div>

        {/* Global JSON Export (Directeur only) */}
        {canExportSavReports(currentUserRole) && (
          <button
            type="button"
            data-testid="reports-export-all-btn"
            onClick={() => handleExportJSON("global_kpi", kpiData)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter KPIs JSON
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {availableReports.map(tab => {
          const TabIcon = tab.icon;
          const isSelected = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`report-tab-${tab.id}`}
              onClick={() => setSelectedReport(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Sidebar / Collapsible Header */}
      {selectedReport !== "vehicle-history" && selectedReport !== "dossier-history" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            Filtres de rapports
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            {/* Period selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Période</label>
              <select
                data-testid="filter-period"
                value={period}
                onChange={e => setPeriod(e.target.value as SavReportPeriod)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="tous">Tous les dossiers</option>
                <option value="jour">Aujourd'hui</option>
                <option value="semaine">7 derniers jours</option>
                <option value="mois">30 derniers jours</option>
              </select>
            </div>

            {/* Custom Dates */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date début</label>
              <input
                type="date"
                data-testid="filter-start-date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date fin</label>
              <input
                type="date"
                data-testid="filter-end-date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
            </div>

            {/* Dossier status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Statut Dossier</label>
              <select
                data-testid="filter-status"
                value={dossierStatus}
                onChange={e => setDossierStatus(e.target.value as DossierStatus | "")}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                {Object.values(DossierStatus).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Intervention Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type dossier</label>
              <select
                data-testid="filter-type"
                value={typeDossier}
                onChange={e => setTypeDossier(e.target.value as InterventionType | "")}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="">Tous les types</option>
                {Object.values(InterventionType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Technician */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Technicien</label>
              <select
                data-testid="filter-technician"
                value={technicianId}
                onChange={e => setTechnicianId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="">Tous les techniciens</option>
                {uniqueTechIds.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>

            {/* Workshop Bay */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pont / Poste</label>
              <select
                data-testid="filter-bay"
                value={workshopBayId}
                onChange={e => setWorkshopBayId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="">Tous les ponts</option>
                {uniqueBays.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>

            {/* Model query */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Modèle</label>
              <input
                type="text"
                data-testid="filter-model"
                value={modelQuery}
                onChange={e => setModelQuery(e.target.value)}
                placeholder="Ex: Glory 580"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
            </div>

            {/* Text query */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recherche (VIN, Immat, Client)</label>
              <div className="relative">
                <input
                  type="text"
                  data-testid="filter-search-query"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full p-2 pl-8 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        
        {/* KPI consolidation */}
        {selectedReport === "kpis" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Indicateurs Consolidés</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="kpi-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "kpis",
                      ["Indicateur", "Valeur"],
                      [
                        ["Dossiers actifs", kpiData.activeDossiersCount],
                        ["Dossiers prioritaires critiques", kpiData.criticalPriorityDossiersCount],
                        ["Durée moyenne séjour (jours)", kpiData.averageStayDays.toFixed(1)]
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-display">
              <div className="p-5 border border-slate-200 rounded-xl text-left bg-slate-50/50 shadow-sm">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Dossiers Actifs</div>
                <div className="text-3xl font-black text-slate-900 mt-2" data-testid="kpi-active-count">
                  {kpiData.activeDossiersCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Dossiers hors ERP ou livraison finale</div>
              </div>

              <div className="p-5 border border-slate-200 rounded-xl text-left bg-slate-50/50 shadow-sm">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Dossiers Critiques</div>
                <div className="text-3xl font-black text-rose-600 mt-2" data-testid="kpi-critical-count">
                  {kpiData.criticalPriorityDossiersCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Véhicules immobilisés ou clients VIP</div>
              </div>

              <div className="p-5 border border-slate-200 rounded-xl text-left bg-slate-50/50 shadow-sm">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Durée Moyenne de Séjour</div>
                <div className="text-3xl font-black text-slate-900 mt-2" data-testid="kpi-stay-days">
                  {kpiData.averageStayDays.toFixed(1)} <span className="text-xs font-semibold text-slate-400">Jours</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">De la réception à la livraison finale</div>
              </div>
            </div>

            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/30">
              <h4 className="text-xs font-extrabold uppercase text-slate-700 mb-3 text-left">Répartition par statut de dossier</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                {Object.entries(kpiData.dossiersStatusCounts).map(([status, count]) => (
                  <div key={status} className="p-3 bg-white border border-slate-200 rounded-lg text-left">
                    <div className="text-[10px] font-bold text-slate-400 line-clamp-1">{status}</div>
                    <div className="text-lg font-black text-slate-800 mt-1">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reception Report */}
        {selectedReport === "reception" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport d'activité Réception</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="reception-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "reception",
                      ["Indicateur", "Valeur"],
                      [
                        ["Dossiers créés", receptionData.totalCreated],
                        ["Saisie manuelle", receptionData.manualCount],
                        ["Pré-remplissage base NIMR", receptionData.prefilledCount],
                        ["Taux pré-remplissage (%)", receptionData.prefilledPercentage.toFixed(1)]
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Dossiers Créés</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{receptionData.totalCreated}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Saisie Manuelle</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{receptionData.manualCount}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Base Véhicule Utilisée</span>
                <div className="text-2xl font-black text-blue-600 mt-1">{receptionData.prefilledCount}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Taux Pré-remplissage</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{receptionData.prefilledPercentage.toFixed(1)}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs">
              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Motifs de plaintes fréquents</h4>
                {receptionData.motifsFrequents.length === 0 ? (
                  <p className="text-slate-400">Aucune donnée disponible</p>
                ) : (
                  <div className="space-y-2">
                    {receptionData.motifsFrequents.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700 line-clamp-1">{item.motif}</span>
                        <span className="font-bold bg-slate-200 px-2 py-0.5 rounded">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Modèles les plus reçus</h4>
                {receptionData.modelsFrequents.length === 0 ? (
                  <p className="text-slate-400">Aucune donnée disponible</p>
                ) : (
                  <div className="space-y-2">
                    {receptionData.modelsFrequents.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700">{item.model}</span>
                        <span className="font-bold bg-slate-200 px-2 py-0.5 rounded">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Workshop Report */}
        {selectedReport === "workshop" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport d'Activité Atelier</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="workshop-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "workshop",
                      ["Technicien / Pont", "Tâches", "Heures"],
                      [
                        ["TOTAL HEURES ESTIMÉES", "", workshopData.totalLaborHoursEstimated],
                        ["TOTAL HEURES PLANIFIÉES", "", workshopData.totalLaborHoursPlanned],
                        ["TOTAL HEURES PASSÉES (TERMINE)", "", workshopData.totalLaborHoursSpent],
                        ...workshopData.techniciansLoad.map(t => [`Tech: ${t.technicianNom}`, t.plannedTasksCount, t.plannedHours]),
                        ...workshopData.baysLoad.map(b => [`Pont: ${b.bayName}`, b.plannedTasksCount, b.plannedHours])
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Heures de Main-d'œuvre Estimées</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{workshopData.totalLaborHoursEstimated.toFixed(1)} H</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Heures de Main-d'œuvre Planifiées</span>
                <div className="text-2xl font-black text-blue-600 mt-1">{workshopData.totalLaborHoursPlanned.toFixed(1)} H</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Heures Réelles Saisies (Done)</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{workshopData.totalLaborHoursSpent.toFixed(1)} H</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs">
              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Charge par Technicien</h4>
                {workshopData.techniciansLoad.length === 0 ? (
                  <p className="text-slate-400">Aucun technicien chargé sur la période</p>
                ) : (
                  <div className="space-y-2">
                    {workshopData.techniciansLoad.map(tech => (
                      <div key={tech.technicianId} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700">{tech.technicianNom}</span>
                        <span className="font-bold text-blue-600">
                          {tech.plannedTasksCount} tâches ({tech.plannedHours.toFixed(1)} H)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Charge par Pont / Poste</h4>
                {workshopData.baysLoad.length === 0 ? (
                  <p className="text-slate-400">Aucun pont chargé sur la période</p>
                ) : (
                  <div className="space-y-2">
                    {workshopData.baysLoad.map(bay => (
                      <div key={bay.bayId} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700">{bay.bayName}</span>
                        <span className="font-bold text-blue-600">
                          {bay.plannedTasksCount} tâches ({bay.plannedHours.toFixed(1)} H)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Planning Report */}
        {selectedReport === "planning" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport Planning & Réservations</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="planning-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "planning",
                      ["Indicateur", "Valeur"],
                      [
                        ["Réservations à confirmer", planningData.reservationsToConfirmCount],
                        ["Réservations confirmées", planningData.reservationsConfirmedCount],
                        ["Réservations annulées", planningData.reservationsCancelledCount],
                        ["Réservations transformées en planning", planningData.reservationsConvertedCount],
                        ["Taux de transformation (%)", planningData.conversionRate.toFixed(1)],
                        ["Réservations multi-jours (>8h)", planningData.multiDayReservationsCount],
                        ["Conflits/Collisions évités", planningData.conflictsPreventedCount]
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Réservations à Confirmer</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{planningData.reservationsToConfirmCount}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Réservations Confirmées</span>
                <div className="text-2xl font-black text-blue-600 mt-1">{planningData.reservationsConfirmedCount}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Transformées en Planning</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{planningData.reservationsConvertedCount}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Taux de Transformation</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{planningData.conversionRate.toFixed(1)}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs">
              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Réservations Multi-jours</h4>
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-slate-600">Nombre de réservations réparties sur plusieurs jours (&gt;8h)</span>
                  <span className="font-black text-blue-600 text-lg" data-testid="planning-multiday-count">
                    {planningData.multiDayReservationsCount}
                  </span>
                </div>
              </div>

              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Sécurité & Prévention</h4>
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-slate-600">Collisions ou conflits évités par l'algorithme</span>
                  <span className="font-black text-emerald-600 text-lg" data-testid="planning-conflicts-count">
                    {planningData.conflictsPreventedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QC Report */}
        {selectedReport === "qc" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport Contrôle Qualité</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="qc-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "qc",
                      ["Indicateur", "Valeur"],
                      [
                        ["Dossiers vérifiés en QC", qcData.totalQcChecked],
                        ["Acceptés du premier coup (FTR)", qcData.firstTimeRightRate.toFixed(1)],
                        ["Dossiers validés QC", qcData.totalQcPassed],
                        ["Dossiers refusés QC", qcData.totalQcFailed],
                        ["Taux d'acceptation QC (%)", qcData.passRate.toFixed(1)]
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Dossiers Contrôlés</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{qcData.totalQcChecked}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Validés QC</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{qcData.totalQcPassed}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Refusés QC</span>
                <div className="text-2xl font-black text-rose-600 mt-1">{qcData.totalQcFailed}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">First Time Right (FTR)</span>
                <div className="text-2xl font-black text-blue-600 mt-1" data-testid="qc-ftr-rate">{qcData.firstTimeRightRate.toFixed(1)}%</div>
              </div>
            </div>

            <div className="border rounded-xl p-4 text-left text-xs">
              <h4 className="font-extrabold uppercase text-slate-700 mb-3">Principaux motifs de refus de contrôle qualité</h4>
              {qcData.motifsRefus.length === 0 ? (
                <p className="text-slate-400">Aucun refus enregistré sur la période</p>
              ) : (
                <div className="space-y-2">
                  {qcData.motifsRefus.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-700">{item.motif}</span>
                      <span className="font-bold bg-slate-200 px-2 py-0.5 rounded">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Report */}
        {selectedReport === "delivery" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport des Livraisons</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="delivery-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "delivery",
                      ["Indicateur", "Valeur"],
                      [
                        ["Dossiers prêts à livrer", deliveryData.totalReadyToDeliver],
                        ["Dossiers livrés", deliveryData.totalDelivered],
                        ["Dossiers en attente client", deliveryData.totalPendingClient],
                        ["Délai moyen QC -> Livraison (jours)", deliveryData.averageQcToDeliveryDays.toFixed(1)]
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Prêts à Livrer</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{deliveryData.totalReadyToDeliver}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Dossiers Livrés</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{deliveryData.totalDelivered}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">En Attente Client</span>
                <div className="text-2xl font-black text-amber-600 mt-1">{deliveryData.totalPendingClient}</div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Délai Moyen QC - Livraison</span>
                <div className="text-2xl font-black text-blue-600 mt-1" data-testid="delivery-avg-days">
                  {deliveryData.averageQcToDeliveryDays.toFixed(1)} <span className="text-xs font-semibold text-slate-400">Jours</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complaints Report */}
        {selectedReport === "complaints" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport des Réclamations</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="complaints-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "complaints",
                      ["Statut Réclamation", "Nombre"],
                      Object.entries(complaintsData.byStatus)
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Réclamations</span>
                <div className="text-2xl font-black text-slate-900 mt-1" data-testid="complaints-total-count">
                  {complaintsData.totalComplaints}
                </div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Délai Moyen de Résolution</span>
                <div className="text-2xl font-black text-blue-600 mt-1" data-testid="complaints-avg-resolution">
                  {complaintsData.averageResolutionDays.toFixed(1)} <span className="text-xs font-semibold text-slate-400">Jours</span>
                </div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Réclamations Résolues / Clôturées</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {(complaintsData.byStatus.resolue || 0) + (complaintsData.byStatus.cloturee || 0)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs">
              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Par Statut</h4>
                <div className="space-y-2">
                  {Object.entries(complaintsData.byStatus).map(([status, val]) => (
                    <div key={status} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-700 uppercase">{status}</span>
                      <span className="font-bold bg-slate-200 px-2.5 py-0.5 rounded">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Par Criticité</h4>
                <div className="space-y-2">
                  {Object.entries(complaintsData.byCriticite).map(([crit, val]) => {
                    const color = crit === "critique" ? "text-rose-600" : crit === "haute" ? "text-amber-600" : "text-slate-700";
                    return (
                      <div key={crit} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className={`font-semibold uppercase ${color}`}>{crit}</span>
                        <span className="font-bold bg-slate-200 px-2.5 py-0.5 rounded">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blockings Report */}
        {selectedReport === "blockings" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Rapport des Blocages</h3>
              {canExportSavReports(currentUserRole) && (
                <button
                  type="button"
                  data-testid="blockings-export-csv"
                  onClick={() =>
                    handleExportCSV(
                      "blockings",
                      ["Motif / Famille", "Dossiers"],
                      [
                        ["TOTAL DOSSIERS BLOQUÉS", blockingData.totalBlockedDossiers],
                        ["TOTAL TÂCHES BLOQUÉES", blockingData.totalBlockedTasks],
                        ["DURÉE MOYENNE BLOCAGE (HEURES)", blockingData.averageBlockingDurationHours.toFixed(1)],
                        ...blockingData.motifsBlocage.map(m => [`Motif: ${m.motif}`, m.count]),
                        ...blockingData.blockingByFamily.map(f => [`Famille: ${f.family}`, f.count])
                      ]
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Dossiers Bloqués</span>
                <div className="text-2xl font-black text-rose-600 mt-1" data-testid="blocking-dossiers-count">
                  {blockingData.totalBlockedDossiers}
                </div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tâches Bloquées</span>
                <div className="text-2xl font-black text-rose-600 mt-1" data-testid="blocking-tasks-count">
                  {blockingData.totalBlockedTasks}
                </div>
              </div>
              <div className="p-4 border rounded-xl bg-slate-50/50 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Durée Moyenne de Blocage</span>
                <div className="text-2xl font-black text-slate-900 mt-1" data-testid="blocking-avg-hours">
                  {blockingData.averageBlockingDurationHours.toFixed(1)} <span className="text-xs font-semibold text-slate-400">Heures</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs">
              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Répartition par Famille</h4>
                <div className="space-y-2">
                  {blockingData.blockingByFamily.map(f => (
                    <div key={f.family} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-700">{f.family}</span>
                      <span className="font-bold bg-slate-200 px-2.5 py-0.5 rounded">{f.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded-xl p-4">
                <h4 className="font-extrabold uppercase text-slate-700 mb-3">Motifs de Blocage les plus fréquents</h4>
                {blockingData.motifsBlocage.length === 0 ? (
                  <p className="text-slate-400">Aucun motif enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {blockingData.motifsBlocage.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700 line-clamp-1">{item.motif}</span>
                        <span className="font-bold bg-slate-200 px-2.5 py-0.5 rounded">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vehicle History View */}
        {selectedReport === "vehicle-history" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Historique d'Interventions Véhicule</h3>
            
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                data-testid="history-vehicle-input"
                placeholder="Entrer VIN ou Immatriculation..."
                value={historyVinOrPlate}
                onChange={e => setHistoryVinOrPlate(e.target.value)}
                className="flex-1 p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
              <button
                type="button"
                data-testid="history-vehicle-search-btn"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Rechercher
              </button>
            </div>

            {activeVehicleHistory ? (
              <div className="border rounded-xl p-5 text-left space-y-4 text-xs" data-testid="vehicle-history-result">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Marque / Modèle</span>
                    <div className="font-bold text-slate-850">{activeVehicleHistory.brand} {activeVehicleHistory.model}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">VIN</span>
                    <div className="font-bold font-mono text-slate-850">{activeVehicleHistory.vin || "Non spécifié"}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Plaque d'immatriculation</span>
                    <div className="font-bold font-mono text-slate-850">{activeVehicleHistory.plateNumber || "Non spécifiée"}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Client associé</span>
                    <div className="font-bold text-slate-850">{activeVehicleHistory.clientNom}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Nombre de passages</span>
                    <div className="text-lg font-black text-slate-900 mt-1">{activeVehicleHistory.passagesCount}</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Dernier kilométrage</span>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {activeVehicleHistory.lastServiceMileage?.toLocaleString() || "Non spécifié"} km
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Premier Passage</span>
                    <div className="text-sm font-bold text-slate-900 mt-1.5">{activeVehicleHistory.firstPassageDate}</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Dernier Passage</span>
                    <div className="text-sm font-bold text-slate-900 mt-1.5">{activeVehicleHistory.lastPassageDate}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[10px]">Dossiers SAV Associés</h4>
                  <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden">
                    {activeVehicleHistory.dossiers.map(d => (
                      <div key={d.id} className="p-3 bg-white flex justify-between items-center hover:bg-slate-50/50">
                        <div>
                          <div className="font-bold text-slate-800">{d.id} ({d.typeDossier})</div>
                          <div className="text-[10px] text-slate-400">Date réception : {d.dateReception} - Kilométrage : {d.vehiculeKilometrage} km</div>
                          {d.plainteClient && <div className="text-[10px] text-slate-500 italic mt-0.5">Plainte : {d.plainteClient}</div>}
                        </div>
                        <span className="px-2.5 py-0.5 bg-slate-100 border text-slate-700 font-extrabold uppercase rounded text-[9px]">
                          {d.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              historyVinOrPlate.trim() && (
                <div className="p-5 border rounded-xl text-center text-slate-550 bg-slate-50/50" data-testid="vehicle-history-empty">
                  Aucun historique trouvé pour le véhicule "{historyVinOrPlate}".
                </div>
              )
            )}
          </div>
        )}

        {/* Dossier History View */}
        {selectedReport === "dossier-history" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-left">Historique Chronologique Dossier</h3>
            
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                data-testid="history-dossier-input"
                placeholder="Entrer numéro dossier (ex: NIMR-2026-001)..."
                value={historyDossierId}
                onChange={e => setHistoryDossierId(e.target.value)}
                className="flex-1 p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
              <button
                type="button"
                data-testid="history-dossier-search-btn"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Rechercher
              </button>
            </div>

            {activeDossierHistory ? (
              <div className="border rounded-xl p-5 text-left space-y-4 text-xs" data-testid="dossier-history-result">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <h4 className="font-extrabold text-slate-800">Timeline du dossier {historyDossierId}</h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Total : {activeDossierHistory.length} événements</span>
                </div>

                <div className="relative border-l border-slate-200 ml-3.5 pl-6 space-y-5">
                  {activeDossierHistory.map((item, index) => (
                    <div key={index} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-0.5 bg-blue-600 border-4 border-white w-4.5 h-4.5 rounded-full shadow-sm flex items-center justify-center" />
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{item.label}</span>
                          <span className="text-[9px] bg-slate-100 border text-zinc-500 font-bold px-1.5 py-0.2 rounded uppercase">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.date).toLocaleString()} {item.role && ` - [${item.role}]`} {item.actor && item.actor !== item.role && ` - ${item.actor}`}
                        </div>
                        {item.details && (
                          <div className="bg-slate-50 p-2 rounded border border-slate-150 text-[10px] text-slate-600 mt-1">
                            {item.details}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              historyDossierId.trim() && (
                <div className="p-5 border rounded-xl text-center text-slate-550 bg-slate-50/50" data-testid="dossier-history-empty">
                  Aucun historique trouvé pour le dossier "{historyDossierId}".
                </div>
              )
            )}
          </div>
        )}

      </div>

    </div>
  );
}
