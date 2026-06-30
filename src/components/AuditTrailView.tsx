/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { History } from "lucide-react";
import { getAuditTrail } from "../audit-trail";
import { UserRole } from "../types";

interface AuditTrailViewProps {
  currentRole: UserRole;
  dossierId?: string;
  limit?: number;
}

const visibleRoles = new Set<UserRole>([UserRole.DIRECTEUR_SAV, UserRole.CHEF_ATELIER]);

function formatAuditDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : value;
}

function getResultClass(result: string): string {
  if (result === "blocked") return "border-amber-200 bg-amber-50 text-amber-800";
  if (result === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default function AuditTrailView({ currentRole, dossierId, limit = 50 }: AuditTrailViewProps) {
  if (!visibleRoles.has(currentRole)) return null;

  const entries = getAuditTrail()
    .filter(entry => !dossierId || entry.dossierId === dossierId)
    .slice(0, limit);

  return (
    <section data-testid="audit-trail-panel" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <History className="h-4 w-4 text-slate-500" />
          Audit local
        </h3>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">
          Consultation
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
          Aucun événement local enregistré pour ce dossier.
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {entries.map(entry => (
            <article key={entry.id} data-testid="audit-trail-entry" className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span data-testid="audit-trail-action" className="font-black uppercase text-slate-800">
                  {entry.action.replace(/_/g, " ")}
                </span>
                <span data-testid="audit-trail-result" className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getResultClass(entry.result)}`}>
                  {entry.result}
                </span>
              </div>
              <p className="mt-1 font-semibold text-slate-600">{entry.summary}</p>
              {entry.blockReason && (
                <p data-testid="action-blocked-message" className="mt-1 font-bold text-amber-700">
                  {entry.blockReason}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase text-slate-400">
                <span data-testid="audit-trail-role">{entry.role}</span>
                <span data-testid="audit-trail-date">{formatAuditDate(entry.date)}</span>
                <span>{entry.source}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
