import { ValidatedFinding } from './schema';

export function filterByConfidence(
  findings: ValidatedFinding[],
  threshold: number
): ValidatedFinding[] {
  return findings.filter((f) => f.confidence >= threshold);
}
