/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  UserRole, 
  DossierStatus, 
  DossierSAV, 
  ReclammationClient, 
  ActiviteLog, 
  TechnicienResource,
  AtelierZone,
  DossierPriority
} from "./types";
import { 
  INITIAL_DOSSIERS, 
  MOCK_TECHNICIENS, 
  INITIAL_RECLAMATIONS, 
  INITIAL_ACTIVITE_LOGS
} from "./data";
import {
  createBackupPayload,
  createRuntimeId,
  isActiviteLog,
  isDossierSAV,
  isReclamationClient,
  isTechnicienResource,
  normalizeDossierForRuntime,
  parseStoredArray,
  validateBackupPayload
} from "./sav-core";
import { APP_NAME, APP_VERSION } from "./app-identity";
import { canAccessTab, canChangeRole, getDefaultTabForRole, normalizeTabForRole, TabId } from "./roles";
import { STORAGE_KEYS } from "./storage-keys";

// Views
import DirectorDashboard from "./components/DirectorDashboard";
import GuidedReception from "./components/GuidedReception";
import DossierDetail from "./components/DossierDetail";
import WorkshopPlanning from "./components/WorkshopPlanning";
import ChefAtelierView from "./components/ChefAtelierView";
import TechnicianView from "./components/TechnicianView";
import ComplaintsView from "./components/ComplaintsView";
import PerformanceSAV from "./components/PerformanceSAV";
import SettingsView from "./components/SettingsView";
import { StatusBadge, PriorityBadge } from "./components/UIParts";

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
  Moon, 
  Sun,
  Search,
  Bell,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Inbox,
  Lock,
  Plus
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

