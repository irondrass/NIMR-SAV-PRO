# Audit et Migration Ancienne App NIMR SAV

Ce document présente l'audit des fonctionnalités de l'ancienne application `NIMR-SAV` (legacy) afin de préparer leur migration vers `NIMR-SAV-PRO` (Lot 5F-2B).

## Résumé des anciennes fonctions retrouvées

L'audit du code source de l'ancienne application a permis d'identifier plusieurs fichiers clés contenant la logique métier à migrer :
- `estimate-import.js` : Logique d'import, parsing de PDF/CSV/Excel, classification des lignes (MO, pièces, peinture), extraction des heures et calculs des durées estimées.
- `planning.js` : Logique de calcul des durées, recherche de créneaux (RDV), gestion des absences/congés, et états des tâches techniciens.
- `storage.js` : Import/export de la base véhicules, remplissage rapide par VIN/Immatriculation, export des sauvegardes JSON chiffrées/non-chiffrées.
- `exports.js` : Génération de PDF et impression des documents d'atelier (devis, OR, planning journalier).

## Tableau de mapping ancien → nouveau

| Ancien module | Fonction ancienne | Utilité métier | Équivalent NIMR SAV PRO | Action recommandée |
|---|---|---|---|---|
| **Devis / Main-d'œuvre** | `handleEstimateImportFile`, `extractPdfText` | Import devis (PDF/XLSX/CSV) | Aucun (Lot 5F-2B) | À migrer (P0) |
| **Devis / Main-d'œuvre** | `classifyLaborLine`, `extractLaborHours` | Extraction main-d'œuvre (MO) | Aucun (Lot 5F-2B) | À migrer (P0) |
| **Devis / Main-d'œuvre** | `distributeLaborHours`, `splitPlanningHours` | Calcul durées estimées / OR / tâche | Calcul manuel actuel | À migrer (P0) |
| **Devis / Main-d'œuvre** | `buildAppliedEstimateLines` | Compléments de travaux | Aucun | À migrer (P0) |
| **Devis / Main-d'œuvre** | Total atelier (MO + Pièces) | Total chiffré atelier | Calculs UI (à sécuriser) | À migrer (P0) |
| **Planning** | `repairDurationHours`, `getBookingDurationMinutes` | Calcul durée | `calculateSegments` (Gantt) | Déjà couvert / À adapter |
| **Planning** | `findEarliestSlot` | Calcul RDV (Suggérer créneau) | `suggestWorkshopSlot` | Déjà couvert (Lot 5D) |
| **Planning** | `schedulePlannedCasesInterleaved` | Planning global | `WorkshopPlanning.tsx` | Déjà couvert (Lot 4A/5D) |
| **Planning** | `getTechnicianLeaveConflicts` | Absences / congés ressources | Aucun | À migrer (P2) |
| **Planning** | Horaires configurables (Samedi, Dimanche, Pause) | Jours ouvrés / Pause déjeuner | Constantes dans `sav-core.ts` | Déjà couvert / À adapter (P2) |
| **Base véhicules** | `parseVehicleDatabaseFile`, `findVehicleRecordsByVin` | Import base & recherche VIN | `VehicleSearchView.tsx` (Recherche) | À adapter (Import = P1) |
| **Base véhicules** | `findVehicleRecordsByVehicleQuery` | Recherche immatriculation | `searchVehiclesAndDossiers` | Déjà couvert (Lot 5E) |
| **Base véhicules** | `autoFillVehicleFromCurrentFields` | Préremplissage réception | Aucun | À migrer (P1) |
| **Sauvegarde / Export** | `exportBackup`, `downloadJson` | Export JSON avancé | Aucun | À migrer (P3) |
| **Sauvegarde / Export** | `exportEncryptedBackup` | Sauvegarde chiffrée | Aucun | À migrer (P3) |
| **Sauvegarde / Export** | `formatSensitiveActionAuditDetails` | Historique d'activité | Logs basiques UI | À adapter |
| **Cloud** | `supabase-sync.js` | Supabase / Cloud | Aucun | À reporter v2.0.0 |

## Liste des fonctions à migrer en Lot 5F-2B (Priorités)

**Priorité P0 (Critique) :**
- `handleEstimateImportFile` : Import de devis (parsing PDF, Excel, CSV).
- `classifyLaborLine` et `extractLaborHours` : Détection des lignes de main-d'œuvre et pièces.
- `distributeLaborHours` : Calcul des durées estimées (T1, T2, T3) à partir des heures de main-d'œuvre.
- Durées par OR / tâche (Compléments de travaux).
- Total atelier (validation des devis et blocage planning si durée non validée).

**Priorité P1 (Important) :**
- Import de la base des véhicules vendus (historique).
- Préremplissage automatique des données de réception via VIN ou Immatriculation.
- Garantie et affichage du dernier service.

**Priorité P2 (Confort) :**
- Gestion fine des horaires configurables.
- Gestion des absences, congés et jours fériés pour les ressources/techniciens.

**Priorité P3 (Secondaire) :**
- Export JSON avancé.
- Sauvegardes chiffrées locales.

## Liste des fonctions déjà couvertes dans NIMR SAV PRO
- **Calcul RDV (Suggérer meilleur créneau)** : Couvert par `suggestWorkshopSlot` (Lot 5D - exclut le passé).
- **Planning global et charge humaine** : Couvert par le module Gantt Avancé (Lot 4A) et statuts (Lot 5E).
- **Recherche de véhicules et statuts agrégés** : Couvert par `searchVehiclesAndDossiers` (Lot 5E).
- **Blocages de base métier** : Couvert par les garde-fous (Lot 4C).
- **Rôles et permissions** : Couvert par les modules de sécurité et auth locale (Lot 5B / 5C).

## Liste des fonctions à reporter v2.0.0
- Sauvegarde / synchronisation Cloud (Supabase).
- Facturation réelle, caisse, paiement, marge, et gestion de stock pièces (hors périmètre SAV opérationnel).
- Anciens designs (Dark mode legacy) et clés `localStorage` obsolètes.

## Confirmations
- **Lot 6 non commencé** : Confirmé.
- **Aucun tag v1.1.0 créé** : Confirmé.
- **Aucun fichier réel ni donnée client ajouté** : L'audit s'est fait strictement sur le code source de l'application (en lecture seule). Aucun fichier de production n'a été copié.
