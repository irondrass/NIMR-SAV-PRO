# Rapport de Défauts Automatiques QA - NIMR SAV PRO v1.1.1

Ce rapport répertorie tous les défauts fonctionnels et techniques détectés lors des tests d'intégration E2E.

| Date / Heure | Scénario / Test | Rôle | Gravité | Statut | Détails |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 01/07/2026 14:27:50 | **alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable** (10-planning-strict.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="gantt-block-ro_long_sat"]').... |

## Détail Échec : alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable
* **Fichier :** `10-planning-strict.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="gantt-block-ro_long_sat"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="gantt-block-ro_long_sat"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\10-planning-strict.spec.ts:462:83
```
* **Capture d'écran :** [Voir capture](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-chromium-desktop\video.webm)

---
| 01/07/2026 14:28:16 | **Conservation des modifications de dossier après rafraîchissement complet** (11-persistence.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-card-"]').filter({ has... |

## Détail Échec : Conservation des modifications de dossier après rafraîchissement complet
* **Fichier :** `11-persistence.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\11-persistence.spec.ts:59:28
```
* **Capture d'écran :** [Voir capture](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-chromium-desktop\video.webm)

---
| 01/07/2026 14:29:36 | **19-01 bouton Importer devis/MO visible pour Chef Atelier** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-01 bouton Importer devis/MO visible pour Chef Atelier
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:127:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-chromium-desktop\video.webm)

---
| 01/07/2026 14:29:45 | **19-02 bouton Importer devis/MO visible pour Directeur SAV** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-02 bouton Importer devis/MO visible pour Directeur SAV
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:141:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-chromium-desktop\video.webm)

---
| 01/07/2026 14:29:55 | **19-03 nouveau-task-submit désactivé si description vide** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="new-task-submit"]') Expecte... |

## Détail Échec : 19-03 nouveau-task-submit désactivé si description vide
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="new-task-submit"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="new-task-submit"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:155:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:06 | **19-04 ajouter ligne manuelle crée une tâche à estimer** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m ... |

## Détail Échec : 19-04 ajouter ligne manuelle crée une tâche à estimer
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m

    at humanFill (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:17:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:168:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:16 | **19-05 modal import devis s'ouvre et se ferme** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-05 modal import devis s'ouvre et se ferme
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:194:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:27 | **19-06 analyse devis fictif — MO et pièces détectées** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-06 analyse devis fictif — MO et pièces détectées
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:215:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:37 | **19-07 pièces non cochées par défaut dans la prévisualisation** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-07 pièces non cochées par défaut dans la prévisualisation
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:247:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:46 | **19-08 confirmer import crée les tâches MO dans les ordres de travaux** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-08 confirmer import crée les tâches MO dans les ordres de travaux
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:274:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-chromium-desktop\video.webm)

---
| 01/07/2026 14:30:56 | **19-09 aucun champ prix ou paiement visible dans l'interface import** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-09 aucun champ prix ou paiement visible dans l'interface import
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:307:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-chromium-desktop\video.webm)

---
| 01/07/2026 14:31:06 | **19-10 badge 'Durée à valider' visible sur tâche preset** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-duration-preset-badge-... |

## Détail Échec : 19-10 badge 'Durée à valider' visible sur tâche preset
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-duration-preset-badge-"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-duration-preset-badge-"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:341:31
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-chromium-desktop\video.webm)

---
| 01/07/2026 14:31:17 | **19-12 aucun crash React lors de l'ouverture et fermeture du modal** (19-quote-import.spec.ts) | Inconnu | **MAJEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-12 aucun crash React lors de l'ouverture et fermeture du modal
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MAJEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:371:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-chromium-desktop\video.webm)

---
| 01/07/2026 14:31:28 | **19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:405:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-chromium-desktop\video.webm)

---
| 01/07/2026 14:31:38 | **19-14 noms propres des tâches — aucun prix ni code admin dans les libellés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-14 noms propres des tâches — aucun prix ni code admin dans les libellés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:455:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-chromium-desktop\video.webm)

---
| 01/07/2026 14:31:48 | **19-15 devis multi-pages 1076 & validation duree 0h** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-15 devis multi-pages 1076 & validation duree 0h
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:529:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-chromium-desktop\video.webm)

