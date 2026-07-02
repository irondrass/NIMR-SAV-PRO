# Audit terrain complet - NIMR SAV PRO v1.1.1

Application auditee : https://irondrass.github.io/NIMR-SAV-PRO/
Date audit : 2026-07-02, fuseau Africa/Tunis
Mode : audit terrain live sur GitHub Pages + verification source/tests locaux.

## 1. Resume executif

Niveau global de maturite : application avancee fonctionnellement, mais pas prete pour un atelier SAV reel demain matin. Les modules clefs existent (reception, dossier, import devis, planning, QC, livraison, impressions, roles), et la suite automatisee locale passe. En revanche, plusieurs verrous terrain sont incomplets dans l'enchainement reel.

Decision : GO recette interne controlee, NO GO production finale et NO GO pilote terrain autonome tant que les P0/P1 ci-dessous ne sont pas corriges.

Principaux risques :
- QC peut etre valide et passer le dossier en "Pret a livrer" alors que les taches atelier sont encore ouvertes.
- Planning inutilisable en donnees propres, car aucun compagnon/technicien atelier n'est initialise ni cree via un parcours clair.
- Import devis montre des incoherences de mapping metier entre les cartes d'etapes et le tableau final.
- Le mobile telephone est difficilement utilisable : le menu lateral fixe consomme l'ecran et pousse le contenu hors vue.
- La deconnexion est inerte sur le build deploye, bloquant le changement de role live et posant un probleme de securite de session.

Priorites immediates :
1. Bloquer la validation QC tant que toutes les taches atelier ne sont pas terminees/annulees proprement.
2. Filtrer les listes "prets a livrer" avec `getDeliveryReadiness(...).canDeliver`, pas seulement le statut.
3. Ajouter un setup obligatoire des ressources atelier (mecanicien, electricien, tolier, peintre, QC/lavage si necessaire) et relier comptes utilisateurs et ressources.
4. Corriger le logout live.
5. Corriger le layout mobile et le tab strip dossier.
6. Stabiliser le mapping import devis ancien-app -> etapes PRO.

## 2. Score global

Score global : 58 / 100

| Axe | Score | Commentaire |
|---|---:|---|
| Ergonomie terrain | 55 | Bons modules, mais trop de messages ambigus, mobile telephone non operationnel, onglets dossier charges. |
| Logique metier | 54 | Plusieurs verrous existent, mais QC peut avancer trop tot et le statut "Pret a livrer" devient incoherent. |
| Planning | 42 | Moteur et tests presents, mais aucun technicien ressource en runtime propre, donc planning inutilisable. |
| Import devis | 62 | Parser puissant et tests nombreux, mais incoherences observees sur cas mixte et total atelier peu lisible. |
| QC / livraison | 50 | Livraison finale bloquee correctement, mais QC accepte trop tot et la file livraison affiche un faux pret. |
| Roles / securite | 52 | Matrice presente, mais deconnexion bloquee, roles trop larges, auth locale demo non prod. |
| Performance | 75 | Navigation fluide sur les parcours testes, pas d'erreur console visible. |
| Preparation production | 45 | LocalStorage, pas de backend multi-user, pas d'onboarding ressources, placeholders demo. |

Validation locale executee : `npm test` OK.

## 3. Tableau des anomalies

