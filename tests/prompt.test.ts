import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSystemPrompt, buildUserMessage } from '../src/prompt';

describe('buildSystemPrompt', () => {
  it('includes the JSON output schema', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('"file_path"');
    expect(sys).toContain('"severity"');
    expect(sys).toContain('"category"');
    expect(sys).toContain('"confidence"');
  });

  it('lists the allowed severity values', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('info');
    expect(sys).toContain('warning');
    expect(sys).toContain('error');
    expect(sys).toContain('critical');
  });

  it('lists the allowed category values', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('correctness');
    expect(sys).toContain('security');
    expect(sys).toContain('performance');
    expect(sys).toContain('style');
    expect(sys).toContain('docs');
  });

  it('instructs the model to return strict JSON only', () => {
    const sys = buildSystemPrompt();
    expect(sys.toLowerCase()).toContain('json');
    expect(sys.toLowerCase()).toMatch(/array|list/);
  });

  it('omits the repo-rules block when no repoRules provided', () => {
    const sys = buildSystemPrompt();
    expect(sys).not.toContain('<repo_rules>');
    expect(sys).not.toContain('REPO-SPECIFIC RULES');
  });

  it('appends the repo-rules block when repoRules provided', () => {
    const rules = '- Flag any console.log in src/\n- Allow `any` only in tests';
    const sys = buildSystemPrompt({ repoRules: rules });
    expect(sys).toContain('REPO-SPECIFIC RULES');
    expect(sys).toContain('<repo_rules>');
    expect(sys).toContain(rules);
    expect(sys).toContain('</repo_rules>');
  });

  it('places the repo-rules block after the existing review principles', () => {
    const sys = buildSystemPrompt({ repoRules: 'foo-rule' });
    const principlesIdx = sys.indexOf('REVIEW PRINCIPLES');
    const rulesIdx = sys.indexOf('<repo_rules>');
    expect(principlesIdx).toBeGreaterThan(-1);
    expect(rulesIdx).toBeGreaterThan(principlesIdx);
  });

  it('does not add the repo-rules block when repoRules is an empty string', () => {
    const sys = buildSystemPrompt({ repoRules: '' });
    expect(sys).not.toContain('<repo_rules>');
  });
});

describe('buildUserMessage', () => {
  it('embeds the diff content', () => {
    const diff = readFileSync(
      resolve(__dirname, 'fixtures/sample-diff.txt'),
      'utf-8'
    );
    const msg = buildUserMessage({
      diff,
      prTitle: 'Test PR',
      prBody: 'Test description',
    });
    expect(msg).toContain('SELECT * FROM users');
    expect(msg).toContain('Test PR');
  });

  it('uses delimiter tags around the diff', () => {
    const msg = buildUserMessage({
      diff: 'foo',
      prTitle: 't',
      prBody: 'b',
    });
    expect(msg).toMatch(/<diff>[\s\S]*<\/diff>/);
  });
});