---
| 01/07/2026 14:33:07 | **DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visibl... |

## Détail Échec : DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:91:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-chromium-desktop\video.webm)

---
| 01/07/2026 14:33:17 | **Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible... |

## Détail Échec : Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:122:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-chromium-desktop\video.webm)

---
| 01/07/2026 14:34:30 | **7. Planning modification recalculates ETA correctly** (31-auto-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : 7. Planning modification recalculates ETA correctly
* **Fichier :** `31-auto-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-chromium-desktop\video.webm)

---
| 01/07/2026 14:34:45 | **Chef Atelier suggère, reçoit un feedback puis réserve le créneau** (32-planning-suggestion-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Chef Atelier suggère, reçoit un feedback puis réserve le créneau
* **Fichier :** `32-planning-suggestion-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\32-planning-suggestion-reservation.spec.ts:85:77
```
* **Capture d'écran :** [Voir capture](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-chromium-desktop\video.webm)

---
| 01/07/2026 14:35:45 | **chef atelier imprime la fiche technicien avec signatures** (35-print-documents.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible... |

## Détail Échec : chef atelier imprime la fiche technicien avec signatures
* **Fichier :** `35-print-documents.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\35-print-documents.spec.ts:190:11
```
* **Capture d'écran :** [Voir capture](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-chromium-desktop\video.webm)

---
| 01/07/2026 14:36:16 | **2. Double clic réservation planning ne crée pas deux réservations** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : 2. Double clic réservation planning ne crée pas deux réservations
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:175:77
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-chromium-desktop\video.webm)

---
| 01/07/2026 14:36:29 | **5. Modification atelier après QC invalide QC et ajoute audit trail** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visib... |

## Détail Échec : 5. Modification atelier après QC invalide QC et ajoute audit trail
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:231:11
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-chromium-desktop\video.webm)

---
| 01/07/2026 14:37:52 | **une tâche réservée doit être libérée avant suppression physique** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche réservée doit être libérée avant suppression physique
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-chromium-desktop\video.webm)

---
| 01/07/2026 14:38:27 | **une tâche terminée s'annule administrativement et invalide le QC conforme** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche terminée s'annule administrativement et invalide le QC conforme
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-chromium-desktop\video.webm)

---
| 01/07/2026 14:38:42 | **Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours** (42-old-app-stage-editor-and-assignment-parity.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="stage-editor-container"]') E... |

## Détail Échec : Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours
* **Fichier :** `42-old-app-stage-editor-and-assignment-parity.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="stage-editor-container"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="stage-editor-container"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\42-old-app-stage-editor-and-assignment-parity.spec.ts:53:74
```
* **Capture d'écran :** [Voir capture](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-chromium-desktop\video.webm)

---
| 01/07/2026 14:38:56 | **Levée de blocage avec motif obligatoire avant reprise** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-start-ro_dir_blocked"]... |

## Détail Échec : Levée de blocage avec motif obligatoire avant reprise
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-start-ro_dir_blocked"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-start-ro_dir_blocked"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:80:28
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-chromium-desktop\video.webm)

---
| 01/07/2026 14:39:05 | **Réouverture d'une tâche terminée avec motif obligatoire** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-reopen-ro_dir_1"]') Exp... |

## Détail Échec : Réouverture d'une tâche terminée avec motif obligatoire
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-reopen-ro_dir_1"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-reopen-ro_dir_1"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:106:29
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-chromium-desktop\video.webm)

---
| 01/07/2026 14:39:29 | **Calcul de suggestion de planification et application** (03-chef-atelier.spec.ts) | Chef d’atelier | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Calcul de suggestion de planification et application
* **Fichier :** `03-chef-atelier.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès"[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\03-chef-atelier.spec.ts:84:77
```
* **Capture d'écran :** [Voir capture](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-chromium-desktop\video.webm)

---
| 01/07/2026 14:40:14 | **Consultation autorisée mais toutes actions interdites / cachées** (07-lecture-seule.spec.ts) | Lecture seule | **BLOQUANT** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22... |

## Détail Échec : Consultation autorisée mais toutes actions interdites / cachées
* **Fichier :** `07-lecture-seule.spec.ts`
* **Gravité :** `BLOQUANT`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\07-lecture-seule.spec.ts:55:11
```
* **Capture d'écran :** [Voir capture](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-chromium-desktop\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-chromium-desktop\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-chromium-desktop\video.webm)

---
| 01/07/2026 14:40:58 | **alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable** (10-planning-strict.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="gantt-block-ro_long_sat"]').... |

## Détail Échec : alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable
* **Fichier :** `10-planning-strict.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="gantt-block-ro_long_sat"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="gantt-block-ro_long_sat"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\10-planning-strict.spec.ts:462:83
```
* **Capture d'écran :** [Voir capture](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-mobile-chrome\video.webm)

---
| 01/07/2026 14:41:24 | **Conservation des modifications de dossier après rafraîchissement complet** (11-persistence.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-card-"]').filter({ has... |

## Détail Échec : Conservation des modifications de dossier après rafraîchissement complet
* **Fichier :** `11-persistence.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\11-persistence.spec.ts:59:28
```
* **Capture d'écran :** [Voir capture](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-mobile-chrome\video.webm)

---
| 01/07/2026 14:42:40 | **19-01 bouton Importer devis/MO visible pour Chef Atelier** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-01 bouton Importer devis/MO visible pour Chef Atelier
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:127:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-mobile-chrome\video.webm)

---
| 01/07/2026 14:42:50 | **19-02 bouton Importer devis/MO visible pour Directeur SAV** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-02 bouton Importer devis/MO visible pour Directeur SAV
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:141:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-mobile-chrome\video.webm)

