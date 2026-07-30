import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  LockKeyhole,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Users,
  Wrench,
} from "lucide-react";
import { DossierSAV, TechnicienResource, UserRole, WorkshopAvailabilityConfig, WorkshopBay } from "../types";
import { getEffectiveWorkshopWindowsForResource } from "../workshop-availability";
import { calculateWorkshopCapacityKpi, findSchedulingSlots } from "../workshop-scheduling/engine";
import {
  confirmPendingBooking,
  createPendingBooking,
  createWorkshopSchedulingGateway,
  loadWorkshopBookings,
  loadWorkshopSchedulingSettings,
  persistWorkshopSchedulingSettings,
  saveWorkshopBookings,
} from "../workshop-scheduling/service";
import {
  BookingConfirmationRequest,
  SchedulingEmployee,
  SchedulingMaterialResource,
  SlotRecommendation,
  WorkshopBooking,
  WorkshopSchedulingSettings,
  WorkshopTask,
} from "../workshop-scheduling/types";

interface WorkshopOperationsViewProps {
  dossiers: DossierSAV[];
  technicians: TechnicienResource[];
  materialResources: WorkshopBay[];
  availabilityConfig: WorkshopAvailabilityConfig;
  activeRole: UserRole;
  onSelectDossier: (id: string) => void;
}

const DEFAULT_SETTINGS: WorkshopSchedulingSettings = {
  siteId: "nimr-tunis",
  workshopId: "atelier-principal",
  granularityMinutes: 15,
  alternatives: 2,
  defaultBufferMinutes: 10,
  defaultQualityControlMinutes: 15,
  defaultRoadTestMinutes: 20,
  allowOverbooking: false,
  requirePartsBeforePlanning: true,
  optimizationWeights: {
    promisedDate: 40,
    continuity: 15,
    workloadBalance: 20,
    vehicleImmobilization: 15,
    skillFit: 10,
  },
};

function toIsoWindow(date: Date, window: { start: string; end: string }): { start: string; end: string } {
  const atTime = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result.toISOString();
  };
  return { start: atTime(window.start), end: atTime(window.end) };
}

function buildDailyWindows(
  config: WorkshopAvailabilityConfig,
  resource: { technicianId?: string; bayId?: string },
  days = 30,
): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let index = 0; index < days; index += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);
    windows.push(...getEffectiveWorkshopWindowsForResource(day, config, resource)
      .map(window => toIsoWindow(day, window)));
  }
  return windows;
}

function buildUnavailabilityWindows(
  entries: Array<{ startDate: string; endDate: string; startTime?: string; endTime?: string }>,
): Array<{ start: string; end: string }> {
  return entries.map(entry => ({
    start: new Date(`${entry.startDate}T${entry.startTime ?? "00:00"}:00`).toISOString(),
    end: new Date(`${entry.endDate}T${entry.endTime ?? "23:59"}:59`).toISOString(),
  }));
}

function adaptEmployees(
  technicians: TechnicienResource[],
  settings: WorkshopSchedulingSettings,
  availabilityConfig: WorkshopAvailabilityConfig,
): SchedulingEmployee[] {
  return technicians.map(technician => ({
    id: technician.id,
    name: technician.displayName ?? technician.nom,
    siteId: settings.siteId,
    workshopId: settings.workshopId,
    active: technician.actif !== false && technician.disponibilite !== "absent",
    skills: technician.compétences.map(skillId => ({ skillId, level: "autonomous" as const })),
    productiveMinutesPerDay: technician.capaciteJournaliereMinutes ?? Math.round(technician.capaciteJournaliere * 60),
    targetProductivity: 100,
    allowsParallelTasks: false,
    workingWindows: buildDailyWindows(availabilityConfig, { technicianId: technician.id }),
    unavailableWindows: buildUnavailabilityWindows(
      availabilityConfig.absences.filter(absence => absence.technicianId === technician.id),
    ),
  }));
}

