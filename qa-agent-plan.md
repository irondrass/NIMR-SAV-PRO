# Plan de Test & Stratégie QA - NIMR SAV PRO v1.0.2

Ce document décrit la stratégie de test d'assurance qualité (QA) automatisée mise en œuvre pour NIMR SAV PRO v1.0.2, axée sur la simulation réaliste de comportements d'utilisateurs métiers par rôle (Human-like QA Testing).

---

## 1. Philosophie & Approche des Tests

Les tests ne sont pas conçus comme des validations techniques froides d'API ou de structures de composants, mais simulent des **workflows opérationnels réels** sur le terrain (tablette de réceptionnaire, console chef d'atelier, terminal technicien) :
- **Attentes réalistes (`humanWait`)** : Simulation de délais humains lors de la saisie des formulaires et de la transition d'écrans pour éviter la fragilité des tests sans introduire de lenteurs aléatoires indésirables.
- **Vérifications de permissions strictes** : Validation que les boutons d'édition ou de forçage de statut ne sont visibles et cliquables que pour les rôles disposant de l'habilitation adéquate.
- **Comportements négatifs** : Tentatives volontaires d'action interdite (ex. livrer un véhicule sans QC, valider un QC sans checklist complète, démarrer deux tâches en parallèle pour un même technicien).

---

## 2. Architecture des Tests E2E Playwright

La suite E2E est structurée dans le répertoire [e2e/](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/e2e) comme suit :

- **[helpers/human-actions.ts](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/e2e/helpers/human-actions.ts)** : Fonctions helper pour interagir avec le DOM (clic, saisie, sélection, navigation) en simulant la latence humaine, et assertions de sécurité (console d'erreur, assets 404, propreté localStorage).
- **[helpers/test-data-creator.ts](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/e2e/helpers/test-data-creator.ts)** : Générateur de structures de données valides (dossiers, techniciens) pour initialiser des scénarios reproductibles à chaud.
- **[helpers/defect-reporter.ts](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/e2e/helpers/defect-reporter.ts)** : Reporter personnalisé qui génère en continu le rapport d'anomalies [qa-report.md](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/qa-report.md) lors d'un échec de test.
- **[00-smoke-and-safety.spec.ts](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/e2e/00-smoke-and-safety.spec.ts)** : Test fumée de base assurant le chargement global de l'app, le routage et l'absence d'erreurs de console ou de chargement d'assets.
- **Scénarios par rôles (`e2e/roles/`)** :
  - `01-directeur.spec.ts` : Habilitation globale, forçage de statuts et réouverture de tâche avec motif obligatoire.
  - `02-receptionnaire.spec.ts` : Réception guidée, validation des formulaires et blocages de champs requis.
  - `03-chef-atelier.spec.ts` : Visualisation de charge, suggestion et application de créneau intelligent.
  - `04-technicien.spec.ts` : Cycle de vie d'une tâche, verrouillage d'une seule tâche en cours, blocage de réouverture.
  - `05-controle-qualite.spec.ts` : Complétion requise de checklist, motif obligatoire sur refus.
  - `06-livraison.spec.ts` : Blocage si QC manquant, signature client, confirmation et facturation ERP.
  - `07-lecture-seule.spec.ts` : Désactivation ou masquage de l'ensemble des éléments modificateurs ou boutons d'action.
- **Scénarios fonctionnels croisés (`e2e/`)** :
  - `08-import-export-strict.spec.ts` : Validation stricte du format JSON d'importation sans corruption de base active.
  - `09-photos.spec.ts` : Persistance d'images encodées en base64 dans le flux de preuves photos.
  - `10-planning-strict.spec.ts` : Charge de travail Gantt calculée à la volée.
  - `11-persistence.spec.ts` : Préservation de l'état applicatif après refresh navigateur.

---

## 3. Gestion des Données de Test (Fixtures)

Chaque test Playwright s'exécute de manière isolée en injectant son propre jeu de données factice directement dans le `localStorage` de la page à l'aide de `page.evaluate()` avant chaque test. 
Cela évite de dépendre d'une base de données distante ou d'un état persistant instable.

Le cache applicatif pour la v1.0.2 utilise l'espace de nom isolé :
- Clé préfixe : `nimr-sav-pro` (défini dans [src/storage-keys.ts](file:///c:/Users/mhadh/antigravity/NIMR-SAV-PRO/src/storage-keys.ts))

---

## 4. Guide d'Exécution des Tests

### En local

Pour lancer l'application en mode développement :
```bash
npm run dev
```

Pour compiler le build de production et lancer le serveur de test local :
```bash
npm run build
npm run preview
```

Pour exécuter tous les tests E2E avec Playwright en arrière-plan :
```bash
npm run test:e2e
```

Pour ouvrir le gestionnaire de tests interactif de Playwright UI :
```bash
npx playwright test --ui
```

### Intégration Continue (GitHub Actions)

À chaque push ou pull request sur la branche `main`, le workflow `.github/workflows/e2e.yml` est déclenché pour :
1. Installer les dépendances NPM.
2. Installer les binaires Chromium nécessaires à Playwright.
3. Lancer le serveur local et exécuter les tests E2E.
4. Archiver les rapports Playwright (`playwright-report/`), les résultats de traces de plantages (`test-results/`) et le rapport de défauts généré (`qa-report.md`).
