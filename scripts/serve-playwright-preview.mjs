import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const host = process.env.PLAYWRIGHT_PREVIEW_HOST || "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);
const basePath = "/NIMR-SAV-PRO/";
const healthPath = "/__nimr_playwright_health";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body);
}

function safeJoin(filePath) {
  const resolved = path.resolve(distDir, filePath);
  if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) return null;
  return resolved;
}

function serveFile(response, absolutePath) {
  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      send(response, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
      return;
    }
    const contentType = mimeTypes.get(path.extname(absolutePath).toLowerCase()) || "application/octet-stream";
    send(response, 200, content, { "content-type": contentType });
  });
}

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error(`[playwright-preview] Missing dist/index.html. Run npm run build first.`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);

  if (requestUrl.pathname === healthPath) {
    send(response, 200, JSON.stringify({ ok: true, app: "nimr-sav-pro", server: "playwright-preview" }), {
      "content-type": "application/json; charset=utf-8",
      "x-nimr-playwright-preview": "ok",
    });
    return;
  }

  if (requestUrl.pathname === "/") {
    response.writeHead(302, { location: basePath });
    response.end();
    return;
  }

  if (!requestUrl.pathname.startsWith(basePath)) {
    send(response, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  const relativeUrl = decodeURIComponent(requestUrl.pathname.slice(basePath.length));
  const relativePath = relativeUrl || "index.html";
  const absolutePath = safeJoin(relativePath);

  if (absolutePath && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    serveFile(response, absolutePath);
    return;
  }

  serveFile(response, path.join(distDir, "index.html"));
});

server.on("error", error => {
  console.error(`[playwright-preview] ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[playwright-preview] serving ${distDir} at http://${host}:${port}${basePath}`);
  console.log(`[playwright-preview] health http://${host}:${port}${healthPath}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
