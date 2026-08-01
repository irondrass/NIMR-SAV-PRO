import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(".env.supabase-dev.local");
const VARIABLES = [
  "SUPABASE_ENVIRONMENT",
  "ALLOW_SUPABASE_DEV_TESTS",
  "WORKSHOP_ALLOW_MUTATING_DEV_TESTS",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_PROD_PROJECT_REF",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const SECRET_VARIABLES = new Set([
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]);

function loadLocalEnvironment() {
  if (!existsSync(ENV_FILE)) return;
  const lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function isPresent(name) {
  return Boolean(process.env[name]?.trim());
}

function maskRef(value) {
  if (!value) return "ABSENT";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskDomain(value) {
  if (!value) return "ABSENT";
  try {
    const hostname = new URL(value).hostname;
    const labels = hostname.split(".");
    const first = labels[0] ?? "";
    const maskedFirst = first.length <= 4 ? `${first.slice(0, 1)}***` : `${first.slice(0, 3)}***${first.slice(-2)}`;
    return [maskedFirst, ...labels.slice(1)].join(".");
  } catch {
    return "INVALIDE";
  }
}

loadLocalEnvironment();

const environmentOk = process.env.SUPABASE_ENVIRONMENT === "development";
const acknowledgementOk = process.env.ALLOW_SUPABASE_DEV_TESTS === "YES" && process.env.WORKSHOP_ALLOW_MUTATING_DEV_TESTS === "true";
const clientKeyPresent = isPresent("SUPABASE_PUBLISHABLE_KEY") || isPresent("SUPABASE_ANON_KEY");
const serverKeyPresent = isPresent("SUPABASE_SECRET_KEY") || isPresent("SUPABASE_SERVICE_ROLE_KEY");
const allPresent = VARIABLES.filter(name => !["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"].includes(name)).every(isPresent) && clientKeyPresent && serverKeyPresent;
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
const productionRef = process.env.SUPABASE_PROD_PROJECT_REF?.trim() ?? "";
const devUrl = process.env.SUPABASE_URL?.trim() ?? "";
const productionPattern = /(^|[-_.])(prod|production)([-_.]|$)/i;
let url;
try {
  url = new URL(devUrl);
} catch {
  url = undefined;
}
const urlMatchesProject = Boolean(
  url &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
      (url.protocol === "https:" && url.hostname === `${projectRef}.supabase.co` && url.hostname.endsWith(".supabase.co"))),
);
const distinctFromProduction = Boolean(projectRef && productionRef && projectRef !== productionRef);
const noProductionMarker = Boolean(
  projectRef &&
    url &&
    !productionPattern.test(projectRef) &&
    !productionPattern.test(url.hostname),
);
const devSafetyOk =
  allPresent &&
  environmentOk &&
  acknowledgementOk &&
  urlMatchesProject &&
  distinctFromProduction &&
  noProductionMarker;

console.log(`environnement=${process.env.SUPABASE_ENVIRONMENT ?? "ABSENT"}`);
console.log(`project_ref=${maskRef(projectRef)}`);
console.log(`domaine=${maskDomain(devUrl)}`);
for (const name of VARIABLES) {
  const classification = SECRET_VARIABLES.has(name) ? "secret" : "variable";
  console.log(`${name}=${isPresent(name) ? `PRESENT (${classification})` : "ABSENT"}`);
}
console.log(`verification_dev=${environmentOk && acknowledgementOk && urlMatchesProject ? "PASS" : "FAIL"}`);
console.log(`verification_anti_production=${distinctFromProduction && noProductionMarker ? "PASS" : "FAIL"}`);
console.log(`preflight=${devSafetyOk ? "PASS" : "FAIL"}`);

if (!devSafetyOk) process.exitCode = 1;
