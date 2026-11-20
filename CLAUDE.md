# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Projet Vite + TypeScript (sans framework). L'étape 0, la page de diagnostic Pointer Events (`spec/SPEC-diagnostic.md`, `diagnostic.html`), est terminée : rapports et **conclusions dans `docs/diagnostic/conclusions.md`**, à lire avant de concevoir la saisie du MVP. Plan et tâches de l'étape 0 : `tasks/diagnostic/`. Prochaine étape : le MVP, spécifié dans **`spec/SPEC-mvp.md`**.

Commandes :

```
npm ci                 # installer
npm run dev            # serveur de dev (exposé sur le réseau local)
npm run build          # tsc --noEmit && vite build → dist/ (base '/draw/')
npm run preview        # prévisualiser le build
npm test               # vitest run (env node)
npx vitest run src/chemin/fichier.test.ts -t "nom du test"   # un seul test
npm run lint           # eslint .
npm run format         # prettier --write .
npm run check          # lint + format:check + tests avec couverture (seuil 90 %) + build
```

Structure : `index.html` (accueil provisoire), `diagnostic.html` + `src/diagnostic/` (page de diagnostic, à garder pour tester de nouveaux appareils), `src/input/palm-rejection.ts` (logique pure de filtrage), `vite.config.ts` (base `/draw/`, entrées multi-pages, PWA, config Vitest), tests `src/**/*.test.ts`. Le DOM est confiné à quelques fichiers exclus de la couverture (liste dans `vite.config.ts`) ; tout le reste est pur et testé (seuil 90 %).

Déploiement : chaque push sur `master` passe `npm run check` puis publie sur `https://charlesdevandiere.github.io/draw/` (GitHub Actions). **Ne jamais pousser : l'utilisateur pousse lui-même.**

La vision produit, le périmètre MVP, les hypothèses à valider et la liste « Not Doing » sont dans **`docs/ideas/carnet-magique.md`** — à lire avant toute décision de fonctionnalité ou d'architecture.

## Objectif

« Carnet magique » : PWA de dessin pour enfants de 5 ans et plus (dessin libre, coloriages anti-dépassement, modèles de lettres à tracer), sans compte, sans backend, hors ligne. Cibles :

- iPad (Safari iPadOS, PWA installée), au stylet **et** au doigt ;
- smartphones iOS et Android (Safari / Chrome), au doigt.

PC (souris / tactile) : non ciblé pour la validation, mais le code doit rester standard pour ne pas l'exclure.

**Appareils de référence** — une fonctionnalité n'est terminée que lorsqu'elle est validée sur les trois :

1. iPad 11 + stylet Metapen ;
2. iPad 11 au doigt ;
3. Google Pixel 9a au doigt.

## Stack

- **Vite + TypeScript, sans framework UI** (Angular écarté : aucune plus-value pour une app essentiellement canvas).
- `vite-plugin-pwa` (Workbox) pour le service worker et le manifeste.
- **Bootstrap uniquement pour les écrans « adulte »** (galerie détaillée, réglages, export). L'écran de dessin enfant utilise du CSS sur mesure : pictogrammes sans texte, cibles tactiles ≥ 48 px.
- Stockage : IndexedDB.

## Contraintes techniques structurantes

- **Moteur de dessin en TypeScript pur**, découplé de l'UI (pas de dépendance DOM hors canvas fourni), testable unitairement.
- **Pointer Events** comme API d'entrée unique ; `touch-action: none` sur la surface de dessin ; `getCoalescedEvents()` quand disponible, avec fallback.
- **Un trait en cours par `pointerId`** (jamais un « trait courant » unique) : prépare le multi-doigts simultané.
- **Mode de saisie au choix : « Stylet » / « Doigt » / « Multi doigts »** (détail dans `docs/diagnostic/conclusions.md`). Stylet : seuls les `pen` dessinent (proposé dès qu'un `pen` est détecté). Doigt : un seul contact dessine, la place ne se libère que quand plus rien ne touche l'écran ; filtre de largeur de contact contre la paume à tester avec des mains d'enfant. Multi doigts : tous les contacts dessinent. **Aucun geste au doigt réservé au pan/zoom** : pas de zoom, la page a la taille de l'écran.
- **`getCoalescedEvents()` indispensable** (le Metapen n'envoie que 60 événements/s, 4 points chacun). **Un appui sans mouvement dessine un point** (le canvas ignore les segments de longueur nulle).
- **Ne pas dépendre de `pressure`/`tilt`** : valeurs factices et fixes au Metapen (mesuré), nulles au doigt sur iPad. Épaisseur fixe (ou simulée par la vitesse). Ne jamais se fier au user-agent (Safari iPad se dit `Macintosh`).
- **Format de page fixe, choisi à la création** : carré, A4 portrait ou A4 paysage (ratio 1:√2). La page est mise à l'échelle et centrée dans l'écran (letterboxing). **Les points sont stockés en coordonnées de page, jamais en pixels écran** : conversion écran → page à l'entrée, page → écran au rendu (tenir compte de `devicePixelRatio`). Chaque coloriage / modèle de lettres déclare son format.
- **Dessins stockés en vectoriel** (points + horodatage) — indispensable au replay, aux calques de fond (coloriages, modèles de lettres) et à l'export. Surveiller la taille, simplifier les points si besoin.
- **Anti-dépassement** : coloriages SVG dont chaque zone est un chemin fermé ; au `pointerdown`, détecter la zone (`isPointInPath`) et clipper le trait dessus.
- **Neutraliser les gestes système** (loupe/appui long, double-tap zoom, sélection, menu contextuel, pull-to-refresh) sur iOS et Android : protections obligatoires, liste dans `docs/diagnostic/conclusions.md`. Les glissés depuis les bords haut et bas sont au système et non bloquables : **aucune commande près de ces bords**.
- **Mise à jour de la PWA** : rechercher une nouvelle version à chaque retour au premier plan (une PWA iOS reprend sans naviguer et reste sinon sur l'ancienne version), plus un moyen manuel dans l'écran adulte.
- **Persistance** : `navigator.storage.persist()` (accordé en PWA installée sur iPad et sur Chrome Android ; refusé par Brave, Chrome est la cible Android), sauvegarde automatique silencieuse, export/import manuel de la galerie comme filet de sécurité.
- **UI adaptative** smartphone portrait ↔ tablette paysage.
- Safari iOS est la cible la plus restrictive : vérifier la compatibilité iOS de toute API web utilisée.

## Première étape (terminée)

Page de diagnostic testée sur les trois configurations de référence : le Metapen est bien vu comme `pen` par Safari. Résultats et décisions : `docs/diagnostic/conclusions.md`.
