/**
 * DOM side of the gallery, a wall (spec/SPEC-gallery-viewer.md): a blank "+" sheet first
 * (a new page), then the drawings newest first, each pinned slightly tilted under a strip
 * of tape (engine/wall.ts). Tapping a drawing opens it in the viewer.
 */
import { tileLook } from '../engine/wall';
import type { Drawing } from '../engine/types';
import type { Translator } from '../i18n/i18n';
import type { DrawingRecord } from '../store/db';

export interface GalleryOptions {
  grid: HTMLElement;
  t: Translator['t'];
  language: string;
  list: () => Promise<DrawingRecord[]>;
  onOpen: (drawing: Drawing) => void;
  /** The "+" sheet: a new page. */
  onNew: () => void;
}

export interface Gallery {
  /** Reloads the drawings from storage and rebuilds the grid. */
  refresh(): Promise<void>;
}

export function initGallery(options: GalleryOptions): Gallery {
  const { grid, t } = options;
  const dateFormat = new Intl.DateTimeFormat(options.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  let urls: string[] = [];

  function card(record: DrawingRecord): HTMLElement {
    const { drawing, thumbnail } = record;
    const item = document.createElement('li');
    item.className = 'gallery-card';
    const look = tileLook(drawing.id);
    item.style.setProperty('--tilt', `${look.tilt}deg`);
    item.dataset['tape'] = String(look.tape);
    const tape = document.createElement('span');
    tape.className = 'gallery-tape';
    tape.setAttribute('aria-hidden', 'true');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'gallery-open';
    open.setAttribute(
      'aria-label',
      t('gallery.open', { date: dateFormat.format(new Date(drawing.updatedAt)) }),
    );
    if (thumbnail) {
      const url = URL.createObjectURL(thumbnail);
      urls.push(url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.draggable = false;
      open.append(image);
    }
    open.addEventListener('click', () => options.onOpen(drawing));
    item.append(open, tape);
    return item;
  }

  /** The blank sheet with a "+", always first. */
  function newSheet(): HTMLElement {
    const item = document.createElement('li');
    item.className = 'gallery-new';
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'gallery-new-page';
    button.className = 'gallery-new-page';
    button.setAttribute('aria-label', t('tools.newPage'));
    button.innerHTML = '<span class="icon icon-plus" aria-hidden="true"></span>';
    button.addEventListener('click', options.onNew);
    item.append(button);
    return item;
  }

  function show(records: DrawingRecord[]): void {
    const list = document.createElement('ul');
    list.className = 'gallery-list';
    list.append(newSheet(), ...records.map(card));
    grid.replaceChildren(list);
    grid.dataset['count'] = String(records.length);
  }

  async function refresh(): Promise<void> {
    let records: DrawingRecord[];
    try {
      records = await options.list();
    } catch (error) {
      // Never leave an outdated list to reopen: an old copy would overwrite the saved one.
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      show([]);
      throw error;
    }
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    show(records);
  }

  return { refresh };
}
