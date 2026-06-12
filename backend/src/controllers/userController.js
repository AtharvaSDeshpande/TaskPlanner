import { User } from '../models/User.js';
import { Todo } from '../models/Todo.js';
import { Course } from '../models/Course.js';
import { generatePassword } from '../utils/password.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email.js';
import { getActiveSemester } from '../utils/semester.js';
import { env } from '../config/env.js';
import { isValidProgram, isValidSection, domainOf } from '../config/academics.js';
import { safeSearchRegex } from '../utils/sanitize.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

// Roles an organization admin is allowed to assign within their tenant.
const ASSIGNABLE_ROLES = ['student', 'moderator', 'admin'];

// The admin's own organization, guaranteed present by the route guard.
function actorOrg(req) {
  const org = req.user.organization;
  if (!org) throw new ApiError(403, 'You are not attached to an organization.');
  return org;
}

// Ensures the target user exists and belongs to the same organization as the admin.
async function findSameOrgUser(req, id) {
  const org = actorOrg(req);
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'owner' || String(user.organization) !== String(org._id || org)) {
    throw new ApiError(403, 'You can only manage users within your own organization.');
  }
  return user;
}

function validateAcademics({ role, program, section }) {
  if (program && !isValidProgram(program)) throw new ApiError(400, 'Invalid program.');
  if (section && !isValidSection(section)) throw new ApiError(400, 'Invalid section.');
  // Moderators and students must be mapped to a program (their scope).
  if ((role === 'moderator' || role === 'student') && !program) {
    throw new ApiError(400, 'A program is required for students and moderators.');
  }
  if (role === 'student' && !section) {
    throw new ApiError(400, 'A section is required for students.');
  }
}

// GET /api/users  — scoped to the admin's organization.
// Pagination is opt-in: pass `limit` (and optionally `page`) to get a slice plus
// `{ total, page, limit, totalPages }`. Callers that need the full roster (role
// assignment, moderator pickers) simply omit them and get everyone (capped).
export const listUsers = asyncHandler(async (req, res) => {
  const org = actorOrg(req);
  const { role, search, program, section } = req.query;

  const filter = { organization: org._id || org };
  if (role && ASSIGNABLE_ROLES.includes(role)) filter.role = role;
  if (program) filter.program = program;
  if (section) filter.section = section;
  if (search) {
    const rx = safeSearchRegex(search);
    filter.$or = [{ name: rx }, { email: rx }, { rollNumber: rx }];
  }

  const rawLimit = parseInt(req.query.limit, 10);
  const paginated = Number.isFinite(rawLimit) && rawLimit > 0;
  const limit = paginated ? Math.min(rawLimit, 100) : 0;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const total = await User.countDocuments(filter);
  let query = User.find(filter).sort({ createdAt: -1 });
  query = paginated ? query.skip((page - 1) * limit).limit(limit) : query.limit(2000);
  const users = await query;

  res.json({
    success: true,
    count: users.length,
    total,
    page: paginated ? page : 1,
    limit: paginated ? limit : total,
    totalPages: paginated ? Math.max(1, Math.ceil(total / limit)) : 1,
    users: users.map((u) => u.toSafeJSON()),
  });
});

// POST /api/users  — admin adds a member under their own domain.
export const createUser = asyncHandler(async (req, res) => {
  const org = actorOrg(req);
  const {
    name,
    email,
    role = 'student',
    program = '',
    section = '',
    rollNumber = '',
    phone = '',
    enrollmentYear = '',
  } = req.body;

  if (!name || !email) throw new ApiError(400, 'Name and email are required.');
  if (!ASSIGNABLE_ROLES.includes(role)) throw new ApiError(400, 'Invalid role.');

  const normalizedEmail = String(email).toLowerCase().trim();
  // Enforce that the member belongs to the admin's organization domain.
  if (domainOf(normalizedEmail) !== org.domain) {
    throw new ApiError(400, `Email must be on your organization domain (@${org.domain}).`);
  }
  validateAcademics({ role, program, section });

  if (await User.findOne({ email: normalizedEmail })) {
    throw new ApiError(409, 'A user with that email already exists.');
  }

  const password = generatePassword(12);
  const user = new User({
    name: name.trim(),
    email: normalizedEmail,
    role,
    organization: org._id || org,
    program, // optional for admins; required for students/moderators (validated above)
    section,
    rollNumber: String(rollNumber).trim(),
    phone: String(phone).trim(),
    enrollmentYear: String(enrollmentYear).trim(),
  });
  await user.setPassword(password);
  await user.save();

  const result = await sendWelcomeEmail({
    name: user.name,
    email: user.email,
    password,
    loginUrl: env.clientUrl,
  });

  res.status(201).json({
    success: true,
    message: 'User created. A welcome email with the temporary password has been sent.',
    user: user.toSafeJSON(),
    generatedPassword: password,
    emailDelivered: result.delivered === true,
  });
});