---
| 01/07/2026 14:42:59 | **19-03 nouveau-task-submit désactivé si description vide** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="new-task-submit"]') Expecte... |

## Détail Échec : 19-03 nouveau-task-submit désactivé si description vide
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="new-task-submit"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="new-task-submit"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:155:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-mobile-chrome\video.webm)

---
| 01/07/2026 14:43:11 | **19-04 ajouter ligne manuelle crée une tâche à estimer** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m ... |

## Détail Échec : 19-04 ajouter ligne manuelle crée une tâche à estimer
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m

    at humanFill (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:17:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:168:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-mobile-chrome\video.webm)

---
| 01/07/2026 14:43:20 | **19-05 modal import devis s'ouvre et se ferme** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-05 modal import devis s'ouvre et se ferme
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:194:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-mobile-chrome\video.webm)

---
| 01/07/2026 14:43:30 | **19-06 analyse devis fictif — MO et pièces détectées** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-06 analyse devis fictif — MO et pièces détectées
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:215:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-mobile-chrome\video.webm)

---
| 01/07/2026 14:43:40 | **19-07 pièces non cochées par défaut dans la prévisualisation** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-07 pièces non cochées par défaut dans la prévisualisation
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:247:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-mobile-chrome\video.webm)

---
| 01/07/2026 14:43:49 | **19-08 confirmer import crée les tâches MO dans les ordres de travaux** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-08 confirmer import crée les tâches MO dans les ordres de travaux
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:274:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:00 | **19-09 aucun champ prix ou paiement visible dans l'interface import** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-09 aucun champ prix ou paiement visible dans l'interface import
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:307:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:10 | **19-10 badge 'Durée à valider' visible sur tâche preset** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-duration-preset-badge-... |

## Détail Échec : 19-10 badge 'Durée à valider' visible sur tâche preset
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-duration-preset-badge-"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-duration-preset-badge-"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:341:31
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:22 | **19-12 aucun crash React lors de l'ouverture et fermeture du modal** (19-quote-import.spec.ts) | Inconnu | **MAJEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-12 aucun crash React lors de l'ouverture et fermeture du modal
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MAJEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:371:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:32 | **19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:405:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:42 | **19-14 noms propres des tâches — aucun prix ni code admin dans les libellés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-14 noms propres des tâches — aucun prix ni code admin dans les libellés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:455:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-mobile-chrome\video.webm)

---
| 01/07/2026 14:44:51 | **19-15 devis multi-pages 1076 & validation duree 0h** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-15 devis multi-pages 1076 & validation duree 0h
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:529:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-mobile-chrome\video.webm)

---
| 01/07/2026 14:46:08 | **DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visibl... |

## Détail Échec : DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:91:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-mobile-chrome\video.webm)

---
| 01/07/2026 14:46:16 | **Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible... |

## Détail Échec : Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:122:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-mobile-chrome\video.webm)