function loadStoredRole(): UserRole {
  try {
    const storedRole = localStorage.getItem(STORAGE_KEYS.userRole);
    if (storedRole && Object.values(UserRole).includes(storedRole as UserRole)) {
      return storedRole as UserRole;
    }
  } catch {
    // Keep the app usable when browser storage is unavailable.
  }
  return UserRole.DIRECTEUR_SAV;
}

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // User connected simulation
  const [activeRole, setActiveRole] = useState<UserRole>(() => loadStoredRole());

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabId>(() => getDefaultTabForRole(activeRole));

  // Core Data Source States with LocalStorage fallback
  const [dossiers, setDossiers] = useState<DossierSAV[]>([]);
  const [reclamations, setReclamations] = useState<ReclammationClient[]>([]);
  const [techList, setTechList] = useState<TechnicienResource[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActiviteLog[]>([]);

  // Detailed selected folder id
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);

  // Import feedback states
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);

  // Search and Filter states
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Tous");
  const [priorityFilter, setPriorityFilter] = useState<string>("Toutes");

  // Load initial states or restore from local storage
  useEffect(() => {
    setDossiers(loadStoredArray(STORAGE_KEYS.dossiers, INITIAL_DOSSIERS, isDossierSAV).map(normalizeDossierForRuntime));
    setReclamations(loadStoredArray(STORAGE_KEYS.reclamations, INITIAL_RECLAMATIONS, isReclamationClient));
    setTechList(loadStoredArray(STORAGE_KEYS.techs, MOCK_TECHNICIENS, isTechnicienResource));
    setActivityLogs(loadStoredArray(STORAGE_KEYS.logs, INITIAL_ACTIVITE_LOGS, isActiviteLog));
  }, []);

  useEffect(() => {
    writeLocalStorageValue(STORAGE_KEYS.userRole, activeRole);
  }, [activeRole]);

  useEffect(() => {
    if (!canAccessTab(activeRole, activeTab)) {
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
    // Generate an automatic log entry if status has updated
    const original = dossiers.find(d => d.id === updatedDossier.id);
    if (original && original.statut !== updatedDossier.statut) {
      const newLog: ActiviteLog = {
        id: createRuntimeId("log"),
        timestamp: new Date().toISOString(),
        user: activeRole,
        role: activeRole,
        action: "Changement statut",
        details: `Dossier ${updatedDossier.id} marqué comme ${updatedDossier.statut}`
      };
      
      const newLogs = [newLog, ...activityLogs];
      setActivityLogs(newLogs);
      writeLocalStorageJSON(STORAGE_KEYS.logs, newLogs);
    }

    const nextDossiers = dossiers.map(item => item.id === updatedDossier.id ? updatedDossier : item);
    saveDossiersToStorage(nextDossiers);
  };

  const handleAddDossier = (newDossier: DossierSAV) => {
    const nextDossiers = [newDossier, ...dossiers];
    
    // Log creation
    const newLog: ActiviteLog = {
      id: createRuntimeId("log_create"),
      timestamp: new Date().toISOString(),
      user: activeRole,
      role: activeRole,
      action: "Création dossier",
      details: `Création réussite du dossier ${newDossier.id} (${newDossier.vehiculeMarque})`
    };
    const newLogs = [newLog, ...activityLogs];
    setActivityLogs(newLogs);
    writeLocalStorageJSON(STORAGE_KEYS.logs, newLogs);

    saveDossiersToStorage(nextDossiers);
  };

  const handleAddReclamation = (newRec: ReclammationClient) => {
    const nextRecs = [newRec, ...reclamations];
    setReclamations(nextRecs);
    writeLocalStorageJSON(STORAGE_KEYS.reclamations, nextRecs);
  };

  const handleUpdateReclamation = (updatedRec: ReclammationClient) => {
    const nextRecs = reclamations.map(r => r.id === updatedRec.id ? updatedRec : r);
    setReclamations(nextRecs);
    writeLocalStorageJSON(STORAGE_KEYS.reclamations, nextRecs);
  };

  // State Import/Export logic
  const handleExportDataJSON = () => {
    const fullBackup = createBackupPayload(dossiers, reclamations, techList, activityLogs);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "NIMR_SAV_PRO_BASE_BACKUP.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportDataJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
    const reader = new FileReader();
    const files = e.target.files;
    if (files && files[0]) {
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const validation = validateBackupPayload(parsed);
          if (validation.ok === false) {
            setImportErrorMessage(validation.error);
            alert(validation.error);
            return;
          }

          if (validation.data.dossiers) {
            const normalizedDossiers = validation.data.dossiers.map(normalizeDossierForRuntime);
            setDossiers(normalizedDossiers);
            writeLocalStorageJSON(STORAGE_KEYS.dossiers, normalizedDossiers);
          }
          if (validation.data.reclamations) {
            setReclamations(validation.data.reclamations);
            writeLocalStorageJSON(STORAGE_KEYS.reclamations, validation.data.reclamations);
          }
          if (validation.data.techList) {
            setTechList(validation.data.techList);
            writeLocalStorageJSON(STORAGE_KEYS.techs, validation.data.techList);
          }
          if (validation.data.activityLogs) {
            setActivityLogs(validation.data.activityLogs);
            writeLocalStorageJSON(STORAGE_KEYS.logs, validation.data.activityLogs);
          }
          setImportSuccessMessage("Base restaurée avec succès !");
          alert("Base restaurée avec succès !");
        } catch (err) {
          setImportErrorMessage("Erreur de format de fichier de sauvegarde.");
          alert("Erreur de format de fichier de sauvegarde.");
        }
        e.target.value = "";
      };
      reader.onerror = () => {
        setImportErrorMessage("Impossible de lire le fichier de sauvegarde.");
        alert("Impossible de lire le fichier de sauvegarde.");
      };
      reader.readAsText(files[0]);
    }
  };

  // Filter application search indexing
  const filteredDossiers = dossiers.filter(d => {
    const textToSearch = `${d.id} ${d.clientNom} ${d.vehiculeImmatriculation} ${d.vehiculeMarque} ${d.vehiculeModele} ${d.clientTelephone}`.toLowerCase();
    const matchesSearch = textToSearch.includes(globalSearchTerm.toLowerCase());
    const matchesStatus = statusFilter === "Tous" || d.statut === statusFilter;
    const matchesPriority = priorityFilter === "Toutes" || d.priorite === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const selectedDossier = selectedDossierId ? dossiers.find(d => d.id === selectedDossierId) : null;
  const allowRoleChange = canChangeRole(activeRole);
  const goToTab = (tab: string) => {
    const nextTab = normalizeTabForRole(activeRole, tab);
    setSelectedDossierId(null);
    setActiveTab(nextTab);
  };

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

          {/* Quick simulator info */}
          <div className="bg-slate-50 rounded-lg p-3 border border-gray-200 text-xs">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Rôle Connecté (Démo)</span>
            <div className="flex items-center justify-between">
              <span data-testid="current-role" className="font-extrabold text-blue-600 font-display">{activeRole}</span>
              {allowRoleChange ? (
                <button 
                  onClick={() => goToTab("parametres")}
                  data-testid="role-switch-button"
                  className="text-[10px] text-zinc-500 underline hover:text-zinc-800 cursor-pointer"
                >
                  Changer
                </button>
              ) : (
                <span 
                  data-testid="role-change-blocked-message" 
                  className="text-[10px] text-rose-600 font-semibold italic"
                  title="Votre rôle connecté ne permet pas de modifier les habilitations."
                >
                  Modification bloquée
                </span>
              )}
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block px-2.5 pb-2">Central Opérationnel</span>
            {[
              { id: "dashboard", label: "Dashboard 360°", icon: Layout },
              { id: "reception-rapide", label: "Réception Guidée", icon: Users },
              { id: "dossiers-liste", label: "Dossiers SAV ERP", icon: FileText },
              { id: "atelier-planning", label: "Planning Atelier", icon: Calendar },
              { id: "atelier-kanban", label: "Kanban Atelier", icon: ClipboardList },
              { id: "chef-atelier", label: "Chef d'atelier", icon: Wrench },
              { id: "tech-view", label: "Mode Technicien", icon: UserCheck },
              { id: "reclamations", label: "Réclamations SAV", icon: ShieldAlert },
              { id: "rendements-sav", label: "Rapport Performances", icon: BarChart3 },
              { id: "parametres", label: "Paramètres Système", icon: SlidersHorizontal }
            ].map(item => {
              if (!canAccessTab(activeRole, item.id)) return null;
              
              const LinkIcon = item.icon;
              const isSel = activeTab === item.id;
              
              const navTestIds: Record<string, string> = {
                "dashboard": "nav-dashboard",
                "reception-rapide": "nav-reception",
                "dossiers-liste": "nav-dossiers",
                "atelier-planning": "nav-planning",
                "chef-atelier": "nav-chef-atelier",
                "tech-view": "nav-technician",
                "parametres": "nav-settings",
                "atelier-kanban": "nav-kanban",
                "reclamations": "nav-reclamations",
                "rendements-sav": "nav-performance"
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

        {/* Footer info and theme button */}
        <div className="pt-4 border-t border-gray-200 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-bold uppercase tracking-wider">Thème</span>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 border border-gray-200 rounded-md text-zinc-600 hover:text-zinc-800 transition cursor-pointer"
              title="Toggle theme mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          
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
                if (activeTab !== "dossiers-liste" && canAccessTab(activeRole, "dossiers-liste")) {
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
              <span className="text-zinc-800 font-extrabold">{activeRole}</span>
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
              userRole={activeRole}
              onBack={() => setSelectedDossierId(null)}
              onUpdateDossier={handleUpdateDossier}
              techniciensList={techList.map(t => ({ id: t.id, nom: t.nom }))}
            />
          ) : (
            /* Render active tabs */
            <>
              {activeTab === "dashboard" && (
                <DirectorDashboard 
                  dossiers={dossiers} 
                  techniciens={techList}
                  onSelectDossier={(id) => {
                    setSelectedDossierId(id);
                  }}
                />
              )}

              {activeTab === "reception-rapide" && (
                <GuidedReception 
                  existingDossierIds={dossiers.map(d => d.id)}
                  onAddDossier={handleAddDossier}
                  onNavigateToTab={(tab) => {
                    goToTab(tab);
                  }}
                />
              )}

              {activeTab === "dossiers-liste" && (
                <div className="space-y-4">
                  {/* Filter header bar */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-2.5 items-center justify-between shadow-sm">
                    <div>
                      <h3 className="text-sm font-extrabold tracking-tight uppercase font-display text-slate-900">Tous les Dossiers Actifs SAV ({filteredDossiers.length})</h3>
                      <p className="text-slate-400 text-xs text-left">Fiches d'intervention et réparations d'assurance, garantie et mécanique</p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
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
                </div>
              )}

              {activeTab === "atelier-planning" && (
                <WorkshopPlanning 
                  techniciens={techList}
                  dossiers={dossiers}
                  onSelectDossier={(id) => setSelectedDossierId(id)}
                  onUpdateDossier={handleUpdateDossier}
                />
              )}

              {activeTab === "chef-atelier" && (
                <ChefAtelierView 
                  dossiers={dossiers}
                  techniciens={techList}
                  onSelectDossier={(id) => setSelectedDossierId(id)}
                  onUpdateDossier={handleUpdateDossier}
                />
              )}

              {activeTab === "reclamations" && (
                <ComplaintsView 
                  reclamations={reclamations}
                  existingReclamationIds={reclamations.map(r => r.id)}
                  onAddReclamation={handleAddReclamation}
                  onUpdateReclamation={handleUpdateReclamation}
                />
              )}

              {activeTab === "tech-view" && (
                <TechnicianView 
                  dossiers={dossiers}
                  techniciens={techList}
                  onUpdateDossier={handleUpdateDossier}
                />
              )}

              {activeTab === "rendements-sav" && (
                <PerformanceSAV />
              )}

              {activeTab === "parametres" && (
                <SettingsView 
                  onExportData={handleExportDataJSON}
                  onImportData={handleImportDataJSON}
                  activeRole={activeRole}
                  canChangeRole={allowRoleChange}
                  onChangeRole={(role) => {
                    if (!allowRoleChange) return;
                    setActiveRole(role);
                    setSelectedDossierId(null);
                    setActiveTab(getDefaultTabForRole(role));
                  }}
                  importSuccessMessage={importSuccessMessage}
                  importErrorMessage={importErrorMessage}
                />
              )}

              {/* Kanban visual screen */}
              {activeTab === "atelier-kanban" && (
                <div className="space-y-4 text-xs font-semibold">
                  <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                    <h3 className="font-extrabold text-sm uppercase tracking-tight text-slate-900">Tableau Kanban d'Avancement de l'Atelier</h3>
                    <p className="text-xs text-zinc-500">Visualisation dynamique des colonnes de production par statut</p>
                  </div>

                  {/* Grid of columns representing stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    
                    {/* Received column */}
                    <div className="bg-slate-50 border border-gray-200 p-4 rounded-lg space-y-3 shadow-xs">
                      <span className="font-bold text-xs uppercase text-zinc-500 block border-b pb-1 font-display">
                        1. Réceptionnés ({dossiers.filter(d => [DossierStatus.VEHICULE_RECU, DossierStatus.TRAVAUX_PLANIFIES].includes(d.statut)).length})
                      </span>
                      
                      <div className="space-y-2">
                        {dossiers.filter(d => [DossierStatus.VEHICULE_RECU, DossierStatus.TRAVAUX_PLANIFIES].includes(d.statut)).map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => setSelectedDossierId(d.id)}
                            className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
                          >
                            <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                            <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                            <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Works in progress column */}
                    <div className="bg-sky-50/50 border border-sky-100 p-4 rounded-lg space-y-3 shadow-xs">
                      <span className="font-bold text-xs uppercase text-sky-600 block border-b pb-1 font-display">
                        2. En travaux ({dossiers.filter(d => d.statut === DossierStatus.EN_TRAVAUX).length})
                      </span>
                      
                      <div className="space-y-2">
                        {dossiers.filter(d => d.statut === DossierStatus.EN_TRAVAUX).map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => setSelectedDossierId(d.id)}
                            className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
                          >
                            <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                            <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                            <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Blocked column */}
                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-lg space-y-3 shadow-xs">
                      <span className="font-bold text-xs uppercase text-red-600 block border-b pb-1 font-display">
                        3. Bloqués ({dossiers.filter(d => d.statut === DossierStatus.BLOQUE).length})
                      </span>
                      
                      <div className="space-y-2">
                        {dossiers.filter(d => d.statut === DossierStatus.BLOQUE).map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => setSelectedDossierId(d.id)}
                            className="bg-white p-3 rounded-lg border border-gray-200 hover:border-red-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
                          >
                            <span className="font-mono text-red-600 font-black text-[11px]">{d.id}</span>
                            <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                            <span className="text-[10px] text-red-600 font-bold block truncate">{d.bloqueRaison || "Facteur bloquant"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ready to hand over column */}
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg space-y-3 shadow-xs">
                      <span className="font-bold text-xs uppercase text-emerald-600 block border-b pb-1 font-display">
                        4. À livrer ({dossiers.filter(d => d.statut === DossierStatus.PRET_A_LIVRER).length})
                      </span>
                      
                      <div className="space-y-2">
                        {dossiers.filter(d => d.statut === DossierStatus.PRET_A_LIVRER).map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => setSelectedDossierId(d.id)}
                            className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition cursor-pointer space-y-1.5"
                          >
                            <span className="font-mono text-blue-600 font-extrabold text-[11px]">{d.id}</span>
                            <div className="font-bold text-slate-800 leading-tight block truncate font-display">{d.clientNom}</div>
                            <span className="text-[10px] text-zinc-400 font-bold block">{d.vehiculeMarque} {d.vehiculeModele}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </>
          )}

        </main>

      </div>

    </div>
  );
}
