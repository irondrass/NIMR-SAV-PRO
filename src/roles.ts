/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "./types";

export const TAB_IDS = [
  "dashboard",
  "reception-rapide",
  "dossiers-liste",
  "atelier-planning",
  "atelier-kanban",
  "chef-atelier",
  "tech-view",
  "reclamations",
  "rendements-sav",
  "parametres",
  "users",
  "controle-qualite",
  "livraison",
  "garantie",
  "satisfaction",
  "referentiel-atelier",
] as const;

export type TabId = typeof TAB_IDS[number];

export const ROLE_TABS: Record<UserRole, readonly TabId[]> = {
  [UserRole.DIRECTEUR_SAV]: [
    "dashboard",
    "reception-rapide",
    "dossiers-liste",
    "atelier-planning",
    "atelier-kanban",
    "chef-atelier",
    "tech-view",
    "reclamations",
    "rendements-sav",
    "parametres",
    "users",
    "controle-qualite",
    "livraison",
    "garantie",
    "satisfaction",
    "referentiel-atelier",
  ],
  [UserRole.RECEPTIONNAIRE]: [
    "reception-rapide",
    "dossiers-liste",
    "atelier-planning",
    "reclamations",
    "rendements-sav",
    "livraison",
    "garantie",
    "satisfaction",
    "referentiel-atelier",
  ],
  [UserRole.CHEF_ATELIER]: [
    "atelier-planning",
    "atelier-kanban",
    "chef-atelier",
    "dossiers-liste",
    "reclamations",
    "rendements-sav",
    "controle-qualite",
    "garantie",
    "referentiel-atelier",
  ],
  [UserRole.TECHNICIEN]: [
    "tech-view",
  ],
  [UserRole.CONTROLE_QUALITE]: [
    "controle-qualite",
    "atelier-kanban",
    "dossiers-liste",
    "reclamations",
    "rendements-sav",
    "satisfaction",
  ],
  [UserRole.LIVRAISON]: [
    "livraison",
    "dossiers-liste",
    "reclamations",
    "rendements-sav",
    "satisfaction",
  ],
  [UserRole.LECTURE_SEULE]: [
    "dashboard",
    "dossiers-liste",
    "reclamations",
    "rendements-sav",
    "garantie",
    "satisfaction",
    "referentiel-atelier",
  ],
};

export function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

export function getDefaultTabForRole(role: UserRole): TabId {
  return ROLE_TABS[role][0];
}

export function canAccessTab(role: UserRole, tab: string): tab is TabId {
  return isTabId(tab) && ROLE_TABS[role].includes(tab);
}

export function canChangeRole(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV;
}

export function normalizeTabForRole(role: UserRole, tab: string): TabId {
  return canAccessTab(role, tab) ? tab : getDefaultTabForRole(role);
}