---
| 01/07/2026 14:47:26 | **7. Planning modification recalculates ETA correctly** (31-auto-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : 7. Planning modification recalculates ETA correctly
* **Fichier :** `31-auto-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-mobile-chrome\video.webm)

---
| 01/07/2026 14:47:40 | **Chef Atelier suggère, reçoit un feedback puis réserve le créneau** (32-planning-suggestion-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Chef Atelier suggère, reçoit un feedback puis réserve le créneau
* **Fichier :** `32-planning-suggestion-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\32-planning-suggestion-reservation.spec.ts:85:77
```
* **Capture d'écran :** [Voir capture](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-mobile-chrome\video.webm)

---
| 01/07/2026 14:48:37 | **chef atelier imprime la fiche technicien avec signatures** (35-print-documents.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible... |

## Détail Échec : chef atelier imprime la fiche technicien avec signatures
* **Fichier :** `35-print-documents.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\35-print-documents.spec.ts:190:11
```
* **Capture d'écran :** [Voir capture](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-mobile-chrome\video.webm)

---
| 01/07/2026 14:49:08 | **2. Double clic réservation planning ne crée pas deux réservations** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : 2. Double clic réservation planning ne crée pas deux réservations
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:175:77
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-mobile-chrome\video.webm)

---
| 01/07/2026 14:49:20 | **5. Modification atelier après QC invalide QC et ajoute audit trail** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visib... |

## Détail Échec : 5. Modification atelier après QC invalide QC et ajoute audit trail
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:231:11
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-mobile-chrome\video.webm)

---
| 01/07/2026 14:50:40 | **une tâche réservée doit être libérée avant suppression physique** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche réservée doit être libérée avant suppression physique
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-mobile-chrome\video.webm)

---
| 01/07/2026 14:51:13 | **une tâche terminée s'annule administrativement et invalide le QC conforme** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche terminée s'annule administrativement et invalide le QC conforme
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-mobile-chrome\video.webm)

---
| 01/07/2026 14:51:27 | **Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours** (42-old-app-stage-editor-and-assignment-parity.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="stage-editor-container"]') E... |

## Détail Échec : Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours
* **Fichier :** `42-old-app-stage-editor-and-assignment-parity.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="stage-editor-container"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="stage-editor-container"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\42-old-app-stage-editor-and-assignment-parity.spec.ts:53:74
```
* **Capture d'écran :** [Voir capture](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-mobile-chrome\video.webm)

---
| 01/07/2026 14:51:41 | **Levée de blocage avec motif obligatoire avant reprise** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-start-ro_dir_blocked"]... |

## Détail Échec : Levée de blocage avec motif obligatoire avant reprise
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-start-ro_dir_blocked"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-start-ro_dir_blocked"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:80:28
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-mobile-chrome\video.webm)

---
| 01/07/2026 14:51:50 | **Réouverture d'une tâche terminée avec motif obligatoire** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-reopen-ro_dir_1"]') Exp... |

## Détail Échec : Réouverture d'une tâche terminée avec motif obligatoire
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-reopen-ro_dir_1"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-reopen-ro_dir_1"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:106:29
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-mobile-chrome\video.webm)

---
| 01/07/2026 14:52:13 | **Calcul de suggestion de planification et application** (03-chef-atelier.spec.ts) | Chef d’atelier | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Calcul de suggestion de planification et application
* **Fichier :** `03-chef-atelier.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès"[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\03-chef-atelier.spec.ts:84:77
```
* **Capture d'écran :** [Voir capture](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-mobile-chrome\video.webm)

---
| 01/07/2026 14:52:56 | **Consultation autorisée mais toutes actions interdites / cachées** (07-lecture-seule.spec.ts) | Lecture seule | **BLOQUANT** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22... |

## Détail Échec : Consultation autorisée mais toutes actions interdites / cachées
* **Fichier :** `07-lecture-seule.spec.ts`
* **Gravité :** `BLOQUANT`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\07-lecture-seule.spec.ts:55:11
```
* **Capture d'écran :** [Voir capture](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-mobile-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-mobile-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-mobile-chrome\video.webm)

---
| 01/07/2026 14:53:39 | **alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable** (10-planning-strict.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="gantt-block-ro_long_sat"]').... |

## Détail Échec : alerte samedi après-midi et reporte une suggestion longue au prochain jour ouvrable
* **Fichier :** `10-planning-strict.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="gantt-block-ro_long_sat"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="gantt-block-ro_long_sat"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\10-planning-strict.spec.ts:462:83
```
* **Capture d'écran :** [Voir capture](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\10-planning-strict-NIMR-SA-ad7df-e-au-prochain-jour-ouvrable-tablet-chrome\video.webm)

---
| 01/07/2026 14:54:05 | **Conservation des modifications de dossier après rafraîchissement complet** (11-persistence.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-card-"]').filter({ has... |

## Détail Échec : Conservation des modifications de dossier après rafraîchissement complet
* **Fichier :** `11-persistence.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-card-"]').filter({ hasText: 'Vidange boîte pont' })[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\11-persistence.spec.ts:59:28
```
* **Capture d'écran :** [Voir capture](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\11-persistence-Persistance-47b3a-ès-rafraîchissement-complet-tablet-chrome\video.webm)

---
| 01/07/2026 14:55:26 | **19-01 bouton Importer devis/MO visible pour Chef Atelier** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-01 bouton Importer devis/MO visible pour Chef Atelier
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:127:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cf0b0-O-visible-pour-Chef-Atelier-tablet-chrome\video.webm)

---
| 01/07/2026 14:55:40 | **19-02 bouton Importer devis/MO visible pour Directeur SAV** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="quote-import-button"]') Expe... |

