# Audit terrain complet apres corrections - NIMR SAV PRO v1.1.1

Date: 02/07/2026  
Application auditee: https://irondrass.github.io/NIMR-SAV-PRO/  
Profil live principal: Directeur SAV (`directeur / 0000`)  
Dossier frais cree pour cette reprise: `NIMR-2026-002` / `222 TU 2026`

## Verdict executif

Score apres corrections: **73 / 100**

Decision:

- **GO recette interne encadree** sur les corrections P0/P1 deja ciblees.
- **NO GO production**.
- **NO GO pilote multi-role/multi-compagnon** tant que la deconnexion live et le dispatch multi-specialite ne sont pas fiabilises.

Les corrections les plus critiques sont bien visibles: le QC ne peut plus rendre un dossier pret a livrer avec des taches ouvertes, la livraison ne liste plus les dossiers non termines, la configuration des ressources atelier existe enfin en base propre, et l'import ne cree plus de tache "Controle qualite forfaitaire". En revanche, le live GitHub Pages garde une anomalie de session importante: le bouton **Deconnexion** ne ramene pas au login. Le flux atelier multi-metiers reste aussi trop fragile: l'affectation rapide remplace le compagnon courant au lieu de permettre une affectation par tache.

## Perimetre teste

Parcours live rejoues:

- Connexion Directeur SAV.
- Creation reception guidee complete d'un dossier frais.
- Import devis multi-metiers mecanique / electricite / tolerie / peinture / finition.
- Configuration ressources atelier depuis zero ressource.
- Planning/Gantt et capacite ressources.
- Affectation rapide dossier et observation des taches atelier.
- Controle qualite avec checklist vide, puis checklist complete avec taches ouvertes.
- Livraison globale et liste des dossiers bloquants.
- Responsive mobile 390 px et menu mobile.
- Deconnexion visible.

Controles locaux executes:

- `npm test`: OK.
- `npm run lint`: OK.
- `npm run build`: OK, avec avertissement Vite de chunk > 500 kB.
- `npm run test:e2e -- e2e/43-terrain-p0-p1-corrections.spec.ts --project=chromium-desktop --project=mobile-chrome`: OK, 24 tests passes.

Limites:

- Le stockage local du navigateur contenait un ancien dossier `NIMR-2026-001`; les conclusions fonctionnelles neuves s'appuient donc sur `NIMR-2026-002`.
- Le test live multi-role complet n'a pas pu etre rejoue de bout en bout, car la deconnexion live reste inerte. Les changements de role sont couverts par l'e2e local, pas par le site deploye.
- Les tests e2e ciblent les corrections terrain majeures, pas toute la suite e2e exhaustive.

## Corrections confirmees

| Zone | Resultat apres correction | Preuve terrain |
| --- | --- | --- |
| QC avec taches ouvertes | **Corrige** | Checklist vide bloquee. Checklist complete + confirmation bloque avec `QC impossible : des tâches atelier sont encore ouvertes. (Nombre : 8)`. Le dossier reste `Vehicule recu` / `QC En attente`. |
| Livraison | **Corrige** | `NIMR-2026-002` n'apparait pas en pret a livrer. L'ancien dossier pret local est classe en bloque livraison avec motif taches non terminees. |
| Ressources atelier a zero | **Corrige** | Ecran `Aucune ressource atelier configurée. Créez les ressources avant planification.` puis creation de 6 ressources: mecanique rapide, grands travaux, electricite, tolerie, peinture, finition. |
| Gantt capacite | **Ameliore** | Les 6 ressources apparaissent en lignes Gantt avec charge `0h / 8h`; les ponts/postes restent visibles. |
| Import devis / mapping | **Ameliore** | Geometrie mappee mecanique, diagnostic/faisceau electrique mappes electricite, tolerie reconnue. |
| Tache QC forfaitaire importee | **Corrige** | L'import du devis cree 8 taches atelier, sans tache `Controle qualite forfaitaire`. |
| Reception VIN/kilometrage | **Corrige** | Le VIN n'affiche plus `DEMOVIN000000001`; le kilometrage n'est plus pre-rempli a `15000`. |
| Mobile horizontal | **Ameliore** | Pas d'overflow horizontal constate a 390 px; l'e2e mobile de corrections passe. |

## Anomalies restantes

