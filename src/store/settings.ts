/**
 * Settings kept in IndexedDB, validated when read back: a missing or corrupt value falls
 * back to the default instead of breaking the app.
 */
import { DEFAULT_TOOLS, isColorId, isWidthId, type ToolState } from '../engine/palette';
import { isInputMode, type InputModeState } from '../input/input-mode';

export const SETTING_KEYS = {
  inputMode: 'inputMode',
  tools: 'tools',
  lastDrawingId: 'lastDrawingId',
} as const;

export const DEFAULT_INPUT_MODE: InputModeState = { mode: 'finger', chosenByHand: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseInputModeState(value: unknown): InputModeState {
  if (!isRecord(value) || !isInputMode(value['mode'])) return DEFAULT_INPUT_MODE;
  return { mode: value['mode'], chosenByHand: value['chosenByHand'] === true };
}

export function parseToolState(value: unknown): ToolState {
  if (!isRecord(value)) return DEFAULT_TOOLS;
  const { tool, color, width } = value;
  if ((tool !== 'pen' && tool !== 'eraser') || !isColorId(color) || !isWidthId(width)) {
    return DEFAULT_TOOLS;
  }
  return { tool, color, width };
}

export function parseDrawingId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}
