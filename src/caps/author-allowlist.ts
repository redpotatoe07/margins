export function isAuthorAllowed(
  author: string,
  allowlist: string[]
): boolean {
  if (allowlist.length === 0) return true;
  const lower = author.toLowerCase();
  return allowlist.some((a) => a.toLowerCase() === lower);
}
