// Mirrors backend/src/config/permissions.js — the curated capability catalog
// the role editor composes custom roles from.
export const PERMISSIONS = [
  { key: 'org:manage', label: 'Manage organizations', scope: 'platform' },
  { key: 'role:manage:global', label: 'Manage platform roles', scope: 'platform' },

  { key: 'user:manage', label: 'Manage users', scope: 'organization' },
  { key: 'role:manage', label: 'Manage roles', scope: 'organization' },
  { key: 'semester:manage', label: 'Manage semesters', scope: 'organization' },
  { key: 'course:manage', label: 'Manage courses & course moderators', scope: 'organization' },
  { key: 'group:manage', label: 'Generate & manage all groups', scope: 'organization' },
  { key: 'assignment:manage', label: 'Manage assignments (all courses)', scope: 'organization' },

  { key: 'assignment:manage:course', label: 'Manage assignments (assigned courses only)', scope: 'course' },
];

export const permissionLabel = (key) => PERMISSIONS.find((p) => p.key === key)?.label || key;
