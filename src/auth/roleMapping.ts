/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "../types";

export type BackendBusinessRole =
  | "DIRECTEUR_SAV"
  | "CHEF_ATELIER"
  | "RECEPTION"
  | "TECHNICIEN"
  | "QC"
  | "LIVRAISON"
  | "LECTURE"
  | "directeur"
  | "chefatelier"
  | "reception"
  | "technicien"
  | "qc"
  | "livraison"
  | "lecture";

export type NimrBackendRole = "directeur" | "reception" | "chefatelier" | "technicien" | "qc" | "livraison" | "lecture";

export const APP_TO_BACKEND_ROLE: Record<UserRole, BackendBusinessRole> = {
  [UserRole.DIRECTEUR_SAV]: "DIRECTEUR_SAV",
  [UserRole.CHEF_ATELIER]: "CHEF_ATELIER",
  [UserRole.RECEPTIONNAIRE]: "RECEPTION",
  [UserRole.TECHNICIEN]: "TECHNICIEN",
  [UserRole.CONTROLE_QUALITE]: "QC",
  [UserRole.LIVRAISON]: "LIVRAISON",
  [UserRole.LECTURE_SEULE]: "LECTURE",
};

export const BACKEND_TO_APP_ROLE: Record<BackendBusinessRole, UserRole> = {
  DIRECTEUR_SAV: UserRole.DIRECTEUR_SAV,
  CHEF_ATELIER: UserRole.CHEF_ATELIER,
  RECEPTION: UserRole.RECEPTIONNAIRE,
  TECHNICIEN: UserRole.TECHNICIEN,
  QC: UserRole.CONTROLE_QUALITE,
  LIVRAISON: UserRole.LIVRAISON,
  LECTURE: UserRole.LECTURE_SEULE,
  directeur: UserRole.DIRECTEUR_SAV,
  chefatelier: UserRole.CHEF_ATELIER,
  reception: UserRole.RECEPTIONNAIRE,
  technicien: UserRole.TECHNICIEN,
  qc: UserRole.CONTROLE_QUALITE,
  livraison: UserRole.LIVRAISON,
  lecture: UserRole.LECTURE_SEULE,
};

export const APP_TO_NIMR_BACKEND_ROLE: Record<UserRole, NimrBackendRole> = {
  [UserRole.DIRECTEUR_SAV]: "directeur",
  [UserRole.CHEF_ATELIER]: "chefatelier",
  [UserRole.RECEPTIONNAIRE]: "reception",
  [UserRole.TECHNICIEN]: "technicien",
  [UserRole.CONTROLE_QUALITE]: "qc",
  [UserRole.LIVRAISON]: "livraison",
  [UserRole.LECTURE_SEULE]: "lecture",
};

export function toBackendRole(role: UserRole): BackendBusinessRole {
  return APP_TO_BACKEND_ROLE[role];
}

export function toNimrBackendRole(role: UserRole): NimrBackendRole {
  return APP_TO_NIMR_BACKEND_ROLE[role];
}

export function toAppRole(role: string): UserRole | null {
  return BACKEND_TO_APP_ROLE[role as BackendBusinessRole] ?? null;
}

export function canBackendRoleWrite(role: BackendBusinessRole): boolean {
  return role !== "LECTURE" && role !== "lecture";
}
