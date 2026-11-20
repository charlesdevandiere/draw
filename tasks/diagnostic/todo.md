# Tasks — Pointer Events Diagnostic Page

Spec: `spec/SPEC-diagnostic.md` · Plan: `tasks/diagnostic/plan.md`

Common Definition of Done: `npm run check` green, code compliant with the Code Style section of the spec, atomic commit.

---

## Phase 1: Foundation and first contact with the iPad

### - [x] T1: Scaffold Vite + TS + Vitest/ESLint/Prettier

**Description:** Create the Vite vanilla-ts project (multi-page, `base: '/draw/'`), strict TypeScript, Vitest (`node` env), ESLint flat config + typescript-eslint, Prettier (`singleQuote`, `printWidth: 100`), npm scripts from the spec. Clean up the `.gitignore` inherited from Angular. Provisional "Carnet magique" `index.html`.

**Acceptance criteria:**

- [x] All scripts of the Commands section exist and work (`dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `format`, `check`)
- [x] A trivial test passes; a badly formatted file / a lint error makes `check` fail
- [x] `npm run build` produces `dist/` with paths prefixed by `/draw/`

**Verification:**

- [x] `npm run check`
- [x] `npm run preview` then open `http://localhost:4173/draw/`

**Dependencies:** none
**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `.gitignore` (config files only)
**Scope:** M

---

### - [x] T2: GitHub Pages continuous deployment

**Description:** Workflow `.github/workflows/deploy.yml`: on push to `master` → `npm ci`, `npm run check`, build, `actions/upload-pages-artifact`, `actions/deploy-pages`. Manual Pages activation by the user.

**Acceptance criteria:**

- [x] A push to `master` publishes `https://charlesdevandiere.github.io/draw/`
- [x] A failing `check` prevents deployment

**Verification:**

- [x] Green GitHub Actions run (`gh run watch`)
- [x] The URL shows the provisional home page on the iPad and the Pixel

**Dependencies:** T1
**Files:** `.github/workflows/deploy.yml`
**Scope:** S

---

### - [x] T3: Minimal diagnostic — Pointer Events reading + raw drawing

**Description:** `diagnostic.html` page + `src/diagnostic/main.ts` + `pointer-sample.ts` (extraction of a serializable sample). F1 panel (properties per `pointerId`, coalesced/predicted support, number of coalesced events of the last move). Full-screen `touch-action: none` canvas, one stroke per `pointerId` colored by `pointerType` (direct rendering, no optimization). Commit SHA displayed.

**Acceptance criteria:**

- [x] All F1 properties are displayed live for each active pointer
- [x] Two fingers draw two distinct strokes simultaneously
- [x] The page neither scrolls nor zooms while drawing (at least `touch-action: none`)

**Verification:**

- [x] `npx vitest run src/diagnostic/pointer-sample.test.ts`
- [x] `npm run check`
- [x] Manual after deployment: iPad + Metapen, iPad with finger, Pixel with finger

**Dependencies:** T2
**Files:** `diagnostic.html`, `src/diagnostic/main.ts`, `src/diagnostic/pointer-sample.ts`, `src/diagnostic/pointer-sample.test.ts`, `src/diagnostic/diagnostic.css`
**Scope:** M

### Checkpoint A (on devices)

- [x] Diagnostic accessible on iPad and Pixel
- [x] Preliminary verdict on hypothesis 1 (Metapen = `pen`?) noted in `docs/diagnostic/campaign-notes.md`
- [x] Review with the user before phase 2

---

## Phase 2: Diagnostic core

### - [x] T4: Installable PWA + offline

**Description:** `vite-plugin-pwa` (`generateSW`, `autoUpdate`, full precache), manifest (name, colors, `start_url`/`scope` `/draw/`, `display: standalone`), provisional icons 192/512/maskable/apple-touch-icon 180 generated once from an SVG, iOS tags (`apple-mobile-web-app-capable`, etc.). Home → diagnostic link.

**Acceptance criteria:**

- [ ] Lighthouse: no installability defect (not run: no local Chrome; installation verified on both devices)
- [x] Once installed, the app opens in standalone and home → diagnostic navigation stays in standalone
- [x] After a first opening, the app loads in airplane mode

**Verification:**

- [ ] `npm run check`, `npm run preview` + Lighthouse
- [x] Manual: installation on iPad (Safari) and Pixel (Chrome), airplane mode test

**Dependencies:** T3
**Files:** `vite.config.ts`, `index.html`, `diagnostic.html`, `public/icons/*`
**Scope:** M

---

### - [x] T5: Palm rejection — 3 strategies (TDD) + selector

**Description:** `src/input/palm-rejection.ts` written TDD (strategies `none`, `during-stroke` G=500 ms, `pen-session` S=10 s, mandatory cases from the spec). Wiring in `main.ts`: selector, G/S fields, ignored contacts marked and counted, "finger active / ignored" indicator.

**Acceptance criteria:**

- [x] All mandatory cases of the spec are covered by tests, ≥ 90 % coverage of the module
- [x] Changing strategy live changes the behavior without reloading
- [x] Ignored contacts are visible and counted per strategy

**Verification:**

- [x] `npx vitest run src/input/palm-rejection.test.ts`
- [x] `npm run check`
- [x] Manual iPad + Metapen: write with the palm resting, with each strategy

**Dependencies:** T3
**Files:** `src/input/palm-rejection.ts`, `src/input/palm-rejection.test.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope:** M

---

### - [x] T6: rAF renderer, coalesced on/off, raw points

**Description:** `stroke-renderer.ts`: incremental rendering in `requestAnimationFrame`, canvas sized in `devicePixelRatio`, resizing/rotation handled. Coalesced on/off and raw points switches, Clear button. Listeners now only record into buffers; panels throttled to ~10 Hz. Collapsible panel drawer.

**Acceptance criteria:**

- [ ] Sharp (not blurry) stroke on a Retina screen and after rotation (rotation not tested)
- [x] Coalesced off → points visibly more spaced out on a fast stroke (if the device provides coalesced events)
- [x] The panels do not refresh more than ~10 times/s

**Verification:**

- [x] `npm run check`
- [ ] Manual: fast stroke with coalesced on/off with raw points, on iPad and Pixel; device rotation (rotation not tested)

**Dependencies:** T3
**Files:** `src/diagnostic/stroke-renderer.ts`, `src/diagnostic/main.ts`, `src/diagnostic/diagnostic.css`, `diagnostic.html`
**Scope:** M

### Checkpoint B (on devices)

- [x] PWA installed on both devices, opens in airplane mode OK
- [x] The 3 palm rejection strategies tested with the Metapen; impressions noted in `docs/diagnostic/campaign-notes.md`
- [x] Review with the user

---

## Phase 3: Full measurements and report

### - [x] T7: Smoothness measurements (F3)

**Description:** `timing-stats.ts` in TDD (Hz rate over a sliding window, mean and p95). F3 panel: Hz per `pointerType` with/without coalesced, mean coalesced per move, frame duration, event → render delay.

**Acceptance criteria:**

- [x] Pure functions tested (empty series, a single sample, p95 on known values)
- [x] Consistent F3 panel: ~60 Hz typical mouse/finger, more for the stylus if the device samples it faster

**Verification:**

- [x] `npx vitest run src/diagnostic/timing-stats.test.ts`
- [x] `npm run check`
- [x] Manual: compare the iPad stylus / iPad finger / Pixel values

**Dependencies:** T6
**Files:** `src/diagnostic/timing-stats.ts`, `src/diagnostic/timing-stats.test.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope:** M

---

### - [x] T8: System gestures — protections on/off + incidents (F5)

**Description:** `incidents.ts`: tested pure counters + separate DOM subscription function (`pointercancel` per type, `touchcancel`, `contextmenu`, non-empty `selectionchange`, `visualViewport.scale ≠ 1`, scrolling, reload via `sessionStorage`). Protections switch (CSS class + `preventDefault` listeners added/removed, viewport without zoom).

**Acceptance criteria:**

- [x] Counting unit-tested (increment, reset, protections state included in the snapshot)
- [x] Protections off: long press / double-tap cause counted incidents; protections on: fewer or no incidents
- [x] Toggling the switch does not require reloading

**Verification:**

- [x] `npx vitest run src/diagnostic/incidents.test.ts`
- [x] `npm run check`
- [x] Manual: step 3 of the protocol on one device

**Dependencies:** T6
**Files:** `src/diagnostic/incidents.ts`, `src/diagnostic/incidents.test.ts`, `src/diagnostic/gesture-protections.ts`, `src/diagnostic/main.ts`, `src/diagnostic/diagnostic.css`, `diagnostic.html`
**Scope:** M

---

### - [x] T9: PWA environment and storage (F6)

**Description:** `environment.ts`: display mode, `storage.persisted()` / `persist()` button, `storage.estimate()`, device info (UA, `userAgentData`, screen/viewport, DPR, `maxTouchPoints`, pointer/hover media queries). F6 panel.

**Acceptance criteria:**

- [x] All F6 info displayed, missing values flagged "non disponible" (not available) (no error)
- [x] The "Demander la persistance" (Request persistence) button updates the display

**Verification:**

- [x] `npm run check`
- [x] Manual: compare browser vs installed PWA on iPad and Pixel

**Dependencies:** T4
**Files:** `src/diagnostic/environment.ts`, `src/diagnostic/main.ts`, `diagnostic.html`
**Scope:** S

---

### - [x] T10: Per-pointerType statistics + JSON report (F7)

**Description:** `pointer-stats.ts` (aggregation per `pointerType`: count, min/max/distinct of pressure, tilt, altitude, twist, width/height) and `report.ts` (assembly of F3/F4/F5/F6 + version + SHA) in TDD. Copy (Clipboard), Share (Web Share if available), `<textarea>` fallback, Reset measurements buttons.

**Acceptance criteria:**

- [x] Report compliant with F7, valid JSON, `reportVersion` field
- [x] Copy or Share works on iPad and Pixel; otherwise the `<textarea>` is displayed
- [x] Reset sets stats, counters and drawing back to zero

**Verification:**

- [x] `npx vitest run src/diagnostic/pointer-stats.test.ts src/diagnostic/report.test.ts`
- [x] `npm run check` (coverage ≥ 90 % on the pure modules)
- [x] Manual: copy a report on each device and paste it elsewhere

**Dependencies:** T5, T7, T8, T9
**Files:** `src/diagnostic/pointer-stats.ts`, `src/diagnostic/pointer-stats.test.ts`, `src/diagnostic/report.ts`, `src/diagnostic/report.test.ts`, `src/diagnostic/main.ts`
**Scope:** M

### Checkpoint C

- [x] `npm run check` green, coverage ≥ 90 % on the pure modules
- [x] Report copyable on both devices
- [x] Review with the user before the campaign

---

## Phase 4: Measurement campaign

### - [x] T11: Manual protocol + conclusions

**Description:** The user runs the 6-step protocol of the spec on the 3 configurations and pastes the reports. Writing of `docs/diagnostic/conclusions.md`: argued yes/no for each of the 5 hypotheses, chosen palm rejection strategy, list of necessary anti-gesture protections. Update of `CLAUDE.md` (commands, structure, key conclusions).

**Acceptance criteria:**

- [x] 3 reports in `docs/diagnostic/` (`ipad11-metapen.json`, `ipad11-doigt.json`, `pixel9a-doigt.json`)
- [x] `conclusions.md` answers the 5 hypotheses with references to the reports
- [x] `CLAUDE.md` up to date

**Verification:**

- [ ] Review of the conclusions with the user

**Dependencies:** T10
**Files:** `docs/diagnostic/*.json`, `docs/diagnostic/conclusions.md`, `CLAUDE.md`
**Scope:** S

### Final checkpoint

- [ ] The 8 Success Criteria of `spec/SPEC-diagnostic.md` are met
- [ ] Final review with the user → move on to the MVP
