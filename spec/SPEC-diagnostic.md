# Spec: Carnet magique — Pointer Events Diagnostic Page — V1

Step 0 of the project (see `docs/ideas/carnet-magique.md`). It also lays the final technical foundation of the repository: Vite + TypeScript project, PWA, quality tooling, continuous deployment.

## Objective

**Why.** The whole input architecture of Carnet magique rests on assumptions not yet verified on real devices:

1. the Metapen stylus is seen as `pointerType: "pen"` by Safari iPadOS;
2. the palm can be ignored while the stylus is active without the finger getting "stuck";
3. system gestures (magnifier, long press, double-tap zoom, selection, pull-to-refresh) can be neutralized;
4. drawing is smooth (sampling rate, `getCoalescedEvents()`);
5. in an installed PWA, storage can be made persistent.

**What.** A `diagnostic.html` page, installable as a PWA, served over HTTPS on GitHub Pages, that measures these points live on the device and produces a copyable/shareable **JSON report**.

**For whom.** The developer (not the child). The page stays in the repository after step 0 to test new devices.

**Reference devices:** iPad 11 + Metapen, iPad 11 with finger, Pixel 9a with finger.

### Features

**F1 — Live reading of Pointer Events**

- Panel showing, for each active pointer (`pointerId`): `pointerType`, `isPrimary`, `pressure`, `tangentialPressure`, `tiltX`, `tiltY`, `twist`, `altitudeAngle`/`azimuthAngle` (if present), `width`, `height`, `buttons`.
- Number of coalesced events of the last `pointermove`, and support for `getCoalescedEvents()` / `getPredictedEvents()` (feature detection).

**F2 — Drawing surface**

- Full-screen canvas (outside the panels), `touch-action: none`, rendering that accounts for `devicePixelRatio`, rendered in a `requestAnimationFrame` loop.
- One stroke per `pointerId`, color by `pointerType` (pen / touch / mouse), fixed width.
- **Coalesced on/off** switch; option to display raw points (one point per sample) to see the density.
- "Effacer" (Clear) button.

**F3 — Smoothness measurements**

- Per `pointerType`: sampling rate in Hz (with and without coalesced events), average number of coalesced events per `pointermove`.
- Frame duration (average, p95) and estimated event → render delay (`performance.now()` at render − `event.timeStamp`).

**F4 — Palm rejection strategies (comparable live)**
3-position selector:

- **None**: every pointer draws.
- **During stroke**: while a `pen` is in contact, and during a grace period of `G` ms after its `pointerup` (default 500 ms), `touch` pointers are ignored.
- **Pen session**: as soon as a `pen` is seen, `touch` pointers are ignored until `S` s without pen activity (default 10 s).
- **One finger at a time** (checkbox, combinable with the 3 strategies; added during the T11 campaign): the first `touch` keeps priority until its `pointerup`, any other `touch` put down in the meantime (palm) is ignored.
  `G` and `S` are adjustable. Ignored contacts are visualized (discreet marker) and counted. An indicator shows the current state ("finger active" / "finger ignored").

**F5 — System gestures**

