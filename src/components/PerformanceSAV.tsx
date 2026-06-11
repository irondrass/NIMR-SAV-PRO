/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, UserCheck, Wrench, Activity, DollarSign } from "lucide-react";

export default function PerformanceSAV() {
  
  // High fidelity summary statistics for Tunisian SAV concessions
  const performanceKPIs = [
    { title: "Délai Moyen d'Entrée-Restitution", val: "1.8 Jours", change: "-0.4 j vs mai", positive: true, icon: Clock, color: "text-blue-600 bg-blue-50" },
    { title: "Taux de Réussite premier Diagnostic", val: "94.2%", change: "+2.1% vs mai", positive: true, icon: CheckCircle2, color: "text-emerald-600 bg-rose-50/50" },
    { title: "Taux de Retour en Atelier (QC)", val: "1.2%", change: "-0.5% vs mai", positive: true, icon: AlertTriangle, color: "text-rose-600 bg-rose-50" },
    { title: "Efficience d'Atelier (Productivité)", val: "95.6%", change: "+4.2% vs mai", positive: true, icon: Activity, color: "text-blue-600 bg-blue-50" }
  ];

  const topBlockers = [
    { reason: "Attente d'accord expert d'assurance (GAT, STAR, COMAR)", percentage: 45, count: 8 },
    { reason: "Délais de livraison pièces détachées spécifiques (Moteur/BMS)", percentage: 30, count: 5 },
    { reason: "Surcharge des bornes d'essais haute tension hybrides EV", percentage: 15, count: 2 },
    { reason: "Attente accord de devis client sur compléments de travaux", percentage: 10, count: 1 }
  ];

  const techOutputProductivity = [
    { name: "Technicien Démo 001", zone: "Électricité / Diag EV", hoursCharged: "44H", efficacy: "105%", status: "Excellent" },
    { name: "Technicien Démo 002", zone: "Grands Travaux Mécaniques", hoursCharged: "38H", efficacy: "98%", status: "Conforme" },
    { name: "Technicien Démo 003", zone: "Mécanique Rapide", hoursCharged: "32H", efficacy: "92%", status: "Conforme" },
    { name: "Technicien Démo 004", zone: "Carrosserie & Marbre", hoursCharged: "40H", efficacy: "102%", status: "Excellent" },
    { name: "Technicien Démo 005", zone: "Peinture cabine", hoursCharged: "42H", efficacy: "95%", status: "Conforme" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-black text-slate-900  uppercase tracking-widest flex items-center gap-2 font-display">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          RENDEMENT OPÉRATIONNEL & KPI MENSUELS SAV
        </h2>
        <p className="text-slate-400 text-xs text-left">Statistiques consolidées sans comptabilité financière pour la direction NIMR</p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
        {performanceKPIs.map((kpi, idx) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={idx} className="bg-white  p-5 border rounded-2xl shadow-sm flex items-center justify-between">
              <div className="space-y-1.5 text-left">
                <span className="text-zinc-400 text-[11px] block uppercase font-bold tracking-wider leading-none">{kpi.title}</span>
                <span className="text-2xl font-black text-slate-900  block">{kpi.val}</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50  p-1 px-1.5 rounded">{kpi.change}</span>
              </div>

              <div className={`p-3 rounded-xl ${kpi.color}`}>
                <KpiIcon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle side-by-side section: Top Blockers vs. Technician ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Blocages chart (5 cols) */}
        <div className="lg:col-span-5 bg-white  border border-slate-200  rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-800 ">PRINCIPAUX FACTEURS DE RETARDS ATELIER</h3>
            <p className="text-slate-400 text-xs">Analyse des goulots d'étranglement de production de la semaine</p>
          </div>

          <div className="space-y-3.5">
            {topBlockers.map((blk, i) => (
              <div key={i} className="space-y-1.5 text-xs text-left font-semibold">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-600  line-clamp-1 max-w-[240px]">{blk.reason}</span>
                  <span className="text-blue-600 ">{blk.count} dossiers ({blk.percentage}%)</span>
                </div>
                {/* Simulated progress tracking bar */}
                <div className="w-full bg-slate-100  rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-full rounded" style={{ width: `${blk.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Companion ranking table (7 cols) */}
        <div className="lg:col-span-7 bg-white  border border-slate-200  rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-800 ">PRODUCTIVITÉ & VALIDATION DES COMPAGNONS</h3>
            <p className="text-slate-400 text-xs">Heures saisies d'atelier comparées au standard d'efficience mécanique</p>
          </div>

          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b text-slate-400 uppercase font-bold text-[9px] bg-slate-50  p-2 text-left tracking-wider">
                  <th className="py-2 px-3">Compagnon</th>
                  <th className="py-2 px-3">Pôle d'Atelier</th>
                  <th className="py-2 px-3">Heures Saisies</th>
                  <th className="py-2 px-3">Efficience</th>
                  <th className="py-2 px-3 text-right">Rapport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {techOutputProductivity.map((tech, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 font-semibold text-slate-800 ">{tech.name}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100  text-zinc-500 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">
                        {tech.zone}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold font-mono">{tech.hoursCharged}</td>
                    <td className="py-3 px-3 font-bold text-blue-600 ">{tech.efficacy}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="bg-green-50  text-green-700  font-bold px-2 py-0.5 rounded text-[10px]">
                        {tech.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