| ID | Module | Role concerne | Gravite | Description | Etapes de reproduction | Resultat actuel | Resultat attendu | Impact terrain | Proposition correction | Test a ajouter |
|---|---|---|---|---|---|---|---|---|---|---|
| A-001 | QC / Dossier | QC, Chef, Directeur | P0 | QC conforme possible avec 9 taches atelier ouvertes. | Creer dossier, importer devis, ouvrir Checklist Qualite, cocher tout, confirmer QC. | Dossier passe "QC Conforme" et "Pret a livrer" alors que progression reste 10%. | QC impossible tant que toutes les taches non annulees ne sont pas `done`. | Vehicule annonce pret alors que travaux non faits. | Ajouter garde dans `submitQualityControl` et vues QC/detail. | QC valide refuse si `ordresReparation.some(!isRepairOrderDone)`. |
| A-002 | Livraison | Livraison, Reception, Directeur | P0 | File "Vehicules prets a livrer" liste un dossier non livrable. | Apres A-001, ouvrir Livraison SAV. | Compteur "Prets a livrer (1)" et carte visible, puis bouton final bloque. | La liste doit utiliser `getDeliveryReadiness(...).canDeliver`. | Agent livraison perd du temps, client peut etre appele trop tot. | Filtrer par readiness centrale et afficher "bloques livraison" separement. | Dossier QC conforme avec taches ouvertes absent de la file prete. |
| A-003 | Planning / Chef atelier | Chef, Directeur | P0 | Aucun technicien/compagnon en runtime propre. | Creer/importer un dossier, ouvrir Planning ou Chef atelier. | "Aucun technicien" et select "Choisir Compagnon" vide/desactive. | Setup obligatoire ou import ressources avant exploitation; au moins creation/liaison ressource. | Impossible de planifier, affecter, demarrer les travaux. | Ajouter onboarding ressources atelier sans donnees demo ou assistant import. | E2E base neuve exige creation/selection d'un technicien compatible. |
| A-004 | Mobile | Tous, surtout Reception/Technicien | P0 | Telephone 390px inutilisable : sidebar fixe visible, contenu pousse hors ecran. | Forcer viewport 390x844. | Menu lateral occupe la largeur utile, zone metier hors vue. | Navigation mobile repliee, contenu plein ecran, boutons tactiles visibles. | Reception tablette/technicien terrain impossible sur smartphone. | Drawer mobile, barre basse ou menu compact; tester 390/768. | Screenshot/pixel test mobile sans overflow horizontal. |
| A-005 | Connexion / roles | Tous | P1 | Bouton "Deconnexion" inerte sur build deploye. | Connecte directeur, cliquer/Entrer sur Deconnexion. | Session reste directeur, aucun retour login. | Suppression session et retour login immediat. | Impossible de changer de role sur poste partage; risque securite. | Corriger handler/hydratation; tester `data-testid=logout-button`. | E2E logout puis login autre role. |
| A-006 | Import devis | Chef, Directeur | P1 | Mapping etapes incoherent entre cartes et tableau. | Importer devis mixte vidange/geometrie/diagnostic/faisceau/tolerie/peinture. | Carte geometrie cochee tolerie mais tableau mecanique; diagnostic coche electrique mais tableau mecanique; faisceau carte tolerie mais tableau electrique. | Une seule source de verite visible; geometrie mecanique, diagnostic/defaut electrique si valise, faisceau electrique. | Chef peut valider mauvaise filiere/metier. | Recalculer cartes depuis les memes distributions que le tableau ou supprimer l'affichage contradictoire. | Test UI preview compare carte, table et taches creees. |
| A-007 | Import devis / QC | Chef, QC | P1 | Creation d'une tache "Controle qualite forfaitaire" dans les ordres atelier. | Confirmer import devis carrosserie/peinture. | QC devient une tache atelier supprimable/planifiable. | QC reste dans module QC, pas dans les taches mecanicien/tolier/peintre. | Risque d'affecter QC a un compagnon atelier. | Traiter QC forfaitaire comme jalon de controle, pas RepairOrderLine atelier. | Import devis ne cree aucune ligne atelier QC. |
| A-008 | Import devis | Chef | P1 | Total atelier peu explicable. | Importer 8 lignes total 13h selectionnees. | Total affiche 13,8125h avec peinture mutualisee et finition/QC auto. | Detail des ajouts/reductions avec total original, total mutualise, forfaits. | Chef ne peut pas justifier ETA au client/atelier. | Ajouter recap calcul : MO brute, mutualisation peinture, finition, QC. | Test snapshot recap total detaille. |
| A-009 | Audit trail | Directeur, Chef | P1 | Import devis confirme non visible dans audit local du dossier. | Importer devis puis consulter audit local. | Creation dossier puis QC/livraison visibles, import absent. | Import devis, nb lignes, total, utilisateur, source doivent etre traces. | Perte de tracabilite sur contenu travaux. | Appeler audit lors de confirmation import. | Test audit apres `quote-import-confirm`. |
| A-010 | Reception | Reception | P2 | "Date de mise en circulation manquante" apparait mais le champ n'est pas marque obligatoire et la creation continue. | Laisser date vide, finaliser dossier. | Warning persiste sur page succes. | Champ obligatoire marque ou simple warning non bloquant clair. | Receptionnaire croit avoir une erreur malgre succes. | Clarifier validation et effacer warning apres succes si non bloquant. | E2E date vide produit message de niveau attendu. |
| A-011 | Reception | Reception | P2 | Placeholder VIN demo `DEMOVIN000000001` en production live; kilometrage default 15000. | Ouvrir etape vehicule. | Cue demo et valeur km par defaut. | Placeholders realistes neutres; km vide obligatoire. | Risque saisie de donnees fictives. | Remplacer par "Ex: L..." et vider km. | Test no-demo placeholders runtime. |
| A-012 | Reception | Reception | P3 | Assistant indique "Etape 4 / 4" avec 5 jalons dont Succes. | Parcourir wizard reception. | Compteur contradictoire. | 4 etapes + confirmation, ou 5/5 coherent. | Perte de confiance UX. | Harmoniser stepper. | Snapshot stepper coherent. |
| A-013 | Reception / Photos | Reception, Technicien | P2 | "Prendre" et "Importer" ne ressortent pas comme boutons accessibles. | Ouvrir etape photos. | Snapshot expose du texte, pas commandes clairement nommees. | Boutons tactiles nommes "Prendre photo", "Importer photo". | Erreur sur tablette, accessibilite faible. | Utiliser vrais buttons/labels avec `aria-label`. | Test role button photos. |
| A-014 | Livraison | Livraison | P2 | Messages de blocage imprecis. | Dossier avec taches `pending`, ouvrir livraison. | "Certaines taches suspendues ou en cours", "Une tache encore en cours". | Mentionner "9 taches en attente/non terminees". | L'agent ne sait pas qui corriger. | Deriver messages par statut et nombre. | Test raisons par `pending/paused/blocked/in_progress`. |
| A-015 | Dossier / QC | Chef, Directeur | P2 | Apres QC conforme, boutons "Supprimer tache" restent actifs visuellement. | QC conforme puis Ordres Travaux. | Boutons cliquables puis message d'interdiction. | Boutons desactives avec tooltip, ou action "Invalider QC avec motif". | Perte de temps, confusion. | Desactiver ou proposer workflow explicite d'invalidation. | E2E post-QC boutons non dangereux. |
| A-016 | Roles | Reception, Chef, QC, Livraison, Lecture | P1 | Matrice trop large et profils metiers non separes. | Lire role matrix/source. | Reception voit rapports/livraison/garantie/satisfaction; chef peut QC; un seul role technicien pour mecanique/electrique/tolerie/peinture. | Permissions minimales; specialites atelier separees via ressources et filtres. | Mauvaise action par role, statistiques exposees trop largement. | Revoir ROLE_TABS/ROLE_PERMISSIONS et lier metiers a ressources. | Tests par role boutons dangereux absents. |
| A-017 | Planning / ressources | Chef | P1 | Gestion utilisateurs cree des comptes, pas des compagnons planifiables. | Ouvrir Gestion utilisateurs et Planning. | Le compte `technicien` n'apparait pas dans le Gantt. | Differencier compte de connexion et ressource atelier, avec liaison claire. | Le chef croit avoir cree un technicien mais ne peut pas l'affecter. | Ajouter ecran "Ressources atelier" ou liaison compte->ressource. | Test creation compte technicien cree/lie ressource si voulu. |
| A-018 | Impressions | Reception, Chef, QC, Livraison | P2 | Vue document s'ajoute sous le chrome applicatif; receptionnaire imprime "Equipe reception NIMR". | Documents > Fiche reception. | DOM contient app + document; acteur non reel. | CSS print A4 isolee et utilisateur reel affiche. | Papier peut etre brouille, tracabilite faible. | Verifier `@media print`, fenetre/section print-only, acteur courant. | Test rendu print sans nav/sidebar. |
| A-019 | Dossier | Tous | P2 | Statut et progression incoherents apres QC premature. | Apres A-001. | Statut "Pret a livrer", QC conforme, progression 10%. | Progression doit rester chantier ouvert ou QC bloque. | Dashboard/KPI contradictoires. | Ne jamais passer pret si progress < 100. | Test invariant statut pret => 100% taches fermees. |
| A-020 | Textes | Tous | P3 | Libelles/francais incoherents. | QC, livraison, technicien. | "confirmed", "d'Vehicules", "disponible commercialement". | Vocabulaire atelier francais coherent. | Confiance utilisateur reduite. | Relecture libelles terrain. | Snapshot no-English/no-grammar-regression. |
| A-021 | Production locale | Directeur | P1 | Authentification et donnees en localStorage seulement. | Login/settings. | Message "client-side, securite reelle necessitant backend v2.0". | Accepter uniquement recette monoposte; prod avec backend auth/audit/sync. | Perte donnees, conflit multi-utilisateur, audit modifiable localement. | Backend planifie obligatoire avant prod multi-utilisateur. | Test migration repositories + auth serveur. |
| A-022 | Vehicule master | Reception | P2 | Base vehicules vide, recherche assistee inutilisable, pas d'assistant obligatoire. | Ouvrir reception propre. | "Aucune base vehicules importee". | Onboarding ou import guide avant reception reelle. | Double saisie, erreurs VIN/client. | Ecran preparation production avec import et controle qualite base. | E2E base vide affiche checklist setup. |

