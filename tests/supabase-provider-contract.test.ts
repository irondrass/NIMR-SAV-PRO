import assert from "node:assert/strict";
import {
  BackendNotEnabledError,
  SUPABASE_BACKEND_TABLES,
  SUPABASE_EDGE_FUNCTIONS,
  SupabaseProviderError,
  createSupabaseProvider,
  SupabaseRequest,
} from "../src/data/supabaseProvider";

console.log("Démarrage du test: supabase-provider-contract...");

assert.ok(SUPABASE_BACKEND_TABLES.includes("users_profile"));
assert.ok(SUPABASE_BACKEND_TABLES.includes("profiles"));
assert.ok(SUPABASE_BACKEND_TABLES.includes("file_attachments"));
assert.ok(SUPABASE_BACKEND_TABLES.includes("file_metadata"));
assert.ok(SUPABASE_EDGE_FUNCTIONS.includes("drive-download"));

const readyProvider = createSupabaseProvider({ config: {
  mode: "backend-ready",
  environment: "staging",
  supabaseUrl: null,
  supabaseAnonKey: null,
  supabaseConfigured: false,
  backendEnabled: false,
  backendReady: true,
  productionBlocked: false,
  authProvider: "local",
  googleDriveStatus: "not-configured",
  missing: [],
  warnings: [],
  errors: [],
} });

assert.equal(readyProvider.backendEnabled, false);
await assert.rejects(() => readyProvider.list("dossiers"), BackendNotEnabledError);

const requests: SupabaseRequest[] = [];
const enabledProvider = createSupabaseProvider({
  config: {
    mode: "backend-enabled",
    environment: "staging",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
    supabaseConfigured: true,
    backendEnabled: true,
    backendReady: true,
    productionBlocked: false,
    authProvider: "supabase",
    googleDriveStatus: "staging-ready",
    missing: [],
    warnings: [],
    errors: [],
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

const missingUrlProvider = createSupabaseProvider({
  config: {
    mode: "backend-enabled",
    environment: "staging",
    supabaseUrl: null,
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
    supabaseConfigured: false,
    backendEnabled: false,
    backendReady: false,
    productionBlocked: false,
    authProvider: "local",
    googleDriveStatus: "not-configured",
    missing: ["VITE_SUPABASE_URL"],
    warnings: [],
    errors: [],
  },
});
await assert.rejects(() => missingUrlProvider.list("dossiers"), (error: unknown) => {
  assert.ok(error instanceof SupabaseProviderError);
  assert.equal(error.code, "missing-url");
  return true;
});

console.log("supabase-provider-contract.test.ts OK");
