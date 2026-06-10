/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  DossierStatus, 
  DossierPriority, 
  InterventionType, 
  AtelierZone
} from "../types";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Hammer, 
  Search, 
  Wrench, 
  Sparkles, 
  Truck, 
  Activity,
  HeartCrack
} from "lucide-react";

// Professional badges for high visual status
export function StatusBadge({ status }: { status: DossierStatus }) {
  let style = "bg-gray-100 text-gray-700 border-gray-200";
  
  switch (status) {
    case DossierStatus.NOUVEAU:
      style = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case DossierStatus.RDV_A_FIXER:
    case DossierStatus.RDV_FIXE:
      style = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case DossierStatus.EN_ATTENTE_RECEPTION:
      style = "bg-amber-50 text-amber-700 border-amber-200";
      break;
    case DossierStatus.VEHICULE_RECU:
      style = "bg-teal-50 text-teal-700 border-teal-200";
      break;
    case DossierStatus.EN_ATTENTE_ACCORD:
      style = "bg-purple-50 text-purple-700 border-purple-200";
      break;
    case DossierStatus.TRAVAUX_PLANIFIES:
      style = "bg-cyan-50 text-cyan-700 border-cyan-200";
      break;
    case DossierStatus.EN_TRAVAUX:
      style = "bg-sky-100 text-sky-800 border-sky-300 animate-pulse";
      break;
    case DossierStatus.BLOQUE:
      style = "bg-rose-100 text-rose-800 border-rose-300 font-semibold";
      break;
    case DossierStatus.CONTROLE_QUALITE:
      style = "bg-yellow-50 text-yellow-800 border-yellow-300";
      break;
    case DossierStatus.PRET_A_LIVRER:
      style = "bg-green-100 text-green-800 border-green-300 font-medium";
      break;
    case DossierStatus.LIVRE:
      style = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    case DossierStatus.CLOTURE:
      style = "bg-stone-100 text-stone-600 border-stone-200";
      break;
    case DossierStatus.PRET_FACTURATION:
      style = "bg-violet-100 text-violet-800 border-violet-200 font-semibold";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}> 
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: DossierPriority }) {
  let style = "bg-slate-100 text-slate-700";
  
  switch (priority) {
    case DossierPriority.URGENTE:
      style = "bg-amber-100 text-amber-900 font-semibold border border-amber-200";
      break;
    case DossierPriority.CLIENT_VIP:
      style = "bg-violet-100 text-violet-900 border border-violet-300 font-bold";
      break;
    case DossierPriority.VEHICULE_IMMOBILISE:
      style = "bg-rose-100 text-rose-900 font-bold border border-rose-300";
      break;
    case DossierPriority.LIVRAISON_AUJOURDHUI:
      style = "bg-blue-100 text-blue-900 font-semibold border border-blue-200";
      break;
    case DossierPriority.RECLAMATION:
      style = "bg-red-50 text-red-800 border border-red-200";
      break;
    default:
      style = "bg-slate-100 text-slate-700 border border-slate-200";
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs uppercase tracking-wider font-semibold ${style}`}>
      {priority === DossierPriority.CLIENT_VIP && <Sparkles className="w-3 h-3" />}
      {priority === DossierPriority.VEHICULE_IMMOBILISE && <AlertTriangle className="w-3 h-3 text-rose-700" />}
      {priority}
    </span>
  );
}

export function LicencePlate({ plate }: { plate: string }) {
  // Demo Tunisian licence plates look like: "000 TU 0001" or "180 تونس 4500"
  // Let's render it styled as a premium real metal license plate
  const parts = plate.split(" ");
  const isTunis = parts[1] === "TU" || parts[1] === "TUN" || parts[1] === "TUNIS" || parts[1] === "تونس";
  
  return (
    <div className="inline-flex items-center bg-zinc-950 text-zinc-100 rounded border-2 border-zinc-700 shadow-sm font-mono text-[11px] font-bold tracking-wider overflow-hidden">
      <div className="px-1.5 py-0.5 bg-blue-900 text-white flex flex-col items-center justify-center text-[8px] font-sans">
        <span className="leading-tight font-extrabold">TN</span>
      </div>
      <div className="px-2 py-0.5 flex items-center gap-1.5 bg-zinc-900 text-zinc-50 font-semibold">
        <span>{parts[0]}</span>
        <span className="text-[9px] text-zinc-400 bg-zinc-800 px-1 py-[1px] rounded uppercase font-sans">{isTunis ? parts[1] : "TU"}</span>
        <span>{parts[2] || parts[1]}</span>
      </div>
    </div>
  );
}

export function FuelIndicator({ level }: { level: number }) {
  const isLow = level <= 20;
  return (
    <div className="flex items-center gap-2">
      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 max-w-[80px] overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${isLow ? "bg-red-500 animate-pulse" : "bg-emerald-600"}`}
          style={{ width: `${level}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${isLow ? "text-red-500 font-bold" : "text-zinc-600 dark:text-zinc-300"}`}>
        {level}%
      </span>
    </div>
  );
}

export function MiniProgress({ val }: { val: number }) {
  let color = "bg-amber-500";
  if (val >= 80) color = "bg-green-600";
  if (val < 30) color = "bg-blue-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-[10px] font-mono font-bold text-neutral-500">{val}%</span>
    </div>
  );
}

export function InterventionTypeBadge({ type }: { type: InterventionType }) {
  let style = "bg-zinc-100 text-zinc-800";
  switch (type) {
    case InterventionType.ENTRETIEN_RAPIDE:
      style = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    case InterventionType.MECANIQUE_GENERALE:
      style = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case InterventionType.ELECTRICITE_DIAG:
    case InterventionType.DIAGNOSTIC:
      style = "bg-blue-50 text-blue-700 border-blue-200 border-dashed";
      break;
    case InterventionType.GARANTIE_CONSTRUCTEUR:
      style = "bg-pink-50 text-pink-700 border-pink-200";
      break;
    case InterventionType.CARROSSERIE:
    case InterventionType.ASSURANCE:
      style = "bg-amber-50 text-amber-700 border-amber-200";
      break;
    case InterventionType.RECLAMATION_CLIENT:
      style = "bg-rose-50 text-rose-700 border-rose-200";
      break;
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-semibold ${style}`}>
      {type}
    </span>
  );
}
