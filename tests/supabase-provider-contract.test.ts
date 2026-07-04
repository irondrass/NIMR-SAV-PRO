import assert from "node:assert/strict";
import {
  BackendNotEnabledError,
  SUPABASE_BACKEND_TABLES,
  SUPABASE_EDGE_FUNCTIONS,
  createSupabaseProvider,
  SupabaseRequest,
} from "../src/data/supabaseProvider";

console.log("Démarrage du test: supabase-provider-contract...");

assert.ok(SUPABASE_BACKEND_TABLES.includes("users_profile"));
assert.ok(SUPABASE_BACKEND_TABLES.includes("file_attachments"));
assert.ok(SUPABASE_EDGE_FUNCTIONS.includes("drive-download"));

const readyProvider = createSupabaseProvider({ config: {
  mode: "backend-ready",
  supabaseUrl: null,
  supabaseAnonKey: null,
  backendEnabled: false,
  backendReady: true,
  missing: [],
  warnings: [],
} });

assert.equal(readyProvider.backendEnabled, false);
await assert.rejects(() => readyProvider.list("dossiers"), BackendNotEnabledError);

const requests: SupabaseRequest[] = [];
const enabledProvider = createSupabaseProvider({
  config: {
    mode: "backend-enabled",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
    backendEnabled: true,
    backendReady: true,
    missing: [],
    warnings: [],
  },
  client: {
    async request<T>(request: SupabaseRequest): Promise<T> {
      requests.push(request);
      return [] as T;
    },
  },
});

const dossiers = await enabledProvider.list("dossiers");
assert.deepEqual(dossiers, []);
assert.deepEqual(requests, [{ table: "dossiers", operation: "list" }]);

console.log("supabase-provider-contract.test.ts OK");
