import assert from "node:assert/strict";
import { buildSpawnSpec, runCommand } from "../scripts/workshop-command-runner.mjs";

assert.deepEqual(buildSpawnSpec("npx", ["supabase", "--version"], "win32"), {
  file: "cmd.exe",
  args: ["/d", "/s", "/c", "npx", "supabase", "--version"],
});

let received;
const output = runCommand("npx", ["supabase", "--version"], {
  platform: "win32",
  env: {},
}, (...args) => {
  received = args;
  return { status: 0, stdout: "2.110.0", stderr: "" };
});
assert.equal(output, "2.110.0");
assert.deepEqual(received.slice(0, 2), ["cmd.exe", ["/d", "/s", "/c", "npx", "supabase", "--version"]]);

assert.throws(() => runCommand("npx", ["supabase", "--version"], {
  platform: "win32",
  env: { SUPABASE_ACCESS_TOKEN: "do-not-print" },
}, () => ({
  status: null,
  error: { code: "ENOENT", message: "runner unavailable do-not-print" },
})), (error) => {
  assert.match(error.message, /status_null/);
  assert.match(error.message, /ENOENT/);
  assert.match(error.message, /runner unavailable \*\*\*/);
  assert.match(error.message, /command=npx supabase --version/);
  assert.doesNotMatch(error.message, /do-not-print/);
  return true;
});

assert.deepEqual(buildSpawnSpec("npx", ["supabase", "--version"], "linux"), {
  file: "npx",
  args: ["supabase", "--version"],
});

console.log("workshop command runner tests passed");
