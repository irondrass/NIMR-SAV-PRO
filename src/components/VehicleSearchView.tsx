/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DossierSAV, DossierPriority, DossierStatus } from "../types";
import {
  searchVehiclesAndDossiers,
  getVehicleAggregatedStatus,
  isOpenDossier
} from "../vehicle-status";
import { canDeliverDossier, normalizeRepairOrderStatus } from "../sav-core";
import { Search, Inbox, ShieldAlert, Sparkles, AlertTriangle, Eye, FileText } from "lucide-react";
import { LicencePlate, PriorityBadge, StatusBadge } from "./UIParts";

interface VehicleSearchViewProps {
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
}

type QuickFilter = "all" | "active" | "blocked" | "in-progress" | "ready" | "delivered" | "multiple";

export default function VehicleSearchView({ dossiers, onSelectDossier }: VehicleSearchViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("all");

  // Perform search first
  const searchedGroups = useMemo(() => {
    return searchVehiclesAndDossiers(dossiers, query);
  }, [dossiers, query]);

  // Apply quick filters next
  const filteredGroups = useMemo(() => {
    return searchedGroups.filter(group => {
      const aggStatus = getVehicleAggregatedStatus(group.dossiers);

      switch (filter) {
        case "active":
          return group.dossiers.some(isOpenDossier);
        case "blocked":
          return aggStatus === "Bloqué";
        case "in-progress":
          return aggStatus === "En cours";
        case "ready":
          return aggStatus === "Prêt à livrer";
        case "delivered":
          return aggStatus === "Livré";
        case "multiple":
          return group.dossiers.length > 1;
        case "all":
        default:
          return true;
      }
    });
  }, [searchedGroups, filter]);

  return (
    <div className="space-y-4">
      {/* Search Bar & Quick Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight uppercase font-display text-slate-900">
            Recherche & Suivi par Véhicule
          </h3>
          <p className="text-slate-400 text-xs text-left">
            Consultez le statut global et l'historique complet des passages SAV par véhicule (immatriculation, VIN, client).
          </p>
        </div>

        {/* Text Input Search */}
        <div className="relative">
          <input
            type="text"
            data-testid="vehicle-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par immatriculation, VIN, numéro dossier, client, téléphone, modèle..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
        </div>

        {/* Quick Filters Buttons */}
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Filtres rapides véhicule">
          <button
            data-testid="filter-vehicle-all"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "all"
                ? "bg-slate-950 text-white border-slate-950"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            Tous ({searchedGroups.length})
          </button>
          <button
            data-testid="filter-vehicle-active"
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "active"
                ? "bg-slate-950 text-white border-slate-950"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            Dossier Actif
          </button>
          <button
            data-testid="filter-vehicle-blocked"
            onClick={() => setFilter("blocked")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "blocked"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600"
            }`}
          >
            Bloqués
          </button>
          <button
            data-testid="filter-vehicle-in-progress"
            onClick={() => setFilter("in-progress")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "in-progress"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-500"
            }`}
          >
            En cours
          </button>
          <button
            data-testid="filter-vehicle-ready"
            onClick={() => setFilter("ready")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "ready"
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:text-green-600"
            }`}
          >
            Prêts à livrer
          </button>
          <button
            data-testid="filter-vehicle-delivered"
            onClick={() => setFilter("delivered")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "delivered"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"
            }`}
          >
            Livrés
          </button>
          <button
            data-testid="filter-vehicle-multiple"
            onClick={() => setFilter("multiple")}
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
              filter === "multiple"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            Multi-dossiers
          </button>
        </div>
      </div>

      {/* Results Container */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center space-y-2 text-xs text-slate-400 shadow-sm">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
          <span>Aucun véhicule ne correspond aux critères de recherche.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const aggStatus = getVehicleAggregatedStatus(group.dossiers);

            // Find active dossier if any
            const activeDossier = group.dossiers.find(isOpenDossier);

            // Critical priority badge if active dossier is critical
            const isCritical = activeDossier && (
              activeDossier.priorite === DossierPriority.VEHICULE_IMMOBILISE ||
              activeDossier.priorite === DossierPriority.RECLAMATION ||
              activeDossier.priorite === DossierPriority.URGENTE
            );

            // Format last visit reception date
            const lastVisit = group.dossiers[0]?.dateReception
              ? new Date(group.dossiers[0].dateReception).toLocaleDateString("fr-FR")
              : "Inconnue";

            // Status colors for aggregated status
            let statusColor = "bg-gray-100 text-gray-700 border-gray-200";
            if (aggStatus === "Bloqué") statusColor = "bg-rose-100 text-rose-800 border-rose-200 font-bold";
            else if (aggStatus === "En cours") statusColor = "bg-sky-100 text-sky-800 border-sky-200 font-bold animate-pulse";
            else if (aggStatus === "En pause") statusColor = "bg-yellow-100 text-yellow-800 border-yellow-200";
            else if (aggStatus === "En attente QC") statusColor = "bg-purple-100 text-purple-800 border-purple-200";
            else if (aggStatus === "Prêt à livrer") statusColor = "bg-green-100 text-green-800 border-green-200";
            else if (aggStatus === "Réceptionné / À planifier") statusColor = "bg-blue-100 text-blue-800 border-blue-200";
            else if (aggStatus === "Prêt facturation ERP") statusColor = "bg-violet-100 text-violet-800 border-violet-200";
            else if (aggStatus === "Livré") statusColor = "bg-emerald-100 text-emerald-800 border-emerald-200";

            return (
              <div
                key={group.key}
                data-testid="vehicle-card"
                className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4"
              >
                {/* Vehicle Header Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <LicencePlate plate={group.vehiculeImmatriculation} />
                      <span data-testid="vehicle-immatriculation" className="sr-only">
                        {group.vehiculeImmatriculation}
                      </span>
                      {group.vehiculeVIN && (
                        <span
                          data-testid="vehicle-vin"
                          className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-200"
                        >
                          VIN: {group.vehiculeVIN}
                        </span>
                      )}
                      <span
                        data-testid="vehicle-marque-modele"
                        className="text-xs font-black text-slate-800 font-display"
                      >
                        {group.vehiculeMarque} {group.vehiculeModele}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-semibold">
                      Client : <span data-testid="vehicle-client" className="font-bold text-slate-700">{group.clientNom}</span>
                      {group.clientTelephone && ` (${group.clientTelephone})`}
                    </div>
                  </div>

                  {/* Status & Priority Badge */}
                  <div className="flex items-center gap-2">
                    {isCritical && (
                      <span data-testid="vehicle-priority-badge">
                        <PriorityBadge priority={activeDossier.priorite} />
                      </span>
                    )}
                    <span
                      data-testid="vehicle-status"
                      className={`px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${statusColor}`}
                    >
                      {aggStatus}
                    </span>
                  </div>
                </div>

                {/* Info summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total dossiers</span>
                    <strong data-testid="vehicle-dossiers-count" className="block text-slate-800 font-bold mt-0.5">
                      {group.dossiers.length} dossier{group.dossiers.length > 1 ? "s" : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Dernier passage</span>
                    <strong data-testid="vehicle-last-visit" className="block text-slate-800 font-bold mt-0.5">
                      {lastVisit}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Dossier actif</span>
                    <strong data-testid="vehicle-active-dossier" className="block text-slate-800 font-bold mt-0.5 truncate">
                      {activeDossier ? `${activeDossier.id} - ${activeDossier.statut}` : "Aucun dossier actif"}
                    </strong>
                  </div>
                </div>

                {/* Dossiers List Header */}
                <div className="pt-2 border-t border-slate-50">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Ce véhicule possède {group.dossiers.length} dossier{group.dossiers.length > 1 ? "s" : ""} SAV
                  </h4>

                  {/* Linked Dossiers Table/List */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-semibold">
                      <thead>
                        <tr className="border-b border-slate-100 font-bold text-[9px] text-slate-400 bg-slate-50/50">
                          <th className="py-2 px-3">Numéro</th>
                          <th className="py-2 px-3">Réception</th>
                          <th className="py-2 px-3">Priorité</th>
                          <th className="py-2 px-3">Statut Dossier</th>
                          <th className="py-2 px-3">Tâche principale</th>
                          <th className="py-2 px-3">Technicien</th>
                          <th className="py-2 px-3">QC</th>
                          <th className="py-2 px-3">Prêt à livrer</th>
                          <th className="py-2 px-3">Livré</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {group.dossiers.map(d => {
                          const deliverable = canDeliverDossier(d).allowed;
                          const isDelivered = d.statut === DossierStatus.LIVRE;

                          // Find main active task status
                          const activeLine = d.ordresReparation.find(line => normalizeRepairOrderStatus(line.status) === "in_progress") ||
                                             d.ordresReparation.find(line => normalizeRepairOrderStatus(line.status) === "paused") ||
                                             d.ordresReparation[0];

                          const mainTaskStatus = activeLine ? normalizeRepairOrderStatus(activeLine.status) : "pending";
                          const techName = activeLine?.plannedTechnicianId || d.technicienId || "Non affecté";

                          return (
                            <tr key={d.id} className="hover:bg-slate-50/50">
                              <td data-testid="vehicle-linked-dossier-id" className="py-2.5 px-3 font-mono font-bold text-slate-900">{d.id}</td>
                              <td data-testid="vehicle-linked-dossier-date" className="py-2.5 px-3 text-zinc-500">
                                {new Date(d.dateReception).toLocaleDateString("fr-FR")}
                              </td>
                              <td data-testid="vehicle-linked-dossier-priority" className="py-2.5 px-3">
                                <PriorityBadge priority={d.priorite} />
                              </td>
                              <td data-testid="vehicle-linked-dossier-status" className="py-2.5 px-3">
                                <StatusBadge status={d.statut} />
                              </td>
                              <td data-testid="vehicle-linked-dossier-main-task-status" className="py-2.5 px-3 uppercase text-[10px] font-mono text-slate-600">
                                {mainTaskStatus}
                              </td>
                              <td data-testid="vehicle-linked-dossier-tech" className="py-2.5 px-3 text-zinc-600">
                                {techName}
                              </td>
                              <td data-testid="vehicle-linked-dossier-qc" className="py-2.5 px-3">
                                {d.checklistQC.validationGlobale === "valide" ? (
                                  <span className="text-emerald-600 font-bold">Accepté</span>
                                ) : d.checklistQC.validationGlobale === "refuse" ? (
                                  <span className="text-rose-600 font-bold">Refusé</span>
                                ) : (
                                  <span className="text-amber-600 font-medium">En attente</span>
                                )}
                              </td>
                              <td data-testid="vehicle-linked-dossier-deliverable" className="py-2.5 px-3">
                                <span className={deliverable ? "text-green-600 font-bold" : "text-slate-400"}>
                                  {deliverable ? "Oui" : "Non"}
                                </span>
                              </td>
                              <td data-testid="vehicle-linked-dossier-delivered" className="py-2.5 px-3">
                                <span className={isDelivered ? "text-emerald-600 font-bold" : "text-slate-400"}>
                                  {isDelivered ? "Oui" : "Non"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  data-testid="vehicle-linked-dossier-open-btn"
                                  onClick={() => onSelectDossier(d.id)}
                                  className="p-1 px-2 bg-slate-900 text-white rounded font-bold text-[10px] hover:bg-blue-600 transition cursor-pointer"
                                >
                                  Ouvrir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
