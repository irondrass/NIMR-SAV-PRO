/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { APP_NAME, APP_VERSION_LABEL } from "../app-identity";
import { UserRole } from "../types";
import { SlidersHorizontal, Download, Upload, ShieldCheck, Clock, RefreshCcw, HardDriveUpload } from "lucide-react";
import * as perm from "../permissions";

interface SettingsViewProps {
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeRole: UserRole;
  importSuccessMessage?: string | null;
  importErrorMessage?: string | null;
}

export default function SettingsView({ 
  onExportData, 
  onImportData, 
  activeRole, 
  importSuccessMessage,
  importErrorMessage
}: SettingsViewProps) {
  
  // High quality configuration tables
  const userRolesPermissions = [
    { role: UserRole.DIRECTEUR_SAV, desc: "Accès global illimité, KPIs, arbitrage blocages, accords critiques", canModify: "OUI (Tout)" },
    { role: UserRole.CHEF_ATELIER, desc: "Planning, assignation compagnons, validation fin travaux, retour atelier", canModify: "OUI (Atelier)" },
    { role: UserRole.RECEPTIONNAIRE, desc: "Création dossiers, réceptions tablettes, photos, accords clients, livraisons", canModify: "OUI (Réception)" },
    { role: UserRole.TECHNICIEN, desc: "Dossiers assignés personnels uniquement, timer de tâche, notes & photo diagnostic", canModify: "OUI (Ses Tâches)" },
    { role: UserRole.CONTROLE_QUALITE, desc: "Checklist d'essais routiers et statiques globales, refus ou acceptation qualité", canModify: "OUI (Qualité)" },
    { role: UserRole.LIVRAISON, desc: "Restitution véhicule après QC accepté et clôture opérationnelle", canModify: "OUI (Livraison)" },
    { role: UserRole.LECTURE_SEULE, desc: "Consultation générale d'avancement sans action de modification", canModify: "NON (Consulte)" }
  ];

  const openingHours = [
    { day: "Lundi - Vendredi", hm: "08:00 - 12:00, 14:00 - 18:00", active: true },
    { day: "Samedi", hm: "08:00 - 13:00", active: true },
    { day: "Dimanche", hm: "Fermé / Garde d'urgence assistance", active: false }
  ];

  return (
    <div className="space-y-6">
      
      {/* Configuration Header Card */}
      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-black text-slate-900  uppercase tracking-widest flex items-center gap-2 font-display">
          <SlidersHorizontal className="w-5 h-5 text-blue-600" />
          PARAMÈTRES SYSTÈME & ARCHITECTURE {APP_VERSION_LABEL}
        </h2>
        <p className="text-slate-400 text-xs text-left">Configuration des habilitations, horaires d'atelier et sauvegardes locales.</p>
      </div>

      {/* Grid containing Quick Backups and Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-semibold">
        
        {/* Backup and utilities (JSON, CSV Transfers) */}
        <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm space-y-4">
          <span className="font-bold text-sm text-slate-800  block border-b pb-1.5 uppercase">Sauvegardes & Synchronisations Locales</span>
          <p className="text-slate-500 font-medium leading-relaxed">
            {APP_NAME} stocke les fichiers de fiches techniques, photos et journal d'activité localement dans le navigateur. Utilisez ces utilitaires pour transférer de gros volumes de données ou faire des sauvegardes de sécurité.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {perm.canExportData(activeRole) && (
              <button 
                onClick={onExportData}
                data-testid="export-json"
                className="p-3 bg-zinc-900 hover:bg-zinc-950 text-white font-extrabold rounded-lg hover:scale-105 transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exporter Base de données (JSON / CSV)
              </button>
            )}

            {perm.canImportData(activeRole) && (
              <label 
                data-testid="import-json"
                className="p-3 bg-blue-50/70 border border-blue-200    hover:bg-blue-100 text-blue-800  font-extrabold rounded-lg hover:scale-105 transition duration-150 flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <Upload className="w-4 h-4" />
                Restaurer Base / Importer
                <input 
                  type="file" 
                  accept=".json" 
                  data-testid="import-json-input"
                  onChange={onImportData} 
                  className="hidden" 
                />
              </label>
            )}
          </div>

          {importSuccessMessage && (
            <div data-testid="import-success-message" className="p-3 bg-green-50 text-green-700   border border-green-200 rounded-lg">
              {importSuccessMessage}
            </div>
          )}

          {importErrorMessage && (
            <div data-testid="import-error-message" className="p-3 bg-red-50 text-red-700   border border-red-200 rounded-lg">
              {importErrorMessage}
            </div>
          )}

          <div className="p-3.5 bg-neutral-50  rounded-xl border flex items-center gap-3">
            <Clock className="w-5 h-5 text-zinc-400" />
            <div className="text-[11px] text-zinc-500 leading-tight">
              <span className="font-extrabold block text-zinc-600 ">Dernière sauvegarde automatique locale client :</span>
              Tout changement initié en réception ou atelier est immédiatement et automatiquement consigné localement.
            </div>
          </div>
        </div>

        {/* Schedule panel */}
        <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm space-y-4">
          <span className="font-bold text-sm text-slate-800  block border-b pb-1.5 uppercase">Horaires Opérationnels d'Atelier NIMR</span>
          <p className="text-slate-500 font-medium">Définissez les tranches horaires d'évaluation de charge de l'atelier pour le calcul automatique de surcharge du calendrier :</p>

          <div className="space-y-2">
            {openingHours.map((oh, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50  border rounded-lg text-xs">
                <span className="text-zinc-700  font-bold">{oh.day}</span>
                <span className={`font-mono font-bold ${oh.active ? "text-blue-600 " : "text-zinc-400"}`}>{oh.hm}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Role and Permissions Control Board */}
      <div className="bg-white  border border-slate-200  rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 ">Matrice des habilitations</h3>
          <p className="text-slate-400 text-xs">
            Vous êtes connecté avec le rôle <strong data-testid="settings-current-role">{activeRole}</strong>. La modification des comptes se fait dans Gestion utilisateurs.
          </p>
        </div>

        <div className="overflow-x-auto min-w-full pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b text-slate-400 font-bold uppercase text-[9px] bg-slate-50  p-2 text-left tracking-wider">
                <th className="py-2.5 px-3">Rôle SAV</th>
                <th className="py-2.5 px-3">Description des Devoirs & Pouvoirs</th>
                <th className="py-2.5 px-3 text-right">Actions autorisées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {userRolesPermissions.map((urp, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition duration-100">
                  <td className="py-3 px-3 font-bold text-slate-800 ">{urp.role}</td>
                  <td className="py-3 px-3 text-slate-500  font-medium">{urp.desc}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-bold ${urp.canModify.includes("NON") ? "text-rose-600" : "text-emerald-600"}`}>
                      {urp.canModify}
                    </span>
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
