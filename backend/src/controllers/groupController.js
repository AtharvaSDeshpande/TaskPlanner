import { Group } from '../models/Group.js';
import { GroupTodo } from '../models/GroupTodo.js';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { env } from '../config/env.js';
import { sendGroupAddedEmail } from '../utils/email.js';
import { isValidProgram, isValidSection } from '../config/academics.js';
import { getActiveSemester, requireActiveSemester } from '../utils/semester.js';
import { safeSearchRegex } from '../utils/sanitize.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const MEMBER_FIELDS = 'name email role program section';
const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

// Resolves a list of emails to active users in the caller's organization.
async function resolveMembers(emails, orgId) {
  const normalized = [
    ...new Set((emails || []).map((e) => String(e).toLowerCase().trim()).filter(Boolean)),
  ];
  if (!normalized.length) return { ids: [], users: [], unknown: [] };

  const users = await User.find({
    email: { $in: normalized },
    organization: orgId,
    role: { $ne: 'owner' },
  }).select('_id name email');

  const found = new Set(users.map((u) => u.email));
  return { ids: users.map((u) => u._id), users, unknown: normalized.filter((e) => !found.has(e)) };
}

// Fire-and-forget "you were added to a group" notifications.
function notifyAddedMembers(users, groupName, addedByName) {
  Promise.all(
    users.map((u) =>
      sendGroupAddedEmail({
        name: u.name,
        email: u.email,
        groupName,
        addedBy: addedByName,
        loginUrl: env.clientUrl,
      }),
    ),
  ).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[groups] notification failed:', err.message);
  });
}

// Loads a group the caller belongs to, or throws 403/404.
async function loadGroupAsMember(req, { populate = true } = {}) {
  const query = Group.findOne({ _id: req.params.id, organization: orgIdOf(req.user) });
  if (populate) query.populate('members', MEMBER_FIELDS);
  const group = await query;
  if (!group) throw new ApiError(404, 'Group not found.');
  if (!group.isMember(req.user._id)) throw new ApiError(403, 'You are not a member of this group.');
  return group;
}

function assertOwner(group, userId) {
  if (String(group.owner._id || group.owner) !== String(userId)) {
    throw new ApiError(403, 'Only the group owner can perform this action.');
  }
}

// GET /api/groups/search-users?q=&exclude=  — typeahead for picking members.
// Any org member may search their own organization's roster (non-owner, active)
// by name, email or roll number. Returns a small, capped result set.
export const searchOrgUsers = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) throw new ApiError(403, 'You are not attached to an organization.');

  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ success: true, users: [] });

  const exclude = String(req.query.exclude || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const rx = safeSearchRegex(q);
  const filter = {
    organization: orgId,
    role: { $ne: 'owner' },
    isActive: true,
    $or: [{ name: rx }, { email: rx }, { rollNumber: rx }],
  };
  if (exclude.length) filter._id = { $nin: exclude };

  const users = await User.find(filter)
    .select('name email rollNumber program section role')
    .sort({ name: 1 })
    .limit(10);

  res.json({ success: true, users: users.map((u) => u.toSafeJSON()) });
});

// GET /api/groups — groups the caller is a member of, in the active semester.
export const listGroups = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const active = await getActiveSemester(orgId);
  if (!active) return res.json({ success: true, count: 0, groups: [] });

  const groups = await Group.find({
    organization: orgId,
    semester: active._id,
    members: req.user._id,
  })
    .populate('members', MEMBER_FIELDS)
    .sort({ updatedAt: -1 });

  res.json({
    success: true,
    count: groups.length,
    groups: groups.map((g) => g.toClientJSON(req.user._id)),
  });
});

