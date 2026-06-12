// Escapes user input before it is placed inside a RegExp, preventing both
// ReDoS and accidental/malicious pattern injection in search queries.
export function escapeRegex(input = '') {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds a safe, case-insensitive "contains" RegExp from user input.
export const safeSearchRegex = (input) => new RegExp(escapeRegex(String(input).trim()), 'i');
