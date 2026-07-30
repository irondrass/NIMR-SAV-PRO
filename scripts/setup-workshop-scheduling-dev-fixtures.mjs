import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertSupabaseDevSafety } from "./load-supabase-dev-env.mjs";

const dev = assertSupabaseDevSafety();
const runId = `WS_RECETTE_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}_${randomBytes(3).toString("hex")}`;
const manifestPath = resolve(".backups", "supabase-dev", `workshop-fixtures-${runId}.json`);
const serverHeaders = {
  apikey: dev.serverKey,
  authorization: `Bearer ${dev.serverKey}`,
  "content-type": "application/json",
  prefer: "return=representation",
};
const created = {
  runId,
  manifestPath,
  users: {},
  ids: { userIds: [], workshops: [], teams: [], skillLevels: [], skills: [], employees: [], employeeSkills: [], shifts: [], absences: [], resourceTypes: [], materials: [], resourceAvailability: [], technicianResources: [], clients: [], vehicles: [], dossiers: [], repairLines: [], tasks: [], taskSkills: [], taskResources: [], dependencies: [], parts: [] },
  tests: {},
};

async function persistManifest() {
  await mkdir(resolve(".backups", "supabase-dev"), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(created, null, 2), "utf8");
}

async function api(path, options = {}) {
  const response = await fetch(`${dev.url}${path}`, {
    ...options,
    headers: { ...serverHeaders, ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function insert(table, rows) {
  const body = await api(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify(rows) });
  return Array.isArray(body) ? body : [body];
}

async function createAuthUser(roleKey, label, role) {
  const email = `${runId.toLowerCase()}.${roleKey}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}!A7`;
  const body = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { workshop_run_id: runId, workshop_role: role } }),
  });
  created.users[roleKey] = { id: body.id, email, password, role, label };
  created.ids.userIds.push(body.id);
  await insert("users_profile", [{ id: body.id, full_name: `${label} ${runId}`, email, role, active: true }]);
  await insert("user_roles", [{ user_id: body.id, role, site: runId, active: true }]);
}

function nextWeekday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isoSlot(date, hour) {
  return `${date}T${String(hour).padStart(2, "0")}:00:00+01:00`;
}

