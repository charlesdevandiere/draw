/**
 * Parent page: the list of drawings, multiple selection and deletion after confirmation
 * (Bootstrap dialog). The child app never deletes anything itself.
 */
import Dialog from 'bootstrap/js/dist/dialog.js';
import { requireElement } from '../app/dom';
import type { Translator } from '../i18n/i18n';
import type { DrawingRecord } from '../store/db';

export interface DrawingsSectionOptions {
  t: Translator['t'];
  language: string;
  list: () => Promise<DrawingRecord[]>;
  remove: (id: string) => Promise<void>;
}

export interface DrawingsSection {
  refresh(): Promise<void>;
  /** Ids currently selected (used by the export). */
  selected(): string[];
  onChange(listener: () => void): void;
}

export function initDrawingsSection(options: DrawingsSectionOptions): DrawingsSection {
  const { t } = options;
  const list = requireElement('drawings-list', HTMLUListElement);
  const count = requireElement('drawings-count', HTMLOutputElement);
  const deleteButton = requireElement('drawings-delete', HTMLButtonElement);
  const selectAll = requireElement('drawings-select-all', HTMLButtonElement);
  const dialogElement = requireElement('delete-dialog', HTMLDialogElement);
  const dialogText = requireElement('delete-dialog-text', HTMLParagraphElement);
  const dialog = new Dialog(dialogElement);
  const dateFormat = new Intl.DateTimeFormat(options.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let ids: string[] = [];
  const chosen = new Set<string>();
  let urls: string[] = [];
  const listeners: (() => void)[] = [];

  function update(): void {
    count.textContent = t('parent.drawings.selected', { count: chosen.size });
    deleteButton.disabled = chosen.size === 0;
    selectAll.textContent = t(
      chosen.size === ids.length && ids.length > 0
        ? 'parent.drawings.selectNone'
        : 'parent.drawings.selectAll',
    );
    for (const listener of listeners) listener();
  }

  function item(record: DrawingRecord): HTMLLIElement {
    const { drawing, thumbnail } = record;
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'check check-lg';
    checkbox.checked = chosen.has(drawing.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) chosen.add(drawing.id);
      else chosen.delete(drawing.id);
      update();
    });
    label.append(checkbox);
    if (thumbnail) {
      const url = URL.createObjectURL(thumbnail);
      urls.push(url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      label.append(image);
    } else {
      // No thumbnail (saved while hidden): keep the tile's shape under the checkbox.
      const placeholder = document.createElement('span');
      placeholder.className = 'parent-drawings-placeholder';
      label.append(placeholder);
    }
    const date = document.createElement('span');
    date.textContent = dateFormat.format(new Date(drawing.updatedAt));
    label.append(date);
    li.append(label);
    return li;
  }

  async function refresh(): Promise<void> {
    const records = await options.list();
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    ids = records.map((record) => record.drawing.id);
    for (const id of [...chosen]) if (!ids.includes(id)) chosen.delete(id);
    list.replaceChildren(...records.map(item));
    if (records.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = t('parent.drawings.none');
      list.append(empty);
    }
    update();
  }

  selectAll.addEventListener('click', () => {
    const all = chosen.size < ids.length;
    chosen.clear();
    if (all) for (const id of ids) chosen.add(id);
    for (const checkbox of list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      checkbox.checked = all;
    }
    update();
  });

  deleteButton.addEventListener('click', () => {
    dialogText.textContent = t('parent.drawings.confirm', { count: chosen.size });
    void dialog.show(deleteButton);
  });
  requireElement('delete-cancel', HTMLButtonElement).addEventListener('click', () => {
    void dialog.hide();
  });
  requireElement('delete-confirm', HTMLButtonElement).addEventListener('click', () => {
    const doomed = [...chosen];
    void dialog
      .hide()
      .then(() => Promise.all(doomed.map((id) => options.remove(id))))
      .then(() => {
        chosen.clear();
        return refresh();
      })
      .catch(() => refresh())
      .catch(() => undefined)
      .finally(() => {
        // The focus went back to the delete button, now disabled (or dropped to the body):
        // keep it in the section.
        const focused = document.activeElement;
        if (deleteButton.disabled && (focused === deleteButton || focused === document.body)) {
          selectAll.focus();
        }
      });
  });

  return {
    refresh,
    selected: () => ids.filter((id) => chosen.has(id)),
    onChange: (listener) => listeners.push(listener),
  };
}
