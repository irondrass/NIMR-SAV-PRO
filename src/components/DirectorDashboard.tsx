/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DossierSAV, DossierStatus, DossierPriority, UserRole } from "../types";
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Activity, 
  Wrench, 
  Truck, 
  ListTodo, 
  UserCheck, 
  Calendar,
  AlertCircle,
  FileCheck,
  Zap,
  Users
} from "lucide-react";
import { StatusBadge, PriorityBadge, LicencePlate, MiniProgress } from "./UIParts";

interface DirectorDashboardProps {
  dossiers: DossierSAV[];
  onSelectDossier: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
  metricsSuggestions: string[];
}

export default function DirectorDashboard({ 
  dossiers, 
  onSelectDossier, 
  onNavigateToTab,
  metricsSuggestions
}: DirectorDashboardProps) {
  
  // Count statistics
  const countByStatus = (status: DossierStatus) => dossiers.filter(d => d.statut === status).length;
  
  const totalActifs = dossiers.filter(d => d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE).length;
  const attendusAuj = dossiers.filter(d => d.statut === DossierStatus.EN_ATTENTE_RECEPTION).length;
  const recusAuj = dossiers.filter(d => [DossierStatus.VEHICULE_RECU, DossierStatus.TRAVAUX_PLANIFIES].includes(d.statut)).length;
  const enTravaux = countByStatus(DossierStatus.EN_TRAVAUX);
  const bloques = countByStatus(DossierStatus.BLOQUE);
  const pretsLivrer = countByStatus(DossierStatus.PRET_A_LIVRER);
  
  // Accords en attente count
  const accordsClientAttente = dossiers.filter(d => 
    d.complements.some(c => c.statut === "attente" && c.accordRequis === "client")
  ).length;
  
  const accordsAssuranceAttente = dossiers.filter(d => 
    d.accords.some(a => a.type === "Assurance" && a.statut === "en_attente")
  ).length;

  const accordsGarantieAttente = dossiers.filter(d => 
    d.accords.some(a => a.type === "Garantie Constructeur" && a.statut === "en_attente")
  ).length;

  // Delay is computed against the actual current time, not the original demo timestamp.
  const dossiersEnRetard = dossiers.filter(d => {
    if ([DossierStatus.LIVRE, DossierStatus.CLOTURE].includes(d.statut)) return false;
    const limit = new Date(d.dateSouhaiteeLivraison).getTime();
    const now = Date.now();
    return now > limit;
  });

  return (
    <div className="space-y-6">
      {/* Welcome Top Banner - Geometric Balance styled */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-lg p-6 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500 via-blue-700 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600/20 text-blue-400 text-xs uppercase px-2.5 py-0.5 rounded-md font-bold tracking-wider border border-blue-500/30 font-mono">
                Directeur SAV NIMR
              </span>
              <span className="text-xs text-slate-400 font-medium">| Portail connecté ERP</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display">Tableau de Bord Stratégique 360°</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Suivi en temps réel de la performance opérationnelle de l'atelier, des accords assurances, clients et du taux de restitution d'atelier.
            </p>
          </div>
          
          {/* Quick Stats Summary Badge on Right */}
          <div className="flex gap-4 p-3 bg-white/5 rounded-md border border-white/10 backdrop-blur-xs">
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-2xl font-black text-amber-400 font-display">{dossiersEnRetard.length}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">En retard</div>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-2xl font-black text-rose-400 font-display">{bloques}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Bloqués</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl font-black text-green-400 font-display">{pretsLivrer}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">À livrer</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row 1 - Operational Flux */}
      <h2 className="text-xs font-bold text-slate-900  uppercase tracking-wider flex items-center gap-2 font-display">
        <Activity className="w-5 h-5 text-blue-600" />
        Flux Opérationnel Atelier NIMR
      </h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total active card */}
        <button 
          onClick={() => onNavigateToTab("atelier-kanban")}
          className="bg-white  border border-slate-200  rounded-lg p-4 text-left shadow-sm hover:border-blue-500 transition group"
        >
          <div className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">Dossiers Actifs</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-blue-600  group-hover:scale-105 transition-transform duration-150 origin-left font-display">{totalActifs}</span>
            <span className="bg-blue-50  text-blue-600  text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
              Atelier
            </span>
          </div>
        </button>

        {/* Attendus card */}
        <button
          onClick={() => onNavigateToTab("reception-rapide")}
          className="bg-white  border border-slate-200  rounded-lg p-4 text-left shadow-sm hover:border-blue-500 transition group"
        >
          <div className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">Attendus Auj.</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600  font-display">{attendusAuj}</span>
            <span className="bg-amber-50  text-amber-600  text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
              RDV
            </span>
          </div>
        </button>

        {/* Reçus card */}
        <button 
          onClick={() => onNavigateToTab("chef-atelier")}
          className="bg-white  border border-slate-200  rounded-lg p-4 text-left shadow-sm hover:border-blue-500 transition group"
        >
          <div className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">Véhicules reçus</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-teal-600  font-display">{recusAuj}</span>
            <span className="bg-teal-50  text-teal-600  text-[10px] font-bold px-1.5 py-0.5 rounded font-mono font-medium">
              Reçus
            </span>
          </div>
        </button>

        {/* En travaux card */}
        <button 
          onClick={() => onNavigateToTab("atelier-kanban")}
          className="bg-white  border border-slate-200  rounded-lg p-4 text-left shadow-sm hover:border-blue-500 transition group"
        >
          <div className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">En travaux</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-sky-600  font-display">{enTravaux}</span>
            <span className="bg-sky-50  text-sky-600  text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse font-mono">
              Prod
            </span>
          </div>
        </button>

        {/* Bloqués card */}
        <button 
          onClick={() => onNavigateToTab("atelier-kanban")}
          className="bg-zinc-50  border-2 border-red-200  rounded-lg p-4 text-left shadow-sm hover:border-red-400 transition group"
        >
          <div className="text-[11px] font-bold text-red-600  uppercase tracking-wider flex items-center gap-1 font-mono">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            Bloqués / Stop
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-red-600  font-display">{bloques}</span>
            <span className="bg-red-100  text-red-700  text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
              Alerte
            </span>
          </div>
        </button>

        {/* Prêts card */}
        <button 
          onClick={() => onNavigateToTab("atelier-kanban")}
          className="bg-white  border border-slate-200  rounded-lg p-4 text-left shadow-sm hover:border-blue-500 transition group"
        >
          <div className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">Prêts à livrer</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-green-600  font-display">{pretsLivrer}</span>
            <span className="bg-green-50  text-green-600  text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
              OK
            </span>
          </div>
        </button>
      </div>

      {/* Accord States Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Accord client */}
        <div className="bg-white  border border-slate-200  rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50  text-purple-600  rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold ">{accordsClientAttente}</div>
            <div className="text-xs font-semibold text-neutral-500  uppercase">Accords Clients Requis</div>
            <p className="text-[10px] text-neutral-400  mt-0.5">Compléments de travaux signalés</p>
          </div>
        </div>

        {/* Accord Assurance */}
        <div className="bg-white  border border-slate-200  rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50  text-sky-600  rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold ">{accordsAssuranceAttente}</div>
            <div className="text-xs font-semibold text-neutral-500  uppercase">Accords GAT/Assurances</div>
            <p className="text-[10px] text-neutral-400  mt-0.5">Chiffres de carrosserie en validation d'expert</p>
          </div>
        </div>

        {/* Accord Garantie */}
        <div className="bg-white  border border-slate-200  rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-pink-50  text-pink-600  rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold ">{accordsGarantieAttente}</div>
            <div className="text-xs font-semibold text-neutral-500  uppercase">Garanties Constructeurs</div>
            <p className="text-[10px] text-neutral-400  mt-0.5">Soumissions Dongfeng/DFSK/Forthing</p>
          </div>
        </div>
      </div>

      {/* Middle Section: Dashboard action plan & Charts side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Side recommendations (4 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-blue-50/10 to-white   border border-blue-100/50  rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-950  text-sm font-display">PLAN D'ACTION CONSEILLÉ</h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Génération d'assistance locale NIMR</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {metricsSuggestions.map((item, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2.5 p-3 rounded-md bg-white  border border-slate-100  hover:border-blue-200  transition shadow-sm text-xs"
              >
                <span className="flex-shrink-0 w-5 h-5 bg-blue-50  text-blue-600  rounded-full flex items-center justify-center font-bold text-[10px] font-mono">
                  {index + 1}
                </span>
                <span className="text-slate-700  font-medium leading-relaxed">{item}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-blue-100 ">
            <button 
              onClick={() => onNavigateToTab("atelier-kanban")} 
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition duration-200 shadow-sm cursor-pointer"
            >
              Consulter le Kanban de l'Atelier
            </button>
          </div>
        </div>

        {/* Interactive mock performance graphs (7 cols) */}
        <div className="lg:col-span-7 bg-white  border border-slate-200  rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900  text-sm font-display">Rentabilité & Délais Opérationnels</h3>
              <p className="text-slate-400 text-xs text-left">Heures vendues vs. Heures passées (Semaine en cours)</p>
            </div>
            <span className="text-[10px] bg-emerald-50  text-emerald-600  font-bold px-2 py-0.5 rounded border border-emerald-100 ">
              Efficacité : 94%
            </span>
          </div>

          {/* Graphical representation in clean vector SVG */}
          <div className="h-44 flex items-end justify-between px-2 pt-2 pb-1 bg-slate-50  rounded-lg relative">
            
            {/* SVG Background grids */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
              <div className="border-b border-zinc-400 w-full h-0"></div>
              <div className="border-b border-zinc-400 w-full h-0"></div>
              <div className="border-b border-zinc-400 w-full h-0"></div>
            </div>

            {/* Monday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[60%]">
                <div className="w-3 bg-zinc-400  h-10 rounded-t" title="Passé: 10h"></div>
                <div className="w-3 bg-blue-600 h-12 rounded-t" title="Vendu: 12h"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Lun</span>
              {/* Tooltip */}
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 12h / Réel: 10h
              </div>
            </div>

            {/* Tuesday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[70%]">
                <div className="w-3 bg-zinc-400  h-16 rounded-t" title="Passé: 16h"></div>
                <div className="w-3 bg-blue-600 h-14 rounded-t" title="Vendu: 14h"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Mar</span>
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 14h / Réel: 16h
              </div>
            </div>

            {/* Wednesday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[85%]">
                <div className="w-3 bg-zinc-400  h-16 rounded-t"></div>
                <div className="w-3 bg-blue-600 h-20 rounded-t"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Mer</span>
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 22h / Réel: 18h
              </div>
            </div>

            {/* Thursday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[95%]">
                <div className="w-3 bg-zinc-400  h-20 rounded-t"></div>
                <div className="w-3 bg-blue-600 h-24 rounded-t"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Jeu</span>
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 24h / Réel: 20h
              </div>
            </div>

            {/* Friday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[50%]">
                <div className="w-3 bg-zinc-400  h-12 rounded-t"></div>
                <div className="w-3 bg-blue-600 h-12 rounded-t"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Ven</span>
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 12h / Réel: 12h
              </div>
            </div>

            {/* Saturday */}
            <div className="flex flex-col items-center flex-1 h-full justify-end z-10 group relative">
              <div className="flex gap-1 items-end h-[35%]">
                <div className="w-3 bg-zinc-400  h-6 rounded-t"></div>
                <div className="w-3 bg-blue-600 h-8 rounded-t"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono mt-2">Sam</span>
              <div className="absolute bottom-12 hidden group-hover:block bg-zinc-950 text-white text-[9px] p-2 rounded whitespace-nowrap shadow-xl">
                Vendu: 8h / Réel: 6h
              </div>
            </div>
            
          </div>
          
          <div className="flex items-center justify-center gap-6 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-zinc-500 ">
              <span className="w-3 h-3 bg-zinc-400 rounded-xs inline-block"></span>
              Temps Ateliers Réel (Heures Passées)
            </span>
            <span className="flex items-center gap-1.5 text-blue-600 ">
              <span className="w-3 h-3 bg-blue-600 rounded-xs inline-block"></span>
              Temps Facturable Vendu (ERP)
            </span>
          </div>

        </div>

      </div>

      {/* Recue Table - Selected Live Operational Dossiers */}
      <div className="bg-white  border border-slate-200  rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-900  text-sm font-display uppercase">SUIVI ET TRAÇABILITÉ DES DOSSIERS DE SAV ACTIFS</h3>
            <p className="text-slate-400 text-xs">Aperçu rapide des statuts opérationnels sans facturation</p>
          </div>
          
          <button 
            onClick={() => onNavigateToTab("dossiers-liste")}
            className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 underline underline-offset-4 font-display cursor-pointer"
          >
            Voir tous les dossiers de l'ERP
          </button>
        </div>

        {/* Beautiful responsive table */}
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200  text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50  font-display">
                <th className="py-2.5 px-3">Dossier</th>
                <th className="py-2.5 px-3">Client & Véhicule</th>
                <th className="py-2.5 px-3">Type / Raison</th>
                <th className="py-2.5 px-3">Priorité</th>
                <th className="py-2.5 px-3">Statut SAV</th>
                <th className="py-2.5 px-3 text-right font-semibold">Fiche</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {dossiers.map(dossier => (
                <tr 
                  key={dossier.id}
                  className="hover:bg-slate-50/40  cursor-pointer transition"
                  onClick={() => onSelectDossier(dossier.id)}
                >
                  <td className="py-3 px-3 font-mono font-bold text-neutral-800 ">
                    {dossier.id}
                  </td>
                  <td className="py-3 px-3 space-y-1">
                    <div className="font-bold text-slate-800  leading-none font-display">
                      {dossier.clientNom}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <span>{dossier.vehiculeMarque} {dossier.vehiculeModele}</span>
                      <span>•</span>
                      <LicencePlate plate={dossier.vehiculeImmatriculation} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-neutral-700  font-mono text-[11px]">{dossier.typeDossier}</div>
                    <div className="text-neutral-500  text-[10px] line-clamp-1 max-w-[200px]" title={dossier.plainteClient}>
                      {dossier.plainteClient}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <PriorityBadge priority={dossier.priorite} />
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={dossier.statut} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button 
                      className="px-3 py-1.5 bg-neutral-100   hover:bg-neutral-200 text-neutral-700 rounded-md font-semibold text-[11px] transition cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDossier(dossier.id);
                      }}
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
