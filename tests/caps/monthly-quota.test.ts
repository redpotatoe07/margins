import { describe, it, expect } from 'vitest';
import { currentMonthKey, checkAndIncrementQuota } from '../../src/caps/monthly-quota';

describe('currentMonthKey', () => {
  it('formats as YYYY-MM for a known date', () => {
    const d = new Date('2026-04-25T12:00:00Z');
    expect(currentMonthKey(d)).toBe('2026-04');
  });

  it('zero-pads single-digit months', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(currentMonthKey(d)).toBe('2026-01');
  });
});

describe('checkAndIncrementQuota', () => {
  it('allows when under the limit', async () => {
    let stored: string | null = null;
    const result = await checkAndIncrementQuota({
      monthKey: '2026-04',
      limit: 10,
      get: async () => stored,
      set: async (v: string) => {
        stored = v;
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(stored).toBe('1');
  });

  it('rejects when at the limit', async () => {
    let stored: string | null = '10';
    const result = await checkAndIncrementQuota({
      monthKey: '2026-04',
      limit: 10,
      get: async () => stored,
      set: async (v: string) => {
        stored = v;
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
  });

  it('increments existing count', async () => {
    let stored: string | null = '5';
    const result = await checkAndIncrementQuota({
      monthKey: '2026-04',
      limit: 10,
      get: async () => stored,
      set: async (v: string) => {
        stored = v;
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(6);
    expect(stored).toBe('6');
  });
});
