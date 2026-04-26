import { describe, it, expect } from 'vitest';
import { estimateInputTokens, truncateDiff } from '../../src/caps/token-cap';

describe('estimateInputTokens', () => {
  it('estimates roughly 4 chars per token', () => {
    const text = 'a'.repeat(4000);
    expect(estimateInputTokens(text)).toBeCloseTo(1000, 0);
  });

  it('handles empty string as 0', () => {
    expect(estimateInputTokens('')).toBe(0);
  });
});

describe('truncateDiff', () => {
  it('returns the diff unchanged when under the cap', () => {
    const diff = 'short';
    expect(truncateDiff(diff, 1000)).toBe('short');
  });

  it('truncates and appends marker when over the cap', () => {
    const diff = 'x'.repeat(50000);
    const result = truncateDiff(diff, 1000); // ~4000 chars
    expect(result.length).toBeLessThan(50000);
    expect(result).toContain('[truncated by margins');
  });
});