## Détail Échec : 19-02 bouton Importer devis/MO visible pour Directeur SAV
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="quote-import-button"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="quote-import-button"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:141:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-9dd7e--visible-pour-Directeur-SAV-tablet-chrome\video.webm)

---
| 01/07/2026 14:55:50 | **19-03 nouveau-task-submit désactivé si description vide** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="new-task-submit"]') Expecte... |

## Détail Échec : 19-03 nouveau-task-submit désactivé si description vide
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="new-task-submit"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="new-task-submit"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:155:29
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-16664-sactivé-si-description-vide-tablet-chrome\video.webm)

---
| 01/07/2026 14:55:59 | **19-04 ajouter ligne manuelle crée une tâche à estimer** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m ... |

## Détail Échec : 19-04 ajouter ligne manuelle crée une tâche à estimer
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="new-task-desc"]') to be visible[22m

    at humanFill (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:17:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:168:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f8d51-le-crée-une-tâche-à-estimer-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:09 | **19-05 modal import devis s'ouvre et se ferme** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-05 modal import devis s'ouvre et se ferme
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:194:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-81b7a-t-devis-s-ouvre-et-se-ferme-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:19 | **19-06 analyse devis fictif — MO et pièces détectées** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-06 analyse devis fictif — MO et pièces détectées
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:215:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-8c144-if-—-MO-et-pièces-détectées-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:28 | **19-07 pièces non cochées par défaut dans la prévisualisation** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-07 pièces non cochées par défaut dans la prévisualisation
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:247:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-5210a-ut-dans-la-prévisualisation-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:38 | **19-08 confirmer import crée les tâches MO dans les ordres de travaux** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-08 confirmer import crée les tâches MO dans les ordres de travaux
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:274:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-36615--dans-les-ordres-de-travaux-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:48 | **19-09 aucun champ prix ou paiement visible dans l'interface import** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-09 aucun champ prix ou paiement visible dans l'interface import
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:307:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-b7056-ble-dans-l-interface-import-tablet-chrome\video.webm)

---
| 01/07/2026 14:56:57 | **19-10 badge 'Durée à valider' visible sur tâche preset** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid^="task-duration-preset-badge-... |

## Détail Échec : 19-10 badge 'Durée à valider' visible sur tâche preset
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid^="task-duration-preset-badge-"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid^="task-duration-preset-badge-"]').first()[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:341:31
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-1b19f-er-visible-sur-tâche-preset-tablet-chrome\video.webm)

---
| 01/07/2026 14:57:09 | **19-12 aucun crash React lors de l'ouverture et fermeture du modal** (19-quote-import.spec.ts) | Inconnu | **MAJEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-12 aucun crash React lors de l'ouverture et fermeture du modal
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MAJEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:371:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-f3bc2-rture-et-fermeture-du-modal-tablet-chrome\video.webm)

