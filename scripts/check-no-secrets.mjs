import fs from "node:fs";
import path from "node:path";

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
  { name: "Service role assignment", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google client secret assignment", pattern: /GOOGLE_CLIENT_SECRET\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google refresh token assignment", pattern: /GOOGLE_REFRESH_TOKEN\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google private key assignment", pattern: /GOOGLE_PRIVATE_KEY\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
  { name: "Google service account assignment", pattern: /GOOGLE_SERVICE_ACCOUNT_JSON\s*=\s*(?!\s*$|YOUR_|REDACTED|PLACEHOLDER)[^\s#]+/i },
];

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

for (const file of listFiles(root)) {
  const relative = path.normalize(path.relative(root, file));
  if (relative === self) continue;
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
}

if (findings.length > 0) {
  console.error("Potential real secrets found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("check-no-secrets: OK");
