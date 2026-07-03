# Audit Terrain - Corrections Rapport (Hotfix 6K-H-C)

Ce document décrit les corrections appliquées pour résoudre les anomalies R-001 à R-004 et R-006, améliorant la robustesse de l'application NIMR SAV PRO avant déploiement.

---

## 1. R-001 / R-002 — Déconnexion KO sur GitHub Pages live

- **ID Anomalie** : R-001 / R-002
- **Problème** : Sur le site live GitHub Pages, cliquer sur "Déconnexion" effaçait localement la session mais le click-propagation global vers `refreshActivity` restaurait immédiatement l'ancienne session en lisant l'ancienne closure d'état, annulant le logout.
- **Correction appliquée** :
  - Ajout de `e.stopPropagation()` sur le bouton de déconnexion.
  - Introduction d'un drapeau persistant `nimr-sav-pro-session-invalidated` dans le `localStorage` positionné à `true` au logout et retiré après un login valide.
  - Modification de `loadStoredSession()` et de `initializeAuth` pour rejeter immédiatement la session si le drapeau d'invalidation est présent.
  - Modification de `refreshActivity` pour bloquer la réhydratation si le drapeau d'invalidation est présent ou si la clé de session est absente de localStorage.
  - Ajout d'un listener `window.storage` pour synchroniser le logout entre plusieurs onglets.
- **Fichiers modifiés** :
  - [src/App.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/App.tsx)
  - [src/components/LoginView.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/components/LoginView.tsx)
- **Tests ajoutés** :
  - `tests/logout-live-session.test.ts`
- **Statut** : Corrigé
- **Risque résiduel** : Aucun. La synchronisation inter-onglets et les verrous localStorage garantissent la déconnexion définitive.

---

## 2. R-003 — Dispatch atelier multi-spécialité par tâche

- **ID Anomalie** : R-003
- **Problème** : L'affectation rapide était mono-compagnon à l'échelle du dossier. Il était impossible de répartir des tâches de spécialités différentes (ex: électricité et peinture) entre différents techniciens.
- **Correction appliquée** :
  - Intégration de menus de sélection individuels par tâche/étape dans l'onglet "Ordres de Travaux & Remplacement Pièces".
  - Filtrage dynamique des compagnons compatibles avec le métier de l'étape (`isTechCompatibleForTask`).
  - Ajout d'un bouton de validation "Affecter" et gestion des avertissements en l'absence de ressources compatibles.
  - Ajout d'un module d'affectation groupée par spécialité ("Affecter toutes les tâches compatibles à ce compagnon") n'écrasant pas les tâches déjà affectées.
  - Intégration d'une boîte de dialogue de confirmation avec saisie obligatoire de motif lors du remplacement d'un technicien déjà affecté.
  - Correction du déclenchement d'affectation groupée : le bouton passe maintenant le compagnon sélectionné et non l'événement de clic React.
  - Compatibilité calculée à partir de `workshopStageId` explicite quand il existe, puis du mapping automatique en secours.
  - Remplacement des alertes navigateur par un feedback applicatif visible et testable.
- **Fichiers modifiés** :
  - [src/components/DossierDetail.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/components/DossierDetail.tsx)
- **Tests ajoutés** :
  - `tests/multi-specialty-dispatch.test.ts`
  - `e2e/44-dispatch-planning-logout-live.spec.ts`
- **Statut** : Corrigé
- **Risque résiduel** : Les utilisateurs doivent être sensibilisés à la saisie de motifs clairs lors du remplacement de compagnons.

---

## 3. R-004 — Planning / réservation actionnable

- **ID Anomalie** : R-004
- **Problème** : La page de planning affichait le statut "À réserver" mais n'offrait pas de boutons d'action visibles pour exécuter la réservation automatique ou la suggestion de créneau en exploitation réelle.
- **Correction appliquée** :
  - Autorisation des rôles `CHEF_ATELIER` et `DIRECTEUR_SAV` à voir et exécuter les actions de planification/réservation.
  - Ajout des boutons "Réserver automatiquement" et "Proposer créneau" directement sur les cartes de besoins du panneau latéral "RÉSERVATIONS ATELIER".
  - Ajout du bouton "Recalculer créneau" sur les cartes déjà en "Créneau proposé", afin de garder la planification actionnable après une absence technicien, une indisponibilité pont ou un changement de date.
  - Affichage d'un bloc de confirmation détaillé après une réservation automatique réussie (technicien, baie, date, heure de début, nouvelle ETA).
