import { test, expect, Page } from "@playwright/test";
import { createReceptionDossier } from "../src/sav-core";
import { STORAGE_KEYS } from "../src/storage-keys";
import {
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  RepairOrderLine,
  WorkshopReservation,
} from "../src/types";

function baseDossier(id: string, lines: RepairOrderLine[], overrides: Partial<DossierSAV> = {}): DossierSAV {
  const dossier = createReceptionDossier({
    clientNom: "Client Nettoyage",
    clientTelephone: "+216 55 390 000",
    deposantNom: "Client Nettoyage",
    deposantTelephone: "+216 55 390 000",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 500",
    vehiculeImmatriculation: "390 TU 3900",
    vehiculeVIN: "1HGCM82633A004352",
    vehiculeKilometrage: 19000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Contrôle atelier",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
  }, [], new Date("2026-06-30T08:00:00.000Z"));
  return { ...dossier, id, ordresReparation: lines, ...overrides };
}

function task(id: string, overrides: Partial<RepairOrderLine> = {}): RepairOrderLine {
  return {
    id,
    designation: "Diagnostic freinage",
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending",
    isEstimatedDurationValidated: true,
    ...overrides,
  };
}

async function seed(page: Page, dossiers: DossierSAV[], reservations: WorkshopReservation[] = []) {
  await page.addInitScript(({ keys, dossiersValue, reservationsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.reservations, JSON.stringify(reservationsValue));
    localStorage.setItem(keys.techs, JSON.stringify([{
      id: "tech_01",
      nom: "Technicien Atelier 01",
      specialite: "Mécanique",
      zoneAffectee: "Grands Travaux Mécaniques",
      disponibilite: "disponible",
      chargeActuelle: 0,
    }]));
  }, { keys: STORAGE_KEYS, dossiersValue: dossiers, reservationsValue: reservations });
}

async function loginChef(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  await page.locator('[data-testid="login-username"]').fill("chefatelier");
  await page.locator('[data-testid="login-pin"]').fill("2222");
  await page.locator('[data-testid="login-submit"]').click();
  await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();
}

async function openRepairOrders(page: Page, dossierId: string) {
  await page.locator('[data-testid="nav-dossiers"]').click();
  await page.locator(`[data-testid="dossier-card-${dossierId}"]`).click();
  await page.locator('[data-testid="tab-repair-orders"]').click();
}

test.describe("Lot 6K-G - règles métier atelier", () => {
  test("une tâche réservée doit être libérée avant suppression physique", async ({ page }) => {
    const dossierId = "NIMR-6KG-DELETE";
    const line = task("task-reserved", {
      planningStart: "2026-07-01T08:00:00.000Z",
      planningEnd: "2026-07-01T09:00:00.000Z",
      plannedTechnicianId: "tech_01",
      plannedBayId: "bay_01",
    });
    const reservation: WorkshopReservation = {
      reservationId: "res-6kg-delete",
      dossierId,
      taskIds: [line.id],
      totalHours: 1,
      desiredDate: "2026-07-01T08:00:00.000Z",
      startTime: "2026-07-01T08:00:00.000Z",
      endTime: "2026-07-01T09:00:00.000Z",
      technicianId: "tech_01",
      bayId: "bay_01",
      status: "RESERVATION_CONFIRMEE",
      source: "e2e",
      history: [],
    };
    await seed(page, [baseDossier(dossierId, [line])], [reservation]);
    await loginChef(page);
    await openRepairOrders(page, dossierId);

    await page.locator('[data-testid="delete-workshop-task-button"][data-task-id="task-reserved"]').click();
    await expect(page.locator('[data-testid="delete-task-blocked-message"]').first()).toContainText("Libérez d’abord la réservation planning");

    await page.locator('[data-testid="release-task-reservation-button"][data-task-id="task-reserved"]').click();
    await expect(page.locator('[data-testid="task-reservation-released-message"]')).toContainText("Réservation atelier libérée");

    await page.locator('[data-testid="delete-workshop-task-button"][data-task-id="task-reserved"]').click();
    await expect(page.locator('[data-testid="delete-task-confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="delete-task-reason"]').fill("Erreur de saisie atelier");
    await page.locator('[data-testid="delete-task-confirm"]').click();

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    expect(stored.find(dossier => dossier.id === dossierId)?.ordresReparation).toHaveLength(0);
  });

  test("une tâche terminée s'annule administrativement et invalide le QC conforme", async ({ page }) => {
    const dossierId = "NIMR-6KG-CANCEL";
    const dossier = baseDossier(dossierId, [task("task-done", { status: "done", tempsPasse: 1 })], {
      statut: DossierStatus.PRET_A_LIVRER,
      checklistQC: {
        essaiEffectue: true,
        defautRepare: true,
        aucunVoyantAllume: true,
        niveauxVerifies: true,
        serrageSecurite: true,
        propreteVehicule: true,
        documentsPrets: true,
        photosApresOk: true,
        validationGlobale: "valide",
      },
    });
    await seed(page, [dossier]);
    await loginChef(page);
    await openRepairOrders(page, dossierId);

    await page.locator('[data-testid="cancel-workshop-task-button"][data-task-id="task-done"]').click();
    await expect(page.locator('[data-testid="delete-task-confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="delete-task-reason"]').fill("Annulation demandée par Chef Atelier");
    await page.locator('[data-testid="delete-task-confirm"]').click();

    await expect(page.locator('[data-testid="workshop-task-status"]').first()).toContainText("Annulée");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    const updated = stored.find(dossier => dossier.id === dossierId);
    expect(updated?.ordresReparation[0].status).toBe("cancelled");
    expect(updated?.checklistQC.validationGlobale).toBe("a_refaire");
  });
});

