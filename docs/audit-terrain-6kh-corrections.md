# Corrections terrain P0/P1 — Hotfix 6K-H-A

**Date** : 2026-07-02
**Base** : `feaf837`
**Document audit source** : `audit-terrain-nimr-sav-pro-2026-07-02.md`

| ID | Gravité | Problème | Correction appliquée | Fichier modifié | Test ajouté | Statut | Risque résiduel |
|---|---|---|---|---|---|---|---|
| A-001 | P0 | QC conforme avec tâches ouvertes | Interdiction centrale `submitQualityControl` si tâches atelier ouvertes, erreurs capturées côté QC et détail dossier | `src/sav-core.ts`, `src/components/ControleQualiteView.tsx`, `src/components/DossierDetail.tsx` | `tests/qc-delivery-readiness-terrain.test.ts`, `e2e/43-terrain-p0-p1-corrections.spec.ts` | ✅ Corrigé | Aucun |
| A-002 | P0 | Livraison liste faux prêts | Partition prêts/bloqués avec `getDeliveryReadiness` et liste bloqués visible | `src/components/LivraisonView.tsx` | `tests/qc-delivery-readiness-terrain.test.ts`, `e2e/43-terrain-p0-p1-corrections.spec.ts` | ✅ Corrigé | Aucun |
| A-003 | P1 | Base propre sans ressources | Panneau configuration ressources atelier et exclusion des ressources inactives/absentes | `src/components/WorkshopPlanning.tsx`, `src/sav-core.ts`, `src/workshop-reservations.ts`, `src/types.ts` | `tests/runtime-resource-setup.test.ts`, `e2e/43-terrain-p0-p1-corrections.spec.ts` | ✅ Corrigé | Aucun |
| A-004 | P1 | Mobile inutilisable | Sidebar drawer responsive, top bar mobile | `src/App.tsx` | `tests/mobile-layout-terrain.test.ts` | ✅ Corrigé | Viewports extrêmes non testés |
| A-005 | P1 | Déconnexion inerte | Logout supprime session, retour login immédiat | `src/App.tsx` | `tests/logout-role-switch.test.ts` | ✅ Corrigé | Aucun |
| A-006 | P1 | Import devis mapping contradictoire | Allocations old-app conservées, géométrie/faisceau routés vers mécanique/électrique, preview cohérente avec tâches créées | `src/core/old-app-quote-rules.ts`, `src/quote-import.ts`, `src/components/QuoteImportModal.tsx` | `tests/import-mapping-consistency.test.ts`, `tests/quote-stage-mapping-parity.test.ts` | ✅ Corrigé | Aucun |
| A-007 | P1 | QC forfaitaire comme tâche atelier | `isQualityControlLine` filtre l'import atelier, l'intake et l'historique MO | `src/quote-import.ts`, `src/workshop-task-intake.ts` | `tests/import-mapping-consistency.test.ts`, `e2e/43-terrain-p0-p1-corrections.spec.ts` | ✅ Corrigé | Aucun |
| A-014 | P1 | Messages livraison imprécis | Messages détaillés par statut dans `getDeliveryReadiness` | `src/sav-core.ts` | `tests/qc-delivery-readiness-terrain.test.ts` | ✅ Corrigé | Aucun |
| A-011 | P1 | Placeholders démo réception | Placeholder VIN neutre, kilométrage vide obligatoire au passage d'étape et à la soumission finale | `src/components/GuidedReception.tsx` | `e2e/43-terrain-p0-p1-corrections.spec.ts` | ✅ Corrigé | Aucun |
