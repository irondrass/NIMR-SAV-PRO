/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  DossierSAV, 
  DossierStatus, 
  DossierPriority, 
  InterventionType,
  AtelierZone,
  RepairOrderLine,
  ComplementTravail,
  AccordSuivi,
  UserRole
} from "../types";
import {
  confirmDelivery,
  createRuntimeId,
  markReadyForBilling,
  submitQualityControl
} from "../sav-core";
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Car, 
  Wrench, 
  Camera, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  ChevronRight, 
  Plus, 
  AlertTriangle,
  History,
  Lock,
  ThumbsUp,
  XCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  FileCheck
} from "lucide-react";
import { StatusBadge, PriorityBadge, LicencePlate, FuelIndicator, MiniProgress, InterventionTypeBadge } from "./UIParts";

interface DossierDetailProps {
  dossier: DossierSAV;
  userRole: UserRole;
  onBack: () => void;
  onUpdateDossier: (updated: DossierSAV) => void;
  techniciensList: { id: string; nom: string }[];
}

export default function DossierDetail({ 
  dossier, 
  userRole, 
  onBack, 
  onUpdateDossier,
  techniciensList
}: DossierDetailProps) {
  const [activeTab, setActiveTab] = useState<string>("resume");
  
  // Temporary form values for adding a repair order line
  const [newROLineText, setNewROLineText] = useState("");
  const [newROLineTime, setNewROLineTime] = useState<number>(1.0);

  // For adding custom logs
  const [newLogText, setNewLogText] = useState("");

  const updateDossierState = (changes: Partial<DossierSAV>) => {
    const updated = {
      ...dossier,
      ...changes,
      dateDernierStatut: new Date().toISOString()
    };
    onUpdateDossier(updated);
  };

  // 1. Repair Order functions
  const handleAddROLine = () => {
    if (!newROLineText.trim()) return;
    const newLine: RepairOrderLine = {
      id: createRuntimeId("ro"),
      designation: newROLineText.trim(),
      tempsEstime: Number(newROLineTime),
      tempsPasse: 0,
      status: "non_commence"
    };
    const updatedRO = [...dossier.ordresReparation, newLine];
    
    // Auto recalculate progress percentage based on task counts
    const completedCount = updatedRO.filter(r => r.status === "termine").length;
    const progress = Math.round((completedCount / updatedRO.length) * 100);

    updateDossierState({
      ordresReparation: updatedRO,
      avancementGlobal: progress
    });
    setNewROLineText("");
    setNewROLineTime(1.0);
  };

  const handleToggleROStatus = (lineId: string, nextStatus: "non_commence" | "en_cours" | "suspendu" | "termine") => {
    const updatedRO = dossier.ordresReparation.map(line => {
      if (line.id === lineId) {
        return { 
          ...line, 
          status: nextStatus,
          tempsPasse: nextStatus === "termine" ? line.tempsEstime : line.tempsPasse
        };
      }
      return line;
    });

    const completedCount = updatedRO.filter(r => r.status === "termine").length;
    const progress = Math.round((completedCount / updatedRO.length) * 100);

    // Auto-recommmended action update
    let nextRec = dossier.prochaineActionRecommended;
    if (progress === 100 && dossier.statut === DossierStatus.EN_TRAVAUX) {
      nextRec = "Lancer le contrôle qualité d'essai routier";
    }

    updateDossierState({
      ordresReparation: updatedRO,
      avancementGlobal: progress,
      prochaineActionRecommended: nextRec
    });
  };

  // 2. Complements Actions
  const handleStatusComplement = (compId: string, nextStatut: "accepte" | "refuse" | "planifie") => {
    const updatedComps = dossier.complements.map(c => {
      if (c.id === compId) {
        return { ...c, statut: nextStatut };
      }
      return c;
    });
    updateDossierState({ complements: updatedComps });
  };

  // 3. Approval status
  const handleUpdateAccordStatut = (accId: string, nextStatut: "en_attente" | "approuve" | "refuse") => {
    const updatedAccs = dossier.accords.map(a => {
      if (a.id === accId) {
        return { ...a, statut: nextStatut };
      }
      return a;
    });
    updateDossierState({ accords: updatedAccs });
  };

  // 4. Checklist Quality validation
  const handleQCFieldChange = (field: keyof typeof dossier.checklistQC, value: boolean) => {
    const updatedQC = {
      ...dossier.checklistQC,
      [field]: value
    };
    updateDossierState({ checklistQC: updatedQC });
  };

  const handleQCSubmit = (globVal: "valide" | "refuse", comment?: string) => {
    onUpdateDossier(submitQualityControl(dossier, userRole, globVal, comment));
  };

  // 5. Handover / Delivery functions
  const handleDeliveryConfirm = () => {
    onUpdateDossier(confirmDelivery(dossier));
  };

  const handleFinalOperationalClose = () => {
    onUpdateDossier(markReadyForBilling(dossier));
  };

  const canManageDossier = [UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole);
  const canUpdateWorkOrders = [UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER, UserRole.TECHNICIEN].includes(userRole);
  const canHandleApprovals = [UserRole.DIRECTEUR_SAV, UserRole.RECEPTIONNAIRE].includes(userRole);
  const canValidateQuality = [UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER, UserRole.CONTROLE_QUALITE].includes(userRole);
  const canDeliverVehicle = [UserRole.DIRECTEUR_SAV, UserRole.RECEPTIONNAIRE].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-display">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-neutral-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste des dossiers
        </button>

        {canManageDossier && (
          <div className="flex flex-wrap gap-2">
            {/* Quick manual status trigger for demonstration */}
            <span className="text-xs font-bold text-neutral-400 self-center">Forcer le statut (Démo) :</span>
            <select
              className="p-1 px-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-bold text-xs text-slate-800 dark:text-neutral-300"
              value={dossier.statut}
              onChange={(e) => updateDossierState({ statut: e.target.value as DossierStatus })}
            >
              {Object.values(DossierStatus).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            <select
              className="p-1 px-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-bold text-xs text-slate-800 dark:text-neutral-300"
              value={dossier.priorite}
              onChange={(e) => updateDossierState({ priorite: e.target.value as DossierPriority })}
            >
              {Object.values(DossierPriority).map((pr) => (
                <option key={pr} value={pr}>{pr}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Hero card showing vehicle and status summary */}
      <div className="bg-slate-900 text-white rounded-lg p-6 shadow-md border-b-4 border-blue-600">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-600 text-white text-[11px] font-mono font-extrabold px-2.5 py-1 rounded">
                {dossier.id}
              </span>
              <InterventionTypeBadge type={dossier.typeDossier} />
              <PriorityBadge priority={dossier.priorite} />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black font-display tracking-tight uppercase">{dossier.clientNom}</h1>
              <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs">
                <span className="font-bold text-slate-200 font-display">{dossier.vehiculeMarque} {dossier.vehiculeModele}</span>
                <span>•</span>
                <LicencePlate plate={dossier.vehiculeImmatriculation} />
                <span>•</span>
                <span>Kms: {dossier.vehiculeKilometrage.toLocaleString()}</span>
                <span>•</span>
                <span>VIN: <span className="font-mono text-[11px] text-slate-300">{dossier.vehiculeVIN}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Statut Actuel Opérationnel</span>
            <StatusBadge status={dossier.statut} />
            
            {/* Progress indicator */}
            <div className="mt-1 flex items-center gap-2">
              <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${dossier.avancementGlobal}%` }}></div>
              </div>
              <span className="text-xs font-mono font-bold text-green-400">{dossier.avancementGlobal}% terminé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-slate-200 dark:border-neutral-800 flex overflow-x-auto bg-slate-50 dark:bg-neutral-950 p-1.5 rounded-lg">
        {[
          { key: "resume", label: "Résumé Action", icon: FileText },
          { key: "client", label: "Client & Véhicule", icon: User },
          { key: "repair-orders", label: "Ordres Travaux", icon: Wrench },
          { key: "photos", label: "Dossier Photos", icon: Camera },
          { key: "complements", label: "Compléments & Accords", icon: ThumbsUp },
          { key: "quality-control", label: "Checklist Qualité", icon: CheckCircle2 },
          { key: "deliveries", label: "Livraison Véhicule", icon: FileCheck }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isSel = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`p-2.5 px-4 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-2 transition duration-150 ${
                isSel 
                  ? "bg-slate-900 text-white dark:bg-neutral-800" 
                  : "text-slate-500 dark:text-neutral-400 hover:text-slate-950 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-neutral-800"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
        
        {/* Tab 1: Résumé */}
        {activeTab === "resume" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left summary values */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200 border-b pb-1.5">Mises en demeure & Suivi</h3>
                
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/60 rounded-xl space-y-2.5">
                  <div className="flex gap-2 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-500 flex-shrink-0" />
                    <div>
                      <span className="uppercase block font-black leading-none">Prochaine action recommandée :</span>
                      <span className="text-[13px] font-medium block mt-1 text-slate-900 dark:text-neutral-200">
                        {dossier.prochaineActionRecommended}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-zinc-400 block font-normal">Responsable en cours :</span>
                    <span className="text-zinc-700 dark:text-neutral-300 font-bold block">{dossier.technicienId ? techniciensList.find(t=>t.id===dossier.technicienId)?.nom || "Technicien Affecté" : "Non assigné"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Zone de l'Atelier :</span>
                    <span className="text-zinc-700 dark:text-neutral-300 font-bold block">{dossier.zoneAtelier || "Réception"}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Date d'Entrée :</span>
                    <span className="text-zinc-700 dark:text-neutral-300 font-bold block">
                      {new Date(dossier.dateReception).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block font-normal">Échéance de restitution :</span>
                    <span className="text-zinc-700 dark:text-neutral-300 font-bold block">
                      {new Date(dossier.dateSouhaiteeLivraison).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {dossier.bloqueRaison && (
                  <div className="p-3 bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-red-950 rounded-lg flex gap-2.5 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Facteur Bloquant Atelier :</span>
                      <p className="font-medium mt-0.5">{dossier.bloqueRaison}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Quick action box */}
              {canManageDossier && (
                <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-4">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-neutral-300 uppercase tracking-wider">Planifications & Contrôles Rapides</h4>
                  <p className="text-xs text-slate-500">
                    Attribuer rapidement le dossier à un technicien disponible ou diriger le dossier vers la zone appropriée.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-neutral-400 mb-1">Attribuer à un technicien :</label>
                      <select
                        className="w-full p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-semibold text-xs dark:text-neutral-100"
                        value={dossier.technicienId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDossierState({
                            technicienId: val || undefined,
                            statut: val ? DossierStatus.EN_TRAVAUX : DossierStatus.TRAVAUX_PLANIFIES,
                            prochaineActionRecommended: val ? "Terminer les ordres de réparation affectés" : "Affecter un technicien"
                          });
                        }}
                      >
                        <option value="">-- Non assigné (File d'attente) --</option>
                        {techniciensList.map(t => (
                          <option key={t.id} value={t.id}>{t.nom}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-neutral-400 mb-1">Zone de l'Atelier affectée :</label>
                      <select
                        className="w-full p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-semibold text-xs dark:text-neutral-100"
                        value={dossier.zoneAtelier || ""}
                        onChange={(e) => updateDossierState({ zoneAtelier: e.target.value as AtelierZone })}
                      >
                        <option value="">-- Non spécifiée (Lobby) --</option>
                        {Object.values(AtelierZone).map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] text-zinc-400 block text-right">Dernière mise à jour : {new Date(dossier.dateDernierStatut).toLocaleTimeString("fr-FR")}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Tab 2: Client & Véhicule */}
        {activeTab === "client" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200 border-b pb-1">Fiche Coordonnées Client</h3>
              
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-semibold">
                <div>
                  <span className="text-zinc-400 font-normal block">Client Titulaire :</span>
                  <span className="text-zinc-950 dark:text-zinc-100 font-bold block">{dossier.clientNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Téléphone Portable :</span>
                  <span className="text-blue-600 font-bold block font-mono">{dossier.clientTelephone}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Nom Déposant :</span>
                  <span className="text-zinc-700 dark:text-zinc-300 block">{dossier.deposantNom}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Téléphone Déposant :</span>
                  <span className="text-zinc-700 dark:text-zinc-300 block font-mono">{dossier.deposantTelephone}</span>
                </div>
              </div>

              {/* Objets check list display */}
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 text-xs">
                <span className="font-bold text-zinc-600 dark:text-zinc-300 block mb-1.5 uppercase">Objets recensés à bord :</span>
                {dossier.objetsLaisses.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">Aucun objet listé.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                    {dossier.objetsLaisses.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Vehicle spec block */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200 border-b pb-1">Identifiants Véhicule</h3>
              
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs font-medium">
                <div>
                  <span className="text-zinc-400 font-normal block">Marque / Gamme :</span>
                  <span className="text-zinc-950 dark:text-neutral-100 font-bold block">{dossier.vehiculeMarque}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Modèle Commercial :</span>
                  <span className="text-zinc-950 dark:text-neutral-100 font-bold block">{dossier.vehiculeModele}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Immatriculation NIMR :</span>
                  <LicencePlate plate={dossier.vehiculeImmatriculation} />
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Numéro de Châssis (VIN) :</span>
                  <span className="text-slate-800 dark:text-zinc-300 font-mono text-[11px] font-bold block">{dossier.vehiculeVIN}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Teinte Extérieure :</span>
                  <span className="text-slate-800 dark:text-zinc-300 font-bold block">{dossier.vehiculeCouleur || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-normal block">Kilométrage relevé :</span>
                  <span className="text-slate-800 dark:text-zinc-300 font-bold block">{dossier.vehiculeKilometrage.toLocaleString()} km</span>
                </div>
              </div>

              {/* Fuel and paint panel */}
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-2.5 text-xs">
                <span className="font-bold text-zinc-600 dark:text-zinc-400 block uppercase">Niveau d’Éthanol / Carburant</span>
                <FuelIndicator level={dossier.niveauCarburant} />
                
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-zinc-500">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.rayures ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Rayures: {dossier.etatCarrosserie.rayures ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.bosses ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Bosses: {dossier.etatCarrosserie.bosses ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.fissureParbrise ? "bg-red-500" : "bg-green-500"}`}></span>
                    Pare-brise cassé: {dossier.etatCarrosserie.fissureParbrise ? "OUI" : "NON"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${dossier.etatCarrosserie.jantesAbimees ? "bg-amber-500" : "bg-green-500"}`}></span>
                    Jante rayée: {dossier.etatCarrosserie.jantesAbimees ? "OUI" : "NON"}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Ordres de réparation */}
        {activeTab === "repair-orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200 font-display uppercase tracking-tight">Ordres de Travaux & Remplacement Pièces</h3>
                <p className="text-slate-400 text-xs">Suivi des travaux de main-d'œuvre spécifiques à l'atelier</p>
              </div>
              <span className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded font-mono">
                Total estimé : {dossier.ordresReparation.reduce((acc, current) => acc + current.tempsEstime, 0)} Heures
              </span>
            </div>

            {/* List RO line items */}
            <div className="space-y-2.5">
              {dossier.ordresReparation.map((line) => {
                let badgeStyle = "bg-stone-100 text-stone-600";
                if (line.status === "en_cours") badgeStyle = "bg-amber-50 text-amber-700 animate-pulse border border-amber-200";
                if (line.status === "termine") badgeStyle = "bg-green-50 text-green-700 border border-green-200";
                if (line.status === "suspendu") badgeStyle = "bg-rose-50 text-rose-700 border border-rose-200";

                return (
                  <div 
                    key={line.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs gap-4"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 dark:text-neutral-200 font-display uppercase text-[11px]">{line.designation}</span>
                      <div className="flex items-center gap-4 text-slate-400 text-[11px] font-semibold">
                        <span>Estimation: <span className="text-stone-700 dark:text-stone-300 font-bold font-mono">{line.tempsEstime}H</span></span>
                        <span>Passé: <span className="font-mono">{line.tempsPasse}H</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeStyle}`}>
                        {line.status.replace("_", " ")}
                      </span>

                      {/* Technical staff control buttons */}
                      {canUpdateWorkOrders && (
                        <div className="flex gap-1">
                          <button 
                            disabled={line.status === "en_cours"}
                            onClick={() => handleToggleROStatus(line.id, "en_cours")}
                            className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] disabled:opacity-30 cursor-pointer"
                            title="Lancer la tâche"
                          >
                            Démarrer
                          </button>
                          <button 
                            disabled={line.status === "termine"}
                            onClick={() => handleToggleROStatus(line.id, "termine")}
                            className="p-1 px-2.5 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700 disabled:opacity-30 cursor-pointer"
                            title="Valider la fin de tâche"
                          >
                            Terminer
                          </button>
                          <button 
                            disabled={line.status === "suspendu"}
                            onClick={() => handleToggleROStatus(line.id, "suspendu")}
                            className="p-1 px-2.5 bg-rose-600 text-white rounded font-bold text-[10px] hover:bg-rose-700 disabled:opacity-30 cursor-pointer"
                            title="Suspendre cette tâche"
                          >
                            Bloquer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form to append new repair order lines (Workshop Chief and Director only) */}
            {[UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER].includes(userRole) && (
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-dashed border-slate-200 dark:border-neutral-800 rounded-lg space-y-3 mt-4">
                <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase block font-display">Ajouter une ligne de travaux (Main d'œuvre / Diagnostic)</span>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <input 
                    type="text" 
                    className="md:col-span-2 p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-semibold dark:text-neutral-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    placeholder="EX: Remplacement plaquettes de frein avant NIMR"
                    value={newROLineText}
                    onChange={(e) => setNewROLineText(e.target.value)}
                  />
                  <input 
                    type="number" 
                    step="0.1"
                    className="p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded font-bold dark:text-neutral-100 focus:outline-none" 
                    placeholder="Temps estimé (H)"
                    value={newROLineTime}
                    onChange={(e) => setNewROLineTime(Number(e.target.value))}
                  />
                  <button 
                    onClick={handleAddROLine}
                    className="py-2 bg-slate-900 hover:bg-slate-950 text-white dark:bg-neutral-800 dark:hover:bg-neutral-800 font-bold rounded cursor-pointer transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Photos */}
        {activeTab === "photos" && (
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">Preuves Photos SAV (Avant / Après)</h3>
              <p className="text-slate-400 text-xs">Historique visuel permettant de sécuriser le client et la concession</p>
            </div>

            {dossier.photosAvant.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Aucune photo enregistrée pour ce dossier.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {dossier.photosAvant.map((ph) => (
                  <div key={ph.id} className="border border-slate-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-950 shadow-sm relative group">
                    <img src={ph.url} alt={ph.title} className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                    <div className="p-2.5 space-y-1 text-[10px]">
                      <span className="font-bold text-slate-800 dark:text-neutral-300 block truncate">{ph.title}</span>
                      <div className="flex justify-between text-zinc-400 font-semibold">
                        <span>{ph.date}</span>
                        <span>{ph.takenBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Compléments & Accords */}
        {activeTab === "complements" && (
          <div className="space-y-6">
            
            {/* Complements of work */}
            <div className="space-y-4">
              <div className="border-b pb-1">
                <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">Module de Compléments de Travaux</h3>
                <p className="text-slate-400 text-xs text-left">Réparations complémentaires identifiées lors du démontage en atelier et nécessitant l'avis du client ou de l'assurance</p>
              </div>

              {dossier.complements.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-neutral-950/40 rounded-xl text-center border text-xs text-slate-400">
                  Aucune réparation complémentaire signalée pour l'instant.
                </div>
              ) : (
                <div className="space-y-3">
                  {dossier.complements.map(comp => {
                    let cBadge = "bg-zinc-100 text-zinc-800";
                    if (comp.statut === "attente") cBadge = "bg-purple-100 text-purple-800 animate-pulse";
                    if (comp.statut === "accepte") cBadge = "bg-green-100 text-green-700 border border-green-200";
                    if (comp.statut === "refuse") cBadge = "bg-red-100 text-red-700 border border-red-200";

                    return (
                      <div key={comp.id} className="p-4 bg-purple-50/10 dark:bg-neutral-950/40 border border-purple-100 dark:border-neutral-800 rounded-xl text-xs space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-900 dark:text-neutral-200 text-[13px]">{comp.titre}</span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{comp.description}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${cBadge}`}>
                            {comp.statut}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs font-semibold text-zinc-500 border-t border-purple-50 dark:border-neutral-800 pt-2.5">
                          <span>Main d'œuvre estimée : <strong className="text-zinc-700 dark:text-zinc-400">{comp.tempsEstime} Heures</strong></span>
                          <span>Impact planning : <strong className="text-red-600 dark:text-red-400">{comp.impactPlanning}</strong></span>
                          <span>Accord requis : <strong className="capitalize text-zinc-700 dark:text-zinc-400">{comp.accordRequis}</strong></span>
                        </div>

                        {/* Interactive Acceptance Toggle */}
                        {canHandleApprovals && comp.statut === "attente" && (
                          <div className="flex justify-end gap-2 pt-1 border-t border-purple-50 dark:border-neutral-800">
                            <button 
                              onClick={() => handleStatusComplement(comp.id, "accepte")}
                              className="px-3 py-1 bg-green-600 text-white font-bold rounded hover:bg-green-700 flex items-center gap-1 transition"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              Accepter le complément
                            </button>
                            <button 
                              onClick={() => handleStatusComplement(comp.id, "refuse")}
                              className="px-3 py-1 bg-red-600 text-white font-bold rounded hover:bg-red-700 flex items-center gap-1 transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Official Accords table */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <div className="border-b pb-1">
                <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">Suivi Des Accords d'Assurance / Garantie</h3>
                <p className="text-slate-400 text-xs">Validation de prises en charge avant raccordement final des pièces de remplacement</p>
              </div>

              {dossier.accords.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-neutral-950/40 rounded-xl text-center text-xs text-slate-400">
                  Aucun accord d'assurance ou garantie constructeur requis sur ce dossier.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {dossier.accords.map(acc => {
                    let color = "bg-amber-100 text-amber-800";
                    if (acc.statut === "approuve") color = "bg-green-100 text-green-800";
                    if (acc.statut === "refuse") color = "bg-red-100 text-red-800";

                    return (
                      <div key={acc.id} className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-neutral-100">{acc.type}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600 dark:text-neutral-400 italic">Destinataire: {acc.destinataire}</span>
                          </div>
                          <p className="text-slate-500 text-[11px] font-medium leading-tight">{acc.commentaire}</p>
                          <div className="text-[10px] text-neutral-400 font-semibold">
                            Date d'envoi: {new Date(acc.dateEnvoi).toLocaleDateString()} 
                            {acc.dateRelance && ` | Relancé le: ${new Date(acc.dateRelance).toLocaleDateString()}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>
                            {acc.statut.replace("_", " ")}
                          </span>

                          {canHandleApprovals && acc.statut === "en_attente" && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleUpdateAccordStatut(acc.id, "approuve")}
                                className="px-2 py-0.5 bg-green-600 text-white font-bold rounded text-[10px]"
                              >
                                Approuver
                              </button>
                              <button 
                                onClick={() => handleUpdateAccordStatut(acc.id, "refuse")}
                                className="px-2 py-0.5 bg-red-600 text-white font-bold rounded text-[10px]"
                              >
                                Décliner
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 6: Contrôle qualité */}
        {activeTab === "quality-control" && (
          <div className="space-y-6">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">Protocole de Contrôle de Qualité Obligatoire</h3>
              <p className="text-slate-400 text-xs">Checklist de sécurité opérationnelle à valider obligatoirement par l'essayeur contrôleur technique</p>
            </div>

            {/* If QC is already validated display details */}
            {dossier.checklistQC.validationGlobale === "valide" ? (
              <div className="p-5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-950 rounded-xl text-xs space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold">
                  <CheckCircle className="w-5 h-5" />
                  CONTRÔLE QUALITÉ VALIDÉ - BON POUR LIVRAISON VÉHICULE
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div>Validé par: <strong className="text-slate-800 dark:text-white">{dossier.checklistQC.validePar || "Chef d'atelier"}</strong></div>
                  <div>Le: <strong className="text-slate-800 dark:text-white">{new Date(dossier.checklistQC.dateValidation!).toLocaleString()}</strong></div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium italic">Tous les voyants d'alerte moteur éteints, essais statiques et routiers entièrement concluants.</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Checklist rendering with interactive buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  {[
                    { key: "essaiEffectue", label: "Essai routier / essai de conduite réalisé à bord" },
                    { key: "defautRepare", label: "Défaut d'origine du client confirmé comme résolu" },
                    { key: "aucunVoyantAllume", label: "Aucun voyant de panne ou anomalie orange/rouge allumé" },
                    { key: "niveauxVerifies", label: "Niveaux de fluides et batteries contrôlés et ajustés" },
                    { key: "serrageSecurite", label: "Serrages dynamométriques et organes de sécurité vérifiés" },
                    { key: "propreteVehicule", label: "Propreté impeccable du véhicule (volant, tapis, carrosserie)" },
                    { key: "documentsPrets", label: "Tous les documents / fiches de travaux d'atelier signés" },
                    { key: "photosApresOk", label: "Photos du véhicule après travaux enregistrées sur l'app" }
                  ].map((item) => (
                    <label 
                      key={item.key} 
                      className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 rounded-lg flex items-center justify-between cursor-pointer select-none"
                    >
                      <span className="text-slate-700 dark:text-neutral-400 font-semibold">{item.label}</span>
                      <input 
                        type="checkbox"
                        checked={dossier.checklistQC[item.key as keyof typeof dossier.checklistQC] as boolean}
                        onChange={(e) => handleQCFieldChange(item.key as any, e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                        disabled={!canValidateQuality}
                      />
                    </label>
                  ))}
                </div>

                {/* Confirm QC Section (QC staff, Chief Workshop and Director only) */}
                {canValidateQuality && (
                  <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-4">
                    <span className="text-xs font-bold text-slate-800 dark:text-neutral-300 uppercase block">Décision Finale de Validation de Qualité :</span>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleQCSubmit("valide")}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valider & Marquer Prêt à Livrer
                      </button>

                      <button 
                        onClick={() => {
                          const cause = prompt("Veuillez saisir la cause ou le motif de refus qualité :");
                          if (cause) {
                            handleQCSubmit("refuse", cause);
                          }
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Refuser (Renvoi à l'atelier)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab 7: Livraison */}
        {activeTab === "deliveries" && (
          <div className="space-y-6">
            <div className="border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-neutral-200">Protocole de Clôture et Restitution d'Véhicules</h3>
              <p className="text-slate-400 text-xs">Validation de conformité d'exploitation avec signature manuelle du client final</p>
            </div>

            {/* Check requirements */}
            <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 text-xs space-y-3.5">
              <span className="font-bold text-neutral-800 dark:text-neutral-300 block uppercase">Pré-requis opérationnels :</span>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.checklistQC.validationGlobale === "valide" ? "bg-green-500" : "bg-red-500"
                  }`}>
                    {dossier.checklistQC.validationGlobale === "valide" ? "✓" : "!"}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-neutral-400">
                    Contrôle qualité validé par l'essayeur : 
                    <strong className="text-slate-900 dark:text-white ml-1">
                      {dossier.checklistQC.validationGlobale === "valide" ? "OUI" : "NON (En cours de validation)"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                    dossier.ordresReparation.every(r=>r.status==="termine") ? "bg-green-500" : "bg-blue-500"
                  }`}>
                    ✓
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-neutral-400">
                    Tous les ordres de réparation d'origine validés : 
                    <strong className="text-slate-900 dark:text-white ml-1">
                      {dossier.ordresReparation.every(r=>r.status==="termine") ? "OUI (100% terminés)" : "NON (Certaines tâches suspendues ou en cours)"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Handover section */}
            {dossier.statut === DossierStatus.PRET_A_LIVRER && canDeliverVehicle ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/20 dark:bg-blue-950/20 border border-blue-200/40 rounded-lg space-y-3 text-xs">
                  <span className="font-bold text-blue-800 dark:text-blue-400 block uppercase font-display">Signature client lors de la remise des clés :</span>
                  
                  {/* Visual Signature Mock */}
                  <div className="bg-white dark:bg-neutral-900 border border-dashed border-zinc-300 dark:border-neutral-800 h-28 rounded-lg flex items-center justify-center text-zinc-400 font-mono italic cursor-pointer" onClick={() => alert("Signature sécurisée capturée sur tablette NIMR.")}>
                    [ Cliquer ici pour simuler la signature tactile du client ]
                  </div>

                  <p className="text-[10px] text-zinc-400">La signature certifie la restitution du véhicule, le contrôle de propreté et la remise des objets personnels listés.</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleDeliveryConfirm}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-xs transition duration-200 cursor-pointer"
                  >
                    Restituer le Véhicule au client
                  </button>
                </div>
              </div>
            ) : dossier.statut === DossierStatus.LIVRE ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs space-y-1 text-emerald-800 dark:text-emerald-400">
                  <span className="font-bold block">✓ Véhicule remis en main propre au client. Clôture en transit.</span>
                  <p className="font-medium text-slate-600 dark:text-slate-400">Restitution confirmée et signée. Le dossier doit être transmis à l'ERP NIMR pour facturation définitive.</p>
                </div>

                {canDeliverVehicle && (
                  <button 
                    onClick={handleFinalOperationalClose}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition cursor-pointer"
                  >
                    Marquer "Prêt pour facturation ERP" (Clôture Opérationnelle)
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                La remise des clés n'est autorisée qu'après validation complète du contrôle routier de qualité.
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
