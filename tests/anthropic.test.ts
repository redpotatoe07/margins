import { describe, it, expect, vi } from 'vitest';
import { callReview } from '../src/anthropic';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: { create: mockCreate },
    };
  }),
}));

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
