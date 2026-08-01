import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SECRET_ENV_NAMES = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
];

export function redact(value, env = process.env) {
  let output = String(value ?? "");
  for (const name of SECRET_ENV_NAMES) {
    if (env[name]) output = output.split(env[name]).join("***");
  }
  if (env.SUPABASE_PROJECT_REF) output = output.split(env.SUPABASE_PROJECT_REF).join("***DEV_REF***");
  return output;
}

export function buildSpawnSpec(command, args = [], platform = process.platform) {
  if (platform === "win32") {
    return { file: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { file: command, args: [ ...args ] };
}

export function runCommand(command, args = [], options = {}, runner = spawnSync) {
  const { platform = process.platform, env = process.env, allowFailure = false, ...spawnOptions } = options;
  const spec = buildSpawnSpec(command, args, platform);
  const result = runner(spec.file, spec.args, {
    cwd: resolve("."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
    ...spawnOptions,
  });
  const output = redact((result.stdout ?? "") + (result.stderr ?? ""), env);
  if (output.trim()) process.stdout.write(output);

  const maskedCommand = redact([command, ...args].join(" "), env);
  if (result.status === null) {
    const errorCode = redact(result.error?.code ?? "UNKNOWN", env);
    const errorMessage = redact(result.error?.message ?? "Unknown command runner error", env);
    if (allowFailure) return { ok: false, status: null, error: result.error, output };
    throw new Error(`command_runner=status_null error_code=${errorCode} error_message=${errorMessage} command=${maskedCommand}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return { ok: false, status: result.status, error: result.error, output };
    throw new Error(`${maskedCommand} failed with exit code ${result.status}`);
  }
  if (allowFailure) return { ok: true, status: 0, output };
  return output;
}
