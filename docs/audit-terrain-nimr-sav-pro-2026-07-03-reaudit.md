# Audit terrain complet apres dernieres corrections - NIMR SAV PRO v1.1.1

Date: 03/07/2026
URL live auditee: https://irondrass.github.io/NIMR-SAV-PRO/
Base depot: `d64f0f5 Add 6K-H reaudit report`
Dernier correctif code visible dans l'historique: `f92603d Fix mobile E2E drawer navigation`
Profil live teste: Directeur SAV (`directeur / 0000`)

## Verdict executif

Score actualise: **74 / 100**

Decision:

- **GO recette interne encadree**.
- **NO GO production**.
- **NO GO pilote multi-role / multi-compagnon**.

La correction mobile la plus recente est visible: a 390 px, le drawer s'ouvre, l'overlay est present, le contenu ne deborde pas horizontalement, et le bouton menu n'est plus hors champ. Les garde-fous QC/livraison restent corrects. En revanche, deux blocages terrain importants restent inchanges sur le live: la **deconnexion ne sort toujours pas de la session** et le **dispatch atelier multi-specialite reste mono-compagnon / non cumulatif**.

## Conditions de test

Parcours live rejoues:

- Ouverture du site GitHub Pages.
- Connexion Directeur SAV.
- Test de deconnexion via bouton visible et via DOM visible.
- Planning atelier et ressources existantes.
- Fiche dossier `NIMR-2026-002`.
- Ordres de travaux et affectations technicien.
- Module Controle Qualite global.
- Module Livraison global.
- Mobile 390 x 844 avec drawer.

Limites:

- Le navigateur live contient encore les donnees locales des audits precedents (`NIMR-2026-001`, `NIMR-2026-002`, six ressources atelier). Je n'ai pas purge le stockage local pour ne pas effacer l'etat utilisateur.
- Le snapshot ARIA du navigateur integre a echoue sur la page live; les controles live ont donc ete faits par lectures DOM ciblees et clics DOM/coordonnees visibles.
- Le test multi-role live complet reste bloque par la deconnexion live KO. Les e2e locaux couvrent le role-switch, mais le site deploye ne se comporte pas comme le preview local.

## Verifications locales

| Commande | Resultat |
| --- | --- |
| `npm test` | OK |
| `npm run lint` | OK |
| `npm run build` | OK, warning chunk JS > 500 kB |
| `npm run test:e2e -- e2e/43-terrain-p0-p1-corrections.spec.ts --project=chromium-desktop --project=mobile-chrome` | OK, 24/24 |

## Corrections confirmees

| Zone | Resultat |
| --- | --- |
| Mobile drawer | **Confirme live**: bouton menu visible a `x=323`, `y=12`; drawer passe de `x=-256` a `x=0`; overlay present; navigation visible. |
| Mobile overflow | **Confirme live**: `scrollWidth=375`, `bodyWidth=375`, `innerWidth=390`; pas de debordement horizontal. |
| QC avec taches ouvertes | **Toujours corrige**: audit local du dossier trace `QC impossible : des tâches atelier sont encore ouvertes. (Nombre : 8)`. |
| Livraison avec taches ouvertes | **Toujours corrige**: aucun vehicule pret a livrer; `NIMR-2026-001` est en bloque livraison avec motif `9 tâches non terminées`; `NIMR-2026-002` n'est pas liste pret a livrer. |
| Ressources atelier | **Toujours OK sur donnees existantes**: les 6 ressources sont visibles dans le Gantt et les listes d'affectation. |
| Tests locaux/e2e | **OK**: toutes les suites ciblees passent, y compris logout local, mobile et QC/livraison. |

## Anomalies restantes

