import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callReview } from '../src/anthropic';
import * as core from '@actions/core';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: mockCreate },
    };
  }),
}));

vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('callReview', () => {
  it('returns parsed JSON findings on a clean response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              file_path: 'src/a.ts',
              line: 5,
              severity: 'warning',
              category: 'correctness',
              message: 'x',
              confidence: 0.8,
            },
          ]),
        },
      ],
    });

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toHaveLength(1);
    expect(result[0].file_path).toBe('src/a.ts');
  });

  it('returns empty array on malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toEqual([]);
  });

  it('returns empty array if response fails schema validation', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([{ file_path: 'x' /* missing fields */ }]),
        },
      ],
    });

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toEqual([]);
  });

  it('round-trips a finding with suggested_fix: null', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              file_path: 'src/a.ts',
              line: 5,
              severity: 'warning',
              category: 'correctness',
              message: 'x',
              confidence: 0.8,
              suggested_fix: null,
            },
          ]),
        },
      ],
    });

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toHaveLength(1);
    expect(result[0].file_path).toBe('src/a.ts');
  });

  it('surfaces schema-validation failures via core.warning, not console', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([{ file_path: 'x' /* missing fields */ }]),
        },
      ],
    });

    await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(core.warning).toHaveBeenCalled();
    const callArgs = vi.mocked(core.warning).mock.calls[0][0];
    expect(String(callArgs)).toMatch(/schema validation/i);
  });

  it('surfaces malformed-JSON failures via core.warning, not console', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(core.warning).toHaveBeenCalled();
    const callArgs = vi.mocked(core.warning).mock.calls[0][0];
    expect(String(callArgs)).toMatch(/json/i);
  });

  it('surfaces API call failures via core.warning', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network down'));

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toEqual([]);
    expect(core.warning).toHaveBeenCalled();
    const callArgs = vi.mocked(core.warning).mock.calls[0][0];
    expect(String(callArgs)).toMatch(/anthropic|network|api/i);
  });

  it('extracts JSON from markdown code fences if model wraps it', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n[{"file_path":"a.ts","line":1,"severity":"info","category":"style","message":"x","confidence":0.7}]\n```',
        },
      ],
    });

    const result = await callReview({
      apiKey: 'sk-test',
      model: 'claude-haiku-4-5',
      maxTokens: 4000,
      systemPrompt: 'sys',
      userMessage: 'user',
    });

    expect(result).toHaveLength(1);
  });
});
