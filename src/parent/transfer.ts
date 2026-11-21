/**
 * Parent page: export the drawings as magic PNGs, and import magic PNGs back. Only valid
 * magic PNGs with a known schema are accepted; drawings already there are not duplicated.
 */
import { requireElement } from '../app/dom';
import { encodeMagicPng } from '../app/magic-image';
import { shareFiles } from '../app/share';
import type { Translator } from '../i18n/i18n';
import type { DrawingRecord } from '../store/db';
import { drawingFileName } from '../store/file-name';
import { mergeImport, type Decoded } from '../store/import-merge';
import { decodeMagicPng } from '../store/magic-png';
import type { Drawing } from '../engine/types';

export interface TransferOptions {
  t: Translator['t'];
  list: () => Promise<DrawingRecord[]>;
  /** Ids chosen in the drawings list; empty means "all". */
  selected: () => string[];
  save: (drawing: Drawing) => Promise<void>;
  /** The gallery changed (import). */
  onImported: () => void;
}

export interface TransferSection {
  /** An export, a share or an import is running: a reload now would cut it short. */
  busy: () => boolean;
}

export function initTransferSection(options: TransferOptions): TransferSection {
  const { t } = options;
  const exportButton = requireElement('export-drawings', HTMLButtonElement);
  const importInput = requireElement('import-files', HTMLInputElement);
  const status = requireElement('transfer-status', HTMLOutputElement);

  const shareButton = requireElement('share-export', HTMLButtonElement);
  /**
   * Export takes two taps: preparing the PNGs takes seconds, and the share sheet only opens
   * from a fresh tap (iOS refuses it once the first tap's activation has expired).
   */
  let prepared: File[] = [];
  /** The share sheet is open. */
  let sharing = false;

  function resetExport(): void {
    prepared = [];
    shareButton.hidden = true;
  }

  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true;
    resetExport();
    status.textContent = t('parent.transfer.preparing');
    try {
      const chosen = new Set(options.selected());
      const records = (await options.list()).filter(
        ({ drawing }) => chosen.size === 0 || chosen.has(drawing.id),
      );
      const files: File[] = [];
      const names = new Set<string>();
      for (const { drawing } of records) {
        // Two drawings saved in the same second would get the same name: number the next.
        const base = drawingFileName(t('file.prefix'), new Date(drawing.updatedAt));
        let name = base;
        for (let n = 2; names.has(name); n += 1) name = base.replace(/\.png$/, `-${n}.png`);
        names.add(name);
        files.push(new File([await encodeMagicPng(drawing)], name, { type: 'image/png' }));
      }
      if (files.length === 0) {
        status.textContent = t('parent.drawings.none');
        return;
      }
      prepared = files;
      status.textContent = t('parent.transfer.ready', { count: files.length });
      shareButton.textContent = t('parent.transfer.share', { count: files.length });
      shareButton.hidden = false;
      shareButton.focus();
    } catch {
      status.textContent = t('parent.transfer.exportFailed');
    } finally {
      exportButton.disabled = false;
    }
  });

  shareButton.addEventListener('click', async () => {
    const files = prepared;
    if (files.length === 0) return;
    sharing = true;
    let outcome: Awaited<ReturnType<typeof shareFiles>>;
    try {
      outcome = await shareFiles(files);
    } finally {
      sharing = false;
    }
    if (outcome === 'cancelled') return;
    status.textContent = t('parent.transfer.exported', { count: files.length });
    resetExport();
  });

  importInput.addEventListener('change', async () => {
    const files = [...(importInput.files ?? [])];
    importInput.value = '';
    if (files.length === 0) return;
    // One import at a time: a second one would count against a stale gallery.
    importInput.disabled = true;
    status.textContent = t('parent.transfer.reading');
    try {
      const decoded: Decoded[] = [];
      for (const file of files) {
        try {
          decoded.push({ ok: true, drawing: await decodeMagicPng(file) });
        } catch {
          decoded.push({ ok: false });
        }
      }
      const existing = new Set((await options.list()).map(({ drawing }) => drawing.id));
      const outcome = mergeImport(existing, decoded);
      for (const drawing of outcome.added) await options.save(drawing);
      status.textContent = t('parent.transfer.imported', {
        added: outcome.added.length,
        already: outcome.alreadyThere,
        refused: outcome.refused,
      });
    } catch {
      status.textContent = t('parent.transfer.importFailed');
    } finally {
      importInput.disabled = false;
      // Even after a failure, some drawings may have been saved.
      options.onImported();
    }
  });

  // Prepared files waiting for the share button count too: a reload would drop them.
  return {
    busy: () => exportButton.disabled || importInput.disabled || sharing || prepared.length > 0,
  };
}