function adaptMaterials(
  resources: WorkshopBay[],
  settings: WorkshopSchedulingSettings,
  availabilityConfig: WorkshopAvailabilityConfig,
): SchedulingMaterialResource[] {
  return resources.map(resource => ({
    id: resource.id,
    code: resource.id,
    name: resource.nom ?? resource.name,
    typeId: resource.categorie ?? resource.zone ?? "generic",
    siteId: settings.siteId,
    workshopId: settings.workshopId,
    state: resource.actif === false ? "out_of_service" as const : "available" as const,
    active: resource.actif !== false && resource.planifiable !== false,
    shareable: (resource.capaciteVehicules ?? 1) > 1,
    simultaneousCapacity: resource.capaciteVehicules ?? 1,
    compatibleOperationFamilies: resource.compatibleTaskTypes ?? [],
    compatibleEnergies: [],
    availableWindows: buildDailyWindows(availabilityConfig, { bayId: resource.id }),
    unavailableWindows: buildUnavailabilityWindows(
      availabilityConfig.bayUnavailabilities.filter(item => item.bayId === resource.id),
    ),
  }));
}

function normalizePromisedAt(value?: string): string | undefined {
  if (!value || value.includes("T")) return value;
  return new Date(`${value}T23:59:59`).toISOString();
}

