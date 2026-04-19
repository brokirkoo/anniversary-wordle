import raw from './valid-words.txt?raw';

// Built once at module load — O(1) lookups everywhere
const VALID_WORDS = new Set(raw.split('\n').map((w) => w.trim()).filter(Boolean));

export function isValidWord(word) {
  return VALID_WORDS.has(word.toLowerCase());
}