/** F6: device, PWA and storage information (DOM / browser APIs only). */
import type { Translator } from '../i18n/i18n';

export interface EnvironmentInfo {
  displayMode: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  /** iOS-only `navigator.standalone`; null elsewhere. */
  iosStandalone: boolean | null;
  storagePersisted: boolean | null;
  storageEstimate: { usage: number | null; quota: number | null } | null;
  userAgent: string;
  userAgentData: { brands: string[]; mobile: boolean; platform: string } | null;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  maxTouchPoints: number;
  media: {
    pointerFine: boolean;
    pointerCoarse: boolean;
    anyPointerFine: boolean;
    anyPointerCoarse: boolean;
    hover: boolean;
    anyHover: boolean;
  };
}

interface NavigatorExtras {
  standalone?: boolean;
  userAgentData?: {
    brands: { brand: string; version: string }[];
    mobile: boolean;
    platform: string;
  };
}

const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui'] as const;

function matches(query: string): boolean {
  return window.matchMedia(query).matches;
}

function displayMode(): EnvironmentInfo['displayMode'] {
  return DISPLAY_MODES.find((mode) => matches(`(display-mode: ${mode})`)) ?? 'browser';
}

async function storagePersisted(): Promise<boolean | null> {
  try {
    return (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    return null;
  }
}

async function storageEstimate(): Promise<EnvironmentInfo['storageEstimate']> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate ? { usage: estimate.usage ?? null, quota: estimate.quota ?? null } : null;
  } catch {
    return null;
  }
}

export async function collectEnvironment(): Promise<EnvironmentInfo> {
  const extras = navigator as Navigator & NavigatorExtras;
  const uaData = extras.userAgentData;
  const [persisted, estimate] = await Promise.all([storagePersisted(), storageEstimate()]);
  return {
    displayMode: displayMode(),
    iosStandalone: typeof extras.standalone === 'boolean' ? extras.standalone : null,
    storagePersisted: persisted,
    storageEstimate: estimate,
    userAgent: navigator.userAgent,
    userAgentData: uaData
      ? {
          brands: uaData.brands.map(({ brand, version }) => `${brand} ${version}`),
          mobile: uaData.mobile,
          platform: uaData.platform,
        }
      : null,
    screen: { width: window.screen.width, height: window.screen.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    maxTouchPoints: navigator.maxTouchPoints,
    media: {
      pointerFine: matches('(pointer: fine)'),
      pointerCoarse: matches('(pointer: coarse)'),
      anyPointerFine: matches('(any-pointer: fine)'),
      anyPointerCoarse: matches('(any-pointer: coarse)'),
      hover: matches('(hover: hover)'),
      anyHover: matches('(any-hover: hover)'),
    },
  };
}

/** Asks for persistent storage; resolves to the browser's answer, or null if unsupported. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    return (await navigator.storage?.persist?.()) ?? null;
  } catch {
    return null;
  }
}

/** Human-readable environment, in the page's language. */
export function formatEnvironment(info: EnvironmentInfo, t: Translator['t']): string {
  const yesNo = (value: boolean | null): string =>
    t(value === null ? 'common.notAvailable' : value ? 'common.yes' : 'common.no');
  const megabytes = (bytes: number | null): string =>
    bytes === null
      ? t('common.notAvailableShort')
      : t('diag.env.megabytes', { value: (bytes / 1_048_576).toFixed(1) });
  const line = (label: string, value: string): string => t('diag.env.line', { label, value });
  const { media } = info;
  return [
    t('diag.env.displayMode', { value: info.displayMode }),
    t('diag.env.iosStandalone', { value: yesNo(info.iosStandalone) }),
    t('diag.env.persisted', { value: yesNo(info.storagePersisted) }),
    t('diag.env.storage', {
      value: info.storageEstimate
        ? `${megabytes(info.storageEstimate.usage)} / ${megabytes(info.storageEstimate.quota)}`
        : t('common.notAvailable'),
    }),
    t('diag.env.screen', {
      screen: `${info.screen.width}×${info.screen.height}`,
      viewport: `${info.viewport.width}×${info.viewport.height}`,
      // A string: Intl would localize the separator ("2,625") unlike the other values.
      dpr: String(info.devicePixelRatio),
    }),
    line('maxTouchPoints', String(info.maxTouchPoints)),
    line(
      'pointer fine/coarse',
      `${yesNo(media.pointerFine)}/${yesNo(media.pointerCoarse)}, ` +
        line(
          'any-pointer fine/coarse',
          `${yesNo(media.anyPointerFine)}/${yesNo(media.anyPointerCoarse)}`,
        ),
    ),
    line('hover / any-hover', `${yesNo(media.hover)} / ${yesNo(media.anyHover)}`),
    line(
      'userAgentData',
      info.userAgentData
        ? `${info.userAgentData.platform}, mobile ${yesNo(info.userAgentData.mobile)}, ${info.userAgentData.brands.join(' · ')}`
        : t('common.notAvailable'),
    ),
    line('UA', info.userAgent),
  ].join('\n');
}
