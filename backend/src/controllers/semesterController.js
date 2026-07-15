import { Semester } from '../models/Semester.js';
import { User } from '../models/User.js';
import { getActiveSemester } from '../utils/semester.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

// GET /api/semesters — history for the caller's organization (any member).
export const listSemesters = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const semesters = orgId
    ? await Semester.find({ organization: orgId }).sort({ isActive: -1, startedAt: -1 })
    : [];
  res.json({ success: true, semesters: semesters.map((s) => s.toClientJSON()) });
});

// GET /api/semesters/active
export const getActive = asyncHandler(async (req, res) => {
  const active = await getActiveSemester(orgIdOf(req.user));
  res.json({ success: true, semester: active ? active.toClientJSON() : null });
});

// Parses a date input, throwing a clear 400 on garbage.
function parseDate(value, label) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `${label} is not a valid date.`);
  return d;
}

// PATCH /api/semesters/:id  { name, startedAt, endedAt }   (semester:manage)
// Records/corrects a term's name and its date range. Activation is intentionally
// NOT touched here — a term only becomes active via /start — so the manual
// new-semester trigger is unchanged.
export const updateSemester = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const semester = await Semester.findOne({ _id: req.params.id, organization: orgId });
  if (!semester) throw new ApiError(404, 'Semester not found.');

  const { name, startedAt, endedAt } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Semester name cannot be empty.');
    semester.name = String(name).trim();
  }
  if (startedAt !== undefined) semester.startedAt = parseDate(startedAt, 'Start date');
  if (endedAt !== undefined) semester.endedAt = endedAt ? parseDate(endedAt, 'End date') : null;

  if (semester.endedAt && semester.endedAt < semester.startedAt) {
    throw new ApiError(400, 'End date cannot be before the start date.');
  }

  await semester.save();
  res.json({ success: true, semester: semester.toClientJSON() });
});

// POST /api/semesters/start  { name, password }   (semester:manage)
// Archive-by-scope: deactivates the current term and activates a fresh one. No
// data is deleted — assignments/courses/groups stay attached to their term and
// simply fall out of the "active" views. Requires password re-confirmation.
export const startSemester = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) throw new ApiError(403, 'You are not attached to an organization.');

  const { name, password } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'A name for the new semester is required.');
  if (!password) throw new ApiError(400, 'Please confirm your password to start a new semester.');

  const me = await User.findById(req.user._id).select('+passwordHash');
  if (!(await me.comparePassword(password))) {
    throw new ApiError(401, 'Password is incorrect.');
  }

  // Close the current active term, then open the new one.
  await Semester.updateMany(
    { organization: orgId, isActive: true },
    { isActive: false, endedAt: new Date() },
  );
  const semester = await Semester.create({
    organization: orgId,
    name: name.trim(),
    isActive: true,
    startedAt: new Date(),
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'New semester started. Previous assignments and groups are archived.',
    semester: semester.toClientJSON(),
  });
});
