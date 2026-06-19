/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "./types";
import { canAccessTab as rolesCanAccessTab } from "./roles";

export interface RolePermissions {
  manageUsers: boolean;
  createDossier: boolean;
  editDossier: boolean;
  forceStatus: boolean;
  planWorkshop: boolean;
  startTask: boolean;
  blockTask: boolean;
  releaseBlock: boolean;
  reopenTask: boolean;
  validateQC: boolean;
  deliver: boolean;
  importData: boolean;
  exportData: boolean;
  createReservation: boolean;
  suggestReservation: boolean;
  confirmReservation: boolean;
  cancelReservation: boolean;
  convertReservationToPlanning: boolean;
  manageWorkshopAvailability: boolean;
  viewWorkshopAvailability: boolean;
  manageVehicleMaster: boolean;
  searchVehicleMaster: boolean;
  useVehicleForReception: boolean;
  viewVehicleSensitiveFields: boolean;
  viewSavReports: boolean;
  viewSensitiveReportFields: boolean;
  exportSavReports: boolean;
  performQC: boolean;
  acceptQC: boolean;
  refuseQC: boolean;
  viewQcDashboard: boolean;
  performDelivery: boolean;
  confirmDelivery: boolean;
  viewDeliveryDashboard: boolean;
  simulateTechnicianAccess: boolean;
  viewWarranty: boolean;
  manageWarranty: boolean;
  viewSatisfaction: boolean;
  recordSatisfaction: boolean;
  archiveDeliveredDossier: boolean;
}

const none: RolePermissions = {
  manageUsers: false,
  createDossier: false,
  editDossier: false,
  forceStatus: false,
  planWorkshop: false,
  startTask: false,
  blockTask: false,
  releaseBlock: false,
  reopenTask: false,
  validateQC: false,
  deliver: false,
  importData: false,
  exportData: false,
  createReservation: false,
  suggestReservation: false,
  confirmReservation: false,
  cancelReservation: false,
  convertReservationToPlanning: false,
  manageWorkshopAvailability: false,
  viewWorkshopAvailability: true,
  manageVehicleMaster: false,
  searchVehicleMaster: false,
  useVehicleForReception: false,
  viewVehicleSensitiveFields: false,
  viewSavReports: false,
  viewSensitiveReportFields: false,
  exportSavReports: false,
  performQC: false,
  acceptQC: false,
  refuseQC: false,
  viewQcDashboard: false,
  performDelivery: false,
  confirmDelivery: false,
  viewDeliveryDashboard: false,
  simulateTechnicianAccess: false,
  viewWarranty: false,
  manageWarranty: false,
  viewSatisfaction: false,
  recordSatisfaction: false,
  archiveDeliveredDossier: false,
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.DIRECTEUR_SAV]: {
    ...none,
    manageUsers: true,
    createDossier: true,
    editDossier: true,
    forceStatus: true,
    planWorkshop: true,
    startTask: true,
    blockTask: true,
    releaseBlock: true,
    reopenTask: true,
    validateQC: true,
    deliver: true,
    importData: true,
    exportData: true,
    createReservation: true,
    suggestReservation: true,
    confirmReservation: true,
    cancelReservation: true,
    convertReservationToPlanning: true,
    manageWorkshopAvailability: true,
    manageVehicleMaster: true,
    searchVehicleMaster: true,
    useVehicleForReception: true,
    viewVehicleSensitiveFields: true,
    viewSavReports: true,
    viewSensitiveReportFields: true,
    exportSavReports: true,
    performQC: true,
    acceptQC: true,
    refuseQC: true,
    viewQcDashboard: true,
    performDelivery: true,
    confirmDelivery: true,
    viewDeliveryDashboard: true,
    simulateTechnicianAccess: true,
    viewWarranty: true,
    manageWarranty: true,
    viewSatisfaction: true,
    recordSatisfaction: true,
    archiveDeliveredDossier: true,
  },
  [UserRole.CHEF_ATELIER]: {
    ...none,
    editDossier: true,
    planWorkshop: true,
    startTask: true,
    blockTask: true,
    releaseBlock: true,
    reopenTask: true,
    validateQC: true,
    exportData: true,
    createReservation: true,
    suggestReservation: true,
    confirmReservation: true,
    cancelReservation: true,
    convertReservationToPlanning: true,
    manageWorkshopAvailability: true,
    searchVehicleMaster: true,
    viewSavReports: true,
    exportSavReports: true,
    performQC: true,
    acceptQC: true,
    refuseQC: true,
    viewQcDashboard: true,
    simulateTechnicianAccess: true,
    viewWarranty: true,
    manageWarranty: true,
    viewSatisfaction: true,
  },
  [UserRole.RECEPTIONNAIRE]: {
    ...none,
    createDossier: true,
    editDossier: true,
    deliver: true,
    createReservation: true,
    suggestReservation: true,
    manageVehicleMaster: true,
    searchVehicleMaster: true,
    useVehicleForReception: true,
    viewVehicleSensitiveFields: true,
    viewSavReports: true,
    viewSensitiveReportFields: true,
    performDelivery: true,
    confirmDelivery: true,
    viewDeliveryDashboard: true,
    viewWarranty: true,
    manageWarranty: true,
    viewSatisfaction: true,
    recordSatisfaction: true,
  },
  [UserRole.TECHNICIEN]: {
    ...none,
    searchVehicleMaster: false,
    startTask: true,
    blockTask: true,
  },
  [UserRole.CONTROLE_QUALITE]: {
    ...none,
    searchVehicleMaster: true,
    viewSavReports: true,
    validateQC: true,
    performQC: true,
    acceptQC: true,
    refuseQC: true,
    viewQcDashboard: true,
    viewWarranty: true,
  },
  [UserRole.LIVRAISON]: {
    ...none,
    editDossier: true,
    deliver: true,
    searchVehicleMaster: true,
    viewSavReports: true,
    performDelivery: true,
    confirmDelivery: true,
    viewDeliveryDashboard: true,
    viewSatisfaction: true,
    recordSatisfaction: true,
  },
  [UserRole.LECTURE_SEULE]: {
    ...none,
    searchVehicleMaster: true,
    viewSavReports: true,
    viewWarranty: true,
    viewSatisfaction: true,
  },
};

