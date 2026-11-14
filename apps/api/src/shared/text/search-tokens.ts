const MAX_TOKENS = 32;
const MAX_QUERY_WORDS = 5;

const words = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);

export function searchTokens(...texts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const word of words(text)) {
      seen.add(word);
      if (seen.size >= MAX_TOKENS) return [...seen];
    }
  }
  return [...seen];
}

export function queryWords(query: string | undefined): string[] {
  return query ? words(query).slice(0, MAX_QUERY_WORDS) : [];
}

export function sortKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
