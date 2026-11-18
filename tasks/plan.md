# Implementation Plan: Page de diagnostic Pointer Events

Source spec: `SPEC.md`

## Overview

Créer le socle du dépôt (Vite + TypeScript, outillage qualité, PWA, déploiement GitHub Pages) et la page `diagnostic.html` qui mesure sur l'iPad 11 et le Pixel 9a les cinq hypothèses de saisie du Carnet magique, puis produit un rapport JSON. Ordre **risque d'abord** : on met une page minimale sur l'iPad le plus tôt possible (tâche 3) pour savoir dès le premier soir si le Metapen est vu comme `pen`.

## Architecture Decisions

- **Vite multi-pages** : `index.html` (accueil provisoire) et `diagnostic.html` comme deux entrées `build.rollupOptions.input`, `base: '/draw/'`.
- **Cœur pur, coquille DOM fine** : toute logique décisionnelle ou statistique (`palm-rejection`, `pointer-stats`, `timing-stats`, `incidents`, `report`) est sans DOM, avec le temps injecté → testée unitairement. Le DOM est confiné à `main.ts`, `environment.ts`, `stroke-renderer.ts` et à l'abonnement d'`incidents.ts`.
- **Mesure non perturbée** : les écouteurs Pointer Events ne font qu'enregistrer des échantillons dans des tampons ; le canvas est dessiné dans `requestAnimationFrame` (segments incrémentaux) ; les panneaux texte sont rafraîchis au plus à ~10 Hz. Ainsi l'affichage des mesures ne fausse pas les mesures.
- **Panneaux en surcouche repliable** : un tiroir repliable au-dessus du canvas (bas d'écran sur téléphone portrait, côté droit sur tablette paysage). Les événements sur le tiroir ne sont pas comptés comme tracé.
- **Version visible** : le SHA du commit (injecté au build via `define`) est affiché dans la page et inclus dans le rapport → on sait toujours quelle version tourne sur l'appareil malgré le cache du service worker.
- **PWA** : `vite-plugin-pwa` en `generateSW`, `registerType: 'autoUpdate'`, precache de tous les assets ; `start_url`/`scope` = `/draw/`.
- **CI unique** : un workflow `deploy.yml` sur push `master` : `npm ci` → `npm run check` → upload artefact → `actions/deploy-pages`. Un `check` rouge bloque le déploiement.

## Dependency Graph

```
T1 Scaffold + outillage
 ├── T2 Déploiement GitHub Pages
 │    └── T3 Diagnostic minimal (lecture F1 + tracé brut)  ← test iPad n°1
 │         ├── T4 PWA installable + hors ligne
 │         ├── T5 Palm rejection (TDD) + sélecteur
 │         └── T6 Renderer rAF + coalesced on/off + points bruts
 │              ├── T7 Fluidité F3 (TDD timing-stats)
 │              └── T8 Gestes système F5 (TDD incidents) + protections
 ├── T9 Environnement F6 (persist, infos appareil)   [après T4]
 └── T10 Stats + rapport F7 (TDD) + copier/partager  [après T5, T7, T8, T9]
      └── T11 Campagne appareils + conclusions
```

## Task List

Détail des tâches : `tasks/todo.md`.

### Phase 1 : Socle et premier contact avec l'iPad

- [x] T1 : Scaffold Vite + TS + Vitest/ESLint/Prettier
- [x] T2 : Déploiement continu GitHub Pages
- [x] T3 : Diagnostic minimal — lecture des Pointer Events + tracé brut

### Checkpoint A (sur appareils)

- [ ] `https://charlesdevandiere.github.io/draw/diagnostic.html` s'ouvre sur iPad et Pixel
- [ ] **Verdict préliminaire hypothèse 1** : `pointerType` affiché avec le Metapen

### Phase 2 : Cœur du diagnostic

- [x] T4 : PWA installable + hors ligne + version affichée
- [x] T5 : Palm rejection (3 stratégies, TDD) + sélecteur et réglages G/S
- [x] T6 : Renderer rAF, coalesced on/off, points bruts, effacer

### Checkpoint B (sur appareils)

- [ ] PWA installée sur les deux appareils, ouverture en mode avion OK
- [ ] Les 3 stratégies se comportent comme prévu avec le Metapen

### Phase 3 : Mesures complètes et rapport

- [x] T7 : Mesures de fluidité (F3)
- [x] T8 : Gestes système — protections on/off + incidents (F5)
- [x] T9 : Environnement PWA et stockage (F6)
- [ ] T10 : Statistiques par pointerType + rapport JSON copier/partager (F7)

### Checkpoint C

- [ ] `npm run check` vert, couverture ≥ 90 % sur les modules purs
- [ ] Rapport copiable sur les deux appareils

### Phase 4 : Campagne de mesure

- [ ] T11 : Protocole manuel sur les 3 configurations + `docs/diagnostic/conclusions.md`

### Checkpoint final

- [ ] Les 8 Success Criteria de `SPEC.md` sont remplis
- [ ] `CLAUDE.md` mis à jour (commandes, structure, conclusions clés)

## Risks and Mitigations

| Risque                                                           | Impact                                              | Mitigation                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Le Metapen n'est pas vu comme `pen`                              | Élevé (remet en cause F4 et la stratégie de saisie) | Détecté dès T3 ; on continue le diagnostic (le rapport documente le comportement réel) et on replanifie la saisie avant le MVP |
| Cache du service worker : l'appareil exécute une vieille version | Moyen (mesures attribuées à la mauvaise version)    | SHA affiché dans la page et le rapport ; `autoUpdate` ; bouton/indication de rechargement                                      |
| Mauvais `base` / chemins sous `/draw/`                           | Moyen (page blanche sur Pages)                      | Déploiement mis en place dès T2, vérifié avant toute fonctionnalité                                                            |
| Rafraîchir les panneaux perturbe les mesures                     | Moyen (fréquences/latences faussées)                | Écouteurs minimalistes, rendu rAF, panneaux throttlés ~10 Hz                                                                   |
| Clipboard API refusée en PWA standalone iOS                      | Faible                                              | Web Share en premier, `<textarea>` de repli                                                                                    |
| Gestes système non bloquables (bords d'écran iOS)                | Faible pour l'étape 0                               | C'est précisément ce qu'on mesure ; consigné dans les conclusions                                                              |

## Décisions (questions résolues)

- `@vitest/coverage-v8` ajouté en dépendance de dev (seuil de couverture).
- **Aucun push par l'agent** : l'utilisateur pousse toujours lui-même. Les vérifications sur appareil des checkpoints A/B/C se font donc après ses pushs.
- GitHub Pages est activé (source : GitHub Actions).
