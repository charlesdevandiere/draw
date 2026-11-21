# Device fixes register

Small adjustments made after testing on real devices: a margin, a threshold, a guard, a browser workaround. Out of context they look arbitrary or even wrong, and a "cleanup" could quietly bring the bug back. Each one is recorded here with the reason for it and the test that guards it.

Rules (also in `CLAUDE.md`):

- Every fix that comes from a device test gets an entry **DF-nn**. It says what was seen, on which device, the cause, the fix, where the code is, and what guards it.
- The code carries a short comment pointing here (`// DF-nn: docs/device-fixes.md`) next to the value or branch that must not change unnoticed.
- Each entry has a regression test when the symptom can be reproduced (unit or end to end). Where it cannot be, the entry says so and names the step of `docs/mvp-device-test.md` that checks it by hand.
- Before changing or removing code tagged DF-nn, read its entry. If the change is deliberate, update the entry in the same commit.

The rules from the step 0 diagnostic (coalesced events, a tap draws a dot, never use pressure or tilt, gesture protections, update check on return to the foreground…) are justified in `docs/diagnostic/conclusions.md`, not repeated here.

Known limitations, not fixed in code: the Metapen sometimes goes unrecognized when the palm rests first (iPadOS takes it for a finger; Apple Notes too). See `docs/diagnostic/conclusions.md`, hypothesis 2.

---

## DF-01 Six tools per row on a narrow phone

- **Seen** (2026-11-21, iPhone 8, 375 px wide): the eraser wrapped to a third row of tools.
- **Cause**: fixed 56 px buttons; six of them plus the gaps do not fit 375 px.
- **Fix**: the tool size is computed from the screen: between 48 px (minimum touch target) and 56 px, so that `$tools-per-row` (6) buttons fit a row.
- **Code**: `src/styles/app.scss` (tool size), `src/styles/_tokens.scss` (`$tools-per-row`).
- **Guard**: e2e `app-shell.spec.ts` › "on a narrow phone (iPhone 8), the drawing tools wrap on two rows".
- **Do not**: add a tool to a row, or raise the minimum size, without rechecking a 375 px screen.

## DF-02 Nothing under the iPadOS status bar blur

- **Seen** (2026-11-21, iPad, iPadOS 26): the top of the screen is blurred under the status bar.
- **Cause**: iPadOS 26 draws a blur under its status bar, taller than the safe area it reports.
- **Fix**: tablets keep 64 px free at the top (plus the safe area), in the app and the parent page.
- **Code**: `$edge-margin-top-tablet` in `src/styles/_tokens.scss`, used by `src/styles/app.scss` (`--app-edge-top`) and `src/styles/parent.scss`.
- **Guard**: e2e `app-shell.spec.ts` › "the square page fills the drawing area and controls stay away from the edges" (`TABLET_TOP_MARGIN`).

## DF-03 Sharp icons

- **Seen** (2026-11-21, iPad and phones): icons looked blurry; they measured 25.66 px.
- **Cause**: icon size as a percentage of the button. Bootstrap Icons are drawn on a 16 px grid and blur at odd sizes.
- **Fix**: a fixed 24 px icon size (1.5 × the grid), and button sizes rounded down to an even pixel count, so the centered icon lands on whole pixels (`round(down, …, 2px)`, plain `clamp()` where `round()` is unsupported).
- **Code**: `$icon-size` in `src/styles/_icons.scss`; tool size in `src/styles/app.scss`.
- **Guard**: none automated (visual). Checked by eye on the devices.

## DF-04 The installed app updates on Android

- **Seen** (2026-11-21, Pixel 9a, installed from Chrome): "new version found, reloading…" then still the old version, forever.
- **Cause**: vite-plugin-pwa 2 leaves a new service worker waiting for a `SKIP_WAITING` message that nothing sends. A waiting worker activates only once every page of the app is closed, and Chrome Android never really closes an installed app's page.
- **Fix**: Workbox `skipWaiting: true` and `clientsClaim: true`. The pages reload on `controllerchange`; the app waits for the stroke in progress and the save, the parent page for an import, export or share in progress (`busy()`).
- **Code**: `vite.config.ts` (workbox options), `src/parent/transfer.ts` (`busy()`), `src/parent/main.ts`.
- **Guard**: e2e `service-worker.spec.ts` › "the service worker activates a new version without waiting". The wait for `busy()` is not automated: step A3 "Update" of `docs/mvp-device-test.md`.