---
| 01/07/2026 14:57:18 | **19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:405:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-cfdab-CLT-COMET-LUXURY-non-cochés-tablet-chrome\video.webm)

---
| 01/07/2026 14:57:28 | **19-14 noms propres des tâches — aucun prix ni code admin dans les libellés** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-14 noms propres des tâches — aucun prix ni code admin dans les libellés
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:455:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-d69b3-ode-admin-dans-les-libellés-tablet-chrome\video.webm)

---
| 01/07/2026 14:57:38 | **19-15 devis multi-pages 1076 & validation duree 0h** (19-quote-import.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22... |

## Détail Échec : 19-15 devis multi-pages 1076 & validation duree 0h
* **Fichier :** `19-quote-import.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quote-import-button"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\19-quote-import.spec.ts:529:11
```
* **Capture d'écran :** [Voir capture](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\19-quote-import-Lot-5F-3-—-7a1f7-es-1076-validation-duree-0h-tablet-chrome\video.webm)

---
| 01/07/2026 14:58:55 | **DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visibl... |

## Détail Échec : DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-finish-ro_6f_detail"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:91:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-bf2a1-tic-structuré-avant-clôture-tablet-chrome\video.webm)

---
| 01/07/2026 14:59:03 | **Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce** (29-post-rc-audit-fixes.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible... |

## Détail Échec : Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce
* **Fichier :** `29-post-rc-audit-fixes.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-block-ro_6f_block"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\29-post-rc-audit-fixes.spec.ts:122:11
```
* **Capture d'écran :** [Voir capture](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\29-post-rc-audit-fixes-Lot-75688-onte-l-alerte-attente-pièce-tablet-chrome\video.webm)

---
| 01/07/2026 15:00:14 | **7. Planning modification recalculates ETA correctly** (31-auto-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : 7. Planning modification recalculates ETA correctly
* **Fichier :** `31-auto-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\31-auto-reservation-Lot-6K-0172d--recalculates-ETA-correctly-tablet-chrome\video.webm)

---
| 01/07/2026 15:00:29 | **Chef Atelier suggère, reçoit un feedback puis réserve le créneau** (32-planning-suggestion-reservation.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Chef Atelier suggère, reçoit un feedback puis réserve le créneau
* **Fichier :** `32-planning-suggestion-reservation.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\32-planning-suggestion-reservation.spec.ts:85:77
```
* **Capture d'écran :** [Voir capture](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\32-planning-suggestion-res-86011-ack-puis-réserve-le-créneau-tablet-chrome\video.webm)

---
| 01/07/2026 15:01:26 | **chef atelier imprime la fiche technicien avec signatures** (35-print-documents.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible... |

## Détail Échec : chef atelier imprime la fiche technicien avec signatures
* **Fichier :** `35-print-documents.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="print-technician-sheet"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\35-print-documents.spec.ts:190:11
```
* **Capture d'écran :** [Voir capture](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\35-print-documents-Lot-6K--4a785--technicien-avec-signatures-tablet-chrome\video.webm)

---
| 01/07/2026 15:01:55 | **2. Double clic réservation planning ne crée pas deux réservations** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : 2. Double clic réservation planning ne crée pas deux réservations
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès."[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:175:77
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-5ca15--crée-pas-deux-réservations-tablet-chrome\video.webm)

---
| 01/07/2026 15:02:09 | **5. Modification atelier après QC invalide QC et ajoute audit trail** (36-action-guards-audit.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visib... |

## Détail Échec : 5. Modification atelier après QC invalide QC et ajoute audit trail
* **Fichier :** `36-action-guards-audit.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="task-reopen-ro-guard-done"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\36-action-guards-audit.spec.ts:231:11
```
* **Capture d'écran :** [Voir capture](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\36-action-guards-audit-Lot-f060e-de-QC-et-ajoute-audit-trail-tablet-chrome\video.webm)

---
| 01/07/2026 15:03:27 | **une tâche réservée doit être libérée avant suppression physique** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche réservée doit être libérée avant suppression physique
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--3db84--avant-suppression-physique-tablet-chrome\video.webm)

---
| 01/07/2026 15:04:00 | **une tâche terminée s'annule administrativement et invalide le QC conforme** (39-business-rules-cleanup.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | [31mTest timeout of 30000ms exceeded.[39m... |

## Détail Échec : une tâche terminée s'annule administrativement et invalide le QC conforme
* **Fichier :** `39-business-rules-cleanup.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
[31mTest timeout of 30000ms exceeded.[39m
```
* **Capture d'écran :** [Voir capture](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\39-business-rules-cleanup--8d43d--et-invalide-le-QC-conforme-tablet-chrome\video.webm)

---
| 01/07/2026 15:04:14 | **Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours** (42-old-app-stage-editor-and-assignment-parity.spec.ts) | Inconnu | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="stage-editor-container"]') E... |

## Détail Échec : Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours
* **Fichier :** `42-old-app-stage-editor-and-assignment-parity.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="stage-editor-container"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="stage-editor-container"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\42-old-app-stage-editor-and-assignment-parity.spec.ts:53:74
```
* **Capture d'écran :** [Voir capture](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\42-old-app-stage-editor-an-cc260-cien-et-la-synchro-en-cours-tablet-chrome\video.webm)

---
| 01/07/2026 15:04:27 | **Levée de blocage avec motif obligatoire avant reprise** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-start-ro_dir_blocked"]... |

## Détail Échec : Levée de blocage avec motif obligatoire avant reprise
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeDisabled[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-start-ro_dir_blocked"]')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeDisabled" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-start-ro_dir_blocked"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:80:28
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-0f986-f-obligatoire-avant-reprise-tablet-chrome\video.webm)

---
| 01/07/2026 15:04:36 | **Réouverture d'une tâche terminée avec motif obligatoire** (01-directeur.spec.ts) | Directeur SAV | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: locator('[data-testid="task-reopen-ro_dir_1"]') Exp... |

## Détail Échec : Réouverture d'une tâche terminée avec motif obligatoire
* **Fichier :** `01-directeur.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: locator('[data-testid="task-reopen-ro_dir_1"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="task-reopen-ro_dir_1"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\01-directeur.spec.ts:106:29
```
* **Capture d'écran :** [Voir capture](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-01-directeur-Rôle-Di-26824-inée-avec-motif-obligatoire-tablet-chrome\video.webm)

---
| 01/07/2026 15:04:59 | **Calcul de suggestion de planification et application** (03-chef-atelier.spec.ts) | Chef d’atelier | **MINEUR** | ÉCHEC | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed Locator: locator('[data-testid="planning... |

## Détail Échec : Calcul de suggestion de planification et application
* **Fichier :** `03-chef-atelier.spec.ts`
* **Gravité :** `MINEUR`
* **Message d'erreur :** 
```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('[data-testid="planning-suggest-feedback"]')
Expected substring: [32m"Créneau réservé avec succès"[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toContainText" with timeout 5000ms[22m
[2m  - waiting for locator('[data-testid="planning-suggest-feedback"]')[22m

    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\03-chef-atelier.spec.ts:84:77
```
* **Capture d'écran :** [Voir capture](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-03-chef-atelier-Rôle-defe0-lanification-et-application-tablet-chrome\video.webm)

---
| 01/07/2026 15:05:42 | **Consultation autorisée mais toutes actions interdites / cachées** (07-lecture-seule.spec.ts) | Lecture seule | **BLOQUANT** | ÉCHEC | TimeoutError: locator.waitFor: Timeout 5000ms exceeded. Call log: [2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22... |

## Détail Échec : Consultation autorisée mais toutes actions interdites / cachées
* **Fichier :** `07-lecture-seule.spec.ts`
* **Gravité :** `BLOQUANT`
* **Message d'erreur :** 
```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-quality-control"]') to be visible[22m

    at humanClick (C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\helpers\human-actions.ts:10:17)
    at C:\Users\mhadh\antigravity\NIMR-SAV-PRO\e2e\roles\07-lecture-seule.spec.ts:55:11
```
* **Capture d'écran :** [Voir capture](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-tablet-chrome\test-failed-1.png)
* **Trace Playwright :** [Télécharger la trace](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-tablet-chrome\trace.zip)
* **Vidéo :** [Voir la vidéo](test-results\roles-07-lecture-seule-Rôl-4c491--actions-interdites-cachées-tablet-chrome\video.webm)

---
