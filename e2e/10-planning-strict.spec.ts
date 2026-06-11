import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierSAV, DossierStatus, RepairOrderLine } from "../src/types";

const PLANNING_DATE = "2026-06-15";
const SATURDAY_DATE = "2026-06-20";
const SUNDAY_DATE = "2026-06-21";
const NEXT_WORKDAY_AFTER_SATURDAY = "2026-06-22";

function localIso(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function line(overrides: Partial<RepairOrderLine> & Pick<RepairOrderLine, "id" | "designation">): RepairOrderLine {
  return {
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending",
    ...overrides,
  };
}

function plannedLine(
  id: string,
  designation: string,
  technicianId: string,
  bayId: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  segments?: Array<{ start: string; end: string }>
): RepairOrderLine {
  const start = localIso(PLANNING_DATE, startHour, startMinute);
  const end = localIso(PLANNING_DATE, endHour, endMinute);
  return line({
    id,
    designation,
    tempsEstime: (new Date(end).getTime() - new Date(start).getTime()) / 3600000,
    plannedTechnicianId: technicianId,
    plannedBayId: bayId,
    planningDate: PLANNING_DATE,
    planningStart: start,
    planningEnd: end,
    planningSegments: segments ?? [{ start, end }],
  });
}

const techA = createMockTech({
  id: "tech_alaa",
  nom: "Alaa Ouerteni",
  specialite: "Mécanicien · Poste mécanique",
  zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
  chargeActuelle: 0,
});

const techFree = createMockTech({
  id: "tech_salah",
  nom: "Salah",
  specialite: "Mécanicien · Poste mécanique",
  zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
  chargeActuelle: 0,
});

const techB = createMockTech({
  id: "tech_imed",
  nom: "IMED",
  specialite: "Tôlier · Poste tôlerie B",
  zoneAffectee: AtelierZone.CARROSSERIE,
  chargeActuelle: 0,
});

const techC = createMockTech({
  id: "tech_anis",
  nom: "ANIS",
  specialite: "Peintre · Zone peinture",
  zoneAffectee: AtelierZone.PEINTURE,
  chargeActuelle: 0,
});

const dossierMorning = createMockDossier({
  id: "NIMR-GANTT-0930",
  clientNom: "Client Démo Gantt Matin",
  vehiculeMarque: "Forthing",
  vehiculeModele: "T5 EVO",
  vehiculeImmatriculation: "111 TU 1111",
  statut: DossierStatus.TRAVAUX_PLANIFIES,
  technicienId: techA.id,
  ordresReparation: [
    plannedLine("ro_morning", "Bloc 09:30-12:00", techA.id, "bay_fast_01", 9, 30, 12, 0),
  ],
});

const dossierAfternoon = createMockDossier({
  id: "NIMR-GANTT-1400",
  clientNom: "Client Démo Gantt Après-midi",
  vehiculeMarque: "DFSK",
  vehiculeModele: "Glory 500",
  vehiculeImmatriculation: "222 TU 2222",
  statut: DossierStatus.TRAVAUX_PLANIFIES,
  technicienId: techB.id,
  ordresReparation: [
    plannedLine("ro_afternoon", "Bloc 14:00-17:00", techB.id, "bay_body_01", 14, 0, 17, 0),
  ],
});

const splitSegments = [
  { start: localIso(PLANNING_DATE, 11, 0), end: localIso(PLANNING_DATE, 12, 0) },
  { start: localIso(PLANNING_DATE, 13, 0), end: localIso(PLANNING_DATE, 15, 0) },
];

const dossierSplit = createMockDossier({
  id: "NIMR-GANTT-SPLIT",
  clientNom: "Client Démo Gantt Split",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "Aeolus Huge",
  vehiculeImmatriculation: "333 TU 3333",
  statut: DossierStatus.TRAVAUX_PLANIFIES,
  technicienId: techC.id,
  ordresReparation: [
    plannedLine("ro_split", "Tâche scindée midi", techC.id, "bay_general_01", 11, 0, 15, 0, splitSegments),
  ],
});

const dossierUnplanned = createMockDossier({
  id: "NIMR-GANTT-MANUAL",
  clientNom: "Client Démo Gantt Manuel",
  statut: DossierStatus.VEHICULE_RECU,
  ordresReparation: [
    line({ id: "ro_manual", designation: "Tâche manuelle 1h", tempsEstime: 1 }),
  ],
});

const dossierLongSaturday = createMockDossier({
  id: "NIMR-GANTT-SAT-LONG",
  clientNom: "Client Démo Gantt Long",
  statut: DossierStatus.VEHICULE_RECU,
  ordresReparation: [
    line({ id: "ro_long_sat", designation: "Tâche longue samedi 5h", tempsEstime: 5 }),
  ],
});

const seedDossiers: DossierSAV[] = [
  dossierMorning,
  dossierAfternoon,
  dossierSplit,
  dossierUnplanned,
  dossierLongSaturday,
];

async function openPlanning(page: Page) {
  await humanClick(page, page.locator('[data-testid="nav-planning"]'));
  await expect(page.locator('[data-testid="planning-gantt-chart"]')).toBeVisible();
}

async function setPlanningDate(page: Page, date: string) {
  const input = page.locator('[data-testid="planning-date-input"]');
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

async function selectManualBase(page: Page, dossierId = dossierUnplanned.id) {
  await page.locator('[data-testid="planning-manual-dossier"]').selectOption(dossierId);
  await page.locator('[data-testid="planning-manual-task"]').selectOption(
    dossierId === dossierLongSaturday.id ? "ro_long_sat" : "ro_manual"
  );
}

async function selectManualSlot(page: Page, technicianId: string, bayId: string, hour: string, minute = "00") {
  await page.locator('[data-testid="planning-manual-tech"]').selectOption(technicianId);
  await page.locator('[data-testid="planning-manual-bay"]').selectOption(bayId);
  await page.locator('[data-testid="planning-manual-hour"]').selectOption(hour);
  await page.locator('[data-testid="planning-manual-minute"]').selectOption(minute);
}

async function readPercent(locator: ReturnType<Page["locator"]>, prop: "left" | "width"): Promise<number> {
  return locator.evaluate((el, cssProp) => parseFloat((el as HTMLElement).style[cssProp as "left" | "width"]), prop);
}

test.describe("NIMR SAV PRO Lot 4A - Planning Chef Atelier avancé", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ dossierKey, techKey, dossiers, techs }) => {
      localStorage.clear();
      localStorage.setItem(dossierKey, JSON.stringify(dossiers));
      localStorage.setItem(techKey, JSON.stringify(techs));
    }, {
      dossierKey: STORAGE_KEYS.dossiers,
      techKey: STORAGE_KEYS.techs,
      dossiers: seedDossiers,
      techs: [techA, techFree, techB, techC],
    });
    await page.reload();
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanning(page);
    await setPlanningDate(page, PLANNING_DATE);
  });

  test("affiche le Gantt, la grille 08:00-17:00 et la pause 12:00-13:00", async ({ page }) => {
    await expect(page.locator('[data-testid="gantt-hour-08"]')).toBeVisible();
    await expect(page.locator('[data-testid="gantt-hour-12"]')).toBeVisible();
    await expect(page.locator('[data-testid="gantt-hour-17"]')).toBeVisible();
    await expect(page.locator('[data-testid="gantt-lunch-break-shading"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="tech-name-tech_alaa"]')).toContainText("Alaa Ouerteni");
  });

  test("positionne correctement un bloc 09:30-12:00", async ({ page }) => {
    const block = page.locator('[data-testid="gantt-block-ro_morning"]').first();
    await expect(block).toBeVisible();
    await expect(block).toContainText("T5 EVO");
    await expect(block).toContainText("111 TU 1111");

    const left = await readPercent(block, "left");
    const width = await readPercent(block, "width");
    expect(left).toBeGreaterThan(16);
    expect(left).toBeLessThan(17.5);
    expect(width).toBeGreaterThan(27);
    expect(width).toBeLessThan(28.5);
  });

  test("positionne correctement un bloc 14:00-17:00", async ({ page }) => {
    const block = page.locator('[data-testid="gantt-block-ro_afternoon"]').first();
    await expect(block).toBeVisible();

    const left = await readPercent(block, "left");
    const width = await readPercent(block, "width");
    expect(left).toBeGreaterThan(66);
    expect(left).toBeLessThan(67.5);
    expect(width).toBeGreaterThan(33);
    expect(width).toBeLessThan(34.5);
  });

  test("affiche une tâche scindée avant et après la pause déjeuner", async ({ page }) => {
    const splitBlocks = page.locator('[data-testid="gantt-block-ro_split"]');
    await expect(splitBlocks).toHaveCount(2);
    await expect(splitBlocks.nth(0)).toHaveAttribute("data-end", /T11:00:00\.000Z|T12:00:00\.000/);
    await expect(splitBlocks.nth(1)).toHaveAttribute("data-start", /T12:00:00\.000Z|T13:00:00\.000/);
  });

  test("navigation jour précédent, aujourd'hui et jour suivant", async ({ page }) => {
    const dateInput = page.locator('[data-testid="planning-date-input"]');

    await humanClick(page, page.locator('[data-testid="planning-nav-next"]'));
    await expect(dateInput).toHaveValue("2026-06-16");

    await humanClick(page, page.locator('[data-testid="planning-nav-prev"]'));
    await expect(dateInput).toHaveValue(PLANNING_DATE);

    const browserToday = await page.evaluate(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
    await humanClick(page, page.locator('[data-testid="planning-nav-today"]'));
    await expect(dateInput).toHaveValue(browserToday);
  });

  test("suggère le premier technicien libre et le premier pont libre", async ({ page }) => {
    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(dossierUnplanned.id);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));

    await expect(page.locator('[data-testid="planning-suggest-tech"]')).toContainText("Salah");
    await expect(page.locator('[data-testid="planning-suggest-bay"]')).toContainText("Pont rapide 1");
    await expect(page.locator('[data-testid="planning-suggest-start"]')).toContainText("08:00");
  });

  test("détecte une collision technicien", async ({ page }) => {
    await selectManualBase(page);
    await selectManualSlot(page, techA.id, "bay_general_01", "09", "30");
    await expect(page.locator('[data-testid="planning-collision-tech"]')).toBeVisible();
  });

  test("détecte une collision pont", async ({ page }) => {
    await selectManualBase(page);
    await selectManualSlot(page, techFree.id, "bay_fast_01", "09", "30");
    await expect(page.locator('[data-testid="planning-collision-bay"]')).toBeVisible();
  });

  test("accepte le samedi matin", async ({ page }) => {
    await setPlanningDate(page, SATURDAY_DATE);
    await selectManualBase(page);
    await selectManualSlot(page, techFree.id, "bay_general_01", "09", "00");
    await expect(page.locator('[data-testid="planning-collision-saturday-afternoon"]')).toHaveCount(0);
    await humanClick(page, page.locator('[data-testid="planning-manual-submit"]'));
    await expect(page.locator('[data-testid="planning-saved-indicator"]')).toBeVisible();
  });

  test("alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable", async ({ page }) => {
    await setPlanningDate(page, SATURDAY_DATE);
    await selectManualBase(page);
    await selectManualSlot(page, techFree.id, "bay_general_01", "13", "00");
    await expect(page.locator('[data-testid="planning-collision-saturday-afternoon"]')).toBeVisible();

    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(dossierLongSaturday.id);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    const startText = await page.locator('[data-testid="planning-suggest-start"]').textContent();
    expect(startText).toContain("08:00");
    const suggestion = await page.locator('[data-testid="planning-suggest-tech"]').textContent();
    expect(suggestion).toBeTruthy();

    await humanClick(page, page.locator('[data-testid="planning-suggest-apply"]'));
    await page.reload();
    await openPlanning(page);
    await setPlanningDate(page, NEXT_WORKDAY_AFTER_SATURDAY);
    await expect(page.locator('[data-testid="gantt-block-ro_long_sat"]').first()).toBeVisible();
  });

  test("alerte le dimanche fermé", async ({ page }) => {
    await setPlanningDate(page, SUNDAY_DATE);
    await selectManualBase(page);
    await selectManualSlot(page, techFree.id, "bay_general_01", "09", "00");
    await expect(page.locator('[data-testid="planning-collision-sunday"]')).toBeVisible();
  });

  test("persiste une planification après refresh", async ({ page }) => {
    await setPlanningDate(page, "2026-06-16");
    await selectManualBase(page);
    await selectManualSlot(page, techFree.id, "bay_general_01", "09", "00");
    await humanClick(page, page.locator('[data-testid="planning-manual-submit"]'));
    await expect(page.locator('[data-testid="planning-saved-indicator"]')).toBeVisible();

    await page.reload();
    await openPlanning(page);
    await setPlanningDate(page, "2026-06-16");
    await expect(page.locator('[data-testid="gantt-block-ro_manual"]').first()).toBeVisible();
  });

  test("boutons impression Gantt et tableau appellent window.print", async ({ page }) => {
    await page.evaluate(() => {
      const printableWindow = window as Window & { __printCalls?: number };
      printableWindow.__printCalls = 0;
      window.print = () => {
        printableWindow.__printCalls = (printableWindow.__printCalls ?? 0) + 1;
      };
    });

    await humanClick(page, page.locator('[data-testid="planning-print-gantt"]'));
    await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls ?? 0)).toBe(1);

    await humanClick(page, page.locator('[data-testid="planning-print-table"]'));
    await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls ?? 0)).toBe(2);
  });
});
