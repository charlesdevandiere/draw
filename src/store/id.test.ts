import { describe, expect, it } from 'vitest';
import { newId, uuidFromBytes } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidFromBytes', () => {
  it('sets the version and variant bits', () => {
    expect(uuidFromBytes(new Uint8Array(16).fill(0xff))).toBe(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
    );
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });
});

describe('newId', () => {
  it('returns a version 4 UUID', () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it('falls back to getRandomValues without randomUUID (insecure context)', () => {
    // An own property hides the prototype's method; deleting it restores the method.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = new Set([newId(), newId()]);
      expect(ids.size).toBe(2);
      for (const id of ids) expect(id).toMatch(UUID_V4);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });
});
