import crypto from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '@#$%&*!?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(set) {
  return set[crypto.randomInt(set.length)];
}

// Generates a readable, reasonably strong password that satisfies the
// validation rules used at login (>= 8 chars, mixed case, digit, symbol).
export function generatePassword(length = 12) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(ALL));
  }
  // Fisher–Yates shuffle so the guaranteed chars are not always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