function adaptTasks(
  dossiers: DossierSAV[],
  settings: WorkshopSchedulingSettings,
  materialResources: WorkshopBay[],
): WorkshopTask[] {
  return dossiers.flatMap(dossier => dossier.ordresReparation.map(line => ({
    id: line.id,
    workOrderId: dossier.id,
    vehicleId: dossier.vehiculeVIN || dossier.vehiculeImmatriculation || dossier.id,
    siteId: settings.siteId,
    workshopId: settings.workshopId,
    label: line.designation,
    description: line.diagnosticFinal,
    operationFamily: line.operationFamily ?? line.workshopStageId ?? "general",
    status: line.status === "done" ? "completed" as const :
      line.status === "in_progress" ? "in_progress" as const :
      line.status === "paused" ? "paused" as const :
      line.status === "blocked" ? "blocked" as const : "ready_to_plan" as const,
    priority: line.taskPriority === "urgente" ? 5 : line.taskPriority === "haute" ? 4 : 3,
    standardDurationMinutes: Math.max(15, Math.round(line.tempsEstime * 60)),
    plannedDurationMinutes: Math.max(15, Math.round(line.tempsEstime * 60)),
    actualDurationMinutes: Math.max(0, Math.round(line.tempsPasse * 60)),
    preparationMinutes: 0,
    executionMinutes: Math.max(15, Math.round(line.tempsEstime * 60)),
    dryingMinutes: 0,
    immobilizationMinutes: 0,
    qualityControlMinutes: settings.defaultQualityControlMinutes,
    bufferBeforeMinutes: settings.defaultBufferMinutes,
    bufferAfterMinutes: settings.defaultBufferMinutes,
    splittable: Boolean(line.planningSegments && line.planningSegments.length > 1),
    minimumTechnicians: 1,
    maximumTechnicians: 1,
    requiredSkills: line.operationFamily ? [{ skillId: line.operationFamily, minimumLevel: "autonomous" as const, required: true }] : [],
    requiredMaterialTypeIds: line.requiredBayId
      ? [String(materialResources.find(resource => resource.id === line.requiredBayId)?.categorie ?? line.requiredBayId)]
      : [],
    optionalMaterialTypeIds: [],
    dependencies: [],
    parts: line.blockSparePartRef ? [{
      partId: line.blockSparePartRef,
      quantity: 1,
      availability: line.status === "blocked" ? "unavailable" as const : "available" as const,
      expectedAt: line.blockSparePartEta,
      requiredBeforePlanning: settings.requirePartsBeforePlanning,
      requiredBeforeStart: true,
    }] : [],
    mayStartWithoutAllParts: false,
    promisedAt: normalizePromisedAt(dossier.dateSouhaiteeLivraison),
    desiredAt: line.planningEnd,
    locked: false,
  })));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function WorkshopOperationsView({
  dossiers,
  technicians,
  materialResources,
  availabilityConfig,
  activeRole,
  onSelectDossier,
}: WorkshopOperationsViewProps) {
  const [settings, setSettings] = useState(() => loadWorkshopSchedulingSettings(DEFAULT_SETTINGS));
  const [bookings, setBookings] = useState<WorkshopBooking[]>(() => loadWorkshopBookings());
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [recommendations, setRecommendations] = useState<SlotRecommendation[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const gateway = useMemo(() => createWorkshopSchedulingGateway(), []);
  const employees = useMemo(
    () => adaptEmployees(technicians, settings, availabilityConfig),
    [technicians, settings, availabilityConfig],
  );
  const resources = useMemo(
    () => adaptMaterials(materialResources, settings, availabilityConfig),
    [materialResources, settings, availabilityConfig],
  );
  const tasks = useMemo(
    () => adaptTasks(dossiers, settings, materialResources),
    [dossiers, settings, materialResources],
  );
  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const canManage = activeRole === UserRole.DIRECTEUR_SAV || activeRole === UserRole.CHEF_ATELIER;
  const canConfigure = activeRole === UserRole.DIRECTEUR_SAV;
  const unplannedTasks = tasks.filter(task => !bookings.some(booking => booking.taskId === task.id && booking.status !== "cancelled"));

  const period = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);
  const kpi = useMemo(
    () => calculateWorkshopCapacityKpi(bookings, employees, tasks, period),
    [bookings, employees, tasks, period],
  );

  const persistBookings = (next: WorkshopBooking[]) => {
    setBookings(next);
    saveWorkshopBookings(next);
  };

  const search = () => {
    if (!selectedTask) return;
    const searchFrom = new Date();
    searchFrom.setMinutes(Math.ceil(searchFrom.getMinutes() / settings.granularityMinutes) * settings.granularityMinutes, 0, 0);
    const searchUntil = new Date(searchFrom);
    searchUntil.setDate(searchUntil.getDate() + 21);
    const result = findSchedulingSlots({
      task: selectedTask,
      employees,
      materialResources: resources,
      bookings,
      tasks,
      searchFrom: searchFrom.toISOString(),
      searchUntil: searchUntil.toISOString(),
      granularityMinutes: settings.granularityMinutes,
      alternatives: settings.alternatives,
    });
    const slots = result.recommended ? [result.recommended, ...result.alternatives] : [];
    setRecommendations(slots);
    setFeedback(slots.length > 0
      ? `${slots.length} creneau(x) compatible(s) trouve(s).`
      : result.impossibleReasons.map(reason => reason.message).join(" "));
  };

  const createBookingRequest = (slot: SlotRecommendation): BookingConfirmationRequest => ({
    taskId: selectedTask!.id,
    start: slot.start,
    end: slot.end,
    employeeIds: slot.employeeIds,
    materialResourceIds: slot.materialResourceIds,
    operationId: crypto.randomUUID(),
    overbook: false,
  });

  const reserve = async (slot: SlotRecommendation) => {
    if (!selectedTask || !canManage || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    const request = createBookingRequest(slot);
    const pending = createPendingBooking(request, selectedTask.workOrderId, selectedTask.vehicleId);
    persistBookings([...bookings, pending]);
    if (!gateway.canConfirmServerBooking) {
      setFeedback("Brouillon local enregistre. Connexion serveur requise avant toute confirmation atelier.");
      actionInFlight.current = false;
      setBusy(false);
      return;
    }
    try {
      const confirmed = await confirmPendingBooking(pending, gateway);
      persistBookings([...bookings, confirmed]);
      setFeedback("Reservation confirmee atomiquement par le serveur.");
    } catch (error) {
      const failed = { ...pending, status: "conflict" as const, attempts: 1, lastError: error instanceof Error ? error.message : "Conflit serveur." };
      persistBookings([...bookings, failed]);
      setFeedback(failed.lastError ?? "Conflit serveur.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    try {
      const target = await persistWorkshopSchedulingSettings(settings, gateway);
      setFeedback(target === "server"
        ? "Parametres de planification enregistres en base."
        : "Parametres enregistres localement. Synchronisation serveur requise avant production.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Echec de l'enregistrement des parametres.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="workshop-operations-view">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Pilotage atelier</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Capacite, ressources simultanees et reservations transactionnelles.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
          gateway.canConfirmServerBooking ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {gateway.canConfirmServerBooking ? <Server className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {gateway.canConfirmServerBooking ? "Confirmation serveur active" : "Propositions locales uniquement"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Occupation semaine", value: `${kpi.occupancyRate}%`, icon: Gauge },
          { label: "Capacite disponible", value: `${Math.round(kpi.availableMinutes / 60)} h`, icon: Users },
          { label: "Taches non affectees", value: String(unplannedTasks.length), icon: Wrench },
          { label: "Reservations confirmees", value: String(bookings.filter(item => item.status === "server_confirmed").length), icon: CheckCircle2 },
          { label: "Conflits a traiter", value: String(bookings.filter(item => item.status === "conflict").length), icon: AlertTriangle },
        ].map(item => (
          <div key={item.label} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-slate-500">
              <span className="text-[11px] font-bold uppercase">{item.label}</span>
              <item.icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
              <CalendarClock className="h-5 w-5 text-blue-700" />
              Recherche multi-ressources
            </h2>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-slate-700">Tache a planifier</span>
            <select
              data-testid="workshop-task-selector"
              value={selectedTaskId}
              onChange={event => {
                setSelectedTaskId(event.target.value);
                setRecommendations([]);
              }}
              className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm font-semibold text-slate-800"
            >
              <option value="">Selectionner une tache non affectee</option>
              {unplannedTasks.map(task => (
                <option key={task.id} value={task.id}>{task.workOrderId} - {task.label} ({task.plannedDurationMinutes} min)</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="find-workshop-slot"
            disabled={!selectedTask}
            onClick={search}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <RefreshCw className="h-4 w-4" />
            Rechercher le premier creneau
          </button>

          {feedback && (
            <div data-testid="workshop-scheduling-feedback" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {feedback}
            </div>
          )}

          <div className="space-y-2" data-testid="workshop-slot-results">
            {recommendations.map((slot, index) => (
              <article key={`${slot.start}-${index}`} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900">
                      {index === 0 ? "Creneau recommande" : `Alternative ${index}`}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDateTime(slot.start)} - {formatDateTime(slot.end)}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      Score {slot.score}/100 · {slot.employeeIds.length} technicien(s) · {slot.materialResourceIds.length} ressource(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage || busy}
                    onClick={() => reserve(slot)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    <CalendarClock className="h-4 w-4" />
                    {gateway.canConfirmServerBooking ? "Confirmer" : "Enregistrer brouillon"}
                  </button>
                </div>
                {slot.promisedDateAtRisk && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-700">
                    <AlertTriangle className="h-4 w-4" />
                    Date promise menacee
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4 border-l-0 border-slate-200 xl:border-l xl:pl-5">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Settings2 className="h-5 w-5 text-slate-700" />
            Regles de calcul
          </h2>
          <label className="block text-xs font-bold text-slate-700">
            Granularite
            <select
              value={settings.granularityMinutes}
              disabled={!canConfigure}
              onChange={event => setSettings({ ...settings, granularityMinutes: Number(event.target.value) as WorkshopSchedulingSettings["granularityMinutes"] })}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 text-sm"
            >
              {[5, 10, 15, 30, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Alternatives proposees
            <input
              type="number"
              min={1}
              max={5}
              value={settings.alternatives}
              disabled={!canConfigure}
              onChange={event => setSettings({ ...settings, alternatives: Math.max(1, Math.min(5, Number(event.target.value))) })}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 text-sm"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Delai de securite
            <input
              type="number"
              min={0}
              max={120}
              value={settings.defaultBufferMinutes}
              disabled={!canConfigure}
              onChange={event => setSettings({ ...settings, defaultBufferMinutes: Math.max(0, Number(event.target.value)) })}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={settings.requirePartsBeforePlanning}
              disabled={!canConfigure}
              onChange={event => setSettings({ ...settings, requirePartsBeforePlanning: event.target.checked })}
            />
            Pieces obligatoires avant planification
          </label>
          {canConfigure && (
            <button
              type="button"
              onClick={saveSettings}
              disabled={busy}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          )}
          <div className="border-t border-slate-200 pt-4 text-xs font-semibold text-slate-600">
            <div className="font-black text-slate-800">Ressource limitante</div>
            <div className="mt-1">{kpi.limitingResource ?? "Aucune sur la periode"}</div>
          </div>
          {selectedTask && (
            <button
              type="button"
              onClick={() => onSelectDossier(selectedTask.workOrderId)}
              className="inline-flex items-center gap-2 text-xs font-black text-blue-700 hover:underline"
            >
              Ouvrir le dossier {selectedTask.workOrderId}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