function hasPermission(role: UserRole, key: keyof RolePermissions): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.[key]);
}

export function canAccessTab(role: UserRole, tabId: string): boolean {
  return rolesCanAccessTab(role, tabId);
}

export function canManageUsers(role: UserRole): boolean { return hasPermission(role, "manageUsers"); }
export function canCreateDossier(role: UserRole): boolean { return hasPermission(role, "createDossier"); }
export function canEditDossier(role: UserRole): boolean { return hasPermission(role, "editDossier"); }
export function canForceStatus(role: UserRole): boolean { return hasPermission(role, "forceStatus"); }
export function canPlanWorkshop(role: UserRole): boolean { return hasPermission(role, "planWorkshop"); }
export function canStartTask(role: UserRole): boolean { return hasPermission(role, "startTask"); }
export function canBlockTask(role: UserRole): boolean { return hasPermission(role, "blockTask"); }
export function canReleaseBlock(role: UserRole): boolean { return hasPermission(role, "releaseBlock"); }
export function canReopenTask(role: UserRole): boolean { return hasPermission(role, "reopenTask"); }
export function canValidateQC(role: UserRole): boolean { return hasPermission(role, "validateQC"); }
export function canDeliver(role: UserRole): boolean { return hasPermission(role, "deliver"); }
export function canImportData(role: UserRole): boolean { return hasPermission(role, "importData"); }
export function canExportData(role: UserRole): boolean { return hasPermission(role, "exportData"); }
export function isReadOnlyRole(role: UserRole): boolean { return role === UserRole.LECTURE_SEULE; }
export function canCreateReservation(role: UserRole): boolean { return hasPermission(role, "createReservation"); }
export function canSuggestReservation(role: UserRole): boolean { return hasPermission(role, "suggestReservation"); }
export function canConfirmReservation(role: UserRole): boolean { return hasPermission(role, "confirmReservation"); }
export function canCancelReservation(role: UserRole): boolean { return hasPermission(role, "cancelReservation"); }
export function canConvertReservationToPlanning(role: UserRole): boolean { return hasPermission(role, "convertReservationToPlanning"); }
export function canManageWorkshopAvailability(role: UserRole): boolean { return hasPermission(role, "manageWorkshopAvailability"); }
export function canViewWorkshopAvailability(role: UserRole): boolean { return hasPermission(role, "viewWorkshopAvailability"); }
export function canManageVehicleMaster(role: UserRole): boolean { return hasPermission(role, "manageVehicleMaster"); }
export function canSearchVehicleMaster(role: UserRole): boolean { return hasPermission(role, "searchVehicleMaster"); }
export function canUseVehicleForReception(role: UserRole): boolean { return hasPermission(role, "useVehicleForReception"); }
export function canViewVehicleSensitiveFields(role: UserRole): boolean { return hasPermission(role, "viewVehicleSensitiveFields"); }
export function canViewSavReports(role: UserRole): boolean { return hasPermission(role, "viewSavReports"); }
export function canViewSensitiveReportFields(role: UserRole): boolean { return hasPermission(role, "viewSensitiveReportFields"); }
export function canExportSavReports(role: UserRole): boolean { return hasPermission(role, "exportSavReports"); }
export function canPerformQC(role: UserRole): boolean { return hasPermission(role, "performQC"); }
export function canAcceptQC(role: UserRole): boolean { return hasPermission(role, "acceptQC"); }
export function canRefuseQC(role: UserRole): boolean { return hasPermission(role, "refuseQC"); }
export function canViewQcDashboard(role: UserRole): boolean { return hasPermission(role, "viewQcDashboard"); }
export function canPerformDelivery(role: UserRole): boolean { return hasPermission(role, "performDelivery"); }
export function canConfirmDelivery(role: UserRole): boolean { return hasPermission(role, "confirmDelivery"); }
export function canViewDeliveryDashboard(role: UserRole): boolean { return hasPermission(role, "viewDeliveryDashboard"); }
export function canSimulateTechnicianAccess(role: UserRole): boolean { return hasPermission(role, "simulateTechnicianAccess"); }
export function canViewWarranty(role: UserRole): boolean { return hasPermission(role, "viewWarranty"); }
export function canManageWarranty(role: UserRole): boolean { return hasPermission(role, "manageWarranty"); }
export function canViewSatisfaction(role: UserRole): boolean { return hasPermission(role, "viewSatisfaction"); }
export function canRecordSatisfaction(role: UserRole): boolean { return hasPermission(role, "recordSatisfaction"); }
export function canArchiveDeliveredDossier(role: UserRole): boolean { return hasPermission(role, "archiveDeliveredDossier"); }

