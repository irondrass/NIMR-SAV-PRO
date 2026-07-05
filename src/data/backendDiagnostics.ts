/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, describeBackendMode, resolveBackendRuntimeConfig } from "./backendMode";

export interface BackendDiagnostics {
  mode: BackendRuntimeConfig["mode"];
  environment: BackendRuntimeConfig["environment"];
  supabaseConfigured: boolean;
  authProvider: BackendRuntimeConfig["authProvider"];
  googleDriveStatus: BackendRuntimeConfig["googleDriveStatus"];
  message: string;
  missing: string[];
  warnings: string[];
  errors: string[];
}

export function buildBackendDiagnostics(config = resolveBackendRuntimeConfig()): BackendDiagnostics {
  return {
    mode: config.mode,
    environment: config.environment,
    supabaseConfigured: config.supabaseConfigured,
    authProvider: config.authProvider,
    googleDriveStatus: config.googleDriveStatus,
    message: config.productionBlocked
      ? "Production reelle non autorisee"
      : config.backendEnabled
        ? "Backend staging configure"
        : "Mode local actif",
    missing: [...config.missing],
    warnings: [...config.warnings],
    errors: config.errors.length > 0 ? [...config.errors] : [describeBackendMode(config)],
  };
}
