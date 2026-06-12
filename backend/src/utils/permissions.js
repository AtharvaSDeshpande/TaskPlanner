import { Role } from '../models/Role.js';
import { Semester } from '../models/Semester.js';
import { Course } from '../models/Course.js';
import { SYSTEM_ROLE_PERMISSIONS, COURSE_SCOPED_PERMISSIONS } from '../config/permissions.js';
import { ApiError } from './ApiError.js';

// A course-scoped permission is satisfied org-wide by its broader counterpart.
const COURSE_TO_ORG = { 'assignment:manage:course': 'assignment:manage' };

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

// Computes the user's effective authorization context for a request:
//   permissions        – union of base-role defaults + assigned custom roles
//   moderatedCourseIds  – ids of active-semester courses the user moderates
//   moderatedCourses    – the same, as {id,code,title} for the client
export async function buildAuthContext(user) {
  const permissions = new Set(SYSTEM_ROLE_PERMISSIONS[user.role] || []);

  if (Array.isArray(user.roles) && user.roles.length) {
    const roleIds = user.roles.map((r) => r._id || r);
    const roles = await Role.find({ _id: { $in: roleIds } }).select('permissions');
    roles.forEach((r) => r.permissions.forEach((p) => permissions.add(p)));
  }

  let moderatedCourses = [];
  const orgId = orgIdOf(user);
  if (orgId) {
    const activeSem = await Semester.findOne({ organization: orgId, isActive: true }).select('_id');
    if (activeSem) {
      const courses = await Course.find({ semester: activeSem._id, moderators: user._id }).select(
        'code title',
      );
      moderatedCourses = courses.map((c) => ({ id: String(c._id), code: c.code, title: c.title }));
    }
  }

  return {
    permissions,
    moderatedCourseIds: moderatedCourses.map((c) => c.id),
    moderatedCourses,
  };
}

// Returns whether the auth context grants `key`. For course-scoped keys, pass
// `{ courseId }`; it is granted if the user holds the org-wide counterpart OR
// holds the course key AND moderates that course.
export function can(ctx, key, { courseId } = {}) {
  if (!ctx) return false;
  if (COURSE_SCOPED_PERMISSIONS.has(key)) {
    const orgKey = COURSE_TO_ORG[key];
    if (orgKey && ctx.permissions.has(orgKey)) return true;
    // Being listed on a course's moderators IS the grant for that course.
    return Boolean(courseId && ctx.moderatedCourseIds.includes(String(courseId)));
  }
  return ctx.permissions.has(key);
}

// True if the user can manage assignments for at least one course (org-wide or
// as a course moderator) — used to reveal authoring UI/nav.
export function canManageAnyAssignment(ctx) {
  return Boolean(ctx && (ctx.permissions.has('assignment:manage') || ctx.moderatedCourseIds.length));
}

export function assertCan(ctx, key, opts) {
  if (!can(ctx, key, opts)) {
    throw new ApiError(403, 'You do not have permission to perform this action.');
  }
}
