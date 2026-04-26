import { describe, it, expect } from 'vitest';
import { findingSchema, findingsArraySchema } from '../src/schema';

describe('findingSchema', () => {
  it('accepts a valid finding', () => {
    const valid = {
      file_path: 'src/foo.ts',
      line: 42,
      severity: 'warning',
      category: 'correctness',
      message: 'Possible null deref',
      confidence: 0.85,
    };
    expect(() => findingSchema.parse(valid)).not.toThrow();
  });

  it('accepts a finding with suggested_fix', () => {
    const valid = {
      file_path: 'src/foo.ts',
      line: 42,
      severity: 'error',
      category: 'security',
      message: 'SQL injection risk',
      confidence: 0.95,
      suggested_fix: 'Use parameterized query',
    };
    expect(() => findingSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid severity', () => {
    const invalid = {
      file_path: 'src/foo.ts',
      line: 42,
      severity: 'urgent',
      category: 'correctness',
      message: 'x',
      confidence: 0.5,
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid category', () => {
    const invalid = {
      file_path: 'src/foo.ts',
      line: 42,
      severity: 'warning',
      category: 'unknown',
      message: 'x',
      confidence: 0.5,
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });

  it('rejects confidence outside 0..1', () => {
    const invalid = {
      file_path: 'src/foo.ts',
      line: 42,
      severity: 'warning',
      category: 'correctness',
      message: 'x',
      confidence: 1.5,
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });
});

describe('findingsArraySchema', () => {
  it('accepts an empty array', () => {
    expect(() => findingsArraySchema.parse([])).not.toThrow();
  });

  it('accepts an array of valid findings', () => {
    const valid = [
      {
        file_path: 'src/a.ts',
        line: 1,
        severity: 'info',
        category: 'style',
        message: 'a',
        confidence: 0.7,
      },
      {
        file_path: 'src/b.ts',
        line: 2,
        severity: 'critical',
        category: 'security',
        message: 'b',
        confidence: 0.99,
      },
    ];
    expect(() => findingsArraySchema.parse(valid)).not.toThrow();
  });
});
