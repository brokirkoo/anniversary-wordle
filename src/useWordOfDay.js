import words from './words.json';

/**
 * Returns the Word of the Day for a given date string (YYYY-MM-DD).
 * Falls back to null if the date is not in the word list.
 */
export function getWordForDate(dateStr) {
  return words[dateStr] ?? null;
}

/**
 * Returns today's local date as YYYY-MM-DD without UTC drift.
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWordOfDay() {
  return getWordForDate(getTodayString());
}