/**
 * Shares files through the native share sheet ("Save to Files" on iPad, the file manager
 * on Android), or downloads them where sharing files is not available (desktop browsers,
 * older systems).
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function shareFile(file: File): Promise<ShareOutcome> {
  return shareFiles([file]);
}

export async function shareFiles(files: File[]): Promise<ShareOutcome> {
  const data = { files };
  if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // NotAllowedError (user activation expired while the PNG was made) and others:
      // fall back to downloads so the files still reach the device.
    }
  }
  for (const file of files) download(file);
  return 'downloaded';
}
