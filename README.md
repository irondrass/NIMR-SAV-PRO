# NIMR SAV PRO v1.0.1

NIMR SAV PRO est une nouvelle application interne de pilotage SAV, atelier et relation client.

Elle est basée sur l'ancienne application NIMR SAV, mais elle est séparée techniquement :

- version corrective propre : `v1.0.1`
- nouveau nom de package : `nimr-sav-pro`
- nouvelle base GitHub Pages : `/NIMR-SAV-PRO/`
- nouvelles clés `localStorage` préfixées `nimr-sav-pro`
- cache PWA réservé si un service worker est ajouté : `nimr-sav-pro-v1.0.1`
- aucun cache PWA ou service worker partagé avec l'ancienne application
- données de démonstration fictives uniquement

## Développement local

Prérequis : Node.js.

```bash
npm ci
npm run dev
```

## Validation

```bash
npm test
npm run lint
npm run build
```

Le build GitHub Pages doit générer des assets sous `/NIMR-SAV-PRO/assets/...`.
