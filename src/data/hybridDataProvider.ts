/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig, shouldAttemptSupabase } from "./backendMode";
import { DataProvider } from "./dataProvider";

export interface AsyncDataProvider<T> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
}

export interface HybridDataProvider<T> {
  mode: BackendRuntimeConfig["mode"];
  local: DataProvider<T>;
  remote?: AsyncDataProvider<T>;
  shouldUseRemote: boolean;
  listLocal(): T[];
  listRemote(): Promise<T[]>;
}

export function createHybridDataProvider<T>(
  local: DataProvider<T>,
  remote?: AsyncDataProvider<T>,
  config = resolveBackendRuntimeConfig()
): HybridDataProvider<T> {
  const shouldUseRemote = shouldAttemptSupabase(config) && Boolean(remote);
  return {
    mode: config.mode,
    local,
    remote,
    shouldUseRemote,
    listLocal: () => local.list(),
    async listRemote() {
      if (!shouldUseRemote || !remote) return local.list();
      try {
        return await remote.list();
      } catch {
        return local.list();
      }
    },
  };
}