## 4. Fonctions en double ou mal placees

| Fonction | Emplacement actuel | Probleme | Emplacement recommande | Justification terrain |
|---|---|---|---|---|
| QC conforme | Onglet dossier + module QC dedie | Deux surfaces peuvent valider; l'onglet detail ne bloque pas les taches ouvertes. | Garder les deux surfaces si elles partagent le meme garde central. | Le chef peut consulter, mais la decision QC doit etre unique et sure. |
| Livraison | Onglet dossier + module Livraison | Module liste des "prets" sur statut, detail bloque sur readiness. | Module Livraison filtre par readiness; dossier affiche le detail du blocage. | Agent livraison travaille depuis la file, elle doit etre fiable. |
| Controle qualite forfaitaire | Ordres Travaux issus de l'import | QC devient une tache atelier. | Jalon QC hors ordres de main-d'oeuvre. | QC n'est pas une operation mecanicien/tolier. |
| Gestion utilisateurs | Parametres comptes | Ne gere pas les ressources planifiables. | Ajouter "Ressources atelier" ou liaison explicite compte/compagnon. | Chef atelier pense en compagnons, specialites, ponts, disponibilites. |
| Rapports SAV | Visible a plusieurs roles operationnels | Risque surcharge et exposition excessive. | Directeur + lecture/qualite selon besoin limite. | Reception/livraison ont besoin d'actions, pas d'analyse KPI complete. |
| Garantie / Satisfaction | Modules visibles reception/livraison/lecture | Peut etre utile mais hors parcours atelier immediat. | Garder en modules secondaires avec permissions fines. | Eviter surcharge visuelle a l'accueil et a la restitution. |
| Import fichier devis | Labels texte "Importer..." | Commandes pas assez explicites/accessibles. | Boutons nommes + status d'import. | Sur tablette, l'action doit etre evidente. |

