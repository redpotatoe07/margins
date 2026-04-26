export function currentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export interface QuotaCheckParams {
  monthKey: string;
  limit: number;
  get: (key: string) => Promise<string | null>;
  set: (value: string) => Promise<void>;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkAndIncrementQuota(
  params: QuotaCheckParams
): Promise<QuotaResult> {
  const cacheKey = `margins-quota-${params.monthKey}`;
  const raw = await params.get(cacheKey);
  const current = raw ? parseInt(raw, 10) : 0;

  if (current >= params.limit) {
    return { allowed: false, used: current, limit: params.limit };
  }

  const next = current + 1;
  await params.set(String(next));
  return { allowed: true, used: next, limit: params.limit };
}