async function seedBusinessData() {
  const date = nextWeekday();
  const workshop = (await insert("workshops", [{ code: `${runId}_WORKSHOP`, name: `Workshop ${runId}`, site_code: runId, timezone: "Africa/Tunis", active: true }]))[0];
  created.ids.workshops.push(workshop.id);
  const team = (await insert("teams", [{ workshop_id: workshop.id, code: `${runId}_TEAM`, name: `Equipe ${runId}`, active: true }]))[0];
  created.ids.teams.push(team.id);
  const levels = await insert("skill_levels", [
    { code: `${runId}_JUNIOR`, label: "Junior", rank: 1, active: true },
    { code: `${runId}_AUTONOMOUS`, label: "Autonome", rank: 3, active: true },
    { code: `${runId}_EXPERT`, label: "Expert", rank: 5, active: true },
  ]);
  created.ids.skillLevels.push(...levels.map(item => item.id));
  const skills = await insert("skills", [
    { code: `${runId}_ELECTRIC`, label: "Electricien", active: true },
    { code: `${runId}_QC`, label: "Controle qualite", active: true },
  ]);
  created.ids.skills.push(...skills.map(item => item.id));
  const employees = await insert("employees", ["technicianA", "technicianB"].map((key, index) => ({
    profile_id: created.users[key].id,
    workshop_id: workshop.id,
    team_id: team.id,
    employee_number: `${runId}_TECH_${index ? "B" : "A"}`,
    display_name: `Technicien ${index ? "B" : "A"} ${runId}`,
    job_title: "Electricien",
    active: true,
  })));
  created.ids.employees.push(...employees.map(item => item.id));
  const employeeSkills = await insert("employee_skills", employees.map(employee => ({
    employee_id: employee.id, skill_id: skills[0].id, skill_level_id: levels[2].id,
  })));
  created.ids.employeeSkills.push(...employeeSkills.map(item => item.employee_id));
  const shifts = await insert("employee_shifts", employees.flatMap(employee => [1, 2, 3, 4, 5].map(weekday => ({
    employee_id: employee.id, weekday, valid_from: date, start_time: "08:00", end_time: "17:00",
    break_windows: [{ start: "12:00", end: "13:00" }],
  }))));
  created.ids.shifts.push(...shifts.map(item => item.id));
  const absence = (await insert("employee_absences", [{
    employee_id: employees[1].id, absence_type: "test", starts_at: `${date}T14:00:00+01:00`,
    ends_at: `${date}T15:00:00+01:00`, reason: runId, approved: true,
  }]))[0];
  created.ids.absences.push(absence.id);

  const resourceTypes = await insert("resource_types", [
    { code: `${runId}_BRIDGE`, label: "Pont exclusif", exclusive_by_default: true },
    { code: `${runId}_BAY`, label: "Baie diagnostic", exclusive_by_default: true },
    { code: `${runId}_CASE`, label: "Valise diagnostic", exclusive_by_default: true },
    { code: `${runId}_SHARED2`, label: "Partageable capacite 2", exclusive_by_default: false },
    { code: `${runId}_SHARED1`, label: "Partageable capacite 1", exclusive_by_default: false },
  ]);
  created.ids.resourceTypes.push(...resourceTypes.map(item => item.id));
  const specs = [["bridge", resourceTypes[0].id, false, 1], ["bay", resourceTypes[1].id, false, 1], ["case", resourceTypes[2].id, false, 1], ["shared2", resourceTypes[3].id, true, 2], ["shared1", resourceTypes[4].id, true, 1]];
  const materials = await insert("material_resources", specs.map(([key, typeId, shareable, capacity]) => ({
    workshop_id: workshop.id, code: `${runId}_${key.toUpperCase()}`, name: `${key} ${runId}`, resource_type_id: typeId,
    state: "available", active: true, shareable, simultaneous_capacity: capacity,
  })));
  created.ids.materials.push(...materials.map(item => item.id));
  const availability = await insert("resource_availability", materials.flatMap(resource => [1, 2, 3, 4, 5].map(weekday => ({
    material_resource_id: resource.id, weekday, valid_from: date, start_time: "08:00", end_time: "17:00",
  }))));
  created.ids.resourceAvailability.push(...availability.map(item => item.id));

  const techResources = await insert("technician_resources", [
    { name: `Electricien A ${runId}`, specialty: "electric", active: true },
    { name: `Electricien B ${runId}`, specialty: "electric", active: true },
  ]);
  created.ids.technicianResources.push(...techResources.map(item => item.id));
  const client = (await insert("clients", [{ full_name: `Client recette ${runId}`, email: `${runId.toLowerCase()}@example.test` }]))[0];
  created.ids.clients.push(client.id);
  const vehicles = await insert("vehicles", [
    { vin: `${runId}_VIN_A`, immatriculation: `${runId}_A`, marque: "Test", modele: "A", kilometrage: 1000 },
    { vin: `${runId}_VIN_B`, immatriculation: `${runId}_B`, marque: "Test", modele: "B", kilometrage: 2000 },
  ]);
  created.ids.vehicles.push(...vehicles.map(item => item.id));
  const dossiers = await insert("dossiers", [
    { dossier_number: `${runId}_DOSSIER_A`, client_id: client.id, vehicle_id: vehicles[0].id, status: "in_progress", assigned_site: runId },
    { dossier_number: `${runId}_DOSSIER_B`, client_id: client.id, vehicle_id: vehicles[1].id, status: "in_progress", assigned_site: runId },
  ]);
  created.ids.dossiers.push(...dossiers.map(item => item.id));
  const lines = await insert("repair_order_lines", [
    { dossier_id: dossiers[0].id, label: `${runId} conflict A`, source: "recette", stage: "diagnostic", estimated_hours: 1 },
    { dossier_id: dossiers[1].id, label: `${runId} conflict B`, source: "recette", stage: "diagnostic", estimated_hours: 1 },
    { dossier_id: dossiers[0].id, label: `${runId} shared`, source: "recette", stage: "diagnostic", estimated_hours: 1 },
    { dossier_id: dossiers[1].id, label: `${runId} dependent`, source: "recette", stage: "diagnostic", estimated_hours: 1 },
    { dossier_id: dossiers[0].id, label: `${runId} unavailable`, source: "recette", stage: "diagnostic", estimated_hours: 1 },
  ]);
  created.ids.repairLines.push(...lines.map(item => item.id));
  const tasks = await insert("workshop_tasks", lines.map((line, index) => ({
    dossier_id: line.dossier_id, repair_order_line_id: line.id, stage: "diagnostic", specialty: "electric", status: "pending",
    assigned_resource_id: index % 2 ? techResources[1].id : techResources[0].id,
    estimated_hours: 1, workshop_id: workshop.id, assigned_employee_id: employees[index % 2].id,
    label: line.label, description: runId, priority: 3, planned_duration_minutes: 60, actual_duration_minutes: 0,
    minimum_technicians: 1, maximum_technicians: 1, promised_at: `${date}T17:00:00+01:00`, desired_at: `${date}T16:00:00+01:00`,
  })));
  created.ids.tasks.push(...tasks.map(item => item.id));
  const taskSkills = await insert("task_skill_requirements", tasks.map(task => ({
    task_id: task.id, skill_id: skills[0].id, minimum_skill_level_id: levels[1].id, required: true,
  })));
  created.ids.taskSkills.push(...taskSkills.map(item => item.task_id));
  const taskResources = await insert("task_resource_requirements", tasks.map((task, index) => ({
    task_id: task.id, resource_type_id: resourceTypes[index === 2 ? 3 : 0].id, required: true, quantity: 1,
  })));
  created.ids.taskResources.push(...taskResources.map(item => item.task_id));
  const dependencies = await insert("task_dependencies", [{
    task_id: tasks[3].id, predecessor_task_id: tasks[0].id, dependency_type: "finish_start", required: true, minimum_lag_minutes: 30,
  }]);
  created.ids.dependencies.push(...dependencies.map(item => item.task_id));
  const parts = await insert("task_parts", [{
    task_id: tasks[4].id, part_reference: `${runId}_UNAVAILABLE_PART`, quantity: 1, availability_status: "unavailable",
    required_before_planning: true, required_before_start: true,
  }]);
  created.ids.parts.push(...parts.map(item => item.id));
  created.tests = {
    slot: { start: isoSlot(date, 9), end: isoSlot(date, 10) },
    taskIds: [tasks[0].id, tasks[1].id],
    employeeIds: [employees[0].id],
    materialResourceIds: [materials[0].id],
    rlsCases: [
      { name: "chef voit les employes", email: created.users.chefA.email, password: created.users.chefA.password, path: "employees?select=id", expectedMinRows: 2 },
      { name: "technicien voit sa tache", email: created.users.technicianA.email, password: created.users.technicianA.password, path: `workshop_tasks?select=id&id=eq.${tasks[0].id}`, expectedMinRows: 1, expectedMaxRows: 1 },
      { name: "technicien ne voit pas hors perimetre", email: created.users.technicianA.email, password: created.users.technicianA.password, path: `workshop_tasks?select=id&id=eq.${tasks[1].id}`, expectedMaxRows: 0 },
      { name: "lecture voit les taches", email: created.users.readonly.email, password: created.users.readonly.password, path: "workshop_tasks?select=id", expectedMinRows: 1 },
    ],
  };
  await persistManifest();
}

try {
  await Promise.all([
    createAuthUser("director", "Directeur", "DIRECTEUR_SAV"),
    createAuthUser("chefA", "Chef Atelier A", "CHEF_ATELIER"),
    createAuthUser("chefB", "Chef Atelier B", "CHEF_ATELIER"),
    createAuthUser("reception", "Reception", "RECEPTION"),
    createAuthUser("technicianA", "Technicien A", "TECHNICIEN"),
    createAuthUser("technicianB", "Technicien B", "TECHNICIEN"),
    createAuthUser("qc", "Controle Qualite", "QC"),
    createAuthUser("parts", "Magasin Pieces", "LECTURE"),
    createAuthUser("readonly", "Lecture seule", "LECTURE"),
  ]);
  await persistManifest();
  await seedBusinessData();
  console.log(`fixtures=PASS run_id=${runId}`);
  console.log(`manifest=${manifestPath}`);
} catch (error) {
  await persistManifest();
  console.error(`fixtures=FAIL run_id=${runId}`);
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`manifest=${manifestPath}`);
  process.exitCode = 1;
}
// Fixture setup entrypoint ends here.
