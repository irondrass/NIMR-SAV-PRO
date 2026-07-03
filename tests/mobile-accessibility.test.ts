import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: mobile-accessibility...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");

// 1. Mobile menu button has aria-label and aria-expanded
assert.ok(appSource.includes('aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}'), "Mobile menu button must have a dynamic aria-label.");
assert.ok(appSource.includes('aria-expanded={mobileMenuOpen}'), "Mobile menu button must have an aria-expanded attribute.");

// 2. Main wrapper has overflow-x-hidden to prevent horizontal scroll
assert.ok(appSource.includes("overflow-x-hidden"), "Wrapper should use overflow-x-hidden to prevent horizontal scrolling on mobile.");

console.log("mobile-accessibility.test.ts OK");
