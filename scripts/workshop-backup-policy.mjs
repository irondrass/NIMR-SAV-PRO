export function decideWorkshopBackup({
  dockerAvailable,
  environment,
  productionExists,
  userDataRows,
  workshopMigrationApplied,
}) {
  if (workshopMigrationApplied) return { mode: "applied_tracked" };
  if (dockerAvailable) return { mode: "dump" };
  if (environment !== "development") {
    throw new Error("NO GO: Docker unavailable outside the DEV environment.");
  }
  if (productionExists !== "NO") {
    throw new Error("NO GO: SUPABASE_PRODUCTION_EXISTS must be exactly NO when Docker is unavailable.");
  }
  if (userDataRows > 0) {
    throw new Error("NO GO: Docker unavailable and the DEV database contains user data; backup is required.");
  }
  return { mode: "skip", report: "backup=SKIPPED_DOCKER_UNAVAILABLE_EMPTY_DEV" };
}
