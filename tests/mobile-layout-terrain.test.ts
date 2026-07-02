import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage des tests mobile-layout-terrain...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");
const cssSource = fs.readFileSync("src/index.css", "utf8");

assert.ok(appSource.includes("mobileMenuOpen"));
assert.ok(appSource.includes('data-testid="mobile-menu-button"'));
assert.ok(appSource.includes('data-testid="mobile-menu-overlay"'));
assert.ok(appSource.includes("setMobileMenuOpen(false)"));
assert.ok(appSource.includes("md:hidden"));
assert.ok(appSource.includes("-translate-x-full"));
assert.ok(appSource.includes("overflow-x-hidden"));
assert.ok(appSource.includes("min-w-0"));
assert.ok(cssSource.includes("overflow-x: hidden"));
assert.ok(cssSource.includes("min-height: 48px"), "Les boutons mobiles doivent garder une hauteur tactile minimale.");

console.log("mobile-layout-terrain.test.ts OK");
