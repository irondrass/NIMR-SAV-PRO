# Audit terrain complet NIMR SAV PRO - Post corrections 6K-H-D

Date d'audit : 03/07/2026  
Application auditee : https://irondrass.github.io/NIMR-SAV-PRO/  
URL controlee : `https://irondrass.github.io/NIMR-SAV-PRO/?audit=571470c`  
Version affichee : `NIMR SAV PRO v1.1.1`  
Dernier commit repo : `571470c Add 6K-H-D live mini audit report`  
Dernier commit correctif code : `9b6b735 Fix live logout and multi specialty dispatch`  
Bundle live observe : `assets/index-BOEJI9g4.js`

## Verdict

Verdict terrain : **GO recette / pilote interne encadre**.

Verdict production finale : **NO GO production large tant que le backend v2.0, la securite serveur et la persistance multi-utilisateur ne sont pas en place**.

Score actualise : **87/100**.

Les corrections recentes traitent les blocages P0/P1 constates lors du precedent audit : deconnexion live, dispatch multi-specialite, planning actionnable, accessibilite du menu mobile et garde-fous QC/livraison. L'application est maintenant exploitable pour une recette terrain controlee avec jeux de donnees pilotes.

## Synthese executive

Les parcours critiques ont ete rejoues sur l'instance publiee et en tests locaux. La deconnexion invalide bien la session, le dispatch par tache permet d'affecter les compagnons compatibles sans casser les affectations existantes, et le planning permet desormais de proposer puis confirmer une reservation qui genere une ETA et des blocs Gantt.

Le niveau fonctionnel est nettement meilleur qu'au precedent audit. Les reserves restantes ne bloquent plus la recette metier, mais elles restent structurantes pour une mise en production : securite client-side, absence de backend metier centralise, taille du bundle et besoin d'une recette terrain avec donnees reelles.

## Corrections verifiees

### 1. Deconnexion live

Statut : **corrige**.

Controle live :
- Connexion `Directeur SAV`.
- Clic `Deconnexion`.
- Rechargement apres deconnexion.
- Retour attendu sur l'ecran login.
- Message d'invalidation observe.
- `stillConnected=false`.

Controle e2e :
- `e2e/44-dispatch-planning-logout-live.spec.ts`
- `e2e/43-terrain-p0-p1-corrections.spec.ts`

Conclusion : l'ancien defaut de session persistante apres logout n'est plus reproduit.

### 2. Dispatch multi-specialite par tache

Statut : **corrige**.

Controle live sur dossier `NIMR-2026-002` :
- Onglet `Ordres Travaux` ouvert.
- Selecteur groupe `bulk-assign-tech-select` present.
- Bouton `bulk-assign-tech-button` present.
- 8 selecteurs d'affectation par tache presents.
- 8 boutons d'affectation par tache presents.
- Les listes sont filtrees par metier :
  - mecanique : `Meca Rapide Audit`, `Meca Grand Audit`
  - electricite : `Elec Audit`
  - tolerie : `Tolier Audit`
  - peinture : `Peintre Audit`
  - finition : `Finition Audit`

Essai fonctionnel reel :
- Selection de `Meca Rapide Audit` sur une tache mecanique non affectee.
- Clic `Affecter`.
- Statut observe : `Affecte a Meca Rapide Audit`.
- Bouton `Demarrer` debloque avec titre `Lancer la tache`.

Conclusion : le dispatch n'est plus limite aux affectations deja existantes et le chemin utilisateur pour affecter chaque tache est operationnel.

### 3. Planning actionnable

Statut : **corrige**.

Controle live :
- Vue `Planning Atelier` accessible.
- Actions visibles et actives :
  - `Réserver automatiquement les tâches du véhicule`
  - `Réserver automatiquement`
  - `Proposer créneau`
  - formulaire manuel avec controle de collision
  - affectation equipe
  - affectation pont

Essai fonctionnel reel :
- Clic `Proposer créneau`.
- Bloc `CRÉNEAU PROPOSÉ` affiche.
- Bouton `Réserver ce créneau` affiche.
- Clic `Réserver ce créneau`.
- Resultat observe :
  - `RÉSERVATION CONFIRMÉE`
  - `Tâches planifiées : 8`
  - `Tâches non réservées : 0`
  - ETA calculee : `06/07/2026 16:04`
  - bloc Gantt visible sur `Meca Rapide Audit`

Conclusion : le planning n'est plus une simple visualisation, il permet maintenant une reservation exploitable.

### 4. Mobile et accessibilite menu

Statut : **corrige**.

Controle live viewport `390x844` :
- Pas de debordement horizontal (`scrollWidth` inferieur a la largeur viewport utile).
- Bouton menu trouve.
- Avant ouverture :
  - `aria-label="Ouvrir le menu"`
  - `aria-expanded="false"`
