export interface RawInputs {
  anthropicApiKey: string;
  githubToken: string;
  model?: string;
  maxTokensPerPr?: string | number;
  confidenceThreshold?: string | number;
  allowedAuthors?: string;
  monthlyQuota?: string | number;
  rulesFile?: string;
}

export interface MarginsConfig {
  anthropicApiKey: string;
  githubToken: string;
  model: string;
  maxTokensPerPr: number;
  confidenceThreshold: number;
  allowedAuthors: string[];
  monthlyQuota: number;
  rulesFile: string;
}

function asNumber(v: string | number | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseConfig(inputs: RawInputs): MarginsConfig {
  return {
    anthropicApiKey: inputs.anthropicApiKey,
    githubToken: inputs.githubToken,
    model: inputs.model ?? 'claude-haiku-4-5',
    maxTokensPerPr: asNumber(inputs.maxTokensPerPr, 8000),
    confidenceThreshold: asNumber(inputs.confidenceThreshold, 0.7),
    allowedAuthors: (inputs.allowedAuthors ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    monthlyQuota: asNumber(inputs.monthlyQuota, 500),
    rulesFile: inputs.rulesFile && inputs.rulesFile.trim() !== ''
      ? inputs.rulesFile
      : '.margins.md',
  };
}
