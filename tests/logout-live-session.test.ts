import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: logout-live-session...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");

// Verify stopPropagation is used
assert.ok(appSource.includes("e.stopPropagation()"), "Logout click should stop event propagation.");

// Verify the session invalidation flag is set to true on logout
assert.ok(
  appSource.includes('writeLocalStorageValue("nimr-sav-pro-session-invalidated", "true")') ||
  appSource.includes('localStorage.setItem("nimr-sav-pro-session-invalidated", "true")'),
  "Session invalidation flag must be set to true on logout."
);

// Verify the session invalidation flag is removed on login
assert.ok(
  appSource.includes('removeLocalStorageValue("nimr-sav-pro-session-invalidated")') ||
  appSource.includes('localStorage.removeItem("nimr-sav-pro-session-invalidated")'),
  "Session invalidation flag must be removed on successful login."
);

// Verify loadStoredSession checks the invalidated flag
assert.ok(appSource.includes('const invalidated = localStorage.getItem("nimr-sav-pro-session-invalidated")'), "loadStoredSession must check the invalidation flag.");

// Verify refreshActivity checks the invalidated flag or storage before renewing the session
assert.ok(appSource.includes('const sessionInStore = localStorage.getItem(STORAGE_KEYS.session)'), "refreshActivity must check if the session key is missing in localStorage.");

// Verify window storage event listener is registered
assert.ok(appSource.includes('window.addEventListener("storage", handleStorageEvent)'), "A storage event listener must be registered to sync logout across tabs.");

console.log("logout-live-session.test.ts OK");
