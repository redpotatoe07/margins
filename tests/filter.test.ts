import { describe, it, expect } from 'vitest';
import { filterByConfidence } from '../src/filter';
import { ValidatedFinding } from '../src/schema';

const mkFinding = (confidence: number): ValidatedFinding => ({
  file_path: 'src/a.ts',
  line: 1,
  severity: 'warning',
  category: 'correctness',
  message: 'x',
  confidence,
});

describe('filterByConfidence', () => {
  it('drops findings below threshold', () => {
    const findings = [mkFinding(0.5), mkFinding(0.7), mkFinding(0.9)];
    const result = filterByConfidence(findings, 0.7);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.confidence)).toEqual([0.7, 0.9]);
  });

  it('returns empty when all are below threshold', () => {
    const findings = [mkFinding(0.3), mkFinding(0.5)];
    expect(filterByConfidence(findings, 0.8)).toEqual([]);
  });

  it('keeps everything when threshold is 0', () => {
    const findings = [mkFinding(0.0), mkFinding(0.4)];
    expect(filterByConfidence(findings, 0)).toHaveLength(2);
  });
});