- **Fichiers modifiés** :
  - [src/components/WorkshopPlanning.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/components/WorkshopPlanning.tsx)
- **Tests ajoutés** :
  - `tests/planning-actionability.test.ts`
  - `e2e/44-dispatch-planning-logout-live.spec.ts`
- **Statut** : Corrigé
- **Risque résiduel** : Aucun. La réservation respecte strictement les contraintes de disponibilité et de compatibilité.

---

## 4. R-006 — Dette accessibilité / Mobile

- **ID Anomalie** : R-006
- **Problème** : Le bouton de menu mobile manquait de labels descriptifs et d'états d'accessibilité (`aria-label`, `aria-expanded`).
- **Correction appliquée** :
  - Ajout des attributs `aria-label` ("Ouvrir le menu" / "Fermer le menu") et `aria-expanded` (selon l'état d'ouverture) sur le bouton du menu mobile.
- **Fichiers modifiés** :
  - [src/App.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/App.tsx)
- **Tests ajoutés** :
  - `tests/mobile-accessibility.test.ts`
  - `e2e/44-dispatch-planning-logout-live.spec.ts`
- **Statut** : Corrigé
- **Risque résiduel** : Aucun.

---

## 5. Audit Trail logs

- **ID Anomalie** : N/A (Exigence transverse)
- **Correction appliquée** :
  - Enregistrement des événements d'audit suivants :
    - `logout` (auth/deconnexion)
    - `affectation par tâche` (atelier/affectation_par_tache)
    - `affectation en masse compatible` (atelier/affectation_en_masse_compatible)
    - `tentative affectation incompatible` (atelier/tentative_affectation_incompatible)
    - `remplacement compagnon avec motif` (atelier/remplacement_compagnon_avec_motif)
    - `réservation automatique` (planning/reservation_automatique)
    - `proposition créneau` (planning/proposition_creneau)
    - `ETA recalculée` (planning/eta_recalculee)
- **Fichiers modifiés** :
  - [src/components/DossierDetail.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/components/DossierDetail.tsx)
  - [src/components/WorkshopPlanning.tsx](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/components/WorkshopPlanning.tsx)
- **Tests ajoutés** :
  - `tests/audit-trail-dispatch-planning.test.ts`
- **Statut** : Corrigé

---

## 6. PWA / cache / build GitHub Pages

- **Constat** :
  - Aucune référence active à `serviceWorker`, `navigator.serviceWorker` ou Workbox dans le code applicatif.
  - Aucun dossier `public` publié avec `sw.js` ou `manifest.webmanifest`.
  - Aucun manifest actif déclaré par `index.html`.
- **Build vérifié** :
  - `dist/index.html`
  - `dist/assets/index-B_DLbskl.css`
  - `dist/assets/index-BOEJI9g4.js`
- **Décision cache** : Pas de nettoyage service worker à prévoir côté application. Le hash Vite du bundle JS change bien après le hotfix, donc GitHub Pages publiera un asset distinct.
- **Statut** : OK

---

## 7. Validation exécutée

- `npm run lint` : OK
- `npm test` : OK
- `npm run build` : OK, avec l'avertissement Vite habituel sur la taille du chunk JS.
- `npm run qa:agent` : OK, 155 contrôles OK / 0 KO.
- `npx playwright test e2e/44-dispatch-planning-logout-live.spec.ts --reporter=line` : OK, 12 tests.
- E2E ciblés 43 à 31 : OK.
- `npx playwright test e2e/21-workshop-availability.spec.ts --reporter=line` après correction du recalcul : OK, 3 tests.
- `npx playwright test --shard=1/3 --reporter=line` : OK, 201 tests.
- `npx playwright test --shard=2/3 --reporter=line` : OK, 201 tests.
- `npx playwright test --shard=3/3 --reporter=line` : OK, 201 tests.

---

## 8. Décision

- **Décision** : GO push correctif Hotfix 6K-H-C.
- **Motif** : Les anomalies R-001, R-002, R-003, R-004 et R-006 sont couvertes par tests unitaires, QA agent et E2E desktop/mobile/tablette. Aucun tag ni RC n'a été créé.
