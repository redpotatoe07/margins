const CHARS_PER_TOKEN = 4; // rough estimate

export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateDiff(diff: string, maxInputTokens: number): string {
  const maxChars = maxInputTokens * CHARS_PER_TOKEN;
  if (diff.length <= maxChars) return diff;
  const headroom = 100;
  const truncated = diff.slice(0, maxChars - headroom);
  return `${truncated}\n\n[truncated by margins — diff exceeded ${maxInputTokens}-token input cap]`;
}
