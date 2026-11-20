/** The app shows one static screen at a time; switching toggles `hidden`. */

export type ScreenName = 'draw' | 'gallery' | 'replay';

const SCREEN_IDS: Record<ScreenName, string> = {
  draw: 'draw-screen',
  gallery: 'gallery-screen',
  replay: 'replay-screen',
};

export function showScreen(name: ScreenName): void {
  for (const [screen, id] of Object.entries(SCREEN_IDS)) {
    const element = document.getElementById(id);
    if (element) element.hidden = screen !== name;
  }
}
