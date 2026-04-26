export type Severity = 'info' | 'warning' | 'error' | 'critical';
export type Category = 'correctness' | 'security' | 'performance' | 'style' | 'docs';

export interface Finding {
  file_path: string;
  line: number;
  severity: Severity;
  category: Category;
  message: string;
  confidence: number;
  suggested_fix?: string;
}
