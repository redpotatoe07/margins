import Anthropic from '@anthropic-ai/sdk';
import * as core from '@actions/core';
import { findingsArraySchema, ValidatedFinding } from './schema';

export interface CallReviewParams {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
}

export async function callReview(
  params: CallReviewParams
): Promise<ValidatedFinding[]> {
  const client = new Anthropic({ apiKey: params.apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    });
  } catch (err) {
    core.warning(
      `Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('\n');

  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    core.warning('Anthropic response was not valid JSON; discarding.');
    return [];
  }

  const validation = findingsArraySchema.safeParse(parsed);
  if (!validation.success) {
    core.warning(
      `Anthropic response failed schema validation: ${validation.error.message}`
    );
    return [];
  }

  return validation.data;
}