- **Anti-gesture protections on/off** switch (on by default) grouping: `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `overscroll-behavior: none`, viewport without zoom, `preventDefault` on `contextmenu`, `selectstart`, `dblclick`, `gesturestart` (iOS), non-passive `touchstart`/`touchmove` on the surface.
- **Incident** counters: `pointercancel` (per `pointerType`), `touchcancel`, `contextmenu`, `selectionchange` with a non-empty selection, `visualViewport.scale ≠ 1`, page scrolling, unintended reload (counter in `sessionStorage`).

**F6 — PWA environment and storage**

- Display mode (`display-mode: standalone` / `navigator.standalone`), `navigator.storage.persisted()`, "Demander la persistance" (Request persistence) button (`persist()`), `navigator.storage.estimate()`.
- Device info: `userAgent`, `userAgentData` if available, screen and viewport size, `devicePixelRatio`, `maxTouchPoints`, `matchMedia('(pointer: fine|coarse)')`, `(any-hover)`.

**F7 — Report**

- "Copier le rapport" (Copy the report) button (Clipboard API) and "Partager" (Share) button (Web Share API, if available); fallback: report displayed in a selectable `<textarea>`.
- JSON content: report version, date, device info (F6), and for each `pointerType` seen: number of events, min/max/distinct values of `pressure`, min/max of `tiltX`/`tiltY`/`altitudeAngle`, presence of `twist`, min/max `width/height`, rates (F3), incident counters (F5) with the state of the protections, counts of ignored contacts per strategy and by the "one finger" option (F4).
- "Réinitialiser les mesures" (Reset measurements) button.

**F8 — PWA and provisional home page**

- Manifest + service worker (`vite-plugin-pwa`, precache of all assets): the app is installable and the diagnostic page works offline once installed.
- Provisional `index.html`: title "Carnet magique", link to the diagnostic. `start_url` and `scope` = app root, so that navigation stays in standalone mode.
- Provisional icons (192, 512, maskable, `apple-touch-icon` 180) produced once from an SVG and committed.
- Update (added during the T11 campaign, as the app installed on the iPad stayed stuck on the old version): check for a new version every time the app returns to the foreground, a "Rechercher une mise à jour" (Check for update) button, and a fallback "Vider le cache et recharger" (Clear cache and reload) button (unregisters the service worker, clears the caches, reloads from the network).

## Tech Stack

- **Node 24**, **npm**.
- **Vite** + **TypeScript** (`strict: true`), no UI framework, no Bootstrap for this page.
- **vite-plugin-pwa** (Workbox, `generateSW`).
- **Vitest** (`node` environment for pure logic), **ESLint** (flat config + `typescript-eslint`), **Prettier**.
- Versions: latest stable version of each package at scaffolding time, pinned by `package-lock.json`.
- Deployment: **GitHub Pages via GitHub Actions**, URL `https://charlesdevandiere.github.io/draw/` → `base: '/draw/'` in Vite.

## Commands

```
Install:           npm ci
Dev (local network): npm run dev           # vite --host
Build:             npm run build           # tsc --noEmit && vite build
Preview:           npm run preview         # vite preview --host (tests the SW locally)
Tests:             npm test                # vitest run
Tests (watch):     npm run test:watch      # vitest
Single test:       npx vitest run src/input/palm-rejection.test.ts -t "ignores a touch during the grace period"
Lint:              npm run lint            # eslint .
Format:            npm run format          # prettier --write .
Check everything:  npm run check           # lint + format --check + test (coverage ≥ 90 %) + build
```

## Project Structure

```
index.html                       → Provisional home page (link to the diagnostic)
diagnostic.html                  → Diagnostic page (Vite multi-page entry)
vite.config.ts                   → base '/draw/', multiple entries, vite-plugin-pwa
public/icons/                    → Provisional PWA icons (PNG) + SVG source
src/
  input/                         → Input logic REUSED by the future engine
    palm-rejection.ts            → none / during-stroke / pen-session strategies (pure)
    palm-rejection.test.ts
  diagnostic/                    → Specific to the diagnostic page
    main.ts                      → DOM wiring, listeners, rAF loop
    pointer-sample.ts            → Extracts a serializable sample from a PointerEvent
    pointer-stats.ts             → Aggregates samples → statistics (pure)
    pointer-stats.test.ts
    timing-stats.ts              → Rates, mean/p95 of durations (pure)
    timing-stats.test.ts
    incidents.ts                 → Gesture incident counters (pure)
    incidents.test.ts
    gesture-protections.ts       → Anti-gesture protections on/off + incident listening (DOM)
    environment.ts               → Device / PWA / storage info (DOM)
    report.ts                    → JSON report construction (pure)
    report.test.ts
    stroke-renderer.ts           → Canvas stroke rendering (DOM)
    diagnostic.css
.github/workflows/deploy.yml     → check + build + Pages deployment on push to master
docs/ideas/                      → Scoping notes
docs/diagnostic/                 → JSON reports collected on devices + conclusions
```

Rule: everything **pure** (no DOM) is unit-tested; the DOM is confined to `main.ts`, `environment.ts`, `stroke-renderer.ts` and `gesture-protections.ts`.

## Code Style

