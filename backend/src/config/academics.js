// Single source of truth for academic enums. Add new entries here and they
// flow through validation, seeding and (mirrored) the frontend dropdowns.
export const PROGRAMS = ['PGPM', 'PGDM', 'MBA'];

export const SECTIONS = ['1', '2', '3'];

export const isValidProgram = (p) => PROGRAMS.includes(p);
export const isValidSection = (s) => SECTIONS.includes(String(s));

// Returns the lowercased domain portion of an email, or '' if malformed.
export const domainOf = (email = '') => {
  const at = String(email).toLowerCase().trim().lastIndexOf('@');
  return at === -1 ? '' : String(email).toLowerCase().trim().slice(at + 1);
};