## DF-05 An edge swipe "back" never reaches the parent page

- **Seen** (2026-11-21, iPad): swiping from the left edge while drawing went back in the history to the parent page, which a child must not reach.
- **Cause**: links between the app, the parent page and the diagnostic page added history entries.
- **Fix**: those links (marked `data-replace`) and the padlock replace the current history entry (`location.replace`) instead of adding one.
- **Code**: `replaceHistoryOnLinks` in `src/app/dom.ts`; `src/app/main.ts` (padlock); `data-replace` in `src/parent/parent.html` and `src/diagnostic/diagnostic.html`.
- **Guard**: e2e `parent.spec.ts` › "the parent and diagnostic pages never stack up in the history".

## DF-06 A stroke can start just outside the page

- **Seen** (2026-11-21, iPad): strokes aimed at the edge of the page often did not start; the contact landed a few pixels outside.
- **Fix**: the whole drawing screen receives the contacts. One within 24 px of the page starts a stroke, pulled onto the page edge. A tap on a tool bar (a button or the gap between buttons) never draws.
- **Code**: `EDGE_MARGIN_PX` and the tool bar guard in `src/app/draw-screen.ts`; `strokeStart` in `src/engine/page-transform.ts`; `touch-action: none` on `.draw-screen` in `src/styles/app.scss`.
- **Guard**: unit `page-transform.test.ts` (`strokeStart`); e2e `draw.spec.ts` › "a contact just outside the page starts a stroke on its edge" and "a tap on a tool bar next to the page never draws".
- **Do not**: listen for contacts on the canvas only, or grow the margin until a tap aimed at a tool can draw.

## DF-07 Strokes drawn at the same time replay together

- **Seen** (2026-11-21, iPad, Multi-finger mode): the replay played strokes drawn simultaneously one after the other.
- **Cause**: the replay schedule placed strokes end to end.
- **Fix**: every stroke keeps its own drawing time on one shared timeline; only the pauses where nothing is drawn are shortened, then the whole replay is scaled to fit ~15 s.
- **Code**: `planReplay` in `src/engine/replay.ts`.
- **Guard**: unit `replay.test.ts` › "plays simultaneous strokes (several fingers) at the same time" and "treats a pause of one finger as drawing time while another one draws".

## DF-08 Ids without `crypto.randomUUID`

- **Seen** (2026-11-21, iPad on the dev server over the local network): the app crashed at the first stroke.
- **Cause**: `crypto.randomUUID` exists only in secure contexts (HTTPS or localhost); a dev server opened by IP is plain HTTP.
- **Fix**: `newId()` falls back to a UUID built from `crypto.getRandomValues`.
- **Code**: `src/store/id.ts`.
- **Guard**: unit `id.test.ts` › "falls back to getRandomValues without randomUUID (insecure context)".

## DF-09 A palm leaves no dot

- **Seen** (2026-11-21, iPad by finger): a resting palm left a dot, with or without the palm width filter. Sliding it drew nothing.
- **Cause**: a palm lands edge first, narrower than the filter threshold, so it started a stroke and its first point was painted at once. Then iPadOS cancels it (`pointercancel`, its own palm rejection, within 10–250 ms) or it spreads past the threshold; the stroke ended there and kept its dot.
- **Fix**: a contact that ends cancelled, or turned away by the input filter, before moving more than 2 % of the page from where it landed, leaves nothing (repainted away, not stored). A tap lifted normally keeps its dot; a stroke that really drew keeps it all.
- **Code**: `STRAY_REACH` and `dropOrFinish` in `src/app/draw-screen.ts`; `strokeReach` in `src/engine/stroke-builder.ts`.
- **Guard**: unit `stroke-builder.test.ts` (`strokeReach`); e2e `input-modes.spec.ts` › "a palm landing narrow, then spreading, leaves no dot" and "a contact cancelled before moving leaves no dot, one that drew keeps its stroke"; `draw.spec.ts` › "a tap without movement draws a dot".
- **Do not**: drop short strokes on `pointerup` (a dot on an "i" must stay).