```ts
// src/input/palm-rejection.ts
export type PalmRejectionStrategy = 'none' | 'during-stroke' | 'pen-session';

export interface PalmRejectionOptions {
  strategy: PalmRejectionStrategy;
  /** Grace period after the stylus's last pointerup (during-stroke strategy). */
  graceMs: number;
  /** Time without stylus activity before the finger is re-enabled (pen-session strategy). */
  sessionMs: number;
}

export interface PointerInput {
  pointerType: string;
  phase: 'down' | 'move' | 'up';
  timeStamp: number;
}

/** Decides whether a contact should draw. Internal state is updated on each call. */
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

- Files in `kebab-case.ts`, tests next to them (`*.test.ts`).
- Functions and factories rather than classes; explicit, local state.
- No `any`, no `@ts-ignore`; feature detection (`'getCoalescedEvents' in event`), **never user-agent sniffing** to change a behavior (UA only in the report).
- Time is injected (`timeStamp` as a parameter), never read via `Date.now()` in pure logic: deterministic tests.
- Identifiers and code comments in English; at the time, UI text and docs were in French (since the MVP, the whole repository is in English, UI text through the i18n catalogs).
- Formatting: default Prettier (`singleQuote: true`, `printWidth: 100`).

## Testing Strategy

- **Unit (Vitest, `node` env)**: `palm-rejection`, `pointer-stats`, `timing-stats`, `incidents` (counting), `report`. Inputs = plain objects simulating samples; no DOM dependency. Target coverage: ≥ 90 % of the lines of `src/input/` and of the pure modules of `src/diagnostic/`.
- **Mandatory cases for `palm-rejection`**: each strategy; finger accepted before any stylus; finger ignored during stylus contact; finger ignored during the grace period then accepted after; session expired after `sessionMs`; two styluses; mouse never rejected; `up` without `down` does not make the counter negative.
- **No automated E2E tests**: the real validation is **manual on devices** (Safari iPadOS behavior cannot be reproduced in an emulator).
- **Manual protocol** (to run on each of the 3 configurations, PWA installed):
  1. Install from `https://charlesdevandiere.github.io/draw/`, open the diagnostic in standalone mode, request persistence.
  2. Draw for 30 s (writing, fast scribbling, slow circles), coalesced on then off.
  3. Protections on: 3 s long press, double-tap, pinch, swipe from each edge, swipe down at the top of the page. Note the incidents. Repeat with protections off.
  4. (iPad + stylus) Write with the palm resting, with each strategy; then alternate stylus / finger alone and check that the finger becomes active again.
  5. Switch to airplane mode, relaunch the app: it must open.
  6. Copy the report and save it as `docs/diagnostic/<device>-<config>.json`.

## Boundaries

- **Always**: `npm run check` green before any commit; pure logic tested before being wired to the DOM; feature detection; every API used verified for Safari iOS; save device reports and conclusions in `docs/diagnostic/`.
- **Ask first**: adding a dependency outside the Tech Stack list; changing `base`, the deployment URL or the GitHub Actions workflow beyond its creation; changing the default `G`/`S` values; any child-facing UI (out of scope).
- **Never**: commit a secret; hook a behavior to the user-agent; depend on `pressure`/`tilt` for an input decision; disable a lint rule or a test to get to green; push to `master` without agreement.

## Success Criteria

1. `npm run check` passes locally and in GitHub Actions; every push to `master` publishes to `https://charlesdevandiere.github.io/draw/`.
2. Lighthouse (Chrome desktop) reports no PWA installability defect; the app installs on the iPad 11 (Safari "Add to Home Screen") and on the Pixel 9a (Chrome "Install app").
3. Once installed and opened once, the diagnostic page loads in airplane mode on both devices.
4. On each device, the F1/F3/F6 panels update live while drawing without visible jank, and the stroke follows the stylus/finger without page scrolling or zooming (protections on).
5. The three F4 strategies are selectable and their effects visible (ignored contacts marked and counted).
6. The "Copier le rapport" button produces valid JSON containing all F7 fields, on the 3 configurations (or the `<textarea>` fallback works).
7. Unit tests covering the mandatory `palm-rejection` cases, coverage ≥ 90 % on the pure modules.
8. **Final deliverable**: 3 reports in `docs/diagnostic/` + a `docs/diagnostic/conclusions.md` answering yes/no to each of the 5 hypotheses of the Objective, with the chosen palm rejection strategy and the list of necessary anti-gesture protections.

## Out of Scope (Deferred)

- MVP drawing engine (colors, eraser, undo, page formats) — after the diagnostic conclusions.
- IndexedDB storage of drawings, gallery, replay — MVP.
- Bootstrap and child UI — MVP.
- Stroke smoothing, speed-based width simulation — MVP, depending on the F3 measurements.
- Targeted PC mouse / touch tests — after the MVP (see scoping note).
- Automated E2E tests (Playwright) — little value as long as the critical target is real Safari iPadOS.
- Physical latency measurement (high-speed camera) — the software estimate of F3 is enough.

## Open Questions

1. **Enabling Pages**: _Settings → Pages → Source: GitHub Actions_ must be set once on the repository (manual action on your side).

Resolved: public repository (GitHub Pages free); default values `G = 500 ms` and `S = 10 s` validated.
