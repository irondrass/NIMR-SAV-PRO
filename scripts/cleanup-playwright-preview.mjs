import { execFileSync } from "node:child_process";
import os from "node:os";

const port = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);
const dryRun = process.argv.includes("--dry-run");

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function windowsListeningPids() {
  const output = run("netstat.exe", ["-ano", "-p", "tcp"]);
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const normalized = line.trim().replace(/\s+/g, " ");
    if (!normalized.includes(" LISTENING ")) continue;
    const parts = normalized.split(" ");
    const localAddress = parts[1] || "";
    const pid = Number(parts.at(-1));
    if (!Number.isInteger(pid)) continue;
    if (localAddress.endsWith(`:${port}`)) pids.add(pid);
  }
  return [...pids];
}

function windowsCommandLine(pid) {
  const query = `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`;
  return run("powershell.exe", ["-NoProfile", "-Command", query]).trim();
}

function posixListeningPids() {
  const output = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  return output.split(/\r?\n/).map(value => Number(value.trim())).filter(Number.isInteger);
}

function posixCommandLine(pid) {
  return run("ps", ["-p", String(pid), "-o", "command="]).trim();
}

function isPlaywrightPreviewProcess(commandLine) {
  const value = commandLine.toLowerCase();
  return (
    value.includes("serve-playwright-preview.mjs") ||
    (value.includes("vite") && value.includes("preview") && value.includes(String(port))) ||
    (value.includes("npm") && value.includes("preview") && value.includes(String(port)))
  );
}

function stopPid(pid) {
  if (dryRun) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Process may already be gone.
  }
}

const isWindows = os.platform() === "win32";
const pids = isWindows ? windowsListeningPids() : posixListeningPids();
const inspected = pids.map(pid => ({
  pid,
  commandLine: isWindows ? windowsCommandLine(pid) : posixCommandLine(pid),
}));

let stopped = 0;
for (const item of inspected) {
  if (!item.commandLine || !isPlaywrightPreviewProcess(item.commandLine)) {
    console.log(`[playwright-cleanup] leaving pid ${item.pid}: ${item.commandLine || "unknown command"}`);
    continue;
  }
  console.log(`[playwright-cleanup] stopping pid ${item.pid}: ${item.commandLine}`);
  stopPid(item.pid);
  stopped += 1;
}

if (stopped === 0) {
  console.log(`[playwright-cleanup] no Playwright/Vite preview process found on port ${port}`);
} else {
  console.log(`[playwright-cleanup] stopped ${stopped} preview process(es) on port ${port}`);
}
