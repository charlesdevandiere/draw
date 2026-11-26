import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Drawing } from '../engine/types';
import { createAutosave } from './autosave';

const stroke = { tool: 'pen' as const, color: '#000000', width: 8, points: [0, 0, 0] };

function drawing(strokes = [stroke], id = 'a'): Drawing {
  return { id, createdAt: 0, updatedAt: strokes.length, strokes, templates: [] };
}

function target() {
  return {
    save: vi.fn<(drawing: Drawing) => Promise<void>>(async () => undefined),
    remove: vi.fn<(id: string) => Promise<void>>(async () => undefined),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('autosave', () => {
  it('batches changes into one save after the delay', async () => {
    const t = target();
    const autosave = createAutosave(t, 1000);
    autosave.changed(drawing());
    autosave.changed(drawing([stroke, stroke]));
    expect(autosave.pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(t.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.save).toHaveBeenCalledWith(drawing([stroke, stroke]));
    expect(autosave.pending()).toBe(false);
  });

  it('flushes right away', async () => {
    const t = target();
    const autosave = createAutosave(t, 1000);
    autosave.changed(drawing());
    await autosave.flush();
    expect(t.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.save).toHaveBeenCalledTimes(1);
  });

  it('removes a drawing left empty instead of saving it', async () => {
    const t = target();
    const autosave = createAutosave(t);
    autosave.changed(drawing([], 'gone'));
    await autosave.flush();
    expect(t.remove).toHaveBeenCalledWith('gone');
    expect(t.save).not.toHaveBeenCalled();
  });

  it('keeps a drawing with a template but no stroke yet', async () => {
    const t = target();
    const autosave = createAutosave(t);
    const layer = { slot: 'overlay' as const, template: 'x', version: 1, params: {}, svg: '' };
    const templated: Drawing = {
      ...drawing([]),
      templates: [{ slot: 'overlay', layer, at: 0, t: 0 }],
    };
    autosave.changed(templated);
    await autosave.flush();
    expect(t.save).toHaveBeenCalledWith(templated);
    expect(t.remove).not.toHaveBeenCalled();
  });

  it('never runs two saves at once', async () => {
    let release: () => void = () => undefined;
    const order: string[] = [];
    const t = {
      save: vi.fn(
        (d: Drawing) =>
          new Promise<void>((resolve) => {
            order.push(`start ${d.id}`);
            release = () => {
              order.push(`end ${d.id}`);
              resolve();
            };
          }),
      ),
      remove: vi.fn(async () => undefined),
    };
    const autosave = createAutosave(t);
    autosave.changed(drawing([stroke], 'a'));
    const first = autosave.flush();
    autosave.changed(drawing([stroke], 'b'));
    const second = autosave.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['start a']);
    release();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['start a', 'end a', 'start b']);
    release();
    await second;
  });

  it('reports a failed save and keeps working', async () => {
    const errors: unknown[] = [];
    const t = target();
    t.save.mockRejectedValueOnce(new Error('quota'));
    const autosave = createAutosave(t, 1000, (error) => errors.push(error));
    autosave.changed(drawing());
    await autosave.flush();
    expect(errors).toHaveLength(1);
    autosave.changed(drawing());
    await autosave.flush();
    expect(t.save).toHaveBeenCalledTimes(2);
  });

  it('retries a failed save on the next flush', async () => {
    const t = target();
    t.save.mockRejectedValueOnce(new Error('locked'));
    const autosave = createAutosave(t);
    autosave.changed(drawing());
    await autosave.flush();
    expect(autosave.pending()).toBe(true);
    await autosave.flush();
    expect(t.save).toHaveBeenCalledTimes(2);
    expect(autosave.pending()).toBe(false);
  });

  it('swallows a failed save by default', async () => {
    const t = target();
    t.save.mockRejectedValueOnce(new Error('quota'));
    const autosave = createAutosave(t);
    autosave.changed(drawing());
    await expect(autosave.flush()).resolves.toBeUndefined();
  });

  it('flushing with nothing pending does nothing', async () => {
    const t = target();
    await createAutosave(t).flush();
    expect(t.save).not.toHaveBeenCalled();
    expect(t.remove).not.toHaveBeenCalled();
  });
});

describe('autosave across drawings', () => {
  it('keeps retrying a failed save after another drawing changes', async () => {
    const t = target();
    t.save.mockRejectedValueOnce(new Error('locked'));
    const autosave = createAutosave(t);
    autosave.changed(drawing([stroke], 'a'));
    await autosave.flush();
    autosave.changed(drawing([stroke], 'b'));
    await autosave.flush();
    expect(t.save.mock.calls.map(([d]) => d.id)).toEqual(['a', 'a', 'b']);
    expect(autosave.pending()).toBe(false);
  });

  it('never queues again an older version that fails while a newer one is on its way', async () => {
    const t = target();
    let failFirst!: (error: Error) => void;
    t.save.mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)));
    const autosave = createAutosave(t);
    const older = drawing([stroke], 'a');
    const newer = drawing([stroke, stroke], 'a');
    autosave.changed(older);
    const first = autosave.flush();
    autosave.changed(newer);
    const second = autosave.flush();
    // Let the first save start (it runs on the promise chain).
    await vi.advanceTimersByTimeAsync(0);
    failFirst(new Error('locked'));
    await Promise.all([first, second]);
    expect(t.save).toHaveBeenLastCalledWith(newer);
    expect(autosave.pending()).toBe(false);
  });

  it('keeps the newer version pending when it fails after an older one failed', async () => {
    const t = target();
    t.save.mockRejectedValue(new Error('quota'));
    const autosave = createAutosave(t);
    const newer = drawing([stroke, stroke], 'a');
    autosave.changed(drawing([stroke], 'a'));
    const first = autosave.flush();
    autosave.changed(newer);
    await Promise.all([first, autosave.flush()]);
    t.save.mockResolvedValue(undefined);
    await autosave.flush();
    expect(t.save).toHaveBeenLastCalledWith(newer);
    expect(autosave.pending()).toBe(false);
  });
});
