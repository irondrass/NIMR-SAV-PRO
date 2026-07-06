/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Gauge,
  ListFilter,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";
import {
  buildDirectorDashboardKpis,
  DashboardChartPoint,
  DashboardMetric,
  DashboardPeriod,
  DashboardTone,
} from "../dashboard-kpis";
import { buildAgingAlerts, filterAgingAlerts } from "../aging-alerts";
import { DossierPriority, DossierSAV, DossierStatus, TechnicienResource, WorkshopReservation, WorkshopAvailabilityConfig, UserRole } from "../types";
import { LicencePlate, PriorityBadge } from "./UIParts";
import { CLIENT_SIDE_SECURITY_NOTICE } from "../rc-notices";

interface DirectorDashboardProps {
  dossiers: DossierSAV[];
  techniciens: TechnicienResource[];
  reservations?: WorkshopReservation[];
  availabilityConfig?: WorkshopAvailabilityConfig;
  onSelectDossier: (id: string) => void;
  onExportBackup?: () => void;
  userRole?: UserRole;
}

const periodLabels: Record<DashboardPeriod, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  all: "Tous",
};

const toneClasses: Record<DashboardTone, { border: string; bg: string; text: string; icon: string }> = {
  slate: { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-900", icon: "text-slate-600" },
  blue: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-900", icon: "text-blue-600" },
  cyan: { border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-900", icon: "text-cyan-600" },
  emerald: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", icon: "text-emerald-600" },
  amber: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", icon: "text-amber-600" },
  rose: { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-900", icon: "text-rose-600" },
  violet: { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-900", icon: "text-violet-600" },
};

export default function DirectorDashboard({ dossiers, techniciens, reservations, availabilityConfig, onSelectDossier, onExportBackup, userRole }: DirectorDashboardProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("all");
  const [status, setStatus] = useState<DossierStatus | "all">("all");
  const [technicianId, setTechnicianId] = useState<string | "all">("all");
  const [priority, setPriority] = useState<DossierPriority | "all">("all");
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState("");

  const filteredDossiersForKpis = useMemo(() => {
    if (!dashboardSearchQuery.trim()) {
      return dossiers;
    }
    const q = dashboardSearchQuery.toLowerCase().trim();
    return dossiers.filter(d =>
      d.id?.toLowerCase().includes(q) ||
      d.vehiculeImmatriculation?.toLowerCase().includes(q) ||
      d.vehiculeVIN?.toLowerCase().includes(q) ||
      d.clientNom?.toLowerCase().includes(q)
    );
  }, [dossiers, dashboardSearchQuery]);

  const kpis = useMemo(() => buildDirectorDashboardKpis({
    dossiers: filteredDossiersForKpis,
    techniciens,
    reservations,
    availabilityConfig,
    filters: { period, status, technicianId, priority },
  }), [filteredDossiersForKpis, period, priority, status, technicianId, techniciens, reservations, availabilityConfig]);
  const dashboardAgingAlerts = useMemo(
    () => filterAgingAlerts(buildAgingAlerts(filteredDossiersForKpis), "dashboard"),
    [filteredDossiersForKpis]
  );
  const activeActivityCards = kpis.activity.cards.slice(0, 4);
  const erpActivityCards = kpis.activity.cards.slice(4);

  const chartColor = "#2563eb";
  const secondaryChartColor = "#10b981";

  // Today vs Yesterday trends
  const todayTrends = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    const todayReceived = dossiers.filter(d => d.dateReception?.slice(0, 10) === todayStr).length;
    const yesterdayReceived = dossiers.filter(d => d.dateReception?.slice(0, 10) === yesterdayStr).length;

    const todayInWork = dossiers.filter(d => d.statut === DossierStatus.EN_TRAVAUX && d.dateDernierStatut?.slice(0, 10) === todayStr).length;
    const yesterdayInWork = dossiers.filter(d => d.statut === DossierStatus.EN_TRAVAUX && d.dateDernierStatut?.slice(0, 10) === yesterdayStr).length;

    const todayDelivered = dossiers.filter(d => (d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.CLOTURE) && d.dateDernierStatut?.slice(0, 10) === todayStr).length;
    const yesterdayDelivered = dossiers.filter(d => (d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.CLOTURE) && d.dateDernierStatut?.slice(0, 10) === yesterdayStr).length;

    return [
      { label: "Réceptions", today: todayReceived, yesterday: yesterdayReceived, testId: "trend-receptions" },
      { label: "En travaux", today: todayInWork, yesterday: yesterdayInWork, testId: "trend-in-work" },
      { label: "Livraisons", today: todayDelivered, yesterday: yesterdayDelivered, testId: "trend-deliveries" },
    ];
  }, [dossiers]);

  return (
    <div data-testid="director-dashboard" className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                {userRole === UserRole.LECTURE_SEULE ? "Lecture seule" : "Directeur SAV"}
              </span>
              <span className="text-xs font-semibold text-slate-500">NIMR SAV PRO v1.1.1</span>
              <span data-testid="pilot-warning-badge-dashboard" className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded border border-amber-300 animate-pulse">
                Données pilote / recette
              </span>
            </div>
            <h1 className="font-display text-2xl font-black text-slate-950">Dashboard KPI opérationnel</h1>
            <p className="max-w-3xl text-sm font-medium text-slate-600">
              Pilotage atelier, qualité, délais et alertes critiques du circuit SAV.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Filtres période">
            {(Object.keys(periodLabels) as DashboardPeriod[]).map(item => (
              <button
                key={item}
                type="button"
                data-testid={`dashboard-period-${item}`}
                aria-pressed={period === item}
                onClick={() => setPeriod(item)}
                className={`rounded-md border px-3 py-2 text-xs font-extrabold transition ${
                  period === item
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {periodLabels[item]}
              </button>
            ))}
          </div>
        </div>

        <div data-testid="client-side-security-notice" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
          {CLIENT_SIDE_SECURITY_NOTICE}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Rechercher</span>
            <input
              type="text"
              data-testid="dashboard-search-input"
              value={dashboardSearchQuery}
              onChange={event => setDashboardSearchQuery(event.target.value)}
              placeholder="Immat, VIN, dossier, client..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <FilterSelect
            testId="dashboard-filter-status"
            label="Statut"
            value={status}
            onChange={value => setStatus(value as DossierStatus | "all")}
            options={Object.values(DossierStatus).map(value => ({ value, label: getDashboardStatusLabel(value) }))}
          />
          <FilterSelect
            testId="dashboard-filter-technician"
            label="Technicien"
            value={technicianId}
            onChange={value => setTechnicianId(value)}
            options={techniciens.map(technician => ({ value: technician.id, label: technician.nom }))}
          />
          <FilterSelect
            testId="dashboard-filter-priority"
            label="Priorité"
            value={priority}
            onChange={value => setPriority(value as DossierPriority | "all")}
            options={Object.values(DossierPriority).map(value => ({ value, label: value }))}
          />
        </div>
      </section>

      <section data-testid="dashboard-activity-view" className="space-y-3">
        <SectionTitle icon={<Gauge className="h-5 w-5" />} title="Vue activité" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div data-testid="dashboard-operational-active-kpis" className="space-y-2 xl:col-span-7">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Opérationnel actif</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {activeActivityCards.map(metric => (
                <div key={metric.testId}>
                  <MetricCard metric={metric} />
                </div>
              ))}
            </div>
          </div>

          <div data-testid="dashboard-archived-erp-kpis" className="space-y-2 xl:col-span-5">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Clôturé / ERP</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {erpActivityCards.map(metric => (
                <div key={metric.testId}>
                  <MetricCard metric={metric} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-workshop-view" className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-5">
          <SectionTitle icon={<Wrench className="h-5 w-5" />} title="Vue atelier" />
          <div className="grid grid-cols-2 gap-3">
            <InfoTile
              testId="kpi-workshop-occupancy"
              label="Occupation atelier"
              value={kpis.workshop.occupancyLabel}
              detail="Capacité réelle"
            />
            <InfoTile
              testId="kpi-workshop-planned"
              label="Charge planifiée"
              value={kpis.workshop.plannedLoadLabel}
              detail="Depuis Gantt"
            />
            <InfoTile
              testId="kpi-workshop-reserved"
              label="Charge réservée"
              value={kpis.workshop.reservedLoadLabel}
              detail="Depuis réservations"
            />
            <InfoTile
              testId="kpi-workshop-in-progress"
              label="Charge en cours"
              value={kpis.workshop.inProgressLoadLabel}
              detail="Travaux actifs"
            />
            <InfoTile
              testId="kpi-estimated-vs-spent"
              label="Estimé vs passé"
              value={`${kpis.workshop.estimatedHours} h / ${kpis.workshop.spentHours} h`}
              detail="Ordres de réparation"
            />
            <InfoTile
              testId="kpi-late-tasks"
              label="Tâches en retard"
              value={kpis.workshop.lateTasks.length}
              detail="Créneau dépassé"
            />
            <InfoTile
              testId="kpi-blocked-tasks"
              label="Tâches bloquées"
              value={kpis.workshop.blockedTasks.length}
              detail="Blocage atelier actif"
            />
          </div>
        </div>

        <div className="space-y-3 xl:col-span-7">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <LoadList title="Charge techniciens" testId="dashboard-technician-load" items={kpis.workshop.technicianLoad.slice(0, 5)} />
            <LoadList title="Charge ponts / postes" testId="dashboard-bay-load" items={kpis.workshop.bayLoad.slice(0, 5)} />
          </div>
        </div>
      </section>

      {dashboardAgingAlerts.length > 0 && (
        <section data-testid="aging-alerts-dashboard" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-black uppercase">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Alertes aging opérationnelles ({dashboardAgingAlerts.length})
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {dashboardAgingAlerts.slice(0, 8).map(alert => (
              <button
                key={`${alert.kind}-${alert.dossierId}`}
                type="button"
                onClick={() => onSelectDossier(alert.dossierId)}
                className="rounded-md border border-rose-200 bg-white px-3 py-2 text-left font-semibold text-rose-900 hover:border-rose-300"
              >
                <span className="font-mono font-black">{alert.dossierId}</span>
                <span className="ml-2 font-black">{alert.title}</span>
                <span className="block text-rose-700">{alert.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section data-testid="dashboard-delay-view" className="space-y-3">
        <SectionTitle icon={<Timer className="h-5 w-5" />} title="Vue délais" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {kpis.delays.map(delay => (
            <div key={delay.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{delay.label}</div>
              <div className="mt-2 text-xl font-black text-slate-950">{delay.value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {delay.measurableCount}/{delay.totalCount} mesurables
              </div>
            </div>
          ))}
        </div>
      </section>

      <section data-testid="dashboard-quality-view" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <SectionTitle icon={<ShieldCheck className="h-5 w-5" />} title="Vue qualité" />
          <div className="grid grid-cols-2 gap-3">
            <InfoTile testId="kpi-qc-accepted" label="QC accepté" value={kpis.quality.qcAccepted} detail="Dossiers validés" />
            <InfoTile testId="kpi-qc-refused" label="QC refusé" value={kpis.quality.qcRefused} detail="Retour retravail" />
            <InfoTile testId="kpi-first-time-right" label="First Time Right" value={kpis.quality.firstTimeRightLabel} detail={`${kpis.quality.firstTimeRightCount} sans refus QC`} />
            <InfoTile testId="kpi-returned-rework" label="Retours retravail" value={kpis.quality.returnedToWorkshop} detail="Motif QC refusé" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-black uppercase text-slate-950">Motifs de refus QC</h3>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {kpis.quality.refusalReasons.length > 0 ? (
            <div className="space-y-2">
              {kpis.quality.refusalReasons.map(item => (
                <div key={item.reason} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-bold text-slate-700">{item.reason}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-700">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
              Aucun refus QC dans le filtre actif.
            </div>
          )}
        </div>
      </section>

      <section data-testid="dashboard-alerts-view" className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-5">
          <SectionTitle icon={<AlertTriangle className="h-5 w-5" />} title="Alertes Directeur" />
          <div className="space-y-2">
            {kpis.alerts.length > 0 ? kpis.alerts.slice(0, 8).map(alert => (
              <div
                key={alert.id}
                data-testid="dashboard-critical-alert"
                className={`rounded-lg border p-3 shadow-sm ${
                  alert.severity === "critical"
                    ? "border-rose-200 bg-rose-50"
                    : alert.severity === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">{alert.title}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-600">{alert.detail}</div>
                  </div>
                  {alert.dossierId ? (
                    <button
                      type="button"
                      data-testid={`dashboard-dossier-link-${alert.dossierId}`}
                      onClick={() => onSelectDossier(alert.dossierId!)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-blue-700 hover:border-blue-300"
                    >
                      Ouvrir
                    </button>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500 shadow-sm">
                Aucune alerte critique dans le filtre actif.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-black uppercase text-slate-950">Dossiers critiques</h3>
            <ListFilter className="h-4 w-4 text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Dossier</th>
                  <th className="py-2 pr-3">Client & véhicule</th>
                  <th className="py-2 pr-3">Priorité</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Cause</th>
                  <th className="py-2 text-right">Lien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kpis.criticalDossiers.length > 0 ? kpis.criticalDossiers.map(dossier => (
                  <tr key={dossier.id}>
                    <td className="py-3 pr-3 font-mono font-black text-slate-900">{dossier.id}</td>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{dossier.client}</div>
                      <div className="text-slate-500">{dossier.vehicle}</div>
                    </td>
                    <td className="py-3 pr-3"><PriorityBadge priority={dossier.priority} /></td>
                    <td className="py-3 pr-3"><DashboardStatusPill status={dossier.status} /></td>
                    <td className="py-3 pr-3 font-semibold text-slate-600">{dossier.reason}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        data-testid={`dashboard-critical-dossier-link-${dossier.id}`}
                        onClick={() => onSelectDossier(dossier.id)}
                        className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-5 text-center font-bold text-slate-500">Aucun dossier critique.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-charts-view" className="space-y-3">
        <SectionTitle icon={<BarChart3 className="h-5 w-5" />} title="Micro-graphiques" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <ChartPanel title="Entrées / sorties">
            <MicroBarChart
              testId="dashboard-svg-entries-exits"
              data={kpis.charts.entriesExits}
              color={chartColor}
              secondaryColor={secondaryChartColor}
            />
          </ChartPanel>
          <ChartPanel title="Dossiers bloqués">
            <MicroBarChart testId="dashboard-svg-blocked" data={kpis.charts.blocked} color="#e11d48" />
          </ChartPanel>
          <ChartPanel title="Charge atelier">
            <MicroBarChart testId="dashboard-svg-workshop-load" data={kpis.charts.workshopLoad} color="#0e7490" secondaryColor="#cbd5e1" />
          </ChartPanel>
          <ChartPanel title="QC accepté/refusé">
            <MicroBarChart testId="dashboard-svg-qc" data={kpis.charts.quality} color="#059669" secondaryColor="#e11d48" />
          </ChartPanel>
          <ChartPanel title="Tendance hebdo">
            <MicroLineChart testId="dashboard-svg-weekly-trend" data={kpis.charts.weeklyTrend} color="#7c3aed" />
          </ChartPanel>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-black uppercase text-slate-950">Dossiers du filtre actif</h3>
          <Truck className="h-4 w-4 text-slate-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Dossier</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Véhicule</th>
                <th className="py-2 pr-3">Immat.</th>
                <th className="py-2 pr-3">Priorité</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 text-right">Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kpis.filteredDossiers.slice(0, 12).map(dossier => (
                <tr key={dossier.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-3 font-mono font-black text-slate-900">{dossier.id}</td>
                  <td className="py-3 pr-3 font-bold text-slate-800">{dossier.clientNom}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-600">{dossier.vehiculeMarque} {dossier.vehiculeModele}</td>
                  <td className="py-3 pr-3"><LicencePlate plate={dossier.vehiculeImmatriculation} /></td>
                  <td className="py-3 pr-3"><PriorityBadge priority={dossier.priorite} /></td>
                  <td className="py-3 pr-3"><DashboardStatusPill status={dossier.statut} /></td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      data-testid={`dashboard-table-dossier-link-${dossier.id}`}
                      onClick={() => onSelectDossier(dossier.id)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-blue-700 hover:border-blue-300"
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
              {kpis.filteredDossiers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-5 text-center font-bold text-slate-500">Aucun dossier dans le filtre actif.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Today vs Yesterday trends (Part 11) */}
      <section data-testid="dashboard-trends" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h2 className="font-display text-xs font-black uppercase tracking-wide text-slate-950">Tendances Aujourd'hui vs Hier</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {todayTrends.map(trend => {
            const diff = trend.today - trend.yesterday;
            const isUp = diff > 0;
            const isDown = diff < 0;
            return (
              <div key={trend.testId} data-testid={trend.testId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{trend.label}</div>
                <div className="flex items-end gap-2">
                  <span className="font-display text-2xl font-black text-slate-950">{trend.today}</span>
                  {diff !== 0 && (
                    <span className={`text-xs font-bold flex items-center gap-0.5 mb-0.5 ${
                      isUp ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isUp ? "+" : ""}{diff}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">Hier : {trend.yesterday}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pilot backup banner (Part 13) */}
      <section data-testid="dashboard-backup-banner" className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black text-amber-900">
            <AlertTriangle className="w-4 h-4" />
            Rappel pilote terrain : exportez une sauvegarde JSON quotidienne
          </div>
          <p className="text-[11px] font-semibold text-amber-800">
            Toutes les données sont stockées en local. Un export quotidien est recommandé pour la durabilité.
          </p>
        </div>
        {onExportBackup && (
          <button
            type="button"
            data-testid="dashboard-export-backup-btn"
            onClick={onExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exporter sauvegarde JSON
          </button>
        )}
      </section>

    </div>
  );
}

function FilterSelect({
  testId,
  label,
  value,
  options,
  onChange,
}: {
  testId: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <select
        data-testid={testId}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">Tous</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-950">
      <span className="text-blue-600">{icon}</span>
      <h2 className="font-display text-xs font-black uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function DashboardStatusPill({ status }: { status: DossierStatus }) {
  const isBlocked = status === DossierStatus.BLOQUE;
  const isImmobilized = status === DossierStatus.IMMOBILISE;
  const isNotWithdrawn = status === DossierStatus.NON_RETIRE;
  const isReady = status === DossierStatus.PRET_A_LIVRER || status === DossierStatus.PRET_FACTURATION;
  const isRunning = status === DossierStatus.EN_TRAVAUX || status === DossierStatus.TRAVAUX_PLANIFIES;
  const classes = isImmobilized
    ? "border-red-200 bg-red-50 text-red-800"
    : isBlocked
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : isNotWithdrawn
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : isReady
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : isRunning
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${classes}`}>
      {getDashboardStatusLabel(status)}
    </span>
  );
}

function getDashboardStatusLabel(status: DossierStatus): string {
  if (status === DossierStatus.PRET_FACTURATION) return "Prêt facturation ERP";
  return status;
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const tone = toneClasses[metric.tone];
  return (
    <div data-testid={metric.testId} className={`min-h-[132px] rounded-lg border ${tone.border} ${tone.bg} p-4 shadow-sm`}>
      <div className="flex h-full flex-col justify-between">
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{metric.label}</div>
        <div>
          <div className={`font-display text-3xl font-black ${tone.text}`}>{metric.value}</div>
          <div className="mt-1 text-xs font-semibold text-slate-600">{metric.detail}</div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ testId, label, value, detail }: { testId: string; label: string; value: number | string; detail: string }) {
  return (
    <div data-testid={testId} className="min-h-[112px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-display text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div>
    </div>
  );
}

function LoadList({ title, testId, items }: { title: string; testId: string; items: Array<{ id: string; label: string; hours: number; capacityHours: number | null; percent: number | null; alert: boolean }> }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-black uppercase text-slate-950">{title}</h3>
        <UserCheck className="h-4 w-4 text-slate-500" />
      </div>
      <div className="space-y-3">
        {items.length > 0 ? items.map(item => {
          const percent = item.percent ?? 0;
          return (
            <div key={item.id}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-xs font-black text-slate-700">{item.label}</span>
                <span className={`text-xs font-black ${item.alert ? "text-rose-600" : "text-slate-600"}`}>
                  {item.percent === null ? `${item.hours} h` : `${item.percent}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${item.alert ? "bg-rose-500" : "bg-blue-600"}`}
                  style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                {item.capacityHours === null ? `${item.hours} h planifiées` : `${item.hours} h / ${item.capacityHours} h`}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
            Non mesurable
          </div>
        )}
      </div>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-600">{title}</h3>
      {children}
    </div>
  );
}

function MicroBarChart({
  data,
  testId,
  color,
  secondaryColor,
}: {
  data: DashboardChartPoint[];
  testId: string;
  color: string;
  secondaryColor?: string;
}) {
  const maxValue = Math.max(1, ...data.flatMap(point => [point.value, point.secondaryValue ?? 0]));
  const width = 220;
  const height = 108;
  const barSpace = width / Math.max(1, data.length);
  const barWidth = Math.max(8, Math.min(18, barSpace * (secondaryColor ? 0.28 : 0.42)));

  return (
    <svg data-testid={testId} role="img" aria-label={testId} viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
      <line x1="0" y1="92" x2={width} y2="92" stroke="#e2e8f0" strokeWidth="1" />
      {data.map((point, index) => {
        const x = index * barSpace + barSpace / 2;
        const primaryHeight = Math.max(2, (point.value / maxValue) * 72);
        const secondaryHeight = Math.max(2, ((point.secondaryValue ?? 0) / maxValue) * 72);
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x - barWidth - (secondaryColor ? 2 : -barWidth / 2)} y={92 - primaryHeight} width={barWidth} height={primaryHeight} rx="3" fill={color} />
            {secondaryColor ? (
              <rect x={x + 2} y={92 - secondaryHeight} width={barWidth} height={secondaryHeight} rx="3" fill={secondaryColor} />
            ) : null}
            <text x={x} y="106" textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{point.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MicroLineChart({ data, testId, color }: { data: DashboardChartPoint[]; testId: string; color: string }) {
  const width = 220;
  const height = 108;
  const maxValue = Math.max(1, ...data.map(point => point.value));
  const points = data.map((point, index) => {
    const x = data.length <= 1 ? width / 2 : index * (width / (data.length - 1));
    const y = 92 - (point.value / maxValue) * 72;
    return { x, y, label: point.label };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <svg data-testid={testId} role="img" aria-label={testId} viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
      <line x1="0" y1="92" x2={width} y2="92" stroke="#e2e8f0" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(point => (
        <g key={`${point.label}-${point.x}`}>
          <circle cx={point.x} cy={point.y} r="4" fill="white" stroke={color} strokeWidth="2" />
          <text x={point.x} y="106" textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}
