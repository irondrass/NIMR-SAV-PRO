/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LOCAL_STORAGE_PREFIX = "nimr-sav-pro";

export const STORAGE_KEYS = {
  dossiers: "nimr-sav-pro-dossiers-v1",
  reclamations: "nimr-sav-pro-reclamations-v1",
  techs: "nimr-sav-pro-techs-v1",
  logs: "nimr-sav-pro-logs-v1",
  theme: "nimr-sav-pro-theme-v1",
  userRole: "nimr-sav-pro-user-role-v1",
  backup: "nimr-sav-pro-backup-v1",
  settings: "nimr-sav-pro-settings-v1",
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
