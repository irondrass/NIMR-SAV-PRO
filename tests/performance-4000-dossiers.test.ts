import assert from "node:assert/strict";
import { buildDirectorDashboardKpis } from "../src/dashboard-kpis";
import { buildDossierSearchIndex, matchesDossierSearch, paginateItems } from "../src/performance-lot7";
import { DossierPriority, DossierSAV, DossierStatus, InterventionType } from "../src/types";
import { createReceptionDossier } from "../src/sav-core";
import { getDefaultWorkshopSchedule, getDefaultWorkshopShiftProfiles } from "../src/workshop-availability";

console.log("Démarrage du test: performance-4000-dossiers...");

function makeDossier(index: number): DossierSAV {
  const dossier = createReceptionDossier({
    clientNom: `Client Charge ${index}`,
    clientTelephone: "+216 20 000 000",
    deposantNom: `Client Charge ${index}`,
    deposantTelephone: "+216 20 000 000",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 580",
    vehiculeImmatriculation: `${100 + index} TU ${2026 + index}`,
    vehiculeVIN: `VINLOT7${String(index).padStart(10, "0")}`,
    vehiculeKilometrage: 10000 + index,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: index % 10 === 0 ? DossierPriority.URGENTE : DossierPriority.NORMALE,
    plainteClient: "Test charge Lot 7",
    observationsReception: "Fixture test uniquement",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
  }, [], new Date("2026-07-03T08:00:00.000Z"));

  return {
    ...dossier,
    id: `NIMR-PERF-${String(index).padStart(4, "0")}`,
    statut: index % 3 === 0 ? DossierStatus.EN_TRAVAUX : DossierStatus.NOUVEAU,
    ordresReparation: Array.from({ length: 3 }, (_, taskIndex) => ({
      id: `task-${index}-${taskIndex}`,
      designation: `Tâche ${taskIndex}`,
      tempsEstime: 1,
      tempsPasse: 0,
      status: "pending" as const,
    })),
  };
}

const dossiers = Array.from({ length: 4000 }, (_, index) => makeDossier(index));
const startedAt = Date.now();
const index = buildDossierSearchIndex(dossiers);
const matches = dossiers.filter(dossier => matchesDossierSearch(index, dossier, "NIMR-PERF-3999"));
const paginated = paginateItems(dossiers, 100);

assert.equal(dossiers.length, 4000);
assert.equal(matches.length, 1);
assert.equal(paginated.visibleItems.length, 100);
assert.equal(paginated.hiddenCount, 3900);
assert.ok(Date.now() - startedAt < 1500, "Recherche indexée 4 000 dossiers trop lente");

const kpis = buildDirectorDashboardKpis({
  dossiers,
  techniciens: [],
  reservations: [],
  availabilityConfig: {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: getDefaultWorkshopShiftProfiles(),
  },
});
assert.equal(kpis.filteredDossiers.length, 4000);
assert.ok(kpis.filteredDossiers.length > 0);

console.log("performance-4000-dossiers.test.ts OK");
