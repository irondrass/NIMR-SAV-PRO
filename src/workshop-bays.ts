/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AtelierZone, WorkshopBay } from "./types";

export const DEFAULT_WORKSHOP_BAYS: WorkshopBay[] = [
  { id: "bay_fast_01", name: "Pont rapide 1", zone: AtelierZone.MECANIQUE_RAPIDE },
  { id: "bay_mech_01", name: "Pont mécanique 1", zone: AtelierZone.GRANDS_TRAVAUX },
  { id: "bay_diag_01", name: "Pont diagnostic 1", zone: AtelierZone.ELECTRICITE_DIAG },
  { id: "bay_body_01", name: "Pont carrosserie 1", zone: AtelierZone.CARROSSERIE },
  { id: "bay_general_01", name: "Pont polyvalent" },
];