const BULK_LIMIT = 500;

// Normalises one parsed spreadsheet row into a clean spec, throwing on bad data.
function normalizeRow(raw, domain) {
  const name = String(raw.name ?? '').trim();
  if (!name) throw new Error('Name is required.');

  let emailRaw = String(raw.email ?? '').toLowerCase().trim();
  if (!emailRaw) throw new Error('Email is required.');
  // Accept a bare username (we append the org domain) or a full email.
  const email = emailRaw.includes('@') ? emailRaw : `${emailRaw}@${domain}`;
  if (domainOf(email) !== domain) throw new Error(`Email must be on @${domain}.`);

  const role = String(raw.role ?? 'student').trim().toLowerCase() || 'student';
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error(`Invalid role "${role}".`);

  const program = String(raw.program ?? '').trim().toUpperCase();
  const section = String(raw.section ?? '').trim();
  validateAcademics({ role, program, section });

  // Password may be supplied in the sheet; if blank, one is generated.
  const password = String(raw.password ?? '').trim() || generatePassword(12);

  return {
    name,
    email,
    role,
    program,
    section,
    rollNumber: String(raw.rollNumber ?? raw.rollNo ?? '').trim(),
    phone: String(raw.phone ?? '').trim(),
    enrollmentYear: String(raw.enrollmentYear ?? raw.year ?? '').trim(),
    password,
  };
}

// POST /api/users/bulk  { users: [...] }   (user:manage)
// Imports a roster (parsed from the admin's Excel/CSV on the client). Resilient:
// valid rows are created, bad rows are reported. Imported users keep
// mustChangePassword=true, so they are forced to set their own password on first
// login even though the temporary one came from the sheet.
export const bulkCreateUsers = asyncHandler(async (req, res) => {
  const org = actorOrg(req);
  const orgId = org._id || org;
  const rows = Array.isArray(req.body.users) ? req.body.users : [];
  if (!rows.length) throw new ApiError(400, 'No rows found to import.');
  if (rows.length > BULK_LIMIT) {
    throw new ApiError(400, `Please import at most ${BULK_LIMIT} users at a time.`);
  }

  const created = [];
  const failed = [];
  const seen = new Set(); // catch duplicate emails within the same file

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = Number(rows[i]?.__row) || i + 2; // 1-based incl. header
    try {
      const spec = normalizeRow(rows[i] || {}, org.domain);
      if (seen.has(spec.email)) throw new Error('Duplicate email in this file.');
      seen.add(spec.email);
      // eslint-disable-next-line no-await-in-loop
      if (await User.findOne({ email: spec.email })) throw new Error('A user with that email already exists.');

      const user = new User({
        name: spec.name,
        email: spec.email,
        role: spec.role,
        organization: orgId,
        program: spec.program,
        section: spec.section,
        rollNumber: spec.rollNumber,
        phone: spec.phone,
        enrollmentYear: spec.enrollmentYear,
        mustChangePassword: true,
      });
      // eslint-disable-next-line no-await-in-loop
      await user.setPassword(spec.password);
      // eslint-disable-next-line no-await-in-loop
      await user.save();
      created.push({ name: spec.name, email: spec.email, role: spec.role, password: spec.password });
    } catch (err) {
      failed.push({ row: rowNum, email: rows[i]?.email || '', error: err.message });
    }
  }

  res.status(created.length ? 201 : 400).json({
    success: created.length > 0,
    summary: { total: rows.length, created: created.length, failed: failed.length },
    created, // includes the temporary password so the admin can distribute it
    failed,
  });
});