// POST /api/groups  { name, description?, memberEmails? }
export const createGroup = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) throw new ApiError(403, 'You are not attached to an organization.');
  const active = await requireActiveSemester(orgId);

  const { name, description = '', memberEmails } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Group name is required.');

  const { ids, users, unknown } = await resolveMembers(memberEmails, orgId);
  const members = [...new Set([String(req.user._id), ...ids.map(String)])];

  let group = await Group.create({
    name: name.trim(),
    description: String(description).trim(),
    organization: orgId,
    semester: active._id,
    owner: req.user._id,
    members,
  });
  group = await group.populate('members', MEMBER_FIELDS);

  notifyAddedMembers(users, group.name, req.user.name);

  res.status(201).json({
    success: true,
    group: group.toClientJSON(req.user._id),
    unknownEmails: unknown, // emails that didn't match a member of your org
  });
});

// GET /api/groups/:id
export const getGroup = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  res.json({ success: true, group: group.toClientJSON(req.user._id) });
});

// PATCH /api/groups/:id  (owner)  { name?, description? }
export const updateGroup = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  assertOwner(group, req.user._id);

  const { name, description } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Group name cannot be empty.');
    group.name = String(name).trim();
  }
  if (description !== undefined) group.description = String(description).trim();

  await group.save();
  res.json({ success: true, group: group.toClientJSON(req.user._id) });
});

// POST /api/groups/:id/members  (owner)  { emails: [] }
export const addMembers = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  assertOwner(group, req.user._id);

  const { ids, users, unknown } = await resolveMembers(req.body.emails, orgIdOf(req.user));
  const existing = new Set(group.members.map((m) => String(m._id || m)));
  // Only notify users who weren't already members.
  const newlyAdded = users.filter((u) => !existing.has(String(u._id)));
  ids.forEach((id) => existing.add(String(id)));
  group.members = [...existing];
  await group.save();
  await group.populate('members', MEMBER_FIELDS);

  notifyAddedMembers(newlyAdded, group.name, req.user.name);

  res.json({ success: true, group: group.toClientJSON(req.user._id), unknownEmails: unknown });
});

// DELETE /api/groups/:id/members/:userId  (owner removes anyone; members may remove themselves)
export const removeMember = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  const targetId = req.params.userId;
  const isSelf = String(targetId) === String(req.user._id);
  const isOwner = String(group.owner._id || group.owner) === String(req.user._id);

  if (!isOwner && !isSelf) throw new ApiError(403, 'Only the owner can remove other members.');
  if (String(targetId) === String(group.owner._id || group.owner)) {
    throw new ApiError(400, 'The owner cannot be removed. Delete the group instead.');
  }

  group.members = group.members.filter((m) => String(m._id || m) !== String(targetId));
  await group.save();
  await group.populate('members', MEMBER_FIELDS);
  res.json({ success: true, group: group.toClientJSON(req.user._id) });
});

// DELETE /api/groups/:id  (owner) — cascades the shared board.
export const deleteGroup = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  assertOwner(group, req.user._id);
  await GroupTodo.deleteMany({ group: group._id });
  await group.deleteOne();
  res.json({ success: true, message: 'Group deleted.' });
});

