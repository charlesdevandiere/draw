/** F6: device, PWA and storage information (DOM / browser APIs only). */

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

function yesNo(value: boolean | null): string {
  return value === null ? 'non disponible' : value ? 'oui' : 'non';
}

function megabytes(bytes: number | null): string {
  return bytes === null ? 'n/d' : `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

export function formatEnvironment(info: EnvironmentInfo): string {
  const { media } = info;
  return [
    `mode d'affichage : ${info.displayMode}`,
    `navigator.standalone (iOS) : ${yesNo(info.iosStandalone)}`,
    `stockage persistant : ${yesNo(info.storagePersisted)}`,
    `stockage : ${
      info.storageEstimate
        ? `${megabytes(info.storageEstimate.usage)} / ${megabytes(info.storageEstimate.quota)}`
        : 'non disponible'
    }`,
    `écran : ${info.screen.width}×${info.screen.height}, viewport : ${info.viewport.width}×${info.viewport.height}, DPR ${info.devicePixelRatio}`,
    `maxTouchPoints : ${info.maxTouchPoints}`,
    `pointer fine/coarse : ${yesNo(media.pointerFine)}/${yesNo(media.pointerCoarse)}, ` +
      `any-pointer fine/coarse : ${yesNo(media.anyPointerFine)}/${yesNo(media.anyPointerCoarse)}`,
    `hover / any-hover : ${yesNo(media.hover)} / ${yesNo(media.anyHover)}`,
    `userAgentData : ${
      info.userAgentData
        ? `${info.userAgentData.platform}, mobile ${yesNo(info.userAgentData.mobile)}, ${info.userAgentData.brands.join(' · ')}`
        : 'non disponible'
    }`,
    `UA : ${info.userAgent}`,
  ].join('\n');
}
