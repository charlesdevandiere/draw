# Spec: Carnet magique — Page de diagnostic Pointer Events — V1

Étape 0 du projet (voir `docs/ideas/carnet-magique.md`). Elle pose aussi le socle technique définitif du dépôt : projet Vite + TypeScript, PWA, outillage qualité, déploiement continu.

## Objective

**Pourquoi.** Toute l'architecture de saisie du Carnet magique repose sur des hypothèses non vérifiées sur les vrais appareils :

1. le stylet Metapen est vu comme `pointerType: "pen"` par Safari iPadOS ;
2. on peut ignorer la paume quand le stylet est actif sans que le doigt reste « bloqué » ;
3. les gestes système (loupe, appui long, double-tap zoom, sélection, pull-to-refresh) sont neutralisables ;
4. le tracé est fluide (fréquence d'échantillonnage, `getCoalescedEvents()`) ;
5. en PWA installée, le stockage peut être rendu persistant.

**Quoi.** Une page `diagnostic.html`, installable en PWA, servie en HTTPS sur GitHub Pages, qui mesure ces points en direct sur l'appareil et produit un **rapport JSON** copiable/partageable.

**Pour qui.** Le développeur (pas l'enfant). La page reste dans le dépôt après l'étape 0 pour tester de nouveaux appareils.

**Appareils de référence :** iPad 11 + Metapen, iPad 11 au doigt, Pixel 9a au doigt.

### Fonctionnalités

**F1 — Lecture en direct des Pointer Events**

- Panneau affichant, pour chaque pointeur actif (`pointerId`) : `pointerType`, `isPrimary`, `pressure`, `tangentialPressure`, `tiltX`, `tiltY`, `twist`, `altitudeAngle`/`azimuthAngle` (si présents), `width`, `height`, `buttons`.
- Nombre de coalesced events du dernier `pointermove`, et support de `getCoalescedEvents()` / `getPredictedEvents()` (détection par fonctionnalité).

**F2 — Surface de tracé**

- Canvas plein écran (hors panneaux), `touch-action: none`, rendu tenant compte de `devicePixelRatio`, rendu dans une boucle `requestAnimationFrame`.
- Un trait par `pointerId`, couleur selon `pointerType` (pen / touch / mouse), épaisseur fixe.
- Interrupteur **coalesced on/off** ; option d'affichage des points bruts (un point par échantillon) pour voir la densité.
- Bouton « Effacer ».

**F3 — Mesures de fluidité**

- Par `pointerType` : fréquence d'échantillonnage en Hz (avec et sans coalesced), nombre moyen de coalesced events par `pointermove`.
- Durée de frame (moyenne, p95) et délai événement → rendu estimé (`performance.now()` au rendu − `event.timeStamp`).

**F4 — Stratégies de palm rejection (comparables en direct)**
Sélecteur à 3 positions :

- **Aucune** : tout pointeur dessine.
- **Pendant le trait** : tant qu'un `pen` est en contact, et pendant une grâce de `G` ms après son `pointerup` (défaut 500 ms), les `touch` sont ignorés.
- **Session stylet** : dès qu'un `pen` est vu, les `touch` sont ignorés jusqu'à `S` s sans activité stylet (défaut 10 s).
  `G` et `S` sont réglables. Les contacts ignorés sont visualisés (marqueur discret) et comptés. Un indicateur montre l'état courant (« doigt actif » / « doigt ignoré »).

**F5 — Gestes système**

- Interrupteur **protections anti-gestes on/off** (on par défaut) regroupant : `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `overscroll-behavior: none`, viewport sans zoom, `preventDefault` sur `contextmenu`, `selectstart`, `dblclick`, `gesturestart` (iOS), `touchstart`/`touchmove` non passifs sur la surface.
- Compteurs d'**incidents** : `pointercancel` (par `pointerType`), `touchcancel`, `contextmenu`, `selectionchange` avec sélection non vide, `visualViewport.scale ≠ 1`, défilement de la page, rechargement involontaire (compteur en `sessionStorage`).

**F6 — Environnement PWA et stockage**

- Mode d'affichage (`display-mode: standalone` / `navigator.standalone`), `navigator.storage.persisted()`, bouton « Demander la persistance » (`persist()`), `navigator.storage.estimate()`.
- Infos appareil : `userAgent`, `userAgentData` si dispo, taille d'écran et de viewport, `devicePixelRatio`, `maxTouchPoints`, `matchMedia('(pointer: fine|coarse)')`, `(any-hover)`.

**F7 — Rapport**

- Bouton « Copier le rapport » (Clipboard API) et « Partager » (Web Share API, si dispo) ; repli : rapport affiché dans un `<textarea>` sélectionnable.
- Contenu JSON : version du rapport, date, infos appareil (F6), et pour chaque `pointerType` vu : nombre d'événements, min/max/valeurs distinctes de `pressure`, min/max de `tiltX`/`tiltY`/`altitudeAngle`, présence de `twist`, `width/height` min/max, fréquences (F3), compteurs d'incidents (F5) avec l'état des protections, compteurs de contacts ignorés par stratégie (F4).
- Bouton « Réinitialiser les mesures ».

**F8 — PWA et page d'accueil provisoire**

- Manifest + service worker (`vite-plugin-pwa`, precache de tous les assets) : l'app est installable et la page de diagnostic fonctionne hors ligne une fois installée.
- `index.html` provisoire : titre « Carnet magique », lien vers le diagnostic. `start_url` et `scope` = racine de l'app, pour que la navigation reste en mode standalone.
- Icônes provisoires (192, 512, maskable, `apple-touch-icon` 180) produites une fois depuis un SVG et commitées.

## Tech Stack

- **Node 24**, **npm**.
- **Vite** + **TypeScript** (`strict: true`), sans framework UI, sans Bootstrap pour cette page.
- **vite-plugin-pwa** (Workbox, `generateSW`).
- **Vitest** (environnement `node` pour la logique pure), **ESLint** (flat config + `typescript-eslint`), **Prettier**.
- Versions : dernière version stable de chaque paquet au moment du scaffolding, figées par `package-lock.json`.
- Déploiement : **GitHub Pages via GitHub Actions**, URL `https://charlesdevandiere.github.io/draw/` → `base: '/draw/'` dans Vite.

## Commands

```
Installer :        npm ci
Dev (réseau local): npm run dev            # vite --host
Build :            npm run build           # tsc --noEmit && vite build
Prévisualiser :    npm run preview         # vite preview --host (teste le SW en local)
Tests :            npm test                # vitest run
Tests (watch) :    npm run test:watch      # vitest
Un seul test :     npx vitest run src/input/palm-rejection.test.ts -t "ignore le doigt pendant la grâce"
Lint :             npm run lint            # eslint .
Format :           npm run format          # prettier --write .
Tout vérifier :    npm run check           # lint + format --check + test (couverture ≥ 90 %) + build
```

## Project Structure

```
index.html                       → Accueil provisoire (lien vers le diagnostic)
diagnostic.html                  → Page de diagnostic (entrée Vite multi-pages)
vite.config.ts                   → base '/draw/', entrées multiples, vite-plugin-pwa
public/icons/                    → Icônes PWA provisoires (PNG) + source SVG
src/
  input/                         → Logique de saisie RÉUTILISÉE par le futur moteur
    palm-rejection.ts            → Stratégies none / during-stroke / pen-session (pur)
    palm-rejection.test.ts
  diagnostic/                    → Spécifique à la page de diagnostic
    main.ts                      → Câblage DOM, écouteurs, boucle rAF
    pointer-sample.ts            → Extraction d'un échantillon sérialisable depuis un PointerEvent
    pointer-stats.ts             → Agrégation des échantillons → statistiques (pur)
    pointer-stats.test.ts
    timing-stats.ts              → Fréquences, moyenne/p95 de durées (pur)
    timing-stats.test.ts
    incidents.ts                 → Compteurs d'incidents de gestes (pur)
    incidents.test.ts
    gesture-protections.ts       → Protections anti-gestes on/off + écoute des incidents (DOM)
    environment.ts               → Infos appareil / PWA / stockage (DOM)
    report.ts                    → Construction du rapport JSON (pur)
    report.test.ts
    stroke-renderer.ts           → Rendu canvas des traits (DOM)
    diagnostic.css
.github/workflows/deploy.yml     → check + build + déploiement Pages sur push master
docs/ideas/                      → Notes de cadrage
docs/diagnostic/                 → Rapports JSON collectés sur les appareils + conclusions
```

Règle : tout ce qui est **pur** (sans DOM) est testé unitairement ; le DOM est confiné à `main.ts`, `environment.ts`, `stroke-renderer.ts` et `gesture-protections.ts`.

## Code Style

```ts
// src/input/palm-rejection.ts
export type PalmRejectionStrategy = 'none' | 'during-stroke' | 'pen-session';

export interface PalmRejectionOptions {
  strategy: PalmRejectionStrategy;
  /** Grâce après le dernier pointerup du stylet (stratégie during-stroke). */
  graceMs: number;
  /** Durée sans activité stylet avant de réactiver le doigt (stratégie pen-session). */
  sessionMs: number;
}

export interface PointerInput {
  pointerType: string;
  phase: 'down' | 'move' | 'up';
  timeStamp: number;
}

/** Décide si un contact doit dessiner. État interne mis à jour à chaque appel. */
export function createPalmRejector(options: PalmRejectionOptions) {
  let pensDown = 0;
  let lastPenActivity = Number.NEGATIVE_INFINITY;

  return function accepts(input: PointerInput): boolean {
    if (input.pointerType === 'pen') {
      if (input.phase === 'down') pensDown += 1;
      if (input.phase === 'up') pensDown = Math.max(0, pensDown - 1);
      lastPenActivity = input.timeStamp;
      return true;
    }
    if (input.pointerType !== 'touch') return true;
    // ...
  };
}
```

- Fichiers en `kebab-case.ts`, tests à côté (`*.test.ts`).
- Fonctions et fabriques plutôt que classes ; état explicite et local.
- Pas de `any`, pas de `@ts-ignore` ; détection par fonctionnalité (`'getCoalescedEvents' in event`), **jamais par user-agent** pour changer un comportement (UA uniquement dans le rapport).
- Le temps est injecté (`timeStamp` en paramètre), jamais lu via `Date.now()` dans la logique pure : tests déterministes.
- Identifiants et commentaires de code en anglais ; textes UI et docs en français.
- Formatage : Prettier par défaut (`singleQuote: true`, `printWidth: 100`).

## Testing Strategy

- **Unitaire (Vitest, env `node`)** : `palm-rejection`, `pointer-stats`, `timing-stats`, `incidents` (comptage), `report`. Entrées = objets simples simulant des échantillons ; aucune dépendance au DOM. Couverture visée : ≥ 90 % des lignes de `src/input/` et des modules purs de `src/diagnostic/`.
- **Cas obligatoires pour `palm-rejection`** : chaque stratégie ; doigt accepté avant tout stylet ; doigt ignoré pendant le contact stylet ; doigt ignoré pendant la grâce puis accepté après ; session expirée après `sessionMs` ; deux stylets ; souris jamais rejetée ; `up` sans `down` ne rend pas le compteur négatif.
- **Pas de tests E2E automatisés** : la vraie validation est **manuelle sur appareils** (le comportement de Safari iPadOS n'est pas reproductible en émulateur).
- **Protocole manuel** (à exécuter sur chacune des 3 configurations, PWA installée) :
  1. Installer depuis `https://charlesdevandiere.github.io/draw/`, ouvrir le diagnostic en mode standalone, demander la persistance.
  2. Tracer 30 s (écriture, gribouillage rapide, cercles lents), coalesced on puis off.
  3. Protections on : appui long 3 s, double-tap, pincement, glissé depuis chaque bord, glissé vers le bas en haut de page. Noter les incidents. Recommencer protections off.
  4. (iPad + stylet) Écrire paume posée avec chaque stratégie ; puis alterner stylet / doigt seul et vérifier que le doigt redevient actif.
  5. Passer en mode avion, relancer l'app : elle doit s'ouvrir.
  6. Copier le rapport et l'enregistrer dans `docs/diagnostic/<appareil>-<config>.json`.

## Boundaries

- **Always** : `npm run check` vert avant tout commit ; logique pure testée avant d'être câblée au DOM ; détection par fonctionnalité ; toute API utilisée vérifiée pour Safari iOS ; enregistrer les rapports d'appareils et les conclusions dans `docs/diagnostic/`.
- **Ask first** : ajouter une dépendance hors de la liste Tech Stack ; changer `base`, l'URL de déploiement ou le workflow GitHub Actions au-delà de sa création ; modifier les valeurs par défaut `G`/`S` ; toute UI destinée à l'enfant (hors périmètre).
- **Never** : committer de secret ; brancher un comportement sur le user-agent ; dépendre de `pressure`/`tilt` pour une décision de saisie ; désactiver une règle de lint ou un test pour passer au vert ; pousser sur `master` sans accord.

## Success Criteria

1. `npm run check` passe en local et dans GitHub Actions ; tout push sur `master` publie sur `https://charlesdevandiere.github.io/draw/`.
2. Lighthouse (Chrome desktop) ne signale aucun défaut d'installabilité PWA ; l'app s'installe sur l'iPad 11 (Safari « Sur l'écran d'accueil ») et sur le Pixel 9a (Chrome « Installer l'application »).
3. Une fois installée et ouverte une fois, la page de diagnostic se charge en mode avion sur les deux appareils.
4. Sur chaque appareil, les panneaux F1/F3/F6 se mettent à jour en direct pendant le tracé sans saccade visible, et le tracé suit le stylet/doigt sans défilement ni zoom de la page (protections on).
5. Les trois stratégies de F4 sont sélectionnables et leurs effets visibles (contacts ignorés marqués et comptés).
6. Le bouton « Copier le rapport » produit un JSON valide contenant tous les champs de F7, sur les 3 configurations (ou le repli `<textarea>` fonctionne).
7. Tests unitaires couvrant les cas obligatoires de `palm-rejection`, couverture ≥ 90 % sur les modules purs.
8. **Livrable final** : 3 rapports dans `docs/diagnostic/` + un `docs/diagnostic/conclusions.md` répondant oui/non à chacune des 5 hypothèses de l'Objective, avec la stratégie de palm rejection retenue et la liste des protections anti-gestes nécessaires.

## Out of Scope (Deferred)

- Moteur de dessin du MVP (couleurs, gomme, annuler, formats de page) — après les conclusions du diagnostic.
- Stockage IndexedDB des dessins, galerie, replay — MVP.
- Bootstrap et UI enfant — MVP.
- Lissage du trait, simulation d'épaisseur par la vitesse — MVP, selon les mesures F3.
- Tests ciblés PC souris / tactile — après le MVP (cf. note de cadrage).
- Tests E2E automatisés (Playwright) — peu de valeur tant que la cible critique est Safari iPadOS réel.
- Mesure de latence physique (caméra haute vitesse) — l'estimation logicielle de F3 suffit.

## Open Questions

1. **Activation de Pages** : il faudra régler une fois _Settings → Pages → Source : GitHub Actions_ sur le dépôt (action manuelle de votre côté).

Résolues : dépôt public (GitHub Pages gratuit) ; valeurs par défaut `G = 500 ms` et `S = 10 s` validées.
