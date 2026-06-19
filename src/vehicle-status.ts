/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV, DossierStatus } from "./types";
import { canDeliverDossier, normalizeRepairOrderStatus } from "./sav-core";

export interface VehicleGroup {
  key: string;
  vehiculeMarque: string;
  vehiculeModele: string;
  vehiculeImmatriculation: string;
  vehiculeVIN: string;
  clientNom: string;
  clientTelephone: string;
  dossiers: DossierSAV[];
}

/**
 * Returns the vehicle identification key based on priority:
 * 1. VIN / Chassis
 * 2. Immatriculation
 * 3. Marque + Modèle + Client
 * 4. Fallback: dossier.id
 */
export function getVehicleKey(dossier: DossierSAV): string {
  if (dossier.vehiculeVIN && dossier.vehiculeVIN.trim()) {
    return dossier.vehiculeVIN.trim();
  }
  if (dossier.vehiculeImmatriculation && dossier.vehiculeImmatriculation.trim()) {
    return dossier.vehiculeImmatriculation.trim();
  }
  const brand = (dossier.vehiculeMarque || "").trim();
  const model = (dossier.vehiculeModele || "").trim();
  const client = (dossier.clientNom || "").trim();
  if (brand || model || client) {
    return `${brand}_${model}_${client}`;
  }
  return dossier.id;
}

/**
 * Groups dossiers by vehicle. The dossiers list for each vehicle is sorted with the latest reception date first.
 */
export function groupDossiersByVehicle(dossiers: DossierSAV[]): VehicleGroup[] {
  const groups: { [key: string]: DossierSAV[] } = {};

  dossiers.forEach(dossier => {
    const key = getVehicleKey(dossier);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(dossier);
  });

  return Object.keys(groups).map(key => {
    const groupDossiers = groups[key];
    const sortedDossiers = [...groupDossiers].sort((a, b) =>
      new Date(b.dateReception).getTime() - new Date(a.dateReception).getTime()
    );

    const rep = sortedDossiers[0];

    return {
      key,
      vehiculeMarque: rep.vehiculeMarque,
      vehiculeModele: rep.vehiculeModele,
      vehiculeImmatriculation: rep.vehiculeImmatriculation,
      vehiculeVIN: rep.vehiculeVIN,
      clientNom: rep.clientNom,
      clientTelephone: rep.clientTelephone,
      dossiers: sortedDossiers
    };
  });
}

/**
 * Checks if a dossier is considered "open".
 * Un dossier ouvert = dossier non livré, non clôturé, non prêt facturation ERP.
 */
export function isOpenDossier(dossier: DossierSAV): boolean {
  return (
    dossier.statut !== DossierStatus.LIVRE &&
    dossier.statut !== DossierStatus.NON_RETIRE &&
    dossier.statut !== DossierStatus.CLOTURE &&
    dossier.statut !== DossierStatus.PRET_FACTURATION
  );
}

/**
 * Returns the aggregated vehicle status based on its dossiers.
 * Status priority order:
 * 1. Bloqué
 * 2. En cours
 * 3. En pause
 * 4. En attente QC
 * 5. Prêt à livrer
 * 6. Réceptionné / À planifier
 * 7. Prêt facturation ERP
 * 8. Livré
 * 9. Clôturé
 */
export function getVehicleAggregatedStatus(dossiersForVehicle: DossierSAV[]): string {
  if (dossiersForVehicle.length === 0) {
    return "Inconnu";
  }

  const openDossiers = dossiersForVehicle.filter(isOpenDossier);

  // 1. Bloqué si au moins un dossier ouvert est bloqué ou contient une tâche blocked
  const hasBlocked = openDossiers.some(d =>
    d.statut === DossierStatus.BLOQUE ||
    d.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) === "blocked")
  );
  if (hasBlocked) {
    return "Bloqué";
  }

  // 2. En cours si le dossier ou au moins une tâche atelier est en cours.
  const hasInProgress = openDossiers.some(d =>
    d.statut === DossierStatus.EN_TRAVAUX ||
    d.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) === "in_progress")
  );
  if (hasInProgress) {
    return "En cours";
  }

  // 3. En pause si au moins une tâche paused dans les dossiers ouverts
  const hasPaused = openDossiers.some(d =>
    d.ordresReparation.some(line => normalizeRepairOrderStatus(line.status) === "paused")
  );
  if (hasPaused) {
    return "En pause";
  }

  // 4. En attente QC si dossier en contrôle qualité
  const hasQC = openDossiers.some(d => d.statut === DossierStatus.CONTROLE_QUALITE);
  if (hasQC) {
    return "En attente QC";
  }

  // 5. Prêt à livrer si QC accepté + canDeliverDossier(dossier).allowed = true
  const hasReadyToDeliver = openDossiers.some(d =>
    d.checklistQC.validationGlobale === "valide" &&
    canDeliverDossier(d).allowed
  );
  if (hasReadyToDeliver) {
    return "Prêt à livrer";
  }

  // 6. Réceptionné / À planifier si dossier créé sans travaux démarrés
  if (openDossiers.length > 0) {
    return "Réceptionné / À planifier";
  }

  // Si aucun dossier ouvert :
  // 7. Prêt facturation ERP si au moins un est PRET_FACTURATION
  const hasPretFacturation = dossiersForVehicle.some(d => d.statut === DossierStatus.PRET_FACTURATION);
  if (hasPretFacturation) {
    return "Prêt facturation ERP";
  }

  // 8. Livré si tous les dossiers sont livrés
  const allDelivered = dossiersForVehicle.every(d => d.statut === DossierStatus.LIVRE || d.statut === DossierStatus.NON_RETIRE);
  if (allDelivered) {
    return "Livré";
  }

  // 9. Clôturé si au moins un est CLOTURE
  const hasCloture = dossiersForVehicle.some(d => d.statut === DossierStatus.CLOTURE);
  if (hasCloture) {
    return "Clôturé";
  }

  return "Livré";
}

/**
 * Searches and groups dossiers by vehicle.
 */
export function searchVehiclesAndDossiers(dossiers: DossierSAV[], query: string): VehicleGroup[] {
  const allGroups = groupDossiersByVehicle(dossiers);
  if (!query || !query.trim()) {
    return allGroups;
  }

  const q = query.toLowerCase().trim();

  return allGroups.filter(group => {
    const matchGroup =
      group.vehiculeImmatriculation?.toLowerCase().includes(q) ||
      group.vehiculeVIN?.toLowerCase().includes(q) ||
      group.clientNom?.toLowerCase().includes(q) ||
      group.clientTelephone?.toLowerCase().includes(q) ||
      group.vehiculeMarque?.toLowerCase().includes(q) ||
      group.vehiculeModele?.toLowerCase().includes(q);

    if (matchGroup) return true;

    const matchDossier = group.dossiers.some(dossier =>
      dossier.id?.toLowerCase().includes(q) ||
      dossier.deposantNom?.toLowerCase().includes(q) ||
      dossier.deposantTelephone?.toLowerCase().includes(q) ||
      dossier.vehiculeImmatriculation?.toLowerCase().includes(q) ||
      dossier.vehiculeVIN?.toLowerCase().includes(q) ||
      dossier.clientNom?.toLowerCase().includes(q) ||
      dossier.clientTelephone?.toLowerCase().includes(q) ||
      dossier.vehiculeMarque?.toLowerCase().includes(q) ||
      dossier.vehiculeModele?.toLowerCase().includes(q)
    );

    return matchDossier;
  });
}
