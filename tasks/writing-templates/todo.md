# Tasks: Writing templates (milestone 2, module 2 of 3)

Plan: `tasks/writing-templates/plan.md`. Spec: `spec/SPEC-writing-templates.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Task 1: Glyph data

**Description:** Add `opentype.js` as a dev dependency. `scripts/glyphs.mjs <andika.ttf> <playwrite-fr-moderne.ttf>` writes `src/templates/glyphs/{capitals,cursive,digits}.json` (A–Z, a–z, 0–9: path data, advance, metrics). Fonts kept out of git (`.gitignore`). OFL notices for both fonts added to the notices generator.

**Acceptance criteria:**

- [x] Unit: every character of each set present, non-empty path, positive advance; metrics present; each file under 60 KB.
- [x] `npm run build` passes the notices check with the two font entries.

**Verification:** `npx vitest run src/templates`; `npm run check`

**Dependencies:** `template-layers` done

**Files likely touched:** `package.json`, `scripts/glyphs.mjs`, `src/templates/glyphs/*.json`, `scripts/third-party-notices.mjs`, `public/THIRD-PARTY-NOTICES.txt`, `.gitignore`, a test

**Estimated scope:** Small

## Task 2: Lines

**Description:** `linesSvg('small-squares' | 'seyes', unitsPerCm)`: 5 mm light blue grid; Seyès 8 mm squares with three thin lines every 2 mm, colors of French exercise books; whole page covered.

**Acceptance criteria:**

- [x] Unit: line positions in page units for a phone and a tablet `unitsPerCm`; thick / thin pattern of Seyès; deterministic; passes the template checker and the size limit.

**Verification:** `npx vitest run src/templates/writing.test.ts`; `npm run check`

**Dependencies:** None (within this module)

**Files likely touched:** `src/templates/writing.ts` (+ test)

**Estimated scope:** Small

## Task 3: Letters

**Description:** `letterGrid(set, char, unitsPerCm)` (positions, rows) and `lettersSvg(...)`: capitals and digits 2 cm high between a baseline and a cap line; cursive on Seyès with a 4 mm interval, x-height one interval; light grey fill; advance + 0.5 cm; 0.5 cm margins; rows centered; no cut letter; glyph in `<defs>`, `<use>` per copy.

**Acceptance criteria:**

- [ ] Unit: copies per row and rows for a phone and a tablet `unitsPerCm`; every copy inside the margins; "J", "m", "8" and a wide letter ("W") laid out; deterministic; checker and size limit pass.
- [ ] Sample SVGs written by a test to `test-results/` and looked at.

**Verification:** `npx vitest run src/templates/writing.test.ts`; `npm run check`

**Dependencies:** Tasks 1, 2

**Files likely touched:** `src/templates/writing.ts` (+ test)

**Estimated scope:** Medium

## Checkpoint: Generators

- [ ] `npm run check` passes; samples look right

## Task 4: In the panel

**Description:** Catalog entries for lines and the three letter sets with a `generate` function; panel sections lines (blank, small squares, Seyès) and letters (set tabs "A", "a", "1", then the characters); adding computes `unitsPerCm` from the page's CSS width and stores the generated layer in the background slot. Names in en and fr.

**Acceptance criteria:**

- [ ] e2e: small-squares spacing in CSS px the same (±1 px) on a phone and a tablet viewport; after a resize, it scales with the page.
- [ ] e2e: "J" repeated several times; reload keeps it; replacing lines by letters is one undo step.
- [ ] e2e: a white stroke hides the lines, the eraser shows them again; tiles reachable in every window shape.

**Verification:** `npx playwright test e2e/writing-templates.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 3

**Files likely touched:** `src/templates/catalog.ts`, `src/app/templates-panel.ts`, `src/styles/app.scss`, i18n catalogs, `e2e/writing-templates.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Module complete

- [ ] Spec success criteria 1–6 met
- [ ] Device check: deferred to the final test campaign
- [ ] Fold into `spec/SPEC-mvp.md`; spec status implemented; capability map progress
