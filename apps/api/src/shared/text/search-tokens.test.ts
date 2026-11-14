import { describe, expect, it } from 'vitest';
import { queryWords, searchTokens, sortKey } from './search-tokens.ts';

describe('searchTokens', () => {
  it('lowercases, strips diacritics and splits on punctuation', () => {
    expect(searchTokens('Álvaro Núñez', 'St. Mary-Hospital')).toEqual([
      'alvaro',
      'nunez',
      'st',
      'mary',
      'hospital',
    ]);
  });

  it('deduplicates and ignores empty input', () => {
    expect(searchTokens('Bob bob BOB', undefined, '')).toEqual(['bob']);
  });

  it('caps the number of tokens', () => {
    const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
    expect(searchTokens(text)).toHaveLength(32);
  });
});

describe('queryWords', () => {
  it('normalizes and limits the words of a query', () => {
    expect(queryWords('  ÁLI  he ')).toEqual(['ali', 'he']);
    expect(queryWords('a b c d e f g')).toHaveLength(5);
    expect(queryWords(undefined)).toEqual([]);
  });

  it('never lets regex characters through', () => {
    expect(queryWords('.*(a|b)[')).toEqual(['a', 'b']);
  });
});

describe('sortKey', () => {
  it('orders accented names with their base letters', () => {
    expect(sortKey('Álvaro')).toBe('alvaro');
  });
});
