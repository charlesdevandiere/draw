/**
 * Settings kept in IndexedDB, validated when read back: a missing or corrupt value falls
 * back to the default instead of breaking the app.
 */
import {
  DEFAULT_TOOLS,
  fromMvpColor,
  isColorId,
  isSizeStep,
  type SizeStep,
  type ToolState,
} from '../engine/palette';
import {
  DEFAULT_FINGER_SETTINGS,
  isInputMode,
  type FingerSettings,
  type InputModeState,
} from '../input/input-mode';

export const SETTING_KEYS = {
  inputMode: 'inputMode',
  tools: 'tools',
  lastDrawingId: 'lastDrawingId',
  fingerSettings: 'fingerSettings',
  outlineWidth: 'outlineWidth',
} as const;

/**
 * Width of the coloring pages' outlines (spec/SPEC-template-layers.md): scaled with the page
 * like the rest of the picture, or the same number of CSS pixels on every screen. A test
 * setting, to compare both on the devices; the losing mode goes afterwards.
 */
export type OutlineWidth = 'scaled' | 'fixed';

/** Outline width of the fixed mode, in CSS pixels. */
export const FIXED_OUTLINE_PX = 3;

export function parseOutlineWidth(value: unknown): OutlineWidth {
  return value === 'fixed' ? 'fixed' : 'scaled';
}

export const DEFAULT_INPUT_MODE: InputModeState = { mode: 'finger', chosenByHand: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseInputModeState(value: unknown): InputModeState {
  if (!isRecord(value) || !isInputMode(value['mode'])) return DEFAULT_INPUT_MODE;
  return { mode: value['mode'], chosenByHand: value['chosenByHand'] === true };
}

/** MVP widths (before module draw-tools) as slider steps: thin 8 units, thick 24. */
const MVP_SIZES: Readonly<Record<string, SizeStep>> = { thin: 1, thick: 3 };

/**
 * The tools setting (spec/SPEC-draw-tools.md): `{ tool, color, size }`. An MVP value
 * (`color: 'red'`, `width: 'thin'`) is migrated; other fields (an earlier `recent` bar)
 * are ignored.
 */
export function parseToolState(value: unknown): ToolState {
  if (!isRecord(value)) return DEFAULT_TOOLS;
  const { tool } = value;
  if (tool !== 'pen' && tool !== 'eraser') return DEFAULT_TOOLS;
  const mvpColor = fromMvpColor(value['color']);
  const width = value['width'];
  const mvpSize =
    typeof width === 'string' && Object.hasOwn(MVP_SIZES, width) ? MVP_SIZES[width] : undefined;
  if (mvpColor && mvpSize !== undefined) return { tool, color: mvpColor, size: mvpSize };
  const { color, size } = value;
  if (!isColorId(color) || !isSizeStep(size)) return DEFAULT_TOOLS;
  return { tool, color, size };
}

export function parseDrawingId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}

/** Bounds of the Finger mode settings (CSS px). */
export const FINGER_BOUNDS = {
  widthThreshold: { min: 20, max: 400 },
} as const;

function clamp(value: number, { min, max }: { min: number; max: number }, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/** Keeps settings within their bounds; a non-number falls back to the default. */
export function clampFingerSettings(settings: FingerSettings): FingerSettings {
  return {
    widthThreshold:
      settings.widthThreshold === null
        ? null
        : clamp(
            settings.widthThreshold,
            FINGER_BOUNDS.widthThreshold,
            DEFAULT_FINGER_SETTINGS.widthThreshold ?? 80,
          ),
  };
}

export function parseFingerSettings(value: unknown): FingerSettings {
  if (!isRecord(value)) return DEFAULT_FINGER_SETTINGS;
  // Settings saved by earlier versions also carry `releaseDelayMs` (removed, DF-10): ignored.
  const { widthThreshold } = value;
  if (widthThreshold !== null && typeof widthThreshold !== 'number') return DEFAULT_FINGER_SETTINGS;
  return clampFingerSettings({ widthThreshold });
}
