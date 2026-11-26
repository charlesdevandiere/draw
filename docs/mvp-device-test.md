# MVP device test protocol

One pass covers checkpoints 0, A1–A3 and B of `tasks/todo.md` on the three reference devices: **iPad 11 + Metapen**, **iPad 11 by finger**, **Pixel 9a by finger (Chrome)**. Tick the boxes in `tasks/todo.md` as you go; note anything odd in a new section of `docs/diagnostic/campaign-notes.md` (or a new `docs/mvp-test-notes.md`).

Automated end-to-end tests (Playwright, Chromium and WebKit) already cover the logic; this protocol is about what only a real device shows: installation, system gestures, palm, pen, fluidity, sharing, files.

## 0. Install (Checkpoint 0)

1. Push, wait for the GitHub Actions deployment.
2. **Remove the old installed app** (installed from `/draw/` or `/draw/diagnostic.html`). On the iPad, if it stays stuck on an old version: Settings → Apps → Safari → Advanced → Website Data → delete `github.io`.
3. Open `https://charlesdevandiere.github.io/draw/` in Safari (iPad) / Chrome (Pixel): it must land on `/draw/fr/` (French device).
4. Install: Safari "Add to Home Screen" / Chrome "Install app". The icon is named **"Carnet"** (short name) or "Carnet magique".
5. Open it from the home screen. Airplane mode, close it, reopen: it opens and draws.
6. Optional: a device or browser set to English lands on `/draw/en/` and installs "Sketchbook".

## A1. Drawing (fluidity, gestures)

Pen mode on the iPad with the Metapen; finger elsewhere.

- [ ] Fast strokes are smooth (no angles), slow circles are round, the stroke follows without visible lag.
- [ ] A tap draws a dot (dot the "i").
- [ ] 5 minutes of scribbling: no zoom, scroll, text selection, magnifier, callout or menu. (Swipes from the very top / bottom edge belong to the system: expected.)
- [ ] Rotate the device: the layout switches (portrait: tools below; landscape: tools on both sides), the drawing is intact.
- [ ] No button sits close to the top or bottom edge.

## A2. The slate

- [ ] 8 colors, thin / thick, eraser: each works; the selected tool is highlighted; with the eraser on, the color and width kept for later show a soft ring.
- [ ] Undo then redo 10 times in a row.
- [ ] New page gives a blank page; the previous drawing is in the gallery.
- [ ] **Mode button** (bottom tool bar / right column), cycles Finger → Multi-finger → Pen:
  - [ ] iPad + Metapen, fresh install: the first Metapen stroke switches to **Pen** by itself (icon changes). Then rest the palm, **including before the first stroke of a new page**: no palm mark.
  - [ ] iPad by finger, Finger mode: draw with the palm resting, lift the finger, touch again with the palm still down: far fewer stray strokes than with the diagnostic's "one finger at a time" option. A contact as wide as a palm never draws.
  - [ ] Multi-finger: two fingers draw two strokes at once.
  - [ ] After choosing Finger by hand, the Metapen no longer switches the mode, and the finger always draws.
- [ ] Colors, widths and button layout feel right for a child (your call).

## A3. Saving, gallery, sharing, updates

- [ ] Draw, then kill the app (app switcher) right after a stroke and relaunch: the drawing is there, to the last stroke (or the one before it at worst).
- [ ] Restart the device: drawings are still there.
- [ ] Gallery (a wall of tilted drawings, "+" sheet first): newest first; open an old drawing in the viewer, **continue** it (undo works on its old strokes).
- [ ] Share from the viewer: the share sheet opens with a PNG. Save it to **Files** (iPad) / the file manager (Pixel); send one through Messages / WhatsApp and to Photos. Note which ones keep the drawing importable (checked in B).
- [ ] Size: draw a busy 10-minute drawing, then look at the size in the settings page (Backup): it should stay well under 0.5 MB per drawing.
- [ ] Update: after a new push, bring the installed app back to the foreground: it picks up the new version (it may reload once), without losing the drawing in progress.

## B. Viewer, trash and settings page

- [ ] Viewer: the drawing redraws itself stroke by stroke, eraser included; a long drawing takes about 15 s; touching the page pauses, play resumes, restart starts over; play at the end replays.
- [ ] Viewer trash pebble: a tap does nothing; a 1.5 s press (fills light red) sends the drawing to the trash and back to the gallery.
- [ ] Tapping the **gear** (top right of the gallery) does nothing; holding it 1.5 s (the button grows and fills from the bottom; a light vibration on Android) opens the settings page; its back pebble returns to the gallery.
- [ ] Settings, Trash: the trashed drawing is listed ("Deleted today"); Restore brings it back to the gallery; trash another one, then hold "Empty the trash" 1.5 s (iPad: no text selection or magnifier).
- [ ] Export: "Export the drawings" prepares, then **"Share N pictures"** opens the share sheet → save to Files. Trash and empty everything, then **Import** the saved pictures: every drawing comes back, replayable. Import a photo: refused.
- [ ] Import the picture that went through Messages / Photos (A3): note whether it is still recognized.
- [ ] "Share the app link": the share sheet opens with the link (or it is copied).
- [ ] Language: switch to English in the settings page, back to the sketchbook: labels (VoiceOver / TalkBack) are in English; switch back to Default.
- [ ] Persistence: "Drawings protected from automatic cleanup" on the installed app (iPad, Chrome); otherwise press "Ask again".
- [ ] Finger settings: turn the palm filter off, back to the sketchbook (it applies at the next opening), check the palm draws again; restore the defaults.
- [ ] "Check for updates" (badge "Up to date"), "Clear cache and reload" and the diagnostic page link work.

## Child test (criterion 17)

Without explanation, on the iPad and on a phone: the child draws, finds the gallery, reopens a drawing. Note where they hesitate. If possible, open the diagnostic page from the settings page and note the **width** reported for the child's finger and palm (`width` in the pointer panel): it tells whether the 80 px threshold fits a child's hand.
