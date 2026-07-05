/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ServerCog, ShieldAlert } from "lucide-react";
import { BackendDiagnostics } from "../data/backendDiagnostics";
import { UserRole } from "../types";

interface BackendDiagnosticsPanelProps {
  diagnostics: BackendDiagnostics;
  currentRole: UserRole;
}

const visibleRoles = new Set<UserRole>([UserRole.DIRECTEUR_SAV, UserRole.LECTURE_SEULE]);

function googleDriveLabel(status: BackendDiagnostics["googleDriveStatus"]): string {
  if (status === "active") return "actif";
  if (status === "staging-ready") return "staging prêt";
  return "non configuré";
}

export default function BackendDiagnosticsPanel({ diagnostics, currentRole }: BackendDiagnosticsPanelProps) {
  if (!visibleRoles.has(currentRole)) return null;

  const rows = [
    ["Mode actuel", diagnostics.mode, "backend-v2-mode"],
    ["Supabase configuré", diagnostics.supabaseConfigured ? "oui" : "non", "backend-v2-supabase-configured"],
    ["Auth provider", diagnostics.authProvider, "backend-v2-auth-provider"],
    ["Environnement", diagnostics.environment, "backend-v2-environment"],
    ["Google Drive réel", googleDriveLabel(diagnostics.googleDriveStatus), "backend-v2-google-drive-status"],
  ] as const;

  const blocked = diagnostics.environment === "production";

  return (
    <section data-testid="backend-v2-diagnostics" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <ServerCog className="h-4 w-4 text-blue-600" />
          Diagnostic Backend v2
        </h3>
        <span
          data-testid="backend-v2-message"
          className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black uppercase ${
            blocked
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : diagnostics.supabaseConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {blocked ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
          {diagnostics.message}
        </span>
      </div>

      <div className="grid gap-2 text-xs font-bold text-slate-650 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map(([label, value, testId]) => (
          <div key={testId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="block text-[9px] uppercase text-slate-400">{label}</span>
            <span data-testid={testId}>{value}</span>
          </div>
        ))}
      </div>

      {(diagnostics.missing.length > 0 || diagnostics.warnings.length > 0 || blocked) && (
        <div data-testid="backend-v2-guardrails" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          {blocked
            ? "Production réelle non autorisée"
            : diagnostics.missing.length > 0
              ? `Configuration incomplète : ${diagnostics.missing.join(", ")}`
              : "Configuration serveur sensible refusée côté frontend"}
        </div>
      )}
    </section>
  );
}
