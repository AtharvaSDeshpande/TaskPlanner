// Client-side mirror of the backend permission check. `user` is the object from
// /auth (carries `permissions: [key]` + `moderatedCourses: [{id,code,title}]`).
const COURSE_SCOPED = new Set(['assignment:manage:course']);
const COURSE_TO_ORG = { 'assignment:manage:course': 'assignment:manage' };

export function can(user, key, { courseId } = {}) {
  const perms = new Set(user?.permissions || []);
  if (COURSE_SCOPED.has(key)) {
    const orgKey = COURSE_TO_ORG[key];
    if (orgKey && perms.has(orgKey)) return true;
    // Being listed on a course's moderators IS the grant for that course.
    const moderated = (user?.moderatedCourses || []).map((c) => String(c.id));
    return Boolean(courseId && moderated.includes(String(courseId)));
  }
  return perms.has(key);
}

// True if the user can author assignments for at least one course (org-wide or as
// a course moderator) — drives the "Manage Assignments" nav/route.
export const canManageAnyAssignment = (user) =>
  Boolean(
    user &&
      ((user.permissions || []).includes('assignment:manage') ||
        (user.moderatedCourses || []).length),
  );

export const canAny = (user, keys) => keys.some((k) => can(user, k));
