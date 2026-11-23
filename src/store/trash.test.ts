import { describe, expect, it } from 'vitest';
import { TRASH_RETENTION_MS, daysLeft, isExpired, keepTrashState, sortTrash } from './trash';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 23, 12);

describe('isExpired', () => {
  it('keeps a trashed drawing 30 days, to the millisecond', () => {
    expect(TRASH_RETENTION_MS).toBe(30 * DAY);
    expect(isExpired(NOW - 30 * DAY + 1, NOW)).toBe(false);
    expect(isExpired(NOW - 30 * DAY, NOW)).toBe(true);
    expect(isExpired(NOW - 31 * DAY, NOW)).toBe(true);
  });

  it('counts a date in the future (clock moved back) as trashed now', () => {
    expect(isExpired(NOW + 365 * DAY, NOW)).toBe(false);
    expect(daysLeft(NOW + 365 * DAY, NOW)).toBe(30);
  });

  it('never expires a drawing outside the trash or with a broken date', () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired(Number.NaN, NOW)).toBe(false);
    expect(isExpired(Number.POSITIVE_INFINITY, NOW)).toBe(false);
  });
});

describe('daysLeft', () => {
  it('is 30 on the first day and 1 on the last, never 0 before expiry', () => {
    expect(daysLeft(NOW, NOW)).toBe(30);
    expect(daysLeft(NOW - 1, NOW)).toBe(30);
    expect(daysLeft(NOW - DAY, NOW)).toBe(29);
    expect(daysLeft(NOW - 30 * DAY + 1, NOW)).toBe(1);
    expect(daysLeft(NOW - 30 * DAY, NOW)).toBe(0);
  });

  it('shows the full stay for a broken date, which never expires', () => {
    expect(daysLeft(Number.NaN, NOW)).toBe(30);
    expect(daysLeft(Number.POSITIVE_INFINITY, NOW)).toBe(30);
  });
});

describe('sortTrash', () => {
  it('puts the most recently trashed first, without changing its input', () => {
    const records = [{ trashedAt: 1 }, { trashedAt: 3 }, { trashedAt: 2 }];
    expect(sortTrash(records).map(({ trashedAt }) => trashedAt)).toEqual([3, 2, 1]);
    expect(records.map(({ trashedAt }) => trashedAt)).toEqual([1, 3, 2]);
  });
});

describe('keepTrashState', () => {
  const next = { id: 'a', schema: 1 };

  it('keeps the trash date already stored (a late autosave)', () => {
    expect(keepTrashState({ id: 'a', trashedAt: 42 }, next)).toEqual({ ...next, trashedAt: 42 });
  });

  it('writes no trash date for a drawing outside the trash or new', () => {
    expect(keepTrashState({ id: 'a' }, next)).toEqual({ ...next, trashedAt: null });
    expect(keepTrashState({ id: 'a', trashedAt: null }, next)).toEqual({
      ...next,
      trashedAt: null,
    });
    expect(keepTrashState(undefined, next)).toEqual({ ...next, trashedAt: null });
    expect(keepTrashState('corrupt', next)).toEqual({ ...next, trashedAt: null });
    expect(keepTrashState({ id: 'a', trashedAt: '42' }, next)).toEqual({
      ...next,
      trashedAt: null,
    });
    expect(keepTrashState({ id: 'a', trashedAt: Number.NaN }, next)).toEqual({
      ...next,
      trashedAt: null,
    });
  });
});
