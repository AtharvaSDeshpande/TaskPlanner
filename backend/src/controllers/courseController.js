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

// Coerces a credits/hours/sections value to a non-negative number (0 when blank).
function nonNegNumber(v, label) {
  if (v === '' || v === undefined || v === null) return 0;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) throw new ApiError(400, `${label} must be a non-negative number.`);
  return n;
}

// Pulls the optional curriculum fields off a request/row body into a clean patch.
function curriculumFields(src = {}) {
  return {
    credits: nonNegNumber(src.credits, 'Credits'),
    hours: nonNegNumber(src.hours, 'Hours'),
    sections: nonNegNumber(src.sections, 'Sections'),
    proposedFaculty: String(src.proposedFaculty ?? '').trim(),
    juniorFaculty: String(src.juniorFaculty ?? '').trim(),
  };
}

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
    ...curriculumFields(req.body),
    moderators: await resolveModerators(moderatorIds, orgId),
    createdBy: req.user._id,
  });
  course = await course.populate('moderators', MOD_FIELDS);
  res.status(201).json({ success: true, course: course.toClientJSON() });
});

const BULK_COURSE_LIMIT = 200;

// Normalises one parsed spreadsheet row into a clean course spec, throwing on
// bad data so the bulk importer can report it per-row.
function normalizeCourseRow(raw) {
  const code = String(raw.code ?? '').toUpperCase().trim();
  if (!code) throw new ApiError(400, 'Course code is required.');
  const title = String(raw.title ?? '').trim();
  if (!title) throw new ApiError(400, 'Course name is required.');

  const program = String(raw.program ?? '').toUpperCase().trim();
  if (program && !isValidProgram(program)) throw new ApiError(400, `Invalid program "${program}".`);

  return { code, title, program, ...curriculumFields(raw) };
}

// POST /api/courses/bulk  { courses: [...] }   (course:manage)
// Imports a term's course plan (parsed from the admin's Excel/CSV on the client).
// Resilient: valid rows are created into the active semester, bad/duplicate rows
// are reported.
export const bulkCreateCourses = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const semester = await requireActiveSemester(orgId);
  const rows = Array.isArray(req.body.courses) ? req.body.courses : [];
  if (!rows.length) throw new ApiError(400, 'No rows found to import.');
  if (rows.length > BULK_COURSE_LIMIT) {
    throw new ApiError(400, `Please import at most ${BULK_COURSE_LIMIT} courses at a time.`);
  }

  // Pre-load existing codes for this term so duplicates are caught without a
  // query per row.
  const existing = new Set(
    (await Course.find({ semester: semester._id }).select('code')).map((c) => c.code),
  );

  const created = [];
  const failed = [];
  const seen = new Set(); // catch duplicate codes within the same file

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = Number(rows[i]?.__row) || i + 2; // 1-based incl. header
    try {
      const spec = normalizeCourseRow(rows[i] || {});
      if (seen.has(spec.code)) throw new ApiError(400, 'Duplicate course code in this file.');
      seen.add(spec.code);
      if (existing.has(spec.code)) {
        throw new ApiError(409, 'A course with that code already exists this semester.');
      }

      // eslint-disable-next-line no-await-in-loop
      const course = await Course.create({
        organization: orgId,
        semester: semester._id,
        ...spec,
        createdBy: req.user._id,
      });
      existing.add(spec.code);
      created.push(course.toClientJSON());
    } catch (err) {
      failed.push({ row: rowNum, code: rows[i]?.code || '', error: err.message });
    }
  }

  res.status(created.length ? 201 : 400).json({
    success: created.length > 0,
    summary: { total: rows.length, created: created.length, failed: failed.length },
    created,
    failed,
  });
});

async function findOrgCourse(req) {
  const course = await Course.findOne({ _id: req.params.id, organization: orgIdOf(req.user) });
  if (!course) throw new ApiError(404, 'Course not found.');
  return course;
}

// PATCH /api/courses/:id   (course:manage)
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await findOrgCourse(req);
  const { code, title, program, credits, hours, sections, proposedFaculty, juniorFaculty } = req.body;
  if (code !== undefined) course.code = String(code).toUpperCase().trim();
  if (title !== undefined) course.title = String(title).trim();
  if (program !== undefined) {
    if (program && !isValidProgram(program)) throw new ApiError(400, 'Invalid program.');
    course.program = program;
  }
  if (credits !== undefined) course.credits = nonNegNumber(credits, 'Credits');
  if (hours !== undefined) course.hours = nonNegNumber(hours, 'Hours');
  if (sections !== undefined) course.sections = nonNegNumber(sections, 'Sections');
  if (proposedFaculty !== undefined) course.proposedFaculty = String(proposedFaculty).trim();
  if (juniorFaculty !== undefined) course.juniorFaculty = String(juniorFaculty).trim();
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
