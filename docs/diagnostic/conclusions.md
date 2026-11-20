# Pointer Events diagnostic conclusions (step 0)

Campaign of 2026-11-19, `diagnostic.html` page versions `79dcd82` → `71f767c`, PWA installed on each device.

| Report                                       | Configuration                                                    |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [`ipad11-metapen.json`](ipad11-metapen.json) | iPad 11, Safari standalone, Metapen stylus                       |
| [`ipad11-doigt.json`](ipad11-doigt.json)     | iPad 11, Safari standalone, finger                               |
| [`pixel9a-doigt.json`](pixel9a-doigt.json)   | Pixel 9a, Chrome standalone, finger (+ round-tip stylus, step 4) |
| [`campaign-notes.md`](campaign-notes.md)     | Visual observations outside the reports                          |

## The 5 hypotheses

### 1. The Metapen is seen as `pointerType: "pen"` by Safari iPadOS — **YES**

- 9,255 `pen` events in `ipad11-metapen.json`.
- But **pressure and tilt are fake**: `pressure` fixed at 0.12, `tiltX`/`tiltY` fixed at −27°/16°, `width`/`height` at 0.5. They are useless: fixed stroke width confirmed.
- The round-tip (passive) stylus is seen as a **finger** (`touch`) on both devices: no way to tell it apart from the hand.

### 2. The palm can be ignored while the stylus is active without blocking the finger — **YES, with a limit**

- iPadOS already does part of the work: 139 palm contacts canceled by the system (`pointercancel:touch`) while writing with the Metapen.
- Our filtering completes it: 20 contacts ignored in "Pendant le trait" (during the stroke), 32 in "Session stylet" (pen session). **"Session stylet" is clearly better**; the finger becomes active again after S seconds without the stylus.
- **Limit**: a palm resting **before** the first stylus stroke draws (orange mark observed), since no stylus has been seen yet. Only an explicitly chosen "Pen" mode avoids it.
- **With the finger, no stylus strategy has any effect** (iPad and Pixel alike: strokes under the palm in every mode). The "Un seul doigt à la fois" (one finger at a time) option avoids some of them, but not all: the slot is freed as soon as the finger lifts, and the palm, still resting, draws when it touches a new spot.
- On a smartphone, resting the palm is not a need (user's observation). On an Android tablet (Metapen probably incompatible, so finger or passive stylus), the palm will become a problem again: **not tested, no device**.

### 3. System gestures can be neutralized — **YES, except the top and bottom edges**

- Protections on: pinch blocked (`gesturestart:bloqué` (blocked) ×31 on iPad), long press / menu blocked (`contextmenu:bloqué` (blocked) on Pixel), no more selection or double-tap zoom, no scrolling.
- Protections off: **app unusable** (selection, double-tap, scrolling, menu…).
- **Not blockable** (system): notification center (swipe from the top, iPad and Pixel) and home bar / dock (swipe from the bottom, iPad; Pixel not tested, 3-button navigation).
- No unintended reload in the installed PWA (no pull-to-refresh counted).

### 4. Drawing is smooth — **YES**

| Measure                                 | iPad + Metapen | iPad finger  | Pixel finger  |
| --------------------------------------- | -------------- | ------------ | ------------- |
| `pointermove` events / s                | 62.5           | 70.6         | 132.3         |
| Points received / s (with coalesced)    | 238.6          | 108.1        | 238.1         |
| Coalesced per `pointermove` (average)   | 3.5            | 1.6          | 1.8           |
| Interval between frames (average / p95) | 22.7 / 46 ms   | 19.6 / 34 ms | 8.9 / 16.6 ms |
| Event → render (average / p95)          | 6.1 / 21 ms    | 7.0 / 20 ms  | 6.0 / 10.3 ms |

- **Coalesced is essential**: on iPad, the stylus only sends 60 events/s, each grouping 4 points. Without coalesced, fast strokes are angular (observed).
- Pixel 9a: 120 Hz screen, excellent.
- **To watch**: on iPad, the p95 of the interval between frames (34 to 46 ms) shows dropped frames; the diagnostic page refreshes its text panels at 10 Hz, to be checked on the MVP engine.
- **Defect found**: a simple tap drew nothing (the canvas ignores zero-length segments) — impossible to dot an "i". Fixed by drawing a disc; to be carried over into the engine.

### 5. In an installed PWA, storage can be made persistent — **YES**

- iPad (Safari standalone): `persist()` granted, `storagePersisted: true`.
- Pixel 9a (**Chrome**): granted. In **Brave**, denied: Chrome is the Android target.
- Manual gallery export remains planned as a safety net.

## Decisions for the MVP

### Input mode: "Pen" / "Finger" / "Multi-finger" button

User's idea, confirmed by the measurements:

- **Pen**: only `pen` pointers draw, every `touch` is ignored. Also handles the palm resting before the first stroke. Suggested automatically as soon as a `pen` is detected.
- **Finger** (default without a stylus): only one contact draws at a time. To improve over the diagnostic:
  - the slot is only freed when **no contact at all** touches the screen anymore, then after a short delay (~300 ms, to be tuned);
  - **width filter**: ignore contacts that are too wide (iPad: finger ≈ 42–63 px, palm up to 292 px). The Pixel only reports small widths (≤ 61 px): the filter is ineffective on Android. **Risk: children's hands are smaller**, so the finger / palm gap narrows. Threshold to be measured with a child, and the filter must be disableable.
- **Multi-finger**: all contacts draw (several children, several fingers).

### Mandatory anti-gesture protections (always on the drawing screen)

`touch-action: none`; `user-select: none` and `-webkit-user-select: none`; `-webkit-touch-callout: none`; `overscroll-behavior: none`; viewport without zoom (`maximum-scale=1, user-scalable=no`); `preventDefault` on `contextmenu`, `selectstart`, `dblclick`, `gesturestart`; non-passive `touchstart` / `touchmove` with `preventDefault` on the surface.

**No controls near the top and bottom edges** of the screen: those swipes belong to the system.

### Other rules

- **Coalesced events** are mandatory (with a fallback if absent).
- **Never use `pressure` or `tilt`**: fake on the Metapen, zero with the finger on iPad, variable with the finger on Android (inconsistent).
- **A tap without movement draws a dot.**
- **PWA update**: look for a new version every time the app returns to the foreground (an iOS PWA resumes without navigating and used to stay stuck on the old version), plus a manual way to force the update in the adult screen.
- **Never rely on the user agent**: Safari on iPad presents itself as a Mac (`Macintosh`).
- Request `navigator.storage.persist()` in the installed app (granted on both reference devices).
