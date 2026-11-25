/**
 * DOM side of the gallery: a grid of thumbnails, newest first. Tapping a thumbnail
 * opens the drawing in the viewer.
 */
import type { Drawing } from '../engine/types';
import type { Translator } from '../i18n/i18n';
import type { DrawingRecord } from '../store/db';

export interface GalleryOptions {
  grid: HTMLElement;
  t: Translator['t'];
  language: string;
  list: () => Promise<DrawingRecord[]>;
  onOpen: (drawing: Drawing) => void;
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
    item.append(open);
    return item;
  }

  async function refresh(): Promise<void> {
    let records: DrawingRecord[];
    try {
      records = await options.list();
    } catch (error) {
      // Never leave an outdated list to reopen: an old copy would overwrite the saved one.
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      grid.replaceChildren();
      throw error;
    }
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    const list = document.createElement('ul');
    list.className = 'gallery-list';
    list.append(...records.map(card));
    grid.replaceChildren(list);
    grid.dataset['count'] = String(records.length);
  }

  return { refresh };
}
