/**
 * Settings page: the trash (spec/SPEC-settings.md). One row per trashed drawing, most
 * recently trashed first: its thumbnail, when it was deleted, and Restore. Emptying the
 * trash takes a 1.5 s press. Drawings left there 30 days are purged at start.
 */
import { requireElement } from '../app/dom';
import { initLongPress } from '../app/long-press';
import type { Translator } from '../i18n/i18n';
import type { TrashedRecord } from '../store/db';
import { trashedAgo, trashedWhen, trashSummary } from './format';

export interface TrashOptions {
  translator: Translator;
  list: () => Promise<TrashedRecord[]>;
  /** A thumbnail for a drawing saved without one. */
  thumbnail: (record: TrashedRecord) => Promise<Blob | null>;
  restore: (id: string) => Promise<boolean>;
  empty: () => Promise<void>;
  haptic: () => void;
  /** The drawings outside the trash changed (restore). */
  onChanged: () => void;
}

export interface TrashSection {
  refresh(): Promise<void>;
}

export function initTrashSection(options: TrashOptions): TrashSection {
  const { translator } = options;
  const { t } = translator;
  const summary = requireElement('trash-summary', HTMLParagraphElement);
  const list = requireElement('trash-list', HTMLUListElement);
  const emptyButton = requireElement('empty-trash', HTMLButtonElement);
  let urls: string[] = [];
  /** Only the latest refresh writes: an earlier, slower one would show an old list. */
  let generation = 0;

  function row(record: TrashedRecord, thumbnail: Blob | null, now: number): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'trash-row';
    const picture = document.createElement('span');
    picture.className = 'trash-thumbnail';
    if (thumbnail) {
      const url = URL.createObjectURL(thumbnail);
      urls.push(url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      picture.append(image);
    }
    const when = document.createElement('span');
    when.className = 'trash-when';
    when.textContent = trashedWhen(translator, record.trashedAt, now);
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'btn btn-solid theme-hold trash-restore';
    restore.textContent = t('settings.trash.restore');
    restore.setAttribute(
      'aria-label',
      t('settings.trash.restoreLabel', {
        when: trashedAgo(translator.language, record.trashedAt, now),
      }),
    );
    restore.addEventListener('click', () => {
      restore.disabled = true;
      void options
        .restore(record.drawing.id)
        .catch(() => false)
        .finally(() => {
          options.onChanged();
          void refresh().catch(() => undefined);
        });
    });
    item.append(picture, when, restore);
    return item;
  }

  async function refresh(): Promise<void> {
    const current = (generation += 1);
    const records = await options.list();
    const thumbnails: (Blob | null)[] = [];
    // One at a time: iOS Safari caps the total canvas memory.
    for (const record of records) {
      thumbnails.push(record.thumbnail ?? (await options.thumbnail(record).catch(() => null)));
    }
    if (current !== generation) return;
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    const now = Date.now();
    summary.textContent = trashSummary(translator, records.length);
    list.replaceChildren(...records.map((record, i) => row(record, thumbnails[i] ?? null, now)));
    emptyButton.hidden = records.length === 0;
  }

  initLongPress(
    emptyButton,
    () => {
      emptyButton.disabled = true;
      void options
        .empty()
        .catch(() => undefined)
        .finally(() => {
          emptyButton.disabled = false;
          void refresh().catch(() => undefined);
        });
    },
    { haptic: options.haptic },
  );

  return { refresh };
}
