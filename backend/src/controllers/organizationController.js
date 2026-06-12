import mongoose from 'mongoose';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Assignment } from '../models/Assignment.js';
import { Semester } from '../models/Semester.js';
import { env } from '../config/env.js';
import { domainOf } from '../config/academics.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { sendWelcomeEmail } from '../utils/email.js';

// Aggregates member counts per organization, keyed by org id.
async function memberCounts(orgIds) {
  const rows = await User.aggregate([
    { $match: { organization: { $in: orgIds } } },
    { $group: { _id: { org: '$organization', role: '$role' }, n: { $sum: 1 } } },
  ]);
  const map = {};
  for (const id of orgIds) map[id.toString()] = { total: 0, admins: 0, moderators: 0, students: 0 };
  for (const r of rows) {
    const key = r._id.org.toString();
    if (!map[key]) continue;
    map[key].total += r.n;
    if (r._id.role === 'admin') map[key].admins += r.n;
    else if (r._id.role === 'moderator') map[key].moderators += r.n;
    else if (r._id.role === 'student') map[key].students += r.n;
  }
  return map;
}

// GET /api/organizations  (owner)
// Returns every organization with member counts plus a global summary.
export const listOrganizations = asyncHandler(async (_req, res) => {
  const orgs = await Organization.find().sort({ createdAt: -1 });
  const counts = await memberCounts(orgs.map((o) => o._id));

  const organizations = orgs.map((o) => o.toClientJSON(counts[o._id.toString()]));
  const summary = organizations.reduce(
    (acc, o) => ({
      organizations: acc.organizations + 1,
      active: acc.active + (o.status === 'active' ? 1 : 0),
      disabled: acc.disabled + (o.status === 'disabled' ? 1 : 0),
      users: acc.users + o.counts.total,
      admins: acc.admins + o.counts.admins,
      moderators: acc.moderators + o.counts.moderators,
      students: acc.students + o.counts.students,
    }),
    { organizations: 0, active: 0, disabled: 0, users: 0, admins: 0, moderators: 0, students: 0 },
  );

  res.json({ success: true, summary, organizations });
});

// POST /api/organizations  (owner)
// Creates the organization and its bootstrap admin@<domain> account.
export const createOrganization = asyncHandler(async (req, res) => {
  const { name, domain } = req.body;
  if (!name || !domain) throw new ApiError(400, 'Organization name and domain are required.');

  const normalizedDomain = String(domain).toLowerCase().trim().replace(/^@/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizedDomain)) {
    throw new ApiError(400, 'Please provide a valid domain, e.g. acme.com');
  }

  if (await Organization.findOne({ domain: normalizedDomain })) {
    throw new ApiError(409, 'An organization with that domain already exists.');
  }

  const adminEmail = `admin@${normalizedDomain}`;
  if (await User.findOne({ email: adminEmail })) {
    throw new ApiError(409, `The account ${adminEmail} already exists.`);
  }

  const org = await Organization.create({
    name: name.trim(),
    domain: normalizedDomain,
    createdBy: req.user._id,
  });

  // Bootstrap an initial active semester so the admin can add courses/assignments
  // immediately (they can start fresh terms later).
  await Semester.create({
    organization: org._id,
    name: 'Semester 1',
    isActive: true,
    createdBy: req.user._id,
  });

  const password = env.defaultOrgAdminPassword;
  const admin = new User({
    name: `${org.name} Admin`,
    email: adminEmail,
    role: 'admin',
    organization: org._id,
    mustChangePassword: true,
  });
  await admin.setPassword(password);
  await admin.save();

  const result = await sendWelcomeEmail({
    name: admin.name,
    email: adminEmail,
    password,
    loginUrl: env.clientUrl,
  });

  res.status(201).json({
    success: true,
    message: 'Organization created with its admin account.',
    organization: org.toClientJSON({ total: 1, admins: 1 }),
    adminAccount: { email: adminEmail, password },
    emailDelivered: result.delivered === true,
  });
});

// PATCH /api/organizations/:id/status  (owner)  { status: 'active' | 'disabled' }
export const setOrganizationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    throw new ApiError(400, "Status must be 'active' or 'disabled'.");
  }
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'Organization not found.');

  org.status = status;
  await org.save();
  res.json({
    success: true,
    message: status === 'disabled' ? 'Organization disabled.' : 'Organization reactivated.',
    organization: org.toClientJSON(),
  });
});

// DELETE /api/organizations/:id  (owner)
// Permanently removes the organization along with all of its users & assignments.
export const deleteOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'Organization not found.');

  // Cascade every record tied to this organization or its members.
  const { Todo } = await import('../models/Todo.js');
  const { Group } = await import('../models/Group.js');
  const { GroupTodo } = await import('../models/GroupTodo.js');
  const { AssignmentProgress } = await import('../models/AssignmentProgress.js');
  const { Course } = await import('../models/Course.js');
  const { Role } = await import('../models/Role.js');

  const members = await User.find({ organization: org._id }).select('_id');
  const memberIds = members.map((m) => m._id);
  const groups = await Group.find({ organization: org._id }).select('_id');
  const groupIds = groups.map((g) => g._id);

  await Promise.all([
    Todo.deleteMany({ user: { $in: memberIds } }),
    AssignmentProgress.deleteMany({ user: { $in: memberIds } }),
    GroupTodo.deleteMany({ group: { $in: groupIds } }),
    Group.deleteMany({ organization: org._id }),
    Assignment.deleteMany({ organization: org._id }),
    Course.deleteMany({ organization: org._id }),
    Semester.deleteMany({ organization: org._id }),
    Role.deleteMany({ organization: org._id }),
    User.deleteMany({ organization: org._id }),
  ]);
  await org.deleteOne();

  res.json({ success: true, message: 'Organization and all of its data have been permanently deleted.' });
});

// Helper reused by other controllers: resolve the org a user belongs to.
export const orgIdOf = (user) =>
  user.organization && (user.organization._id || user.organization)
    ? new mongoose.Types.ObjectId((user.organization._id || user.organization).toString())
    : null;

export { domainOf };
