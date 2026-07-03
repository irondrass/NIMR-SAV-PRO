/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Database } from "lucide-react";
import { StorageDiagnostics } from "../data/storageDiagnostics";
import { UserRole } from "../types";

interface StorageDiagnosticsPanelProps {
  diagnostics: StorageDiagnostics;
  currentRole: UserRole;
}

const visibleRoles = new Set<UserRole>([UserRole.DIRECTEUR_SAV, UserRole.LECTURE_SEULE]);

function formatBytes(value: number | null): string {
  if (value === null) return "Non disponible";
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function StorageDiagnosticsPanel({ diagnostics, currentRole }: StorageDiagnosticsPanelProps) {
  if (!visibleRoles.has(currentRole)) return null;

  const rows = [
    ["Dossiers", diagnostics.dossierCount],
    ["Tâches", diagnostics.taskCount],
    ["Réservations", diagnostics.reservationCount],
    ["Ressources", diagnostics.resourceCount],
    ["Événements audit", diagnostics.auditEventCount],
    ["Métadonnées fichiers", diagnostics.fileMetadataCount],
    ["Véhicules", diagnostics.vehicleCount],
  ] as const;

  return (
    <section data-testid="storage-diagnostics" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <Database className="h-4 w-4 text-blue-600" />
          Diagnostic stockage local
        </h3>
        <span data-testid="storage-mode" className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
          {diagnostics.mode}
        </span>
      </div>

      <div className="grid gap-2 text-xs font-bold text-slate-650 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="block text-[9px] uppercase text-slate-400">Migration</span>
          <span data-testid="storage-migration-status">{diagnostics.migrationStatus}</span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="block text-[9px] uppercase text-slate-400">Schéma</span>
          <span data-testid="storage-schema-version">{diagnostics.schemaVersion}</span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="block text-[9px] uppercase text-slate-400">Dernière migration</span>
          <span>{diagnostics.lastMigration ? new Date(diagnostics.lastMigration).toLocaleString("fr-FR") : "Non réalisée"}</span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="block text-[9px] uppercase text-slate-400">Taille estimée</span>
          <span>{formatBytes(diagnostics.estimatedBytes)}</span>
        </div>
      </div>

      <div data-testid="storage-record-count" className="mt-3 grid gap-2 text-xs font-bold text-slate-650 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span>{label}</span>
            <span data-testid={label === "Métadonnées fichiers" ? "file-metadata-count" : undefined} className="font-black text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