| ID | Gravite | Zone | Constat | Impact | Recommandation |
| --- | --- | --- | --- | --- | --- |
| R-001 | P1 | Auth / session live | Sur le site deploye, `Deconnexion` garde l'utilisateur connecte et renvoie au dashboard. | Impossible de faire une vraie bascule de role en live; risque session poste partage. | Verifier artefact GitHub Pages/cache/service worker. Ajouter smoke de deconnexion sur URL deployee, pas seulement preview local. |
| R-002 | P1 | Atelier multi-specialite | L'affectation rapide est mono-compagnon. `Meca Rapide Audit` affecte 2 taches mecaniques; `Elec Audit` remplace ensuite l'affectation, les taches mecaniques redeviennent sans technicien. | Un devis multi-metiers ne peut pas etre dispatche proprement en parallele par ligne de MO. | Ajouter affectation par tache/etape, preserve assignments existants, et exposer les techniciens compatibles sur chaque ligne. |
| R-003 | P1 | Atelier / demarrage taches | Les taches non compatibles restent `Aucun technicien compatible affecte` avec `Demarrer` disabled. Le bouton `Fiche tâche technicien` declenche une trace d'impression, sans panneau d'affectation observable. | Le chef d'atelier ne dispose pas d'un chemin clair pour dispatcher chaque tache. | Renommer l'action si c'est une impression; sinon ouvrir une vraie fiche tache avec assignation, consignes, statut et historique. |
| R-004 | P2 | Planning reservation | Le Gantt liste les dossiers `A reserver`, mais aucun bouton explicite `Reserver`, `Proposer`, `Planifier` n'est visible dans le live audite. | ETA reste `Non definie`; le moteur de reservation teste localement n'est pas assez evident en exploitation. | Rendre l'action de reservation visible depuis le bloc dossier ou la ligne Gantt. |
| R-005 | P2 | Import devis | 8 lignes collees donnent `10 lignes main-d'oeuvre detectees` en preview, avec lignes `Depose` / `Preparation` a 0h non selectionnees. Total preview `13,81 h`, total importe `13.5625 Heures`. | Perte de confiance reception/chef atelier sur les temps importes. | Afficher les lignes ignorees a part, arrondir/formatter les heures, expliquer mutualisation peinture/finition. |
| R-006 | P2 | Audit trail | Apres import devis, l'audit local du dossier ne montre pas clairement l'action d'import; le blocage QC est bien trace. | Manque de tracabilite sur une action structurante du dossier. | Journaliser import devis, lignes retenues, lignes ignorees, total valide et utilisateur. |
| R-007 | P2 | Reception UX | Stepper affiche `Etape 1 / 4` alors que le parcours montre 5 jalons avec `Succes`; avertissement `Date de mise en circulation manquante` persiste jusqu'a l'ecran succes si le champ est vide. | Confusion terrain et impression d'erreur mal resolue. | Corriger le compteur d'etapes; effacer ou contextualiser les warnings acceptes apres confirmation. |
| R-008 | P2 | Base vehicules | La reception affiche encore `Base véhicules NIMR (0 véhicule(s) en local)`. | Pas de referentiel local exploitable pour eviter les saisies libres. | Fournir un import initial officiel ou une experience claire de chargement/absence de base. |
| R-009 | P3 | Mobile / accessibilite | Le menu mobile fonctionne, mais le bouton menu reste sans libelle accessible dans le snapshot live et peut apparaitre partiellement hors champ selon le scroll. | Accessibilite et ergonomie mobile perfectibles. | Ajouter `aria-label`, stabiliser la position top, conserver les tests responsive. |
| R-010 | P3 | Build | Build OK, mais chunk JS principal ~1,014 kB minifie. | Temps de chargement et maintenabilite front. | Prevoir code splitting par modules lourds avant production. |

## Parcours par module

### Authentification et roles

Connexion Directeur SAV OK. Le site affiche `Directeur SAV` et ouvre le dashboard. La deconnexion live reste KO: l'utilisateur demeure connecte et le login ne reapparait pas. Les tests locaux/e2e annoncent pourtant `Logout puis login autre rôle` OK, ce qui suggere un ecart entre build local et build deploye ou un probleme de cache de production.

### Reception guidee

Creation `NIMR-2026-002` OK. Le dossier sort en `Vehicule recu`, QC `Non realise`, progression 10%. Les deux corrections visibles sont positives: VIN non demo, kilometrage non pre-rempli. Restent des irritants UX: compteur d'etapes incoherent, warning date qui persiste, boutons photo encore trop textuels, base vehicules vide.

### Import devis

Le mapping metier est nettement meilleur et la tache QC forfaitaire parasite n'est plus creee. Le devis multi-metiers audite genere 8 taches atelier exploitables, mais la preview reste difficile a auditer: nombre de lignes detectees superieur aux lignes collees et total horaire different entre preview et dossier.

### Planning et ressources

La correction la plus structurante cote planning est confirmee: en absence de ressource, l'application propose une configuration atelier. Les ressources creees sont visibles dans le Gantt et dans les listes d'affectation du dossier. Cependant, la reservation effective n'est pas assez actionnable dans le live: les dossiers restent `A reserver` et l'ETA reste non confirmee.

### Atelier et chef d'atelier

Le dispatch reste le principal point faible apres les corrections P0. L'affectation rapide est utile pour un dossier mono-metier, mais elle n'est pas suffisante pour un dossier mecanique + electricite + carrosserie + peinture. Le chef d'atelier voit le dossier actif, mais pas un tableau de dispatch par tache permettant d'affecter chaque ligne au bon compagnon.

### Controle qualite

Le verrou critique est corrige. L'application refuse la validation sans checklist complete, puis refuse aussi la validation complete si les taches atelier sont ouvertes. Le blocage est visible et trace dans l'audit local avec le motif exact.

### Livraison

La livraison globale respecte mieux la realite atelier. Aucun dossier avec taches ouvertes n'est livre. L'ecran liste les dossiers bloques et affiche le motif taches non terminees. Ce comportement est aussi couvert par les tests e2e de correction.

### Mobile

Le responsive est en net progres: pas d'overflow horizontal constate en mobile 390 px et les tests e2e mobile ciblant le menu passent. Il reste une dette d'accessibilite sur le bouton menu, qui n'a pas de nom lisible dans le snapshot live.

## Synthese GO / NO GO

| Critere | Statut |
| --- | --- |
| Reception dossier neuf | GO avec reserves UX |
| Import devis multi-metiers | GO partiel |
| Ressources atelier depuis base propre | GO |
| Planning/Gantt capacite | GO partiel |
| Dispatch multi-compagnons | NO GO pilote multi-metier |
| QC avant fin travaux | GO |
| Livraison avant fin travaux | GO |
| Deconnexion / changement role live | NO GO |
| Mobile 390 px | GO avec reserve accessibilite |
| Qualite technique locale | GO |

Conclusion: les corrections retirent les anciens blocages P0 QC/livraison/ressources vides. L'application peut repasser en recette interne dirigee. Pour un pilote terrain reel, il faut encore corriger la deconnexion sur le site deploye et transformer le dispatch atelier en affectation multi-tache/multi-compagnon robuste.