// PATCH /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const user = await findSameOrgUser(req, req.params.id);
  const { name, program, section, rollNumber, role, isActive, phone, enrollmentYear } = req.body;

  const nextRole = role !== undefined ? role : user.role;
  if (role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(role)) throw new ApiError(400, 'Invalid role.');
    user.role = role;
  }
  if (name !== undefined) user.name = String(name).trim();
  if (program !== undefined) user.program = program;
  if (section !== undefined) user.section = section;
  if (rollNumber !== undefined) user.rollNumber = String(rollNumber).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (enrollmentYear !== undefined) user.enrollmentYear = String(enrollmentYear).trim();
  if (typeof isActive === 'boolean') user.isActive = isActive;

  validateAcademics({ role: nextRole, program: user.program, section: user.section });

  await user.save();
  res.json({ success: true, user: user.toSafeJSON() });
});

// POST /api/users/:id/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const user = await findSameOrgUser(req, req.params.id);

  const password = generatePassword(12);
  await user.setPassword(password);
  user.mustChangePassword = true;
  await user.save();

  // The E2E key is derived from the password, so a reset makes the user's
  // existing ciphertext unreadable — clear it to avoid orphaned, locked cards.
  await Todo.deleteMany({ user: user._id });

  const result = await sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    password,
    loginUrl: env.clientUrl,
  });

  res.json({
    success: true,
    message: 'Password reset. The new temporary password has been emailed to the user.',
    generatedPassword: password,
    emailDelivered: result.delivered === true,
  });
});

// PUT /api/users/:id/moderated-courses  { courseIds }   (course:manage)
// Sets exactly which of the active semester's courses this user moderates — the
// "make a user a subject moderator" action, driven from the user view.
export const setUserModeratedCourses = asyncHandler(async (req, res) => {
  const user = await findSameOrgUser(req, req.params.id);
  const orgId = actorOrg(req)._id || actorOrg(req);
  const active = await getActiveSemester(orgId);
  if (!active) throw new ApiError(409, 'No active semester. Start a semester first.');

  const requested = new Set((req.body.courseIds || []).map(String));
  const courses = await Course.find({ organization: orgId, semester: active._id });

  await Promise.all(
    courses.map((c) => {
      const isMod = c.moderators.some((m) => String(m) === String(user._id));
      const shouldMod = requested.has(String(c._id));
      if (isMod && !shouldMod) return Course.updateOne({ _id: c._id }, { $pull: { moderators: user._id } });
      if (!isMod && shouldMod) return Course.updateOne({ _id: c._id }, { $addToSet: { moderators: user._id } });
      return null;
    }),
  );

  const moderated = courses
    .filter((c) => requested.has(String(c._id)))
    .map((c) => ({ id: String(c._id), code: c.code, title: c.title }));
  res.json({ success: true, moderatedCourses: moderated });
});

// DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await findSameOrgUser(req, req.params.id);
  if (user._id.equals(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');

  // Cascade the user's personal + collaborative footprint.
  const { Group } = await import('../models/Group.js');
  const { GroupTodo } = await import('../models/GroupTodo.js');
  const { AssignmentProgress } = await import('../models/AssignmentProgress.js');
  const { Course } = await import('../models/Course.js');

  // Delete groups they own (and those groups' boards); drop them from others.
  const ownedGroups = await Group.find({ owner: user._id }).select('_id');
  const ownedIds = ownedGroups.map((g) => g._id);

  await Promise.all([
    Todo.deleteMany({ user: user._id }),
    AssignmentProgress.deleteMany({ user: user._id }),
    GroupTodo.deleteMany({ group: { $in: ownedIds } }),
    Group.deleteMany({ owner: user._id }),
    Group.updateMany({ members: user._id }, { $pull: { members: user._id } }),
    Course.updateMany({ moderators: user._id }, { $pull: { moderators: user._id } }),
  ]);
  await user.deleteOne();
  res.json({ success: true, message: 'User deleted.' });
});
