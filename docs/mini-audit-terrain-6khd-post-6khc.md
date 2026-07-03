# Mini-audit terrain 6K-H-D post Hotfix 6K-H-C

Date : 03/07/2026
Base verifiee : `9b6b735 Fix live logout and multi specialty dispatch`
URL live : https://irondrass.github.io/NIMR-SAV-PRO/
Perimetre : verification live GitHub Pages uniquement des corrections 6K-H-C.

## R-001

ID : R-001 - Deconnexion live immediate
Statut : OK
Role teste : Directeur SAV, puis Receptionnaire
Etapes :
- Connexion `directeur / 0000`.
- Controle du role affiche : `Directeur SAV`.
- Clic sur `Deconnexion`.
- Controle retour ecran login.
- Connexion `reception / 1111`.
- Controle du role affiche : `Receptionnaire`.
Resultat observe :
- Apres deconnexion, `login-screen` visible, bouton `logout-button` absent, role courant absent.
- La reconnexion reception affiche bien `Receptionnaire`.
Ecart restant : Aucun.
Decision : OK pour R-001.

## R-002

ID : R-002 - Session directeur non restauree apres reload
Statut : OK
Role teste : Directeur SAV, puis Receptionnaire
Etapes :
- Apres deconnexion Directeur SAV, rechargement de la page live.
- Controle de l'ecran apres reload.
- Connexion reception.
Resultat observe :
- Apres reload, l'ecran login reste visible.
- Aucun role `Directeur SAV` n'est restaure.
- La session reception demarre correctement apres login.
Ecart restant : Aucun.
Decision : OK pour R-002.

## R-003

ID : R-003 - Dispatch multi-specialite par tache
Statut : OK
Role teste : Chef d'atelier
Etapes :
- Dossier live utilise : `NIMR-2026-002`.
- Ressources live utilisees : `Meca Rapide Audit`, `Elec Audit`, `Tolier Audit`, `Peintre Audit`, `Finition Audit`.
- Controle des listes compatibles par tache.
- Affectation des taches mecaniques a `Meca Rapide Audit`.
- Verification que les taches electriques restent affectees a `Elec Audit`.
- Affectation des taches tolerie a `Tolier Audit`.
- Affectation de la tache peinture a `Peintre Audit`.
- Controle des boutons `Demarrer`.
Resultat observe :
- Mecanique : seules les options `Meca Rapide Audit` et `Meca Grand Audit` sont proposees.
- Electrique : seule l'option `Elec Audit` est proposee.
- Tolerie : seule l'option `Tolier Audit` est proposee, aucun mecanicien propose.
- Peinture : seule l'option `Peintre Audit` est proposee, aucun mecanicien propose.
- Les affectations electriques existantes restent intactes apres affectation mecanique.
- Apres affectation, les boutons `Demarrer` deviennent actifs sur les taches correctement affectees.
- Une tache non affectee reste avec `Demarrer` desactive, ce qui confirme le verrou par compagnon compatible.
Ecart restant : Aucun ecart bloquant observe.
Decision : OK pour R-003.

## R-004

ID : R-004 - Planning actionnable
Statut : OK
Role teste : Chef d'atelier
Etapes :
- Ouverture `Planning Atelier`.
- Controle de la carte `NIMR-2026-002` en statut `A reserver`.
- Verification de la presence des boutons `Reserver automatiquement` et `Proposer creneau`.
- Clic `Proposer creneau`.
- Verification de la proposition visible.
- Annulation de la proposition pour revenir au cas pur `A reserver`.
- Clic `Reserver automatiquement` sur la carte.
- Verification Gantt, ETA et fiche dossier.
Resultat observe :
- Les deux actions sont visibles sur les cartes `A reserver`.
- La proposition affiche : debut `03/07/2026 a 14:15`, fin estimee `06/07/2026 a 15:49`, technicien `Meca Rapide Audit`, pont `Pont rapide 1`, segments visibles.
- Apres reservation automatique : message `8 tache(s) du vehicule reservee(s) automatiquement`.
- Confirmation affichee : compagnon `Elec Audit`, baie `Pont diagnostic 1`, date `03/07/2026`, heure `14:15`, ETA `06/07/2026 16:12`.
- Gantt : blocs planifies/reserves visibles avec techniciens, ponts et horaires.
- ETA dossier : `06/07/2026 16:12`, fiabilite elevee, `Taches planifiees : 8`, `Taches non reservees : 0`.
- Onglet `RDV & Planning` du dossier synchronise : `Planning complet`, total reserve `13,58 h`, `6/6 etape(s) reservee(s)`, etapes mecanique, electrique, tolerie, peinture et finition reservees avec compagnons et ponts.
Ecart restant :
- Remarque non bloquante : apres le parcours de test avec proposition puis annulation, l'ancienne ligne de feedback `Reservation annulee` peut rester visible sur la carte reservations, alors que la confirmation automatique, le Gantt, l'ETA et la fiche dossier sont corrects.
Decision : OK pour R-004.

## R-006

ID : R-006 - Mobile accessibilite drawer
Statut : OK
Role teste : Chef d'atelier
Etapes :
- Passage viewport `390x844`.
- Controle bouton menu ferme.
- Ouverture du drawer.
- Controle overflow horizontal.
- Fermeture du drawer.
Resultat observe :
- Etat ferme : `aria-label="Ouvrir le menu"`, `aria-expanded="false"`.
- Etat ouvert : `aria-label="Fermer le menu"`, `aria-expanded="true"`, overlay visible.
- Etat referme : `aria-label="Ouvrir le menu"`, `aria-expanded="false"`, overlay absent.
- Aucun overflow horizontal : `innerWidth=390`, `scrollWidth=375`, `bodyScrollWidth=375`.
Ecart restant : Aucun.
Decision : OK pour R-006.

## Decision finale

Decision finale : GO Lot 7.

Motif :
- R-001 OK sur live.
- R-002 OK sur live.
- R-003 OK sur live.
- R-004 OK sur live.
- R-006 OK sur live.

Aucun commit, tag, `v1.1.1-rc4` ou demarrage Lot 7 n'a ete effectue pendant ce mini-reaudit.
