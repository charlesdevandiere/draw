# Tâches — Page de diagnostic Pointer Events

Spec : `SPEC.md` · Plan : `tasks/plan.md`

Definition of Done commune : `npm run check` vert, code conforme à la section Code Style de la spec, commit atomique.

---

## Phase 1 : Socle et premier contact avec l'iPad

### - [x] T1 : Scaffold Vite + TS + Vitest/ESLint/Prettier

**Description :** Créer le projet Vite vanilla-ts (multi-pages, `base: '/draw/'`), TypeScript strict, Vitest (env `node`), ESLint flat config + typescript-eslint, Prettier (`singleQuote`, `printWidth: 100`), scripts npm de la spec. Nettoyer le `.gitignore` hérité d'Angular. `index.html` provisoire « Carnet magique ».

**Acceptance criteria :**

- [x] Tous les scripts de la section Commands existent et fonctionnent (`dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `format`, `check`)
- [x] Un test trivial passe ; un fichier mal formaté / une erreur de lint font échouer `check`
- [x] `npm run build` produit `dist/` avec des chemins préfixés `/draw/`

**Verification :**

- [x] `npm run check`
- [x] `npm run preview` puis ouvrir `http://localhost:4173/draw/`

**Dependencies :** aucune
**Files :** `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `.gitignore` (fichiers de config uniquement)
**Scope :** M

---

### - [x] T2 : Déploiement continu GitHub Pages

**Description :** Workflow `.github/workflows/deploy.yml` : sur push `master` → `npm ci`, `npm run check`, build, `actions/upload-pages-artifact`, `actions/deploy-pages`. Activation manuelle de Pages par l'utilisateur.

**Acceptance criteria :**

- [x] Un push sur `master` publie `https://charlesdevandiere.github.io/draw/`
- [x] Un `check` en échec empêche le déploiement

**Verification :**

- [ ] Run GitHub Actions vert (`gh run watch`)
- [ ] L'URL affiche l'accueil provisoire sur l'iPad et le Pixel

**Dependencies :** T1
**Files :** `.github/workflows/deploy.yml`
**Scope :** S

---

### - [x] T3 : Diagnostic minimal — lecture des Pointer Events + tracé brut

**Description :** Page `diagnostic.html` + `src/diagnostic/main.ts` + `pointer-sample.ts` (extraction d'un échantillon sérialisable). Panneau F1 (propriétés par `pointerId`, support coalesced/predicted, nombre de coalesced du dernier move). Canvas plein écran `touch-action: none`, un trait par `pointerId` coloré selon `pointerType` (rendu direct, sans optimisation). SHA du commit affiché.

**Acceptance criteria :**

- [x] Toutes les propriétés de F1 s'affichent en direct pour chaque pointeur actif
- [x] Deux doigts tracent deux traits distincts simultanément
- [x] La page ne défile ni ne zoome pendant le tracé (au minimum `touch-action: none`)

**Verification :**

- [x] `npx vitest run src/diagnostic/pointer-sample.test.ts`
- [x] `npm run check`
- [ ] Manuel après déploiement : iPad + Metapen, iPad au doigt, Pixel au doigt

**Dependencies :** T2
**Files :** `diagnostic.html`, `src/diagnostic/main.ts`, `src/diagnostic/pointer-sample.ts`, `src/diagnostic/pointer-sample.test.ts`, `src/diagnostic/diagnostic.css`
**Scope :** M

### Checkpoint A (sur appareils)

- [ ] Diagnostic accessible sur iPad et Pixel
- [ ] Verdict préliminaire hypothèse 1 (Metapen = `pen` ?) noté dans `docs/diagnostic/notes.md`
- [ ] Revue avec l'utilisateur avant la phase 2

---

## Phase 2 : Cœur du diagnostic

### - [x] T4 : PWA installable + hors ligne

**Description :** `vite-plugin-pwa` (`generateSW`, `autoUpdate`, precache complet), manifest (nom, couleurs, `start_url`/`scope` `/draw/`, `display: standalone`), icônes provisoires 192/512/maskable/apple-touch-icon 180 générées une fois depuis un SVG, balises iOS (`apple-mobile-web-app-capable`, etc.). Lien accueil → diagnostic.

**Acceptance criteria :**

- [ ] Lighthouse : aucun défaut d'installabilité
- [ ] Installée, l'app s'ouvre en standalone et la navigation accueil → diagnostic reste en standalone
- [ ] Après une première ouverture, l'app se charge en mode avion

**Verification :**

- [ ] `npm run check`, `npm run preview` + Lighthouse
- [ ] Manuel : installation iPad (Safari) et Pixel (Chrome), test mode avion

**Dependencies :** T3
**Files :** `vite.config.ts`, `index.html`, `diagnostic.html`, `public/icons/*`
**Scope :** M

---

### - [x] T5 : Palm rejection — 3 stratégies (TDD) + sélecteur

**Description :** `src/input/palm-rejection.ts` écrit en TDD (stratégies `none`, `during-stroke` G=500 ms, `pen-session` S=10 s, cas obligatoires de la spec). Câblage dans `main.ts` : sélecteur, champs G/S, contacts ignorés marqués et comptés, indicateur « doigt actif / ignoré ».

**Acceptance criteria :**

- [x] Tous les cas obligatoires de la spec sont couverts par des tests, couverture ≥ 90 % du module
- [x] Changer de stratégie en direct change le comportement sans recharger
- [x] Les contacts ignorés sont visibles et comptés par stratégie

**Verification :**

- [x] `npx vitest run src/input/palm-rejection.test.ts`
- [x] `npm run check`
- [ ] Manuel iPad + Metapen : écrire paume posée avec chaque stratégie

**Dependencies :** T3
**Files :** `src/input/palm-rejection.ts`, `src/input/palm-rejection.test.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope :** M

---

### - [x] T6 : Renderer rAF, coalesced on/off, points bruts

**Description :** `stroke-renderer.ts` : rendu incrémental dans `requestAnimationFrame`, canvas dimensionné en `devicePixelRatio`, redimensionnement/rotation gérés. Interrupteurs coalesced on/off et points bruts, bouton Effacer. Les écouteurs ne font plus qu'enregistrer dans des tampons ; panneaux throttlés ~10 Hz. Tiroir de panneaux repliable.

**Acceptance criteria :**

- [ ] Tracé net (pas flou) sur écran Retina et après rotation
- [ ] Coalesced off → points visiblement plus espacés en tracé rapide (si l'appareil fournit des coalesced events)
- [x] Les panneaux ne se rafraîchissent pas plus de ~10 fois/s

**Verification :**

- [x] `npm run check`
- [ ] Manuel : tracé rapide coalesced on/off avec points bruts, sur iPad et Pixel ; rotation de l'appareil

**Dependencies :** T3
**Files :** `src/diagnostic/stroke-renderer.ts`, `src/diagnostic/main.ts`, `src/diagnostic/diagnostic.css`, `diagnostic.html`
**Scope :** M

### Checkpoint B (sur appareils)

- [ ] PWA installée sur les deux appareils, ouverture en mode avion OK
- [ ] Les 3 stratégies de palm rejection testées avec le Metapen ; impressions notées dans `docs/diagnostic/notes.md`
- [ ] Revue avec l'utilisateur

---

## Phase 3 : Mesures complètes et rapport

### - [x] T7 : Mesures de fluidité (F3)

**Description :** `timing-stats.ts` en TDD (fréquence Hz sur fenêtre glissante, moyenne et p95). Panneau F3 : Hz par `pointerType` avec/sans coalesced, moyenne de coalesced par move, durée de frame, délai événement → rendu.

**Acceptance criteria :**

- [x] Fonctions pures testées (séries vides, un seul échantillon, p95 sur valeurs connues)
- [ ] Panneau F3 cohérent : ~60 Hz souris/doigt typique, plus pour le stylet si l'appareil l'échantillonne plus vite

**Verification :**

- [x] `npx vitest run src/diagnostic/timing-stats.test.ts`
- [x] `npm run check`
- [ ] Manuel : comparer les valeurs iPad stylet / iPad doigt / Pixel

**Dependencies :** T6
**Files :** `src/diagnostic/timing-stats.ts`, `src/diagnostic/timing-stats.test.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope :** M

---

### - [ ] T8 : Gestes système — protections on/off + incidents (F5)

**Description :** `incidents.ts` : compteurs purs testés + fonction d'abonnement DOM séparée (`pointercancel` par type, `touchcancel`, `contextmenu`, `selectionchange` non vide, `visualViewport.scale ≠ 1`, défilement, rechargement via `sessionStorage`). Interrupteur protections (classe CSS + écouteurs `preventDefault` ajoutés/retirés, viewport sans zoom).

**Acceptance criteria :**

- [ ] Comptage testé unitairement (incrément, remise à zéro, état des protections inclus dans l'instantané)
- [ ] Protections off : appui long / double-tap provoquent des incidents comptés ; protections on : moins ou pas d'incidents
- [ ] Basculer l'interrupteur ne nécessite pas de recharger

**Verification :**

- [ ] `npx vitest run src/diagnostic/incidents.test.ts`
- [ ] `npm run check`
- [ ] Manuel : étape 3 du protocole sur un appareil

**Dependencies :** T6
**Files :** `src/diagnostic/incidents.ts`, `src/diagnostic/incidents.test.ts`, `src/diagnostic/main.ts`, `src/diagnostic/diagnostic.css`, `diagnostic.html`
**Scope :** M

---

### - [ ] T9 : Environnement PWA et stockage (F6)

**Description :** `environment.ts` : mode d'affichage, `storage.persisted()` / bouton `persist()`, `storage.estimate()`, infos appareil (UA, `userAgentData`, écran/viewport, DPR, `maxTouchPoints`, media queries pointer/hover). Panneau F6.

**Acceptance criteria :**

- [ ] Toutes les infos F6 affichées, valeurs absentes signalées « non disponible » (pas d'erreur)
- [ ] Le bouton « Demander la persistance » met à jour l'affichage

**Verification :**

- [ ] `npm run check`
- [ ] Manuel : comparer navigateur vs PWA installée sur iPad et Pixel

**Dependencies :** T4
**Files :** `src/diagnostic/environment.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope :** S

---

### - [ ] T10 : Statistiques par pointerType + rapport JSON (F7)

**Description :** `pointer-stats.ts` (agrégation par `pointerType` : nombre, min/max/distinctes de pressure, tilt, altitude, twist, width/height) et `report.ts` (assemblage de F3/F4/F5/F6 + version + SHA) en TDD. Boutons Copier (Clipboard), Partager (Web Share si dispo), repli `<textarea>`, Réinitialiser les mesures.

**Acceptance criteria :**

- [ ] Rapport conforme à F7, JSON valide, champ `reportVersion`
- [ ] Copier ou Partager fonctionne sur iPad et Pixel ; sinon le `<textarea>` s'affiche
- [ ] Réinitialiser remet stats, compteurs et tracé à zéro

**Verification :**

- [ ] `npx vitest run src/diagnostic/pointer-stats.test.ts src/diagnostic/report.test.ts`
- [ ] `npm run check` (couverture ≥ 90 % sur les modules purs)
- [ ] Manuel : copier un rapport sur chaque appareil et le coller ailleurs

**Dependencies :** T5, T7, T8, T9
**Files :** `src/diagnostic/pointer-stats.ts`, `src/diagnostic/pointer-stats.test.ts`, `src/diagnostic/report.ts`, `src/diagnostic/report.test.ts`, `src/diagnostic/main.ts`
**Scope :** M

### Checkpoint C

- [ ] `npm run check` vert, couverture ≥ 90 % sur les modules purs
- [ ] Rapport copiable sur les deux appareils
- [ ] Revue avec l'utilisateur avant la campagne

---

## Phase 4 : Campagne de mesure

### - [ ] T11 : Protocole manuel + conclusions

**Description :** L'utilisateur exécute le protocole en 6 étapes de la spec sur les 3 configurations et colle les rapports. Rédaction de `docs/diagnostic/conclusions.md` : oui/non argumenté pour chacune des 5 hypothèses, stratégie de palm rejection retenue, liste des protections anti-gestes nécessaires. Mise à jour de `CLAUDE.md` (commandes, structure, conclusions clés).

**Acceptance criteria :**

- [ ] 3 rapports dans `docs/diagnostic/` (`ipad11-metapen.json`, `ipad11-doigt.json`, `pixel9a-doigt.json`)
- [ ] `conclusions.md` répond aux 5 hypothèses avec références aux rapports
- [ ] `CLAUDE.md` à jour

**Verification :**

- [ ] Relecture des conclusions avec l'utilisateur

**Dependencies :** T10
**Files :** `docs/diagnostic/*.json`, `docs/diagnostic/conclusions.md`, `CLAUDE.md`
**Scope :** S

### Checkpoint final

- [ ] Les 8 Success Criteria de `SPEC.md` sont remplis
- [ ] Revue finale avec l'utilisateur → passage au MVP
