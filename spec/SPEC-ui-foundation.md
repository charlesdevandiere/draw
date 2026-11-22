# Spec Delta: UI foundation — redesign module 1 of 5

Status: proposed

Module `ui-foundation` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) except what is stated here.

## Objective

Give every child screen the shared building blocks of the redesign, before any screen is rebuilt on them:

1. the paper theme and the action colors, with "pebble" buttons built on Bootstrap;
2. a reusable 1.5 s long press with a visible fill;
3. a light haptic feedback helper;
4. a layout that follows the window's shape (tools along the long sides), with a device class (phone or tablet) for margins and sizes.

Users: children aged 5+ (child screens); the long press and haptics are also used by the settings page (module `settings`).

## Current Behavior

- Theme (`src/styles/_tokens.scss`, `app.scss`): paper background `#fff4d6`, white page with 12 px rounded corners and a shadow, round white tool buttons (`.tool-button`, 48–56 px) with an orange (`#e0692a`) selection border.
- Press-and-hold: pure `createHold(durationMs)` in `src/input/hold.ts`, `PARENT_HOLD_MS = 3000`, used by the gallery padlock (`src/app/padlock.ts`) with an SVG ring.
- No haptic feedback.
- Layout follows the viewport: phone portrait = page above two rows of tools; landscape (aspect ≥ 1) = tools on both sides of the page (`app.scss`, `.draw-screen` grid). Manifests: `"orientation": "any"`.

## New Behavior

### Theme and buttons

- **Background**: paper `#fff4d6` (unchanged). **Page**: white, **square corners** (the exported PNG is a square: no hidden corner), shadow `0 2px 12px rgb(0 0 0 / 15%)`. Ink `#2b2b2b`.
- **Action colors** (fill; icon `#1a1a1a`, contrast > 10:1):

  | Role                                         | Color                     |
  | -------------------------------------------- | ------------------------- |
  | undo, redo, back                             | `#ffd54f`                 |
  | input mode, restart replay                   | `#ce93d8`                 |
  | new page, play / pause                       | `#a5d6a7`                 |
  | gallery, share                               | `#81d4fa`                 |
  | eraser                                       | `#f48fb1`                 |
  | continue drawing                             | `#ffab91`                 |
  | long-press actions (settings, trash) at rest | `#ebe0c4`, icon `#5d5442` |
  | disabled                                     | `#ebe0c4`, icon `#a39882` |

- **Pebble buttons**: square with rounded corners (radius ≈ 29 % of the size: 16 px at 56 px), no border, no shadow. **One size, 56 px, on every device**, shrinking only when the screen is too narrow for a row (the existing DF-01 rule: 6 buttons per row, rounded down to an even pixel count, never under the 48 px `$target-min`). The iPhone SE (375 px) gets 52 px (six 56 px buttons do not fit 375 px, DF-01); a 360 px wide Android phone gets 50 px. (The 52 px phone buttons of the mockups were a margin of safety, not a design choice.)
- **Selection** (a pressed tool, the eraser): a 3 px paper-colored gap then a 3 px ink ring (`0 0 0 3px #fff4d6, 0 0 0 6px #2b2b2b`). Replaces the orange border.
- **Built on Bootstrap 6**: each action color is an entry of the Sass `$theme-colors` map (roles `history`, `mode`, `create`, `gallery`, `eraser`, `continue`, `hold`; `$action-colors` in `src/styles/_tokens.scss`), used as `.btn.btn-solid.theme-<role>`; the pebble shape is a project class over `.btn` (radius and size from tokens). No hand-rolled button component outside Bootstrap's `.btn`.

### Long press (1.5 s)

- One duration for every long press: **1500 ms** (`LONG_PRESS_MS`, replacing `PARENT_HOLD_MS = 3000`). Same pure `createHold` logic: releasing, cancelling or leaving the button before 1.5 s cancels.
- While held: the button **fills from the bottom** with a darker shade of its color (`--progress` 0 → 1) and grows slightly (scale 1.12), as in the mockups. On completion: light haptic tick, then the action.
- A tap does nothing (no hint text on the child screens).
- In this module, it replaces the padlock ring (the padlock itself is replaced by the settings button in module `settings`; until then the padlock keeps working with the new fill and duration).

