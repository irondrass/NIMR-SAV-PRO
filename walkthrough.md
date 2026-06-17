# Walkthrough NIMR SAV PRO v1.1.0 - Lot 6E Hardening metier pre-RC

## Objectif

Valider le durcissement metier pre-Release Candidate sans extension de perimetre finance, ERP, backend, stock reel ou donnees reelles.

## Parcours verifies

1. **Reception**
   - Telephone, VIN, immatriculation, kilometrage, client et plainte sont controles avant creation.
   - Les champs libres sont neutralises contre les balises et scripts.
   - La creation dossier passe par une confirmation interne et bloque le double-clic.

2. **Atelier / Technicien**
   - La cloture d'une tache exige un diagnostic final explicite.
   - Les diagnostics courts ou generiques sont refuses.
   - Les actions critiques sont protegees contre les clics multiples.

3. **Controle qualite**
   - Validation et refus passent par des modals internes.
   - Le refus QC exige un motif et un commentaire exploitable.
   - La decision est journalisee dans l'audit trail.

4. **Livraison**
   - Le kilometrage de sortie doit etre valide et coherent avec le kilometrage d'entree.
   - La restitution exige checklist/signature et confirmation finale.
   - La livraison est journalisee et protegee contre les doubles validations.

5. **Documents internes**
   - Bon de reception, ordre de reparation, controle qualite et bon de livraison sont imprimables depuis le dossier.
   - Les documents restent operationnels et ne contiennent pas de vocabulaire finance, caisse, marge ou stock reel.

6. **Session et roles**
   - La session locale expire apres 30 minutes d'inactivite.
   - L'activite utilisateur rafraichit la session.
   - Le mode lecture seule ne presente pas d'actions critiques.

## Validations executees

| Commande | Resultat |
| :--- | :--- |
| `npm run lint` | Reussi |
| `npm test` | Reussi |
| `npm run build` | Reussi, avec avertissement Vite non bloquant sur la taille des chunks |
| `npm run qa:agent` | Reussi - 116/116 invariants |
| `npm run test:e2e -- --reporter=line` | Reussi - 318/318 tests Playwright |

## Decision

Lot 6E valide localement. Aucun tag Git `v1.1.0` n'a ete cree.