| ID | Gravite | Zone | Constat live | Impact | Recommandation |
| --- | --- | --- | --- | --- | --- |
| R-001 | P1 | Auth / session live | `Deconnexion` garde l'utilisateur connecte. Apres clic DOM visible sur le bouton, `loginVisible=false` et `stillConnected=true`. | Impossible de valider les roles en live; risque session sur poste partage; divergence avec e2e local. | Corriger le handler live ou l'artefact deploye. Ajouter un smoke automatise contre l'URL GitHub Pages, pas seulement contre le preview local. |
| R-002 | P1 | Ecart local vs deploye | Les tests e2e `Logout puis login autre rôle` passent en local, mais le live reste KO. | Les rapports de recette locaux peuvent annoncer une correction absente du site publie. | Verifier pipeline GitHub Pages, cache navigateur/service worker, version de bundle et invalidation assets. |
| R-003 | P1 | Dispatch atelier multi-specialite | Sur `NIMR-2026-002`, 2 taches electriques sont affectees a `Elec Audit`; 6 taches restent `Aucun technicien compatible affecté` et 6 boutons `Démarrer` sont disabled. | Un devis multi-metiers ne peut pas etre dispatche proprement par ligne de MO. | Ajouter une affectation par tache ou par etape, cumulative, preservant les affectations deja faites. |
| R-004 | P2 | Planning / reservation | Le planning affiche `À réserver`, `Tâches non réservées : 8`, ETA `Non définie`, mais aucun bouton explicite `Réserver`, `Proposer`, `Planifier` ou `Confirmer` n'est visible. | Le moteur de reservation teste localement reste peu actionnable pour un chef d'atelier. | Exposer l'action de reservation depuis la carte dossier, la ligne Gantt ou le detail dossier. |
| R-005 | P2 | Onglets fiche dossier | Les onglets `Checklist Qualité` et `Livraison Véhicule` peuvent partir hors viewport horizontal sur la fiche dossier desktop si la barre d'onglets depasse. | Acces moins robuste aux sections critiques sans scroll horizontal evident. | Rendre les onglets wrap/responsive ou ajouter navigation secondaire stable. |
| R-006 | P3 | Accessibilite mobile | Le bouton menu mobile est visible et fonctionnel, mais `aria-label` est toujours absent et le texte accessible est vide. | Navigation difficile pour lecteurs d'ecran. | Ajouter `aria-label="Ouvrir le menu"` / `aria-expanded`. |
| R-007 | P3 | Performance bundle | Build OK mais bundle JS principal ~1,014 kB minifie. | Risque temps de chargement et maintenance front. | Prevoir code splitting par modules lourds avant production. |

## Parcours live detaille

### Authentification

Connexion Directeur SAV OK. L'application affiche bien `Directeur SAV` et ouvre le dashboard. La deconnexion est toujours KO sur le live: le bouton est present dans le DOM visible, le clic est envoye, mais l'ecran login ne reapparait pas et l'utilisateur reste connecte. C'est l'ecart le plus important avec les tests locaux.

### Planning atelier

Le Gantt charge correctement les ressources existantes: `Meca Rapide Audit`, `Meca Grand Audit`, `Elec Audit`, `Tolier Audit`, `Peintre Audit`, `Finition Audit`. Les ponts/postes sont visibles et la capacite affiche `0h / 8h`. Les deux dossiers restent `À réserver`; l'ETA est `Non définie`.

### Dossier et ordres travaux

`NIMR-2026-002` est en `En travaux`, QC `En attente`, progression 10%. Dans les ordres travaux, le dossier est actuellement affecte a `Elec Audit`, ce qui active uniquement les deux taches electriques. Les autres taches restent sans technicien compatible. Le probleme de fond du precedent audit reste donc present: le flux affecte le dossier a un compagnon, pas chaque tache au bon metier.

### Controle qualite

Le module QC global n'affiche aucun dossier en attente de QC, ce qui est coherent avec `NIMR-2026-002` bloque avant controle. L'audit local du dossier conserve la trace du blocage QC avec 8 taches ouvertes.

### Livraison

Le module livraison est coherent: 0 pret a livrer, 0 livre. `NIMR-2026-001` est classe en bloque livraison pour `9 tâches non terminées`; `NIMR-2026-002` n'apparait pas comme pret a livrer.

### Mobile

La correction du drawer mobile est confirmee sur live. Avant ouverture, la sidebar est repliee hors champ (`x=-256`), le bouton menu est visible (`y=12`), et le contenu n'a pas de debordement horizontal. Apres ouverture, la sidebar passe a `x=0`, l'overlay couvre l'ecran, et les entrees de navigation sont visibles. Reste la dette d'accessibilite du bouton sans nom.

## Synthese GO / NO GO

| Critere | Statut |
| --- | --- |
| QC bloque tant que travaux ouverts | GO |
| Livraison bloque tant que travaux ouverts | GO |
| Ressources / Gantt capacite | GO partiel |
| Mobile drawer / overflow | GO avec reserve accessibilite |
| Deconnexion live / role-switch live | NO GO |
| Dispatch multi-compagnon par tache | NO GO |
| Reservation atelier actionnable | GO partiel |
| Build/tests locaux | GO |

Conclusion: les dernieres corrections ameliorent surtout le mobile et conservent les garde-fous QC/livraison. Le niveau reste insuffisant pour production ou pilote multi-role, car la deconnexion live et le dispatch multi-metiers sont encore les deux sujets qui cassent le plus le terrain.
