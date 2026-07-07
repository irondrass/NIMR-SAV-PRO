import assert from "node:assert/strict";
import {
  isWorkshopBay,
  normalizeWorkshopBay,
  normalizeTechnicienResource,
  getActivePlanifiableHumanResources,
  getActivePlanifiableMaterialResources,
  isHumanResourceCompatibleForTask,
  isMaterialResourceCompatibleForTask,
  canManageResourceRepository,
  detectResourceRepositoryIssues,
  detectBayCollision
} from "../src/sav-core";
import { UserRole, AtelierMetier, MaterialCategory, AtelierZone, User, TechnicienResource, WorkshopBay, WorkshopReservation, DossierSAV } from "../src/types";

function testIsWorkshopBay() {
  console.log("Testing isWorkshopBay...");
  assert.ok(isWorkshopBay({ id: "bay_1", name: "Pont 1" }));
  assert.equal(isWorkshopBay({ id: "bay_1" }), false);
  assert.equal(isWorkshopBay(null), false);
}

function testNormalizeWorkshopBay() {
  console.log("Testing normalizeWorkshopBay...");
  const rawBay: WorkshopBay = { id: "bay_1", name: "Pont 1" };
  const normalized = normalizeWorkshopBay(rawBay);
  assert.equal(normalized.nom, "Pont 1");
  assert.equal(normalized.type, "MATERIAL");
  assert.equal(normalized.actif, true);
  assert.equal(normalized.planifiable, true);
  assert.equal(normalized.capaciteVehicules, 1);
}

function testCompatibility() {
  console.log("Testing human/material compatibility...");
  const tech: TechnicienResource = {
    id: "tech_1",
    nom: "Ali",
    specialite: "Peintre",
    disponibilite: "disponible",
    compétences: [],
    zoneAffectee: AtelierZone.PEINTURE,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 0,
    actif: true,
    planifiable: true,
    metierPrincipal: AtelierMetier.PEINTURE
  };

  const bay: WorkshopBay = {
    id: "bay_1",
    name: "Cabine 1",
    nom: "Cabine 1",
    type: "MATERIAL",
    categorie: MaterialCategory.CABINE_PEINTURE,
    actif: true,
    planifiable: true
  };

  // Human compatibility
  assert.ok(isHumanResourceCompatibleForTask(tech, "paint"));
  assert.ok(isHumanResourceCompatibleForTask(tech, "peinture"));
  assert.equal(isHumanResourceCompatibleForTask(tech, "elec"), false);

  // Material compatibility
  assert.ok(isMaterialResourceCompatibleForTask(bay, "paint"));
  assert.equal(isMaterialResourceCompatibleForTask(bay, "mecanique"), false);
}

function testPermissions() {
  console.log("Testing permissions...");
  assert.ok(canManageResourceRepository(UserRole.DIRECTEUR_SAV, "users"));
  assert.ok(canManageResourceRepository(UserRole.DIRECTEUR_SAV, "humans"));
  assert.ok(canManageResourceRepository(UserRole.CHEF_ATELIER, "humans"));
  assert.equal(canManageResourceRepository(UserRole.CHEF_ATELIER, "users"), false);
  assert.equal(canManageResourceRepository(UserRole.RECEPTIONNAIRE, "humans"), false);
}

function testDiagnostics() {
  console.log("Testing diagnostics...");
  const users: User[] = [
    {
      id: "u_1",
      username: "tech_user",
      displayName: "Tech User",
      role: UserRole.TECHNICIEN,
      active: true,
      createdAt: "",
      updatedAt: ""
    }
  ];
  const companions: TechnicienResource[] = [];
  const materials: WorkshopBay[] = [];

  const issues = detectResourceRepositoryIssues(users, companions, materials);
  
  const codes = issues.map(i => i.code);
  assert.ok(codes.includes("BAYSLIST_EMPTY_FALLBACK"));
  assert.ok(codes.includes("TECH_ACTIVE_NO_HR"));
}

testIsWorkshopBay();
testNormalizeWorkshopBay();
testCompatibility();
testPermissions();
testDiagnostics();

console.log("All resource repository unit tests passed!");
