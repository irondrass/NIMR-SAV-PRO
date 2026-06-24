/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  UserRole, 
  DossierStatus, 
  DossierSAV, 
  ReclammationClient, 
  ActiviteLog, 
  TechnicienResource,
  AtelierZone,
  DossierPriority,
  User,
  UserSession,
  WorkshopReservation,
  WorkshopAvailabilityConfig,
  WorkshopShiftProfile,
  VehicleMasterRecord
} from "./types";
import { 
  INITIAL_DOSSIERS, 
  MOCK_TECHNICIENS, 
  INITIAL_RECLAMATIONS, 
  INITIAL_ACTIVITE_LOGS
} from "./data";
import {
  createUser,
  ensureDefaultUsers,
  isSessionValid,
  isUser,
  isUserSession,
  loginUser,
  resetUserPin,
  setUserActive,
  updateUserProfile,
  CreateUserInput,
  LoginResult,
  touchSession,
} from "./auth";
import * as perm from "./permissions";
import {
  BackupPayload,
  createRuntimeId,
  isActiviteLog,
  isDossierSAV,
  isReclamationClient,
  isTechnicienResource,
  isOperationalActiveDossier,
  normalizeDossierForRuntime,
  parseStoredArray,
  validateBackupPayload,
  isWorkshopReservation
} from "./sav-core";
import {
  buildImportSummary,
  createPreImportBackupPayload,
  createRoleAwareBackupPayload,
  ImportSummary,
  isStrongImportConfirmation,
  PRE_IMPORT_BACKUP_KEY,
  STRONG_IMPORT_CONFIRMATION,
} from "./import-export-safety";
import { APP_NAME, APP_VERSION } from "./app-identity";
import { getDefaultTabForRole, normalizeTabForRole, TabId } from "./roles";
import { STORAGE_KEYS } from "./storage-keys";
import {
  getDefaultWorkshopSchedule,
  getDefaultWorkshopShiftProfiles,
  SHIFT_PROFILES_STORAGE_KEY,
} from "./workshop-availability";
import { logAuditEvent } from "./audit-trail";
import { canRunGuardedAction } from "./action-guard";

// Views
import DirectorDashboard from "./components/DirectorDashboard";
import VehicleSearchView from "./components/VehicleSearchView";
import GuidedReception from "./components/GuidedReception";
import DossierDetail from "./components/DossierDetail";
import WorkshopPlanning from "./components/WorkshopPlanning";
import ChefAtelierView from "./components/ChefAtelierView";
import TechnicianView from "./components/TechnicianView";
import ComplaintsView from "./components/ComplaintsView";
import PerformanceSAV from "./components/PerformanceSAV";
import SettingsView from "./components/SettingsView";
import LoginView from "./components/LoginView";
import UserManagementView from "./components/UserManagementView";
import { KanbanBoard } from "./components/KanbanBoard";
import { StatusBadge, PriorityBadge } from "./components/UIParts";
import ControleQualiteView from "./components/ControleQualiteView";
import LivraisonView from "./components/LivraisonView";
import WarrantyView from "./components/WarrantyView";
import SatisfactionView from "./components/SatisfactionView";

// Icons
import { 
  BarChart3, 
  Calendar, 
  ClipboardList, 
  FileText, 
  Layout, 
  SlidersHorizontal, 
  UserCheck, 
  Users, 
  Wrench, 
  ShieldAlert, 
  Volume2, 
  Search,
  Bell,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Inbox,
  Lock,
  LogOut,
  Plus,
  UserCog,
  Truck,
  ClipboardCheck,
  Star
} from "lucide-react";

function writeLocalStorageValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Local persistence is a convenience layer; the UI remains usable without it.
  }
}

function writeLocalStorageJSON<T>(key: string, value: T) {
  writeLocalStorageValue(key, JSON.stringify(value));
}

function loadStoredArray<T>(key: string, fallback: T[], itemGuard: (value: unknown) => value is T): T[] {
  let rawValue: string | null = null;
  try {
    rawValue = localStorage.getItem(key);
  } catch {
    return fallback;
  }

  const parsed = parseStoredArray(rawValue, fallback, itemGuard);
  if (parsed.usedFallback) {
    writeLocalStorageJSON(key, fallback);
  }
  return parsed.items;
}

function loadStoredSession(): UserSession | null {
  try {
    const rawSession = localStorage.getItem(STORAGE_KEYS.session);
    if (!rawSession) return null;
    const parsed = JSON.parse(rawSession);
    return isUserSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isStoredShiftProfile(value: unknown): value is WorkshopShiftProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkshopShiftProfile>;
  return Boolean(
    candidate.id &&
    candidate.name &&
    candidate.schedule &&
    Array.isArray(candidate.schedule.days)
  );
}

function loadStoredShiftProfiles(): WorkshopShiftProfile[] {
  try {
    const rawValue = localStorage.getItem(SHIFT_PROFILES_STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) && parsed.every(isStoredShiftProfile) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredAvailabilityConfig(key: string, fallback: WorkshopAvailabilityConfig): WorkshopAvailabilityConfig {
  const mergeStoredShiftProfiles = (config: WorkshopAvailabilityConfig): WorkshopAvailabilityConfig => {
    const storedShiftProfiles = loadStoredShiftProfiles();
    return storedShiftProfiles.length > 0 ? { ...config, shiftProfiles: storedShiftProfiles } : config;
  };

  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return mergeStoredShiftProfiles(fallback);
    const parsed = JSON.parse(rawValue);
    if (
      parsed &&
      parsed.schedule &&
      Array.isArray(parsed.exceptions) &&
      Array.isArray(parsed.absences) &&
      Array.isArray(parsed.bayUnavailabilities) &&
      Array.isArray(parsed.holidays)
    ) {
      return mergeStoredShiftProfiles(parsed as WorkshopAvailabilityConfig);
    }
  } catch {
    // Ignore
  }
  return mergeStoredShiftProfiles(fallback);
}

function loadStoredVehicleMaster(key: string): VehicleMasterRecord[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        id: String(item.id || ""),
        vin: item.vin ? String(item.vin) : undefined,
        plateNumber: item.plateNumber ? String(item.plateNumber) : undefined,
        customerName: item.customerName ? String(item.customerName) : undefined,
        customerPhone: item.customerPhone ? String(item.customerPhone) : undefined,
        itemNo: item.itemNo ? String(item.itemNo) : undefined,
        brand: item.brand ? String(item.brand) : undefined,
        model: item.model ? String(item.model) : undefined,
        version: item.version ? String(item.version) : undefined,
        deliveryDate: item.deliveryDate ? String(item.deliveryDate) : undefined,
        circulationDate: item.circulationDate ? String(item.circulationDate) : undefined,
        saleDate: item.saleDate ? String(item.saleDate) : undefined,
        warrantyPartsEndDate: item.warrantyPartsEndDate ? String(item.warrantyPartsEndDate) : undefined,
        warrantyLaborEndDate: item.warrantyLaborEndDate ? String(item.warrantyLaborEndDate) : undefined,
        lastServiceDate: item.lastServiceDate ? String(item.lastServiceDate) : undefined,
        lastServiceMileage: item.lastServiceMileage !== undefined && item.lastServiceMileage !== null ? Number(item.lastServiceMileage) : undefined,
        energy: item.energy ? String(item.energy) : undefined,
        source: item.source ? String(item.source) : undefined,
        importedAt: item.importedAt ? String(item.importedAt) : undefined,
      }));
    }
  } catch {
    // Ignore
  }
  return [];
}

