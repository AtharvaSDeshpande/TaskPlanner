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
