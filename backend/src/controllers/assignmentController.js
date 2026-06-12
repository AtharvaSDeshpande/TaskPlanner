import { Assignment } from '../models/Assignment.js';
import { AssignmentProgress } from '../models/AssignmentProgress.js';
import { Course } from '../models/Course.js';
import { isValidSection } from '../config/academics.js';
import { can, assertCan } from '../utils/permissions.js';
import { getActiveSemester, requireActiveSemester } from '../utils/semester.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

const cleanSections = (input) =>
  Array.isArray(input) ? [...new Set(input.map(String).filter(isValidSection))] : [];

// Whether the user may author/edit assignments for a given course id.
const canManageCourse = (ctx, courseId) =>
  can(ctx, 'assignment:manage:course', { courseId: String(courseId) });

// Learner visibility within the active semester: same program, and the
// assignment targets all sections or the user's section.
function visibleAsLearner(assignment, user) {
  if (!user.program || assignment.program !== user.program) return false;
  return assignment.sections.length === 0 || assignment.sections.includes(user.section);
}

// GET /api/assignments?scope=upcoming|past|all[&manage=1]
// Visibility (always the active semester):
//   • assignment:manage (admin)      → every assignment in the org
//   • course moderators              → assignments for their moderated courses
//   • students                       → their program + section
// `manage=1` returns only the assignments the caller can author/edit.
export const listAssignments = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) return res.json({ success: true, count: 0, assignments: [] });
  const active = await getActiveSemester(orgId);
  if (!active) return res.json({ success: true, count: 0, assignments: [] });

  const ctx = req.authContext;
  const isOrgManager = can(ctx, 'assignment:manage');
  const manageView = req.query.manage === '1' || req.query.manage === 'true';
  const filter = { organization: orgId, semester: active._id };

  if (isOrgManager) {
    // sees everything
  } else if (manageView) {
    filter.course = { $in: ctx.moderatedCourseIds };
  } else {
    const or = [];
    if (req.user.program) {
      or.push({
        program: req.user.program,
        $or: [{ sections: { $size: 0 } }, { sections: req.user.section || '__none__' }],
      });
    }
    if (ctx.moderatedCourseIds.length) or.push({ course: { $in: ctx.moderatedCourseIds } });
    if (!or.length) return res.json({ success: true, count: 0, assignments: [] });
    filter.$or = or;
  }

  if (req.query.courseId) filter.course = req.query.courseId;

  const now = new Date();
  if (req.query.scope === 'upcoming') filter.dueAt = { $gte: now };
  else if (req.query.scope === 'past') filter.dueAt = { $lt: now };
  const sort = req.query.scope === 'past' ? { dueAt: -1 } : { dueAt: 1 };

  const assignments = await Assignment.find(filter)
    .sort(sort)
    .populate('course', 'code title')
    .populate('createdBy', 'name role')
    .limit(1000);

  // Attach the caller's personal completion status + manage flag.
  const ids = assignments.map((a) => a._id);
  const done = await AssignmentProgress.find({
    user: req.user._id,
    assignment: { $in: ids },
    completed: true,
  }).select('assignment');
  const doneSet = new Set(done.map((p) => String(p.assignment)));

  const out = assignments.map((a) => ({
    ...a.toObject(),
    done: doneSet.has(String(a._id)),
    canManage: canManageCourse(ctx, a.course?._id || a.course),
  }));

  res.json({ success: true, count: out.length, assignments: out });
});

// GET /api/assignments/:id
export const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, organization: orgIdOf(req.user) })
    .populate('course', 'code title')
    .populate('createdBy', 'name role');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  res.json({ success: true, assignment });
});

// POST /api/assignments
export const createAssignment = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const active = await requireActiveSemester(orgId);

  const { title, dueAt, description, attachmentUrl, sections, courseId } = req.body;
  const course = await Course.findOne({ _id: courseId, organization: orgId, semester: active._id });
  if (!course) throw new ApiError(400, 'Choose a valid course in the current semester.');
  if (!course.program) throw new ApiError(400, 'This course has no program set; set it before posting.');

  assertCan(req.authContext, 'assignment:manage:course', { courseId: course._id });

  if (!title || !dueAt) throw new ApiError(400, 'Title and due date are required.');
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) throw new ApiError(400, 'Invalid due date.');

  let assignment = await Assignment.create({
    title: title.trim(),
    description: description || '',
    course: course._id,
    semester: active._id,
    organization: orgId,
    program: course.program,
    sections: cleanSections(sections),
    dueAt: due,
    attachmentUrl: attachmentUrl || '',
    createdBy: req.user._id,
  });
  assignment = await assignment.populate('course', 'code title');
  res.status(201).json({ success: true, assignment });
});

// Loads an assignment the caller may modify (course-scoped permission).
async function findEditable(req) {
  const assignment = await Assignment.findOne({ _id: req.params.id, organization: orgIdOf(req.user) });
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  assertCan(req.authContext, 'assignment:manage:course', { courseId: assignment.course });
  return assignment;
}

// PATCH /api/assignments/:id
export const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await findEditable(req);
  const { title, description, dueAt, attachmentUrl, sections, courseId } = req.body;

  if (title !== undefined) assignment.title = title.trim();
  if (description !== undefined) assignment.description = description;
  if (attachmentUrl !== undefined) assignment.attachmentUrl = attachmentUrl;
  if (sections !== undefined) assignment.sections = cleanSections(sections);

  // Only org-wide managers may move an assignment to a different course.
  if (courseId !== undefined && can(req.authContext, 'assignment:manage')) {
    const course = await Course.findOne({
      _id: courseId,
      organization: orgIdOf(req.user),
      semester: assignment.semester,
    });
    if (!course || !course.program) throw new ApiError(400, 'Invalid course.');
    assignment.course = course._id;
    assignment.program = course.program;
  }
  if (dueAt !== undefined) {
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) throw new ApiError(400, 'Invalid due date.');
    assignment.dueAt = due;
    assignment.reminderSentAt = null;
  }

  await assignment.save();
  await assignment.populate('course', 'code title');
  res.json({ success: true, assignment });
});

// DELETE /api/assignments/:id
export const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await findEditable(req);
  await AssignmentProgress.deleteMany({ assignment: assignment._id });
  await assignment.deleteOne();
  res.json({ success: true, message: 'Assignment deleted.' });
});

// PATCH /api/assignments/:id/progress  { completed }
export const setProgress = asyncHandler(async (req, res) => {
  const completed = Boolean(req.body.completed);
  const assignment = await Assignment.findOne({ _id: req.params.id, organization: orgIdOf(req.user) });
  const allowed =
    assignment &&
    (can(req.authContext, 'assignment:manage') ||
      canManageCourse(req.authContext, assignment.course) ||
      visibleAsLearner(assignment, req.user));
  if (!allowed) throw new ApiError(404, 'Assignment not found.');

  await AssignmentProgress.findOneAndUpdate(
    { user: req.user._id, assignment: assignment._id },
    { completed, completedAt: completed ? new Date() : null },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ success: true, id: assignment._id, done: completed });
});
