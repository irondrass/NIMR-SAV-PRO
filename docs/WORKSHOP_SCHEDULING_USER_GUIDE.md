# Guide utilisateur - Planification atelier

## Acces

La vue `Pilotage Atelier` est disponible pour le Directeur SAV, le Chef
d'atelier, la Reception et la Lecture seule. Le Technicien utilise sa vue
terrain habituelle.

## Proposer un creneau

1. Ouvrir `Pilotage Atelier`.
2. Selectionner une tache non affectee.
3. Cliquer sur `Rechercher le premier creneau`.
4. Comparer le creneau recommande et les alternatives.
5. Verifier le score, les techniciens, les ressources et l'alerte de date
   promise.
6. Enregistrer le brouillon ou confirmer la reservation.

Une proposition locale n'est pas une reservation atelier. Le bandeau
`Propositions locales uniquement` signifie qu'aucune ressource n'est bloquee
sur le serveur. La confirmation n'est acquise que lorsque le message
`Reservation confirmee atomiquement par le serveur` apparait.

## Conflits

Le moteur explique la cause : technicien occupe, ressource indisponible,
vehicule deja immobilise, competence manquante, piece indisponible ou prerequis
non termine. Relancer la recherche pour obtenir le prochain creneau commun.

## Execution

Le Technicien demarre, met en pause, reprend et termine depuis `Mode
Technicien`. Une pause ou un blocage exige un motif. Une tache terminee passe
au controle qualite.

## Controle qualite

Le Controle Qualite renseigne la checklist, les observations et les photos. Une
non-conformite reouvre la tache et conserve la trace du refus. Une validation
finale permet le passage a la livraison.

## Mode hors ligne

Les observations, photos et brouillons peuvent etre conserves localement. Une
reservation definitive exige toujours une connexion et une session serveur.
Les conflits et erreurs de synchronisation restent visibles et ne sont pas
relances indefiniment.