// POST /api/groups/generate   (group:manage)
// Auto-partitions eligible students into evenly-sized groups for the active
// semester. Eligibility: role student in the org, matching program (and section
// if given), or a course's program when courseId is supplied.
export const generateGroups = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const active = await requireActiveSemester(orgId);

  let { program, section, size, namePrefix, courseId } = req.body;
  size = Number(size);
  if (!Number.isInteger(size) || size < 2) throw new ApiError(400, 'Group size must be at least 2.');

  if (courseId) {
    const course = await Course.findOne({ _id: courseId, organization: orgId, semester: active._id });
    if (!course) throw new ApiError(400, 'Invalid course.');
    program = course.program;
    namePrefix = namePrefix || `${course.code} Group`;
  }
  if (!program || !isValidProgram(program)) throw new ApiError(400, 'A valid program is required.');
  if (section && !isValidSection(section)) throw new ApiError(400, 'Invalid section.');

  const filter = { organization: orgId, role: 'student', isActive: true, program };
  if (section) filter.section = section;
  const students = await User.find(filter).select('_id name email');
  if (students.length < size) {
    throw new ApiError(400, `Not enough students (${students.length}) for a group of ${size}.`);
  }

  // Fisher–Yates shuffle for fair distribution.
  for (let i = students.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [students[i], students[j]] = [students[j], students[i]];
  }

  const prefix = (namePrefix || 'Group').trim();
  const docs = [];
  for (let i = 0; i < students.length; i += size) {
    const members = students.slice(i, i + size).map((s) => s._id);
    docs.push({
      name: `${prefix} ${docs.length + 1}`,
      description: `Auto-generated · ${program}${section ? ` · Sec ${section}` : ''}`,
      organization: orgId,
      semester: active._id,
      owner: req.user._id, // the admin owns generated groups
      members: [...new Set([String(req.user._id), ...members.map(String)])],
    });
  }

  const created = await Group.insertMany(docs);
  res.status(201).json({
    success: true,
    message: `Created ${created.length} group(s) from ${students.length} student(s).`,
    count: created.length,
    students: students.length,
  });
});

// ── Shared board ───────────────────────────────────────────────────────────

async function assertAssignee(group, assignedTo) {
  if (!assignedTo) return null;
  if (!group.isMember(assignedTo)) throw new ApiError(400, 'Assignee must be a group member.');
  return assignedTo;
}

// GET /api/groups/:id/todos
export const listGroupTodos = asyncHandler(async (req, res) => {
  await loadGroupAsMember(req, { populate: false });
  const todos = await GroupTodo.find({ group: req.params.id })
    .populate('createdBy assignedTo completedBy', 'name')
    .sort({ completed: 1, createdAt: -1 });
  res.json({ success: true, count: todos.length, todos: todos.map((t) => t.toClientJSON()) });
});

// POST /api/groups/:id/todos
export const createGroupTodo = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  const { title, notes = '', dueDate = null, assignedTo = null } = req.body;
  if (!title || !title.trim()) throw new ApiError(400, 'Task title is required.');
  await assertAssignee(group, assignedTo);

  let todo = await GroupTodo.create({
    group: group._id,
    title: title.trim(),
    notes: String(notes).trim(),
    dueDate: dueDate ? new Date(dueDate) : null,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
  });
  todo = await todo.populate('createdBy assignedTo completedBy', 'name');
  res.status(201).json({ success: true, todo: todo.toClientJSON() });
});

// PATCH /api/groups/:id/todos/:todoId
export const updateGroupTodo = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req);
  const todo = await GroupTodo.findOne({ _id: req.params.todoId, group: group._id });
  if (!todo) throw new ApiError(404, 'Task not found.');

  const { title, notes, dueDate, completed, assignedTo } = req.body;
  if (title !== undefined) {
    if (!String(title).trim()) throw new ApiError(400, 'Task title cannot be empty.');
    todo.title = String(title).trim();
  }
  if (notes !== undefined) todo.notes = String(notes).trim();
  if (dueDate !== undefined) todo.dueDate = dueDate ? new Date(dueDate) : null;
  if (assignedTo !== undefined) {
    await assertAssignee(group, assignedTo);
    todo.assignedTo = assignedTo || null;
  }
  if (typeof completed === 'boolean') {
    todo.completed = completed;
    todo.completedBy = completed ? req.user._id : null;
  }

  await todo.save();
  await todo.populate('createdBy assignedTo completedBy', 'name');
  res.json({ success: true, todo: todo.toClientJSON() });
});

// DELETE /api/groups/:id/todos/:todoId
export const deleteGroupTodo = asyncHandler(async (req, res) => {
  const group = await loadGroupAsMember(req, { populate: false });
  const todo = await GroupTodo.findOneAndDelete({ _id: req.params.todoId, group: group._id });
  if (!todo) throw new ApiError(404, 'Task not found.');
  res.json({ success: true, message: 'Task deleted.' });
});
