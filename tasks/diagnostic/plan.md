# Implementation Plan: Pointer Events Diagnostic Page

Source spec: `spec/SPEC-diagnostic.md`

## Overview

Create the repository foundation (Vite + TypeScript, quality tooling, PWA, GitHub Pages deployment) and the `diagnostic.html` page that measures, on the iPad 11 and the Pixel 9a, the five input hypotheses of Carnet magique, then produces a JSON report. **Risk-first** order: a minimal page goes onto the iPad as early as possible (task 3) so that we know on the very first evening whether the Metapen is seen as `pen`.

## Architecture Decisions

- **Vite multi-page**: `index.html` (provisional home page) and `diagnostic.html` as two `build.rollupOptions.input` entries, `base: '/draw/'`.
- **Pure core, thin DOM shell**: all decision or statistical logic (`palm-rejection`, `pointer-stats`, `timing-stats`, `incidents`, `report`) is DOM-free, with time injected → unit-tested. The DOM is confined to `main.ts`, `environment.ts`, `stroke-renderer.ts` and the subscription part of `incidents.ts`.
- **Undisturbed measurement**: the Pointer Events listeners only record samples into buffers; the canvas is drawn in `requestAnimationFrame` (incremental segments); the text panels are refreshed at ~10 Hz at most. This way, displaying the measurements does not skew them.
- **Collapsible overlay panels**: a collapsible drawer above the canvas (bottom of the screen on portrait phone, right side on landscape tablet). Events on the drawer are not counted as drawing.
- **Visible version**: the commit SHA (injected at build time via `define`) is displayed in the page and included in the report → we always know which version is running on the device despite the service worker cache.
- **PWA**: `vite-plugin-pwa` in `generateSW`, `registerType: 'autoUpdate'`, precache of all assets; `start_url`/`scope` = `/draw/`.
- **Single CI**: one `deploy.yml` workflow on push to `master`: `npm ci` → `npm run check` → upload artifact → `actions/deploy-pages`. A red `check` blocks deployment.

## Dependency Graph

```
T1 Scaffold + tooling
 ├── T2 GitHub Pages deployment
 │    └── T3 Minimal diagnostic (F1 reading + raw drawing)  ← iPad test #1
 │         ├── T4 Installable PWA + offline
 │         ├── T5 Palm rejection (TDD) + selector
 │         └── T6 rAF renderer + coalesced on/off + raw points
 │              ├── T7 Smoothness F3 (TDD timing-stats)
 │              └── T8 System gestures F5 (TDD incidents) + protections
 ├── T9 Environment F6 (persist, device info)   [after T4]
 └── T10 Stats + report F7 (TDD) + copy/share  [after T5, T7, T8, T9]
      └── T11 Device campaign + conclusions
```

## Task List

Task details: `tasks/diagnostic/todo.md`.

### Phase 1: Foundation and first contact with the iPad

- [x] T1: Scaffold Vite + TS + Vitest/ESLint/Prettier
- [x] T2: GitHub Pages continuous deployment
- [x] T3: Minimal diagnostic — Pointer Events reading + raw drawing

### Checkpoint A (on devices)

- [x] `https://charlesdevandiere.github.io/draw/diagnostic.html` opens on iPad and Pixel
- [x] **Preliminary verdict on hypothesis 1**: `pointerType` displayed with the Metapen

### Phase 2: Diagnostic core

- [x] T4: Installable PWA + offline + displayed version
- [x] T5: Palm rejection (3 strategies, TDD) + selector and G/S settings
- [x] T6: rAF renderer, coalesced on/off, raw points, clear

### Checkpoint B (on devices)

- [x] PWA installed on both devices, opens in airplane mode OK
- [x] The 3 strategies behave as expected with the Metapen

### Phase 3: Full measurements and report

- [x] T7: Smoothness measurements (F3)
- [x] T8: System gestures — protections on/off + incidents (F5)
- [x] T9: PWA environment and storage (F6)
- [x] T10: Per-pointerType statistics + JSON report copy/share (F7)

### Checkpoint C

- [x] `npm run check` green, coverage ≥ 90 % on the pure modules
- [x] Report copyable on both devices

### Phase 4: Measurement campaign

- [x] T11: Manual protocol on the 3 configurations + `docs/diagnostic/conclusions.md`

### Final checkpoint

- [ ] The 8 Success Criteria of `spec/SPEC-diagnostic.md` are met (remaining: Lighthouse not run, no local Chrome)
- [x] `CLAUDE.md` updated (commands, structure, key conclusions)

## Risks and Mitigations

| Risk                                                      | Impact                                                | Mitigation                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The Metapen is not seen as `pen`                          | High (undermines F4 and the input strategy)           | Detected as early as T3; we continue the diagnostic (the report documents the real behavior) and re-plan input before the MVP |
| Service worker cache: the device runs an old version      | Medium (measurements attributed to the wrong version) | SHA displayed in the page and the report; `autoUpdate`; reload button/indication                                              |
| Wrong `base` / paths under `/draw/`                       | Medium (blank page on Pages)                          | Deployment set up as early as T2, verified before any feature                                                                 |
| Refreshing the panels disturbs the measurements           | Medium (rates/latencies skewed)                       | Minimal listeners, rAF rendering, panels throttled to ~10 Hz                                                                  |
| Clipboard API refused in iOS standalone PWA               | Low                                                   | Web Share first, `<textarea>` fallback                                                                                        |
| System gestures that cannot be blocked (iOS screen edges) | Low for step 0                                        | This is precisely what we measure; recorded in the conclusions                                                                |

## Decisions (resolved questions)

- `@vitest/coverage-v8` added as a dev dependency (coverage threshold).
- **No push by the agent**: the user always pushes themselves. Device checks for checkpoints A/B/C therefore happen after their pushes.
- GitHub Pages is enabled (source: GitHub Actions).
