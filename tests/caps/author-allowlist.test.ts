import { describe, it, expect } from 'vitest';
import { isAuthorAllowed } from '../../src/caps/author-allowlist';

describe('isAuthorAllowed', () => {
  it('allows everyone when allowlist is empty', () => {
    expect(isAuthorAllowed('alice', [])).toBe(true);
  });

  it('allows author when present in allowlist', () => {
    expect(isAuthorAllowed('redpotatoe07', ['redpotatoe07', 'alice'])).toBe(true);
  });

  it('rejects author when not in allowlist', () => {
    expect(isAuthorAllowed('mallory', ['redpotatoe07', 'alice'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAuthorAllowed('Redpotatoe07', ['redpotatoe07'])).toBe(true);
  });
});
