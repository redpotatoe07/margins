import { z } from 'zod';

export const findingSchema = z.object({
  file_path: z.string().min(1),
  line: z.number().int().nonnegative(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  category: z.enum(['correctness', 'security', 'performance', 'style', 'docs']),
  message: z.string().min(1),
  confidence: z.number().min(0).max(1),
  suggested_fix: z.string().optional(),
});

export const findingsArraySchema = z.array(findingSchema);

export type ValidatedFinding = z.infer<typeof findingSchema>;