### Haptic feedback

- `haptic()` helper: a light tick, called on each step of a slider (module `draw-tools`) and when a long press completes.
- **Android (Chrome)**: `navigator.vibrate(8)`.
- **iOS / iPadOS**: no web vibration API. Try the iOS 18+ switch trick (a hidden `<input type="checkbox" switch>` toggled through its label inside the user gesture produces the system haptic). If it does not work on the reference devices, iOS gets no haptics: **best effort, never a blocking criterion**.
- Never throws, never delays the action; does nothing where unsupported.

### Layout follows the window's shape

Decided 2026-11-22, after a device trial of a layout fixed to the hardware (see Decision history).

- **Layout from the window's shape**, as before this module: a window taller than wide = page above the rows of tools; a window wider than tall (aspect ≥ 1) = tools on both sides of the page (`min-aspect-ratio: 1/1`). Rotating the device swaps width and height, so the layout switches with it: the tools always run along the long sides and the page stays as large as possible. No screen is ever turned by the app, icons stay upright by themselves, pointer input needs no rotation. iPad Split View, iPadOS windows and Android split screen follow the same rule.
- **Device class**, for margins and sizes only, from Bootstrap's `sm` breakpoint (576 px, `$breakpoints`): **tablet** when both viewport sides are at least 576 px (`@media (min-width: 576px) and (min-height: 576px)`), else **phone**. iPad 11 (820 × 1180), iPad mini (744) and 7–8" Android tablets (≈ 600) are tablets; iPhone SE (375) and Pixel 9a (412) are phones. `md` (768 px) is not used: it would turn the iPad mini and small Android tablets into phones. The tablet top margin rule (DF-02) uses this breakpoint (700 px before). Never from the user agent.
- Accepted trade-off: after a quarter turn, a control is on the same kind of edge, but not always under the same finger (that depends on the direction of the turn).
- Applies to the child screens (drawing, gallery, viewer). The settings page (text, forms) keeps the normal responsive behavior.

### Decision history

- A **layout fixed to the device** was built and tried (2026-11-22, commits 676a9d5, b7550d9, ddcac6d): held away from its design orientation (phone portrait, tablet landscape), the child screens were turned back by `screen.orientation.angle` so every control kept its place on the hardware, icons turned upright, input went through a rotation-aware page transform. On the iPad 11 it looked clean; the Pixel 9a needed a fix for browser tabs (their bars shorten the window), and windows sharing the screen needed their own rules. Dropped for the simpler rule above: same page size, no angle, no special cases.

## Success Criteria

1. Buttons, page and selection match the foundations board of the mockups: paper background, square white page, pebble buttons in the action colors, ink selection ring; all are Bootstrap `.btn` with `theme-*` colors.
2. Every long press takes 1.5 s: a release at 1.4 s does nothing, a 1.5 s press triggers the action; the fill shows the progress (unit tests on `createHold`, an e2e on the padlock).
3. On the Pixel 9a, a completed long press gives a light vibration. On the iPad, the switch trick is tried and the result is recorded in `docs/device-fixes.md` (works or not); either way nothing breaks.
4. In portrait and landscape, on the iPhone SE (or Pixel 9a) and the iPad 11: the tools run along the long sides, the page is square and keeps its drawing, nothing sits in the system edge margins (tablet top margin from 576 px, DF-02) (e2e with portrait and landscape viewports for both device classes).
5. What must NOT change: drawing input (modes, palm handling, DF-01 to DF-10 in `docs/device-fixes.md`), stroke storage, replay, gallery data, existing e2e behaviors other than the visuals.

## Boundaries (deltas)

- Always: build buttons on Bootstrap `.btn` and `$theme-colors`; record any device-specific workaround (haptics) as a DF entry.
- Ask first: locking the orientation in the manifests; any new dependency.
- Never: detect the device class from the user agent.

## Out of Scope (Deferred)

- The new screen layouts themselves (palette, slider, gallery wall, viewer, settings): modules `draw-tools`, `gallery-viewer`, `settings`.
- Dark theme: dropped (2026-11-22).

## Open Questions

None. (The layout fixed to the device was settled by the decision gate: dropped, see Decision history.)
