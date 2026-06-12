import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import { Assignment } from '../models/Assignment.js';
import { AssignmentProgress } from '../models/AssignmentProgress.js';
import { isValidProgram } from '../config/academics.js';
import { getActiveSemester, requireActiveSemester } from '../utils/semester.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);
const MOD_FIELDS = 'name email';

// GET /api/courses?semesterId=  — courses in a term (default: active). Readable
// by any org member (powers dropdowns); moderators are included for admins' UIs.
export const listCourses = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  let semesterId = req.query.semesterId;
  if (!semesterId) {
    const active = await getActiveSemester(orgId);
    semesterId = active?._id;
  }
  if (!semesterId) return res.json({ success: true, courses: [] });

  const courses = await Course.find({ organization: orgId, semester: semesterId })
    .populate('moderators', MOD_FIELDS)
    .sort({ code: 1 });
  res.json({ success: true, courses: courses.map((c) => c.toClientJSON()) });
});

async function resolveModerators(userIds, orgId) {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const users = await User.find({ _id: { $in: userIds }, organization: orgId }).select('_id');
  if (users.length !== new Set(userIds.map(String)).size) {
    throw new ApiError(400, 'One or more moderators are not members of your organization.');
  }
  return users.map((u) => u._id);
}

// POST /api/courses   (course:manage)
export const createCourse = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const semester = await requireActiveSemester(orgId);

  const { code, title, program = '', moderatorIds = [] } = req.body;
  if (!code || !title) throw new ApiError(400, 'Course code and title are required.');
  if (program && !isValidProgram(program)) throw new ApiError(400, 'Invalid program.');

  const normalizedCode = String(code).toUpperCase().trim();
  if (await Course.findOne({ semester: semester._id, code: normalizedCode })) {
    throw new ApiError(409, 'A course with that code already exists this semester.');
  }

  let course = await Course.create({
    organization: orgId,
    semester: semester._id,
    code: normalizedCode,
    title: title.trim(),
    program,
    moderators: await resolveModerators(moderatorIds, orgId),
    createdBy: req.user._id,
  });
  course = await course.populate('moderators', MOD_FIELDS);
  res.status(201).json({ success: true, course: course.toClientJSON() });
});

async function findOrgCourse(req) {
  const course = await Course.findOne({ _id: req.params.id, organization: orgIdOf(req.user) });
  if (!course) throw new ApiError(404, 'Course not found.');
  return course;
}

// PATCH /api/courses/:id   (course:manage)
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await findOrgCourse(req);
  const { code, title, program } = req.body;
  if (code !== undefined) course.code = String(code).toUpperCase().trim();
  if (title !== undefined) course.title = String(title).trim();
  if (program !== undefined) {
    if (program && !isValidProgram(program)) throw new ApiError(400, 'Invalid program.');
    course.program = program;
  }
  await course.save();
  await course.populate('moderators', MOD_FIELDS);
  res.json({ success: true, course: course.toClientJSON() });
});

// PUT /api/courses/:id/moderators  { userIds }   (course:manage)
// This is how a user (e.g. a student) becomes a subject moderator.
export const setModerators = asyncHandler(async (req, res) => {
  const course = await findOrgCourse(req);
  course.moderators = await resolveModerators(req.body.userIds, orgIdOf(req.user));
  await course.save();
  await course.populate('moderators', MOD_FIELDS);
  res.json({ success: true, course: course.toClientJSON() });
});

// DELETE /api/courses/:id   (course:manage) — cascades its assignments.
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await findOrgCourse(req);
  const assignments = await Assignment.find({ course: course._id }).select('_id');
  const ids = assignments.map((a) => a._id);
  await Promise.all([
    AssignmentProgress.deleteMany({ assignment: { $in: ids } }),
    Assignment.deleteMany({ course: course._id }),
  ]);
  await course.deleteOne();
  res.json({ success: true, message: 'Course and its assignments deleted.' });
});
