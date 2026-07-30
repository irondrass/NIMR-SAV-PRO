import assert from "node:assert/strict";
import { assertSupabaseDevSafety, loadSupabaseDevEnvironment } from "./load-supabase-dev-env.mjs";
import { runCommand } from "./workshop-command-runner.mjs";

loadSupabaseDevEnvironment();
assertSupabaseDevSafety();
runCommand("npx", ["supabase", "db", "push", "--yes"]);