## 5. Ameliorations proposees

Corrections urgentes :
- Refuser `submitQualityControl(..., "valide")` si `!ordresReparation.every(isRepairOrderDone)`.
- Ne jamais definir `DossierStatus.PRET_A_LIVRER` si `getDeliveryReadiness` retourne un blocage.
- Faire filtrer `LivraisonView` par readiness centrale, pas par statut seul.
- Corriger le logout live et ajouter un test de changement de compte.
- Ajouter un parcours de preparation ressources atelier avant planning.
- Corriger le responsive telephone et le menu lateral.

Ameliorations ergonomiques :
- Stepper reception coherent, messages warning/succes propres.
- Boutons photos/imports accessibles et tactiles.
- Desactiver visuellement les boutons interdits post-QC.
- Reduire le nombre d'onglets visibles sur dossier mobile/tablette.
- Nettoyer les libelles : "confirmed", "d'Vehicules", "commercialement".

Ameliorations metier :
- Revoir mapping import devis sur geometrie, diagnostic valise, faisceau, tolerie/peinture.
- Afficher un recap lisible du total atelier et de la mutualisation peinture.
- Separer comptes utilisateurs et ressources atelier, puis relier specialites.
- Ajouter un workflow clair "invalider QC avec motif" apres correction atelier.
- Distinguer prets a livrer, bloques livraison, non retires.

Preparation production :
- Supprimer placeholders demo et valeurs par defaut dangereuses.
- Rendre l'import base vehicules et ressources atelier visible dans une checklist avant pilote.
- Verifier toutes impressions A4 en CSS print-only.
- Completer audit trail : import devis, planning, refus, tentative interdite, changement role.
- Documenter limites localStorage et sauvegarde quotidienne.

