export function listHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    if (defaults[key] !== undefined && String(defaults[key]) === String(value)) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
