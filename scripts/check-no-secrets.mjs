import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "playwright-report",
  "test-results",
  ".cache",
]);

const allowedPlaceholderFiles = new Set([
  ".env.example",
  path.join("supabase", ".env.example"),
]);

const self = path.normalize(path.join("scripts", "check-no-secrets.mjs"));

const realSecretPatterns = [
  { name: "GitHub token", pattern: /gho_[A-Za-z0-9_]{20,}/ },
  { name: "Google OAuth access token", pattern: /ya29\.[A-Za-z0-9_\-.]+/ },
  { name: "Google API key", pattern: /AIza[A-Za-z0-9_\-]{30,}/ },
  { name: "Private key block", pattern: /BEGIN PRIVATE KEY/ },
  { name: "JSON private key", pattern: /"private_key"\s*:\s*"(?!YOUR_)[^"]{20,}"/i },
  { name: "JSON service account", pattern: /"type"\s*:\s*"service_account"/i },
  { name: "OAuth client secret", pattern: /"client_secret"\s*:\s*"(?!YOUR_)[^"]{12,}"/i },
  { name: "OAuth refresh token", pattern: /refresh_token\s*["':=]\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER|null|false)[A-Za-z0-9_\-./]{12,}/i },
  { name: "Service role literal", pattern: /service_role\s*["':=]\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER|null|false)[A-Za-z0-9_\-./]{12,}/i },
  { name: "Private key assignment", pattern: /private_key\s*["':=]\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER|null|false)[A-Za-z0-9_\-./\\]{12,}/i },
  { name: "Client secret assignment", pattern: /client_secret\s*["':=]\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER|null|false)[A-Za-z0-9_\-./]{12,}/i },
  { name: "Google application credentials assignment", pattern: /GOOGLE_APPLICATION_CREDENTIALS\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Service role assignment", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google client secret assignment", pattern: /GOOGLE_CLIENT_SECRET\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google refresh token assignment", pattern: /GOOGLE_REFRESH_TOKEN\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google private key assignment", pattern: /GOOGLE_PRIVATE_KEY\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google service account assignment", pattern: /GOOGLE_SERVICE_ACCOUNT_JSON\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Private API key assignment", pattern: /(PRIVATE_API_KEY|API_PRIVATE_KEY|SECRET_API_KEY)\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Real password assignment", pattern: /\b(password|passwd|pwd)\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER|secret|pin|null|false)[A-Za-z0-9_!@#$%^&*.\-]{12,}/i },
  { name: "JSON password", pattern: /"(password|passwd|pwd)"\s*:\s*"(?!YOUR_|REDACTED|PLACEHOLDER|secret|pin|null|false)[^"]{12,}"/i },
];

const forbiddenSensitiveExtensions = new Set([".pem", ".p12", ".key"]);
const realDataExportPattern = /((\b[A-HJ-NPR-Z0-9]{17}\b)|(\+?\d[\d\s().-]{7,}\d))/i;

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function isTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  return [
    "",
    ".css",
    ".env",
    ".example",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yml",
    ".yaml",
  ].includes(ext);
}

const findings = [];

try {
  execFileSync("git", ["ls-files", "--error-unmatch", ".env.local"], { cwd: root, stdio: "ignore" });
  findings.push(".env.local: tracked env file is forbidden");
} catch {
  // Not tracked, which is expected.
}

for (const file of listFiles(root)) {
  const relative = path.normalize(path.relative(root, file));
  if (relative === self) continue;
  if (path.basename(relative) === ".env.local") continue;
  if (forbiddenSensitiveExtensions.has(path.extname(file).toLowerCase())) {
    findings.push(`${relative}: forbidden sensitive key/certificate file`);
    continue;
  }
  if (!isTextFile(file)) continue;

  const content = fs.readFileSync(file, "utf8");
  const placeholderOnly = allowedPlaceholderFiles.has(relative);
  for (const check of realSecretPatterns) {
    if (check.pattern.test(content)) {
      if (placeholderOnly && !/"type"\s*:\s*"service_account"/i.test(content) && !/BEGIN PRIVATE KEY/.test(content)) {
        continue;
      }
      findings.push(`${relative}: ${check.name}`);
    }
  }

  const exportLikeExtension = new Set([".csv", ".json", ".xlsx", ".xls", ".zip", ".txt"]);
  const inExportDirectory = /(^|[\\/])(exports?|backups?)([\\/]|$)/i.test(relative);
  const namedExportArtifact = /export|backup|sauvegarde/i.test(path.basename(relative)) && exportLikeExtension.has(path.extname(relative).toLowerCase());
  const looksLikeExport = inExportDirectory || namedExportArtifact;
  if (looksLikeExport && realDataExportPattern.test(content)) {
    findings.push(`${relative}: export appears to contain real customer/VIN/phone-like data`);
  }
}

if (findings.length > 0) {
  console.error("Potential real secrets found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("check-no-secrets: OK");