Futures evolutions backend :
- Authentification serveur, sessions multi-postes, journal audit immuable.
- Synchronisation planning multi-utilisateur et verrouillage concurrent.
- Repositories backend pour dossiers, QC, livraison, ressources, vehicules.
- API ERP uniquement pour statut operationnel "pret facturation ERP", sans prix/paiement/stock reel.

## 6. Parcours utilisateur detailles

Directeur SAV :
- Fonctionne : dashboard, tous modules, KPI, audit local, documents.
- Gene : logout bloque, dashboard peut afficher pret a livrer incoherent, actions dangereuses tres visibles.
- Manque : alertes P0 "pret a livrer mais taches ouvertes", setup ressources.
- Recommandation : dashboard doit prioriser incoherences metier et onboarding production.

Receptionnaire / conseiller service :
- Fonctionne : reception guidee claire, creation dossier sans tache automatique, fiche reception imprimable.
- Gene : base vehicule vide, warning date ambigu, placeholders demo, stepper incoherent.
- Manque : import base vehicule guide, photo buttons clairs, validation champs obligatoires.
- Risque : saisie fictive VIN/km, erreur de donnees client/vehicule.

Chef Atelier :
- Fonctionne : file non affectee, planning, import devis, ordres de travaux.
- Gene : aucun compagnon disponible, import devis contradictoire, QC accessible trop tot.
- Manque : gestion ressources, affectation par specialite, validation import avec audit.
- Risque : aucune planification possible et mauvais metier reserve.

Technicien mecanicien :
- Fonctionne : mode technicien existe, actions demarrer/pause/bloquer/terminer prevues.
- Gene : aucun travail assignable faute ressource.
- Manque : liaison compte technicien -> ressource mecanicien, fiche tache mobile.
- Risque : atelier papier en parallele.

Technicien electricien :
- Fonctionne : etape "Reparation electrique" existe.
- Gene : diagnostic valise apparait contradictoire entre carte/table; ressource electricien absente.
- Manque : filtre strict electricite/diagnostic.
- Risque : tache electrique envoyee a mauvais profil.

Tolier / peintre :
- Fonctionne : etapes tolerie, preparation, peinture, remontage, finition existent; mutualisation peinture visible.
- Gene : pas de ressources tolier/peintre; peinture/tolerie non planifiables.
- Manque : cabine peinture comme ressource, peintre/tolier distincts, recap mutualisation.
- Risque : planning carrosserie impossible ou faux ETA.

Controle Qualite :
- Fonctionne : checklist complete, refus avec motif prevu, audit QC.
- Gene : validation possible alors que atelier non termine.
- Manque : garde "toutes taches fermees", retour atelier clair apres refus/invalidation.
- Risque : QC administratif sans realite atelier.

Agent Livraison / restitution :
- Fonctionne : livraison finale bloquee si taches ouvertes, PV/bon restitution disponible.
- Gene : file affiche faux pret, controles signature visibles meme bloque.
- Manque : liste separee "prets reels" vs "bloques".
- Risque : client appele trop tot.

Responsable satisfaction / lecture seule :
- Fonctionne : role lecture existe et n'a pas de permissions metier dans la matrice.
- Gene : live role non verifie a cause logout bloque; rapports/garantie/satisfaction visibles.
- Manque : verification boutons dangereux absents dans le build deploye.
- Risque : consultation trop large si donnees sensibles apparaissent plus tard.

## 7. Checklist finale GO / NO GO

| Etape | Decision | Conditions |
|---|---|---|
| Recette interne technique | GO conditionnel | Continuer tests en environnement controle avec donnees fictives. |
| Pilote terrain atelier | NO GO actuel | Corriger A-001 a A-006 minimum. |
| Production locale monoposte | NO GO actuel | Corriger QC/planning/logout/mobile, ajouter setup ressources et sauvegarde guidee. |
| Production multi-utilisateur | NO GO | Backend requis pour auth, audit, sync, verrouillage planning. |
| Backend requis | OUI avant prod finale | Ne pas improviser API; preparer migration propre. |
| Ancienne app Planning/Import Devis | A verifier strictement | Les tests de parite passent, mais l'UI preview observee doit etre alignee avec la source de verite. |

Decision finale : GO recette interne seulement, NO GO production finale. L'application a une base solide, mais le terrain ne pardonnera pas les incoherences QC/planning/pret-a-livrer.
