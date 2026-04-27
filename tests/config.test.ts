import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/config';

describe('parseConfig', () => {
  it('returns config with defaults when only required inputs provided', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
    });
    expect(cfg.model).toBe('claude-haiku-4-5');
    expect(cfg.maxTokensPerPr).toBe(8000);
    expect(cfg.confidenceThreshold).toBe(0.7);
    expect(cfg.allowedAuthors).toEqual([]);
    expect(cfg.monthlyQuota).toBe(500);
  });

  it('parses comma-separated allowed-authors into array', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
      allowedAuthors: 'redpotatoe07, alice, bob',
    });
    expect(cfg.allowedAuthors).toEqual(['redpotatoe07', 'alice', 'bob']);
  });

  it('respects override of model', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
      model: 'claude-sonnet-4-6',
    });
    expect(cfg.model).toBe('claude-sonnet-4-6');
  });

  it('parses numeric inputs from strings', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
      maxTokensPerPr: '4000',
      confidenceThreshold: '0.8',
      monthlyQuota: '200',
    });
    expect(cfg.maxTokensPerPr).toBe(4000);
    expect(cfg.confidenceThreshold).toBe(0.8);
    expect(cfg.monthlyQuota).toBe(200);
  });

  it('defaults rulesFile to .margins.md', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
    });
    expect(cfg.rulesFile).toBe('.margins.md');
  });

  it('respects override of rulesFile', () => {
    const cfg = parseConfig({
      anthropicApiKey: 'sk-test',
      githubToken: 'gh-test',
      rulesFile: '.github/margins-rules.md',
    });
    expect(cfg.rulesFile).toBe('.github/margins-rules.md');
  });
});
