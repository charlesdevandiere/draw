# Measurement campaign notes (T11)

Observations made on screen during the tests, which do not appear in the JSON reports.

## iPad 11 + Metapen — `ipad11-metapen.json` (2026-11-19, version 79dcd82)

- Installed PWA (standalone), persistence requested → granted.
- **Resting palm**: the Metapen is "not always recognized right away". Clearly better with the "Session stylet" (pen session) strategy, but the problem also occurs in that mode.
  - Confirmed cause: in "Session stylet", the residual problem occurs on the **first stroke**, with an **orange** mark under the palm. The palm touches the screen before the stylus and draws (no stylus has been seen yet, so nothing is blocked).
- **Coalesced events**: no visual difference perceived between on and off.
- **Protections on**: effective, except two unblocked gestures: notification center (swipe from the top) and dock / home bar (swipe from the bottom).
- **Protections off**: app unusable, too many system actions triggered.

## Pixel 9a

- First attempt as a PWA in **Brave**: persistence **denied**. In **Chrome**, persistence **granted**. The rest of the Android campaign is done in Chrome, the chosen target (Brave dropped, as with the user's other PWAs).

### Pixel 9a with finger — `pixel9a-doigt.json` (Chrome)

Steps 0 to 3 and 5 with the finger. Step 4 (palm) was done with the round-tip stylus, without resetting: the report mixes finger and round stylus, both seen as `touch`.

- The passive stylus is seen as a finger (`touch`): no palm rejection strategy can act (0 contacts ignored).
- **Resting palm (step 4)**: unusable, the palm gets in the way completely. But on a smartphone, resting the palm is not a need: it is even counter-intuitive (to reconsider for a large foldable phone). On an **Android tablet**, however (Metapen probably incompatible, so passive stylus or finger), the palm will become a problem again. No device to test.
- **Gestures (step 2)**: as on iPad, protections effective with the same limits (swipe from the top). The swipe from the bottom could not be tested: 3-button navigation.

## iPad 11 with finger — `ipad11-doigt.json`

- **Resting palm**: palm rejection is useless with the finger, strokes appear under the palm in every strategy (they only filter while a stylus is active).
  - User's idea: a "non-multitouch" mode that gives priority to the stroke already started when the palm lands afterwards. → Added to the page: "Un seul doigt à la fois" (one finger at a time) option (to be measured).
- The report contains no "protections off" incident: step 3 not done (or nothing was triggered) for this configuration.

## Common observations

- **Without coalesced events, fast strokes are angular** (observed afterwards). Coalesced is essential.
- **Impossible to make a simple dot** (dot of the `i`, of the `!`), whatever the tool and device: you have to draw a small circle. Cause: the canvas does not paint a zero-length segment. → Fixed in the page: a tap without movement draws a disc. To be carried over into the MVP engine.
- **Idea for the app**: a "mode" button to choose "pen", "finger" or "multi-finger".

## Tests after additions (version 300d383 then 71f767c)

- **Update on iPad**: the installed app stayed stuck on the old version, even after deleting the icon and refreshing in Safari. → Added an update check when returning to the foreground, and the buttons "Rechercher une mise à jour" (check for update) and "Vider le cache et recharger" (clear cache and reload).
- **Dot by simple tap**: works.
- **"Un seul doigt à la fois"** (finger and round stylus): works, but not perfect. Strokes still appear under the palm **when the finger or round stylus is lifted**. It still avoids some of the unwanted strokes compared with multi-finger. User's decision: **keep this choice in the app**.
- **Airplane mode**: the installed app opens offline on the iPad and the Pixel.
- **Width filter against the palm**: a good idea according to the user, but risks working less well with children's hands.