- Apres ouverture :
  - `aria-label="Fermer le menu"`
  - `aria-expanded="true"`
  - drawer visible a `x=0`

Conclusion : la navigation mobile est utilisable et expose les bons etats ARIA pour le bouton de menu.

### 5. Garde-fous QC / livraison / reception

Statut : **confirme par regression e2e**.

Points couverts :
- QC conforme bloque avec taches ouvertes.
- Livraison ne liste pas un dossier avec taches ouvertes.
- Dossier bloque visible dans la liste bloquee livraison.
- Messages livraison affichent les taches bloquantes.
- Aucun placeholder `DEMO` dans le VIN reception.
- Kilometrage non pre-rempli a `15000`.
- Kilometrage vide bloque l'etape de reception.
- Tache QC forfaitaire non creee comme tache atelier.

Conclusion : les verrous metier critiques restent actifs.

## Tests executes

Tous les tests ci-dessous sont passes :

- `npm test`
  - Inclut notamment `logout-live-session`, `multi-specialty-dispatch`, `planning-actionability`, `mobile-accessibility`, `audit-trail-dispatch-planning`.
- `npm run lint`
  - `tsc --noEmit` OK.
- `npm run build`
  - Build Vite OK.
  - Avertissement conserve : chunk JS > 500 kB.
- `npm run test:e2e -- e2e/44-dispatch-planning-logout-live.spec.ts --project=chromium-desktop --project=mobile-chrome`
  - 8/8 OK.
- `npm run test:e2e -- e2e/43-terrain-p0-p1-corrections.spec.ts --project=chromium-desktop --project=mobile-chrome`
  - 24/24 OK.

## Reserves restantes

### R1 - Production securisee non encore couverte

Gravite : **majeure pour production, acceptable pour pilote encadre**.

Le dashboard affiche encore : `Version RC client-side, securite reelle necessitant backend v2.0.`  
Les roles, sessions et donnees restent essentiellement cote client. Cela ne convient pas a une production multi-utilisateur avec exigences de tracabilite, droits serveur, sauvegarde centralisee et audit legal.

Action recommandee :
- Backend v2.0 avec authentification serveur.
- Base centralisee.
- Autorisations enforcees cote API.
- Journal d'audit serveur immuable.
- Strategie de migration des donnees locales.

### R2 - Taille bundle

Gravite : **moyenne**.

Build observe :
- `assets/index-BOEJI9g4.js`
- taille minifiee : `1,027.05 kB`
- gzip : `256.46 kB`
- avertissement Vite : chunk > 500 kB

Action recommandee :
- Code splitting par modules lourds : rapports, planning, imports, impressions.
- Chargement dynamique des vues rarement utilisees.
- Budget performance tablette atelier.

### R3 - Donnees pilotes et localStorage

Gravite : **moyenne**.

Les tests live manipulent l'etat local du navigateur : affectations, reservations, ETA et planning. Pour une recette officielle, il faut un protocole de reset ou des jeux de donnees versionnes afin d'eviter les conclusions basees sur un etat local deja modifie.

Action recommandee :
- Fixture terrain de depart.
- Bouton/admin de reinitialisation recette.
- Export des donnees avant/apres campagne.
- Scenarios UAT rejouables.

### R4 - UX planning manuel

Gravite : **mineure**.

Le formulaire manuel peut demarrer sur un horaire passe et afficher `Impossible de planifier dans le passé`, avec bouton `Corriger le créneau`. Le comportement est correct fonctionnellement, mais le default devrait plutot se positionner sur le prochain creneau legal.

Action recommandee :
- Initialiser l'heure manuelle au prochain creneau ouvert.
- Garder l'erreur uniquement si l'utilisateur force une heure invalide.

### R5 - Accessibilite complete non exhaustive

Gravite : **mineure a moyenne selon objectif conformite**.

Le menu mobile et l'overflow ont ete verifies. Ce n'est pas encore un audit WCAG complet de tous les formulaires, tableaux, modales, impressions et workflows clavier.

Action recommandee :
- Revue clavier complete.
- Focus management des modales.
- Labels des formulaires longs.
- Contrastes et navigation lecteur d'ecran sur planning/Gantt.

## Decision recommandee

Decision : **GO pour recette terrain encadree**.

Conditions minimales :
- Utiliser un jeu de donnees dedie.
- Designer un responsable de reset/export des donnees.
- Limiter la recette a un environnement pilote.
- Rejouer les parcours role par role en atelier reel : reception, chef atelier, technicien, QC, livraison, directeur.
- Conserver le blocage production tant que le backend v2.0 n'est pas livre.

Decision refusee pour : **production ouverte / donnees clients reelles / multi-site sans backend**.

Le produit est maintenant suffisamment solide pour une validation terrain metier. Il n'est pas encore une application de production securisee au sens SI.
