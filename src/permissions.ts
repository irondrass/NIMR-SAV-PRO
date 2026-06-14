/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "./types";
import { canAccessTab as rolesCanAccessTab } from "./roles";

// Navigation
export function canAccessTab(role: UserRole, tabId: string): boolean {
  return rolesCanAccessTab(role, tabId);
}

// Utilisateurs
export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV;
}

// Dossiers
export function canCreateDossier(role: UserRole): boolean {
  return role === UserRole.RECEPTIONNAIRE || role === UserRole.DIRECTEUR_SAV;
}

export function canEditDossier(role: UserRole): boolean {
  return (
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER ||
    role === UserRole.RECEPTIONNAIRE ||
    role === UserRole.LIVRAISON
  );
}

export function canForceStatus(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV;
}

// Atelier
export function canPlanWorkshop(role: UserRole): boolean {
  return role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canStartTask(role: UserRole): boolean {
  return (
    role === UserRole.TECHNICIEN ||
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER
  );
}

export function canBlockTask(role: UserRole): boolean {
  return (
    role === UserRole.TECHNICIEN ||
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER
  );
}

export function canReleaseBlock(role: UserRole): boolean {
  return role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canReopenTask(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

// Qualité et Livraison
export function canValidateQC(role: UserRole): boolean {
  return (
    role === UserRole.CONTROLE_QUALITE ||
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER
  );
}

export function canDeliver(role: UserRole): boolean {
  return (
    role === UserRole.LIVRAISON ||
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.RECEPTIONNAIRE
  );
}

// Données
export function canImportData(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV;
}

export function canExportData(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function isReadOnlyRole(role: UserRole): boolean {
  return role === UserRole.LECTURE_SEULE;
}

// Réservations
export function canCreateReservation(role: UserRole): boolean {
  return (
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER ||
    role === UserRole.RECEPTIONNAIRE
  );
}

export function canSuggestReservation(role: UserRole): boolean {
  return (
    role === UserRole.DIRECTEUR_SAV ||
    role === UserRole.CHEF_ATELIER ||
    role === UserRole.RECEPTIONNAIRE
  );
}

export function canConfirmReservation(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function canCancelReservation(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function canConvertReservationToPlanning(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function canManageWorkshopAvailability(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function canViewWorkshopAvailability(role: UserRole): boolean {
  return true;
}

export function canManageVehicleMaster(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.RECEPTIONNAIRE;
}

export function canSearchVehicleMaster(role: UserRole): boolean {
  return role !== UserRole.TECHNICIEN;
}

export function canUseVehicleForReception(role: UserRole): boolean {
  return role === UserRole.RECEPTIONNAIRE || role === UserRole.DIRECTEUR_SAV;
}

export function canViewVehicleSensitiveFields(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.RECEPTIONNAIRE;
}

export function canViewSavReports(role: UserRole): boolean {
  return role !== UserRole.TECHNICIEN;
}

export function canViewSensitiveReportFields(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.RECEPTIONNAIRE;
}

export function canExportSavReports(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV || role === UserRole.CHEF_ATELIER;
}

export function canPerformQC(role: UserRole): boolean {
  return role === UserRole.CONTROLE_QUALITE || role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canAcceptQC(role: UserRole): boolean {
  return role === UserRole.CONTROLE_QUALITE || role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canRefuseQC(role: UserRole): boolean {
  return role === UserRole.CONTROLE_QUALITE || role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canViewQcDashboard(role: UserRole): boolean {
  return role === UserRole.CONTROLE_QUALITE || role === UserRole.CHEF_ATELIER || role === UserRole.DIRECTEUR_SAV;
}

export function canPerformDelivery(role: UserRole): boolean {
  return role === UserRole.LIVRAISON || role === UserRole.RECEPTIONNAIRE || role === UserRole.DIRECTEUR_SAV;
}

export function canConfirmDelivery(role: UserRole): boolean {
  return role === UserRole.LIVRAISON || role === UserRole.RECEPTIONNAIRE || role === UserRole.DIRECTEUR_SAV;
}

export function canViewDeliveryDashboard(role: UserRole): boolean {
  return role === UserRole.LIVRAISON || role === UserRole.RECEPTIONNAIRE || role === UserRole.DIRECTEUR_SAV;
}


