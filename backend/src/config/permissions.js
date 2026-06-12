// Curated capability catalog. Every permission here gates real code somewhere —
// new permission *names* are intentionally not creatable at runtime. Custom
// roles are composed from these keys (see roleController).
//
// scope:
//   platform     → only the platform owner / platform roles may hold it
//   organization → an org admin / org roles may hold it (applies org-wide)
//   course       → course-scoped; effective only for the user's moderated courses

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

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export const COURSE_SCOPED_PERMISSIONS = new Set(['assignment:manage:course']);

export const isValidPermission = (k) => PERMISSION_KEYS.includes(k);

// Keys a role of each scope is allowed to bundle.
export const PLATFORM_ASSIGNABLE = PERMISSIONS.filter((p) => p.scope === 'platform').map((p) => p.key);
export const ORG_ASSIGNABLE = PERMISSIONS.filter(
  (p) => p.scope === 'organization' || p.scope === 'course',
).map((p) => p.key);

// Built-in role → default permissions. These roles are `isSystem` and cannot be
// edited; they define the baseline before any custom roles are layered on.
export const SYSTEM_ROLE_PERMISSIONS = {
  owner: ['org:manage', 'role:manage:global'],
  admin: ['user:manage', 'role:manage', 'semester:manage', 'course:manage', 'group:manage', 'assignment:manage'],
  moderator: ['assignment:manage:course'],
  student: [],
};