type DossierOperationalFilter = "active" | "ready_for_billing" | "delivered" | "all";

export default function App() {
  // Local internal authentication state
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const handleTouchSession = () => {
    if (currentSession) {
      const touched = touchSession(currentSession);
      setCurrentSession(touched);
      writeLocalStorageJSON(STORAGE_KEYS.session, touched);
    }
  };

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const [dossiers, setDossiers] = useState<DossierSAV[]>([]);
  const [reclamations, setReclamations] = useState<ReclammationClient[]>([]);
  const [techList, setTechList] = useState<TechnicienResource[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActiviteLog[]>([]);
  const [reservations, setReservations] = useState<WorkshopReservation[]>([]);
  const [availabilityConfig, setAvailabilityConfig] = useState<WorkshopAvailabilityConfig>({
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: getDefaultWorkshopShiftProfiles(),
  });

  // Detailed selected folder id
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const currentUser = currentSession ? users.find(user => user.id === currentSession.userId) ?? null : null;
  const activeRole = currentUser?.role ?? currentSession?.role ?? UserRole.LECTURE_SEULE;
  const recordAudit = (event: Omit<Parameters<typeof logAuditEvent>[0], "user" | "role" | "source"> & { source?: string }) => {
    logAuditEvent({
      ...event,
      user: currentUser?.displayName ?? currentSession?.displayName ?? activeRole,
      role: activeRole,
      source: event.source ?? "local-ui",
    });
  };

  // Vehicle master local database
  const [vehicleMasterRecords, setVehicleMasterRecords] = useState<VehicleMasterRecord[]>([]);
  const [vehicleMasterLastImport, setVehicleMasterLastImport] = useState<string | null>(null);

  const handleUpdateVehicleMaster = (records: VehicleMasterRecord[]) => {
    handleTouchSession();
    setVehicleMasterRecords(records);
    localStorage.setItem(STORAGE_KEYS.vehicleMaster, JSON.stringify(records));
    const importTime = new Date().toISOString();
    setVehicleMasterLastImport(importTime);
    localStorage.setItem(STORAGE_KEYS.vehicleMasterLastImport, importTime);
    recordAudit({
      module: "vehicules",
      action: "import_referentiel",
      commentaire: `${records.length} véhicules importés dans le référentiel local`,
      source: "vehicle-master",
    });
  };

  const handleClearVehicleMaster = () => {
    handleTouchSession();
    setVehicleMasterRecords([]);
    localStorage.removeItem(STORAGE_KEYS.vehicleMaster);
    setVehicleMasterLastImport(null);
    localStorage.removeItem(STORAGE_KEYS.vehicleMasterLastImport);
    recordAudit({
      module: "vehicules",
      action: "purge_referentiel",
      commentaire: "Référentiel véhicules local vidé",
      source: "vehicle-master",
    });
  };

  // Import feedback states
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ data: Partial<BackupPayload>; summary: ImportSummary; fileName: string } | null>(null);
  const [importConfirmationText, setImportConfirmationText] = useState("");
  const [hasImportBackup, setHasImportBackup] = useState(false);

  // Search and Filter states
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Tous");
  const [priorityFilter, setPriorityFilter] = useState<string>("Toutes");
  const [dossierViewMode, setDossierViewMode] = useState<"standard" | "vehicles">("standard");
  const [dossierOperationalFilter, setDossierOperationalFilter] = useState<DossierOperationalFilter>("active");

  // Load initial states or restore from local storage
  useEffect(() => {
    setDossiers(loadStoredArray(STORAGE_KEYS.dossiers, INITIAL_DOSSIERS, isDossierSAV).map(normalizeDossierForRuntime));
    setReclamations(loadStoredArray(STORAGE_KEYS.reclamations, INITIAL_RECLAMATIONS, isReclamationClient));
    setTechList(loadStoredArray(STORAGE_KEYS.techs, MOCK_TECHNICIENS, isTechnicienResource));
    setActivityLogs(loadStoredArray(STORAGE_KEYS.logs, INITIAL_ACTIVITE_LOGS, isActiviteLog));
    setReservations(loadStoredArray(STORAGE_KEYS.reservations, [], isWorkshopReservation));
    setVehicleMasterRecords(loadStoredVehicleMaster(STORAGE_KEYS.vehicleMaster));
    setVehicleMasterLastImport(localStorage.getItem(STORAGE_KEYS.vehicleMasterLastImport) || null);
    setHasImportBackup(Boolean(localStorage.getItem(PRE_IMPORT_BACKUP_KEY)));

    const defaultAvail: WorkshopAvailabilityConfig = {
      schedule: getDefaultWorkshopSchedule(),
      exceptions: [],
      absences: [],
      bayUnavailabilities: [],
      holidays: [],
      shiftProfiles: getDefaultWorkshopShiftProfiles(),
    };
    setAvailabilityConfig(loadStoredAvailabilityConfig(STORAGE_KEYS.availability, defaultAvail));

    let mounted = true;
    const initializeAuth = async () => {
      const storedUsers = loadStoredArray(STORAGE_KEYS.users, [], isUser);
      const nextUsers = await ensureDefaultUsers(storedUsers);
      const storedSession = loadStoredSession();
      if (!mounted) return;
      setUsers(nextUsers);
      writeLocalStorageJSON(STORAGE_KEYS.users, nextUsers);
      if (isSessionValid(storedSession, nextUsers)) {
        const touched = touchSession(storedSession!);
        setCurrentSession(touched);
        writeLocalStorageJSON(STORAGE_KEYS.session, touched);
        setActiveTab(getDefaultTabForRole(storedSession!.role));
      } else {
        localStorage.removeItem(STORAGE_KEYS.session);
        if (storedSession) {
          setSessionExpiredMessage("Session expirée après 30 minutes d'inactivité.");
        }
      }
      setAuthReady(true);
    };

    initializeAuth();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!perm.canAccessTab(activeRole, activeTab)) {
      setSelectedDossierId(null);
      setActiveTab(getDefaultTabForRole(activeRole));
    }
  }, [activeRole, activeTab]);

  // Update theme class on mount / change - forced to light
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    writeLocalStorageValue(STORAGE_KEYS.theme, "light");
  }, []);

  // General persistence triggers
  const saveDossiersToStorage = (updatedList: DossierSAV[]) => {
    setDossiers(updatedList);
    writeLocalStorageJSON(STORAGE_KEYS.dossiers, updatedList);
  };

  const handleUpdateDossier = (updatedDossier: DossierSAV) => {
    handleTouchSession();
    const canUpdateDossierFromHandler =
      perm.canEditDossier(activeRole) ||
      perm.canPlanWorkshop(activeRole) ||
      perm.canStartTask(activeRole) ||
      perm.canValidateQC(activeRole) ||
      perm.canConfirmDelivery(activeRole) ||
      perm.canManageWarranty(activeRole) ||
      perm.canRecordSatisfaction(activeRole);
    if (!canUpdateDossierFromHandler) return;
    // Generate an automatic log entry if status has updated
    const original = dossiers.find(d => d.id === updatedDossier.id);
    if (original && original.statut !== updatedDossier.statut) {
      const newLog: ActiviteLog = {
        id: createRuntimeId("log"),
        timestamp: new Date().toISOString(),
        user: currentUser?.displayName ?? activeRole,
        role: activeRole,
        action: "Changement statut",
        details: `Dossier ${updatedDossier.id} marqué comme ${updatedDossier.statut}`
      };
      
      const newLogs = [newLog, ...activityLogs];
      setActivityLogs(newLogs);
      writeLocalStorageJSON(STORAGE_KEYS.logs, newLogs);
      recordAudit({
        module: "dossiers",
        action: "changement_statut",
        dossierId: updatedDossier.id,
        ancienStatut: original.statut,
        nouveauStatut: updatedDossier.statut,
        commentaire: `Dossier marqué comme ${updatedDossier.statut}`,
      });
    }

    const nextDossiers = dossiers.map(item => item.id === updatedDossier.id ? updatedDossier : item);
    saveDossiersToStorage(nextDossiers);
  };

  const handleAddDossier = (newDossier: DossierSAV) => {
    handleTouchSession();
    if (!perm.canCreateDossier(activeRole)) return;
    const guardKey = `create-dossier:${newDossier.id}`;
    if (!canRunGuardedAction(guardKey)) return;
    const nextDossiers = [newDossier, ...dossiers];
    
    // Log creation
    const newLog: ActiviteLog = {
      id: createRuntimeId("log_create"),
      timestamp: new Date().toISOString(),
      user: currentUser?.displayName ?? activeRole,
      role: activeRole,
      action: "Création dossier",
      details: `Création réussite du dossier ${newDossier.id} (${newDossier.vehiculeMarque})`
    };
    const newLogs = [newLog, ...activityLogs];
    setActivityLogs(newLogs);
    writeLocalStorageJSON(STORAGE_KEYS.logs, newLogs);
    recordAudit({
      module: "reception",
      action: "creation_dossier",
      dossierId: newDossier.id,
      nouveauStatut: newDossier.statut,
      commentaire: `Création dossier ${newDossier.id}`,
    });

    saveDossiersToStorage(nextDossiers);
  };

  const handleAddReclamation = (newRec: ReclammationClient) => {
    handleTouchSession();
    const nextRecs = [newRec, ...reclamations];
    setReclamations(nextRecs);
    writeLocalStorageJSON(STORAGE_KEYS.reclamations, nextRecs);
    recordAudit({
      module: "reclamations",
      action: "creation_reclamation",
      dossierId: newRec.dossierId,
      commentaire: `Réclamation ${newRec.id}`,
      source: "complaints",
    });
  };

  const handleUpdateReclamation = (updatedRec: ReclammationClient) => {
    handleTouchSession();
    const nextRecs = reclamations.map(r => r.id === updatedRec.id ? updatedRec : r);
    setReclamations(nextRecs);
    writeLocalStorageJSON(STORAGE_KEYS.reclamations, nextRecs);
    recordAudit({
      module: "reclamations",
      action: "mise_a_jour_reclamation",
      dossierId: updatedRec.dossierId,
      commentaire: `Réclamation ${updatedRec.id} - statut ${updatedRec.statut}`,
      source: "complaints",
    });
  };

  const handleUpdateReservations = (nextRes: WorkshopReservation[]) => {
    handleTouchSession();
    if (!perm.canCreateReservation(activeRole) && !perm.canPlanWorkshop(activeRole)) return;
    setReservations(nextRes);
    writeLocalStorageJSON(STORAGE_KEYS.reservations, nextRes);
    recordAudit({
      module: "atelier",
      action: "mise_a_jour_reservations",
      commentaire: `${nextRes.length} réservation(s) atelier enregistrée(s)`,
      source: "workshop-planning",
    });
  };

  const handleUpdateAvailabilityConfig = (nextConfig: WorkshopAvailabilityConfig) => {
    handleTouchSession();
    if (!perm.canManageWorkshopAvailability(activeRole)) return;
    setAvailabilityConfig(nextConfig);
    writeLocalStorageJSON(STORAGE_KEYS.availability, nextConfig);
    if (nextConfig.shiftProfiles) {
      writeLocalStorageJSON(SHIFT_PROFILES_STORAGE_KEY, nextConfig.shiftProfiles);
    }
    recordAudit({
      module: "atelier",
      action: "mise_a_jour_disponibilites",
      commentaire: `${nextConfig.exceptions.length} exception(s), ${nextConfig.absences.length} absence(s), ${nextConfig.bayUnavailabilities.length} indisponibilité(s) baie`,
      source: "workshop-availability",
    });
  };

  // State Import/Export logic
  const handleExportDataJSON = () => {
    handleTouchSession();
    if (!perm.canExportData(activeRole)) return;
    setShowExportConfirm(true);
  };

  const executeExportDataJSON = () => {
    handleTouchSession();
    if (!perm.canExportData(activeRole)) return;
    if (!canRunGuardedAction("export-json")) return;
    const fullBackup = createRoleAwareBackupPayload(
      dossiers,
      reclamations,
      techList,
      activityLogs,
      reservations,
      perm.canViewVehicleSensitiveFields(activeRole)
    );
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "NIMR_SAV_PRO_BASE_BACKUP.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    recordAudit({
      module: "import_export",
      action: "export_json",
      commentaire: `${dossiers.length} dossiers exportés`,
      source: "backup-json",
    });
    setShowExportConfirm(false);
  };

  const handleExportDossiersCSV = () => {
    handleTouchSession();
    if (!perm.canExportData(activeRole)) return;
    const headers = [
      "ID","Statut","Priorité","Client","Téléphone","Marque","Modèle","Immatriculation","VIN","Km","Type","Date réception","Date dernier statut","Avancement %","Tâches","Prochain action"
    ];
    const rows = dossiers.map(d => [
      d.id,
      d.statut,
      d.priorite,
      d.clientNom,
      perm.canViewVehicleSensitiveFields(activeRole) ? (d.clientTelephone || "") : "***",
      d.vehiculeMarque,
      d.vehiculeModele,
      d.vehiculeImmatriculation,
      perm.canViewVehicleSensitiveFields(activeRole) ? (d.vehiculeVIN || "") : "***",
      String(d.vehiculeKilometrage ?? ""),
      d.typeDossier,
      d.dateReception?.slice(0, 10) ?? "",
      d.dateDernierStatut?.slice(0, 10) ?? "",
      String(d.avancementGlobal ?? 0),
      String(d.ordresReparation?.length ?? 0),
      d.prochaineActionRecommended ?? ""
    ].map(val => `"${String(val).replace(/"/g, '""')}"`))
    .map(row => row.join(","));
    const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NIMR_SAV_PRO_Dossiers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    recordAudit({
      module: "import_export",
      action: "export_csv",
      commentaire: `${dossiers.length} dossiers exportés en CSV`,
      source: "dossier-list-csv",
    });
  };


  const handleImportDataJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTouchSession();
    if (!perm.canImportData(activeRole)) return;
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
    setPendingImport(null);
    setImportConfirmationText("");
    const reader = new FileReader();
    const files = e.target.files;
    if (files && files[0]) {
      const fileName = files[0].name;
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const validation = validateBackupPayload(parsed);
          if (validation.ok === false) {
            setImportErrorMessage(validation.error);
            return;
          }

          const preImportBackup = createPreImportBackupPayload(dossiers, reclamations, techList, activityLogs, reservations);
          writeLocalStorageValue(PRE_IMPORT_BACKUP_KEY, JSON.stringify(preImportBackup));
          setHasImportBackup(true);
          setPendingImport({
            data: validation.data,
            summary: buildImportSummary(validation.data),
            fileName,
          });
        } catch (err) {
          setImportErrorMessage("Erreur de format de fichier de sauvegarde.");
        }
        e.target.value = "";
      };
      reader.onerror = () => {
        setImportErrorMessage("Impossible de lire le fichier de sauvegarde.");
      };
      reader.readAsText(files[0]);
    }
  };

  const applyValidatedImportPayload = (data: Partial<BackupPayload>, sourceLabel: string) => {
    if (data.dossiers) {
      const normalizedDossiers = data.dossiers.map(normalizeDossierForRuntime);
      setDossiers(normalizedDossiers);
      writeLocalStorageJSON(STORAGE_KEYS.dossiers, normalizedDossiers);
    }
    if (data.reclamations) {
      setReclamations(data.reclamations);
      writeLocalStorageJSON(STORAGE_KEYS.reclamations, data.reclamations);
    }
    if (data.techList) {
      setTechList(data.techList);
      writeLocalStorageJSON(STORAGE_KEYS.techs, data.techList);
    }
    if (data.activityLogs) {
      setActivityLogs(data.activityLogs);
      writeLocalStorageJSON(STORAGE_KEYS.logs, data.activityLogs);
    }
    if (data.reservations) {
      setReservations(data.reservations);
      writeLocalStorageJSON(STORAGE_KEYS.reservations, data.reservations);
    }
    recordAudit({
      module: "import_export",
      action: sourceLabel === "restore-backup" ? "restore_pre_import_backup" : "import_json",
      commentaire: `${data.dossiers?.length ?? 0} dossiers appliqués`,
      source: sourceLabel,
    });
  };

  const confirmPendingImport = () => {
    if (!perm.canImportData(activeRole)) return;
    if (!canRunGuardedAction("import-json-confirm")) return;
    if (!pendingImport || !isStrongImportConfirmation(importConfirmationText)) return;
    applyValidatedImportPayload(pendingImport.data, "backup-json");
    setImportSuccessMessage("Base restaurée avec succès !");
    setPendingImport(null);
    setImportConfirmationText("");
  };

  const handleRestoreImportBackup = () => {
    handleTouchSession();
    if (!perm.canImportData(activeRole)) return;
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
    try {
      const rawBackup = localStorage.getItem(PRE_IMPORT_BACKUP_KEY);
      if (!rawBackup) {
        setImportErrorMessage("Aucune sauvegarde pré-import disponible.");
        return;
      }
      const parsed = JSON.parse(rawBackup);
      const validation = validateBackupPayload(parsed);
      if (validation.ok === false) {
        setImportErrorMessage(validation.error);
        return;
      }
      applyValidatedImportPayload(validation.data, "restore-backup");
      setImportSuccessMessage("Sauvegarde pré-import restaurée.");
      setPendingImport(null);
      setImportConfirmationText("");
    } catch {
      setImportErrorMessage("Sauvegarde pré-import illisible.");
    }
  };

  // Filter application search indexing
  const filteredDossiers = useMemo(() => {
    return dossiers.filter(d => {
      const textToSearch = `${d.id} ${d.clientNom} ${d.vehiculeImmatriculation} ${d.vehiculeMarque} ${d.vehiculeModele} ${d.clientTelephone}`.toLowerCase();
      const matchesSearch = textToSearch.includes(globalSearchTerm.toLowerCase());
      const matchesOperationalFilter =
        dossierOperationalFilter === "active"
          ? isOperationalActiveDossier(d)
          : dossierOperationalFilter === "ready_for_billing"
            ? d.statut === DossierStatus.PRET_FACTURATION
            : dossierOperationalFilter === "delivered"
              ? d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.NON_RETIRE
              : true;
      const matchesStatus = statusFilter === "Tous" || d.statut === statusFilter;
      const matchesPriority = priorityFilter === "Toutes" || d.priorite === priorityFilter;
      return matchesSearch && matchesOperationalFilter && matchesStatus && matchesPriority;
    });
  }, [dossiers, globalSearchTerm, dossierOperationalFilter, statusFilter, priorityFilter]);

  const dossierOperationalFilterLabels: Record<DossierOperationalFilter, string> = {
    active: "Actifs",
    ready_for_billing: "Prêts facturation ERP",
    delivered: "Livrés",
    all: "Tous les dossiers",
  };

  const blockedCount = useMemo(() => {
    return dossiers.filter(d => d.statut === DossierStatus.BLOQUE).length;
  }, [dossiers]);

  const selectedDossier = selectedDossierId ? dossiers.find(d => d.id === selectedDossierId) : null;
  const goToTab = (tab: string) => {
    const nextTab = normalizeTabForRole(activeRole, tab);
    setSelectedDossierId(null);
    setActiveTab(nextTab);
    handleTouchSession();
  };

  const persistUsers = (nextUsers: User[]) => {
    setUsers(nextUsers);
    writeLocalStorageJSON(STORAGE_KEYS.users, nextUsers);
  };

  const syncSessionWithUsers = (nextUsers: User[]) => {
    if (!currentSession) return;
    const nextCurrentUser = nextUsers.find(user => user.id === currentSession.userId);
    if (!nextCurrentUser || !nextCurrentUser.active) {
      handleLogout();
      return;
    }
    const nextSession: UserSession = {
      ...currentSession,
      displayName: nextCurrentUser.displayName,
      role: nextCurrentUser.role,
    };
    setCurrentSession(nextSession);
    writeLocalStorageJSON(STORAGE_KEYS.session, nextSession);
    setActiveTab(normalizeTabForRole(nextCurrentUser.role, activeTab));
  };

  const handleLogin = async (username: string, pin: string): Promise<LoginResult> => {
    const result = await loginUser(users, username, pin);
    if (result.ok) {
      persistUsers(result.users);
      setCurrentSession(result.session);
      writeLocalStorageJSON(STORAGE_KEYS.session, result.session);
      setSelectedDossierId(null);
      setActiveTab(getDefaultTabForRole(result.session.role));
      setSessionExpiredMessage(null);
      logAuditEvent({
        user: result.session.displayName,
        role: result.session.role,
        module: "auth",
        action: "connexion",
        commentaire: "Connexion locale réussie",
        source: "login",
      });
    }
    return result;
  };

  const handleLogout = () => {
    if (currentSession) {
      recordAudit({
        module: "auth",
        action: "deconnexion",
        commentaire: "Déconnexion locale",
        source: "logout",
      });
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.session);
    } catch {
      // Session removal failure should not keep the UI unlocked in memory.
    }
    setCurrentSession(null);
    setSelectedDossierId(null);
    setGlobalSearchTerm("");
    setStatusFilter("Tous");
    setPriorityFilter("Toutes");
  };

  const handleCreateUser = async (input: CreateUserInput): Promise<{ ok: boolean; message: string }> => {
    handleTouchSession();
    if (!perm.canManageUsers(activeRole)) return { ok: false, message: "Accès réservé au Directeur SAV." };
    if (!input.username.trim() || !input.pin.trim()) {
      return { ok: false, message: "Identifiant et PIN obligatoires." };
    }
    if (users.some(user => user.username === input.username.trim().toLowerCase())) {
      return { ok: false, message: "Identifiant utilisateur déjà existant." };
    }
    const nextUser = await createUser(input, users);
    persistUsers([...users, nextUser]);
    recordAudit({
      module: "utilisateurs",
      action: "creation_utilisateur",
      commentaire: `${nextUser.username} - ${nextUser.role}`,
      source: "user-management",
    });
    return { ok: true, message: "Utilisateur créé." };
  };

  const handleUpdateUser = (userId: string, changes: { displayName: string; role: UserRole }): { ok: boolean; message: string } => {
    handleTouchSession();
    if (!perm.canManageUsers(activeRole) || !currentUser) return { ok: false, message: "Accès réservé au Directeur SAV." };
    const result = updateUserProfile(users, userId, changes, currentUser.id);
    if (result.ok === false) return result;
    persistUsers(result.users);
    syncSessionWithUsers(result.users);
    recordAudit({
      module: "utilisateurs",
      action: "mise_a_jour_utilisateur",
      commentaire: `${userId} - ${changes.role}`,
      source: "user-management",
    });
    return { ok: true, message: "Utilisateur mis à jour." };
  };

  const handleToggleUserActive = (userId: string, active: boolean): { ok: boolean; message: string } => {
    handleTouchSession();
    if (!perm.canManageUsers(activeRole)) return { ok: false, message: "Accès réservé au Directeur SAV." };
    const result = setUserActive(users, userId, active);
    if (result.ok === false) return result;
    persistUsers(result.users);
    syncSessionWithUsers(result.users);
    recordAudit({
      module: "utilisateurs",
      action: active ? "activation_utilisateur" : "desactivation_utilisateur",
      commentaire: userId,
      source: "user-management",
    });
    return { ok: true, message: active ? "Utilisateur activé." : "Utilisateur désactivé." };
  };

  const handleResetUserPin = async (userId: string, pin: string): Promise<{ ok: boolean; message: string }> => {
    handleTouchSession();
    if (!perm.canManageUsers(activeRole)) return { ok: false, message: "Accès réservé au Directeur SAV." };
    const result = await resetUserPin(users, userId, pin);
    if (result.ok === false) return result;
    persistUsers(result.users);
    recordAudit({
      module: "utilisateurs",
      action: "reinitialisation_pin",
      commentaire: userId,
      source: "user-management",
    });
    return { ok: true, message: "PIN réinitialisé." };
  };

  useEffect(() => {
    if (!currentSession) return;

    let lastRefresh = 0;
    const expireSession = () => {
      setSessionExpiredMessage("Session expirée après 30 minutes d'inactivité.");
      recordAudit({
        module: "auth",
        action: "expiration_session",
        commentaire: "Inactivité supérieure à 30 minutes",
        source: "session-timeout",
      });
      handleLogout();
    };

    const validateCurrentSession = () => {
      if (!isSessionValid(currentSession, users)) {
        expireSession();
      }
    };

    const refreshActivity = () => {
      const now = Date.now();
      if (now - lastRefresh < 1000) return;
      lastRefresh = now;

      if (!isSessionValid(currentSession, users)) {
        expireSession();
        return;
      }

      const touched = touchSession(currentSession);
      setCurrentSession(touched);
      writeLocalStorageJSON(STORAGE_KEYS.session, touched);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        validateCurrentSession();
      }
    };

    window.addEventListener("click", refreshActivity);
    window.addEventListener("keydown", refreshActivity);
    window.addEventListener("popstate", refreshActivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(validateCurrentSession, 15000);

    return () => {
      window.removeEventListener("click", refreshActivity);
      window.removeEventListener("keydown", refreshActivity);
      window.removeEventListener("popstate", refreshActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [currentSession, users]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-600">
        Chargement de la session locale...
      </div>
    );
  }

  if (!currentSession || !currentUser) {
    return (
      <>
        {sessionExpiredMessage && (
          <div
            data-testid="session-expired-message"
            className="fixed left-1/2 top-6 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-800 shadow-sm"
          >
            {sessionExpiredMessage}
          </div>
        )}
        <LoginView onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 transition duration-150 flex flex-col md:flex-row antialiased">
      
      {/* 1. Lateral Left Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 text-gray-800 p-5 flex flex-col justify-between shrink-0 font-sans shadow-xs">
        <div className="space-y-6">
          
          {/* Logo Branding - Humble, Literal - Geometric Balance styled */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm tracking-tight shrink-0">
              SAV
            </div>
            <div>
              <h1 className="text-xs font-black text-slate-900 tracking-widest uppercase mb-0.5 leading-none font-display">{APP_NAME}</h1>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block">v{APP_VERSION} · Atelier & Restitutions</span>
            </div>
          </div>

          {/* Connected user info */}
          <div className="bg-slate-50 rounded-lg p-3 border border-gray-200 text-xs">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Utilisateur connecté</span>
            <div className="space-y-2">
              <div>
                <span data-testid="current-user" className="font-extrabold text-slate-900 font-display block">{currentUser.displayName}</span>
                <span data-testid="current-role" className="font-extrabold text-blue-600 font-display">{activeRole}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-button"
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-500 underline underline-offset-2 hover:text-rose-700"
              >
                <LogOut className="w-3 h-3" />
                Déconnexion
              </button>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block px-2.5 pb-2">Central Opérationnel</span>
            {[
              { id: "dashboard", label: "Dashboard KPI", icon: Layout },
              { id: "reception-rapide", label: "Réception Guidée", icon: Users },
              { id: "dossiers-liste", label: "Dossiers SAV", icon: FileText },
              { id: "atelier-planning", label: "Planning Atelier", icon: Calendar },
              { id: "atelier-kanban", label: "Kanban Atelier", icon: ClipboardList },
              { id: "chef-atelier", label: "Chef d'atelier", icon: Wrench },
              { id: "tech-view", label: "Mode Technicien", icon: UserCheck },
              { id: "controle-qualite", label: "Contrôle Qualité", icon: ClipboardCheck },
              { id: "livraison", label: "Livraison SAV", icon: Truck },
              { id: "garantie", label: "Garantie locale", icon: CheckCircle },
              { id: "satisfaction", label: "Satisfaction pilote", icon: Star },
              { id: "reclamations", label: "Réclamations SAV", icon: ShieldAlert },
              { id: "rendements-sav", label: "Rapports SAV", icon: BarChart3 },
              { id: "parametres", label: "Paramètres Système", icon: SlidersHorizontal },
              { id: "users", label: "Gestion utilisateurs", icon: UserCog }
            ].map(item => {
              if (!perm.canAccessTab(activeRole, item.id)) return null;
              
              const LinkIcon = item.icon;
              const isSel = activeTab === item.id;
              
              const navTestIds: Record<string, string> = {
                "dashboard": "nav-dashboard",
                "reception-rapide": "nav-reception",
                "dossiers-liste": "nav-dossiers",
                "atelier-planning": "nav-planning",
                "chef-atelier": "nav-chef-atelier",
                "tech-view": "nav-technician",
                "controle-qualite": "nav-controle-qualite",
                "livraison": "nav-livraison",
                "parametres": "nav-settings",
                "atelier-kanban": "nav-kanban",
                "reclamations": "nav-reclamations",
                "rendements-sav": "nav-performance",
                "garantie": "nav-warranty",
                "satisfaction": "nav-satisfaction",
                "users": "nav-users"
              };

              return (
                <button
                  key={item.id}
                  data-testid={navTestIds[item.id] || `nav-${item.id}`}
                  onClick={() => {
                    goToTab(item.id);
                  }}
                  className={`w-full p-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-between transition-all duration-105 border ${
                    isSel 
                      ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs font-extrabold" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <LinkIcon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-gray-200 space-y-4">
          <div className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
            <span>© NIMR Concessions 2026. Tout droit réservé.</span>
          </div>
        </div>
      </aside>

      {/* 2. Top Header and Central View Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header bar with search indices */}
        <header className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 shadow-sm z-10">
          
          {/* Global search across dossiers */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2.5 pl-9 pr-8 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 placeholder-zinc-400 text-zinc-800" 
              placeholder="Rechercher client, véhicule, immatriculation (TU)..."
              value={globalSearchTerm}
              onChange={(e) => {
                setGlobalSearchTerm(e.target.value);
                // Auto route to view folders list when typing search queries
                if (activeTab !== "dossiers-liste" && perm.canAccessTab(activeRole, "dossiers-liste")) {
                  setActiveTab("dossiers-liste");
                }
              }}
            />
            {globalSearchTerm && (
              <button 
                onClick={() => setGlobalSearchTerm("")}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 font-black text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Quick status displays */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            
            {/* Blocker notification indicator */}
            {dossiers.some(d => d.statut === DossierStatus.BLOQUE) && (
              <button 
                onClick={() => {
                  goToTab("dossiers-liste");
                  setStatusFilter(DossierStatus.BLOQUE);
                }}
                className="bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 animate-pulse border border-red-100 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{dossiers.filter(d => d.statut === DossierStatus.BLOQUE).length} BLOQUÉS ATELIER</span>
              </button>
            )}

            <div className="text-right leading-none hidden md:block">
              <span className="text-[10px] text-zinc-400 block font-bold">CONNECTÉ</span>
              <span className="text-zinc-800 font-extrabold">{currentUser.displayName}</span>
              <span className="block text-[10px] font-bold text-zinc-500">{activeRole}</span>
            </div>
          </div>

        </header>

        {/* Central Router Stage */}
        <main className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {selectedDossier ? (
            /* Open detailed view of client/vehicle */
            <DossierDetail 
              dossier={selectedDossier}
              dossiers={dossiers}
              reclamations={reclamations}
              userRole={activeRole}
              onBack={() => setSelectedDossierId(null)}
              onUpdateDossier={handleUpdateDossier}
              techniciensList={techList.map(t => ({ id: t.id, nom: t.nom }))}
              reservations={reservations}
            />
          ) : (
            /* Render active tabs */
            <>
              {activeTab === "dashboard" && (
                <DirectorDashboard 
                  dossiers={dossiers} 
                  techniciens={techList}
                  reservations={reservations}
                  availabilityConfig={availabilityConfig}
                  onSelectDossier={(id) => {
                    setSelectedDossierId(id);
                  }}
                />
              )}

              {activeTab === "reception-rapide" && (
                <GuidedReception 
                  dossiers={dossiers}
                  existingDossierIds={dossiers.map(d => d.id)}
                  onAddDossier={handleAddDossier}
                  onNavigateToTab={(tab) => {
                    goToTab(tab);
                  }}
                  vehicleMasterRecords={vehicleMasterRecords}
                  vehicleMasterLastImport={vehicleMasterLastImport}
                  onUpdateVehicleMaster={handleUpdateVehicleMaster}
                  onClearVehicleMaster={handleClearVehicleMaster}
                  currentUserRole={activeRole}
                  onSelectDossier={(id) => {
                    setSelectedDossierId(id);
                  }}
                />
              )}

              {activeTab === "dossiers-liste" && (
                <div className="space-y-4">
                  {/* View Mode Toggle Sub-navigation */}
                  <div className="flex border-b border-gray-200 bg-white p-2.5 rounded-lg shadow-sm gap-2">
                    <button
                      onClick={() => setDossierViewMode("standard")}
                      data-testid="dossier-mode-standard"
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        dossierViewMode === "standard"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      Liste simple des dossiers
                    </button>
                    <button
                      onClick={() => setDossierViewMode("vehicles")}
                      data-testid="dossier-mode-vehicles"
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        dossierViewMode === "vehicles"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      Recherche par véhicule
                    </button>
                  </div>

                  {dossierViewMode === "standard" ? (
                    <>
                      {/* Filter header bar */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-2.5 items-center justify-between shadow-sm">
                        <div>
                          <h3 className="text-sm font-extrabold tracking-tight uppercase font-display text-slate-900">{dossierOperationalFilterLabels[dossierOperationalFilter]} SAV ({filteredDossiers.length})</h3>
                          <p className="text-slate-400 text-xs text-left">Fiches d'intervention et réparations d'assurance, garantie et mécanique</p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          {(["active", "ready_for_billing", "delivered", "all"] as DossierOperationalFilter[]).map(filter => (
                            <button
                              key={filter}
                              type="button"
                              data-testid={`dossier-operational-filter-${filter}`}
                              onClick={() => setDossierOperationalFilter(filter)}
                              className={`px-3 py-1.5 rounded-md font-bold border transition ${
                                dossierOperationalFilter === filter
                                  ? "bg-slate-950 text-white border-slate-950"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                              }`}
                            >
                              {dossierOperationalFilterLabels[filter]}
                            </button>
                          ))}

                          <select
                            className="p-1.5 px-3 bg-slate-50 border border-slate-200 rounded-md font-semibold text-zinc-800 focus:outline-none focus:border-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <option value="Tous">Tous les statuts</option>
                            {Object.values(DossierStatus).map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>

                          <select
                            className="p-1.5 px-3 bg-slate-50 border border-slate-200 rounded-md font-semibold text-zinc-800 focus:outline-none focus:border-blue-500"
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                          >
                            <option value="Toutes">Toutes les priorités</option>
                            {Object.values(DossierPriority).map(pr => (
                              <option key={pr} value={pr}>{pr}</option>
                            ))}
                          </select>

                          {perm.canExportData(activeRole) && (
                            <button
                              type="button"
                              data-testid="dossier-list-export-csv"
                              onClick={handleExportDossiersCSV}
                              className="px-3 py-1.5 rounded-md font-bold border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                            >
                              Exporter CSV
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rendering standard table of dossiers */}
                      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        {filteredDossiers.length === 0 ? (
                          <div className="text-center py-10 space-y-2 text-xs text-slate-400">
                            <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                            <span>Aucun dossier ne correspond à vos options de filtres actifs.</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto min-w-full">
                            <table className="w-full text-left border-collapse text-xs font-semibold">
                              <thead>
                                <tr className="border-b border-gray-200 uppercase font-bold text-[9px] text-slate-400 bg-slate-50/60 p-2 tracking-wider font-display">
                                  <th className="py-2.5 px-4">Dossier</th>
                                  <th className="py-2.5 px-4">Client & Immatriculation (TU)</th>
                                  <th className="py-2.5 px-4">Type</th>
                                  <th className="py-2.5 px-4 font-bold">Priorité</th>
                                  <th className="py-2.5 px-4">Statut SAV</th>
                                  <th className="py-2.5 px-4 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredDossiers.map(doss => (
                                  <tr
                                    key={doss.id}
                                    data-testid={`dossier-card-${doss.id}`}
                                    className="hover:bg-slate-50/40 cursor-pointer transition"
                                    onClick={() => setSelectedDossierId(doss.id)}
                                  >
                                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{doss.id}</td>
                                    <td className="py-3 px-4 space-y-1">
                                      <div className="font-bold text-slate-800 leading-none font-display text-xs">
                                        {doss.clientNom}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                        <span>{doss.vehiculeMarque} {doss.vehiculeModele}</span>
                                        <span>•</span>
                                        <span>{doss.vehiculeImmatriculation}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 uppercase text-[10px] text-zinc-500 font-mono">{doss.typeDossier}</td>
                                    <td className="py-3 px-4">
                                      <PriorityBadge priority={doss.priorite} />
                                    </td>
                                    <td className="py-3 px-4">
                                      <StatusBadge status={doss.statut} />
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDossierId(doss.id);
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-bold text-[10px] hover:bg-blue-700 hover:scale-105 active:scale-95 transition duration-150 cursor-pointer"
                                      >
                                        Fiche complète
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <VehicleSearchView
                      dossiers={dossiers}
                      onSelectDossier={(id) => setSelectedDossierId(id)}
                    />
                  )}
                </div>
              )}

              {activeTab === "atelier-planning" && (
                <WorkshopPlanning 
                  techniciens={techList}
                  dossiers={dossiers}
                  reservations={reservations}
                  onUpdateReservations={handleUpdateReservations}
                  onSelectDossier={(id) => setSelectedDossierId(id)}
                  onUpdateDossier={handleUpdateDossier}
                  activeRole={activeRole}
                  availabilityConfig={availabilityConfig}
                  onUpdateAvailabilityConfig={handleUpdateAvailabilityConfig}
                />
              )}

              {activeTab === "chef-atelier" && (
                <ChefAtelierView 
                  dossiers={dossiers}
                  techniciens={techList}
                  onSelectDossier={(id) => setSelectedDossierId(id)}
                  onUpdateDossier={handleUpdateDossier}
                  activeRole={activeRole}
                />
              )}
              {activeTab === "reclamations" && (
                <ComplaintsView 
                  reclamations={reclamations}
                  dossiers={dossiers}
                  existingReclamationIds={reclamations.map(r => r.id)}
                  userRole={activeRole}
                  currentUserLabel={currentUser.displayName}
                  onAddReclamation={handleAddReclamation}
                  onUpdateReclamation={handleUpdateReclamation}
                  onUpdateDossier={handleUpdateDossier}
                  onSelectDossier={(id) => setSelectedDossierId(id)}
                />
              )}

              {activeTab === "tech-view" && (
                <TechnicianView 
                  dossiers={dossiers}
                  techniciens={techList}
                  onUpdateDossier={handleUpdateDossier}
                  activeRole={activeRole}
                  currentUserLabel={currentUser?.displayName || ""}
                />
              )}

              {activeTab === "controle-qualite" && (
                <ControleQualiteView 
                  dossiers={dossiers}
                  onUpdateDossier={handleUpdateDossier}
                  currentUser={{ displayName: currentUser.displayName, role: activeRole }}
                />
              )}

              {activeTab === "livraison" && (
                <LivraisonView 
                  dossiers={dossiers}
                  onUpdateDossier={handleUpdateDossier}
                  currentUser={{ displayName: currentUser.displayName, role: activeRole }}
                />
              )}

              {activeTab === "garantie" && (
                <WarrantyView
                  dossiers={dossiers}
                  onUpdateDossier={handleUpdateDossier}
                  currentUser={{ displayName: currentUser.displayName, role: activeRole }}
                />
              )}

              {activeTab === "satisfaction" && (
                <SatisfactionView
                  dossiers={dossiers}
                  onUpdateDossier={handleUpdateDossier}
                  currentUser={{ displayName: currentUser.displayName, role: activeRole }}
                />
              )}

              {activeTab === "rendements-sav" && (
                <PerformanceSAV 
                  dossiers={dossiers}
                  reservations={reservations}
                  complaints={reclamations}
                  availabilityConfig={availabilityConfig}
                  vehicleMasterRecords={vehicleMasterRecords}
                  currentUserRole={activeRole}
                />
              )}

              {activeTab === "parametres" && (
                <SettingsView 
                  onExportData={handleExportDataJSON}
                  onImportData={handleImportDataJSON}
                  onRestoreImportBackup={handleRestoreImportBackup}
                  hasImportBackup={hasImportBackup}
                  activeRole={activeRole}
                  importSuccessMessage={importSuccessMessage}
                  importErrorMessage={importErrorMessage}
                />
              )}

              {activeTab === "users" && perm.canManageUsers(activeRole) && (
                <UserManagementView
                  users={users}
                  currentUser={currentUser}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onToggleUserActive={handleToggleUserActive}
                  onResetPin={handleResetUserPin}
                />
              )}

              {/* Kanban visual screen */}
              {activeTab === "atelier-kanban" && (
                <KanbanBoard dossiers={dossiers} onSelectDossier={setSelectedDossierId} />
              )}
            </>
          )}

          {showExportConfirm && (
            <div data-testid="export-json-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <h3 className="font-black uppercase text-slate-900">Confirmer l'export JSON</h3>
                    <p className="mt-1 font-semibold text-slate-600">
                      L'export contient des données locales sensibles. Les téléphones sont masqués si le rôle courant n'est pas autorisé.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    data-testid="export-json-cancel"
                    onClick={() => setShowExportConfirm(false)}
                    className="rounded-lg bg-slate-100 px-4 py-2 font-extrabold text-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    data-testid="export-json-confirm"
                    onClick={executeExportDataJSON}
                    className="rounded-lg bg-slate-900 px-4 py-2 font-extrabold text-white"
                  >
                    Confirmer l'export
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingImport && (
            <div data-testid="import-json-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-xl">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                  <div>
                    <h3 className="font-black uppercase text-slate-900">Confirmer l'import JSON</h3>
                    <p className="mt-1 font-semibold text-slate-600">
                      Une sauvegarde locale pré-import a été créée. L'import remplace les données locales des sections présentes.
                    </p>
                  </div>
                </div>
                <div data-testid="import-json-summary" className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-bold text-slate-700">
                  Fichier : {pendingImport.fileName} · {pendingImport.summary.label}
                </div>
                <label className="block space-y-1.5">
                  <span className="font-black text-slate-700">Confirmation forte</span>
                  <input
                    data-testid="import-json-confirmation-input"
                    value={importConfirmationText}
                    onChange={(e) => setImportConfirmationText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-800"
                    placeholder={STRONG_IMPORT_CONFIRMATION}
                  />
                </label>
                <div className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-800">
                  Saisir exactement : {STRONG_IMPORT_CONFIRMATION}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    data-testid="import-json-cancel"
                    onClick={() => {
                      setPendingImport(null);
                      setImportConfirmationText("");
                    }}
                    className="rounded-lg bg-slate-100 px-4 py-2 font-extrabold text-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    data-testid="import-json-confirm"
                    disabled={!isStrongImportConfirmation(importConfirmationText)}
                    onClick={confirmPendingImport}
                    className="rounded-lg bg-rose-600 px-4 py-2 font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    Remplacer les données locales
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
}
