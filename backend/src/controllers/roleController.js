import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { can } from '../utils/permissions.js';
import { PERMISSIONS, PLATFORM_ASSIGNABLE, ORG_ASSIGNABLE } from '../config/permissions.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

// Resolves the caller's role-management scope:
//   platform → owner (role:manage:global), organization = null, ORG ⊄
//   organization → admin (role:manage), organization = their org
function scopeFor(req) {
  if (can(req.authContext, 'role:manage:global')) {
    return { scope: 'platform', organization: null, assignable: PLATFORM_ASSIGNABLE };
  }
  if (can(req.authContext, 'role:manage')) {
    const org = orgIdOf(req.user);
    if (!org) throw new ApiError(403, 'You are not attached to an organization.');
    return { scope: 'organization', organization: org, assignable: ORG_ASSIGNABLE };
  }
  throw new ApiError(403, 'You do not have permission to manage roles.');
}

// GET /api/roles — catalog + roles in the caller's manageable scope.
export const listRoles = asyncHandler(async (req, res) => {
  const { scope, organization, assignable } = scopeFor(req);
  const filter = scope === 'platform' ? { scope: 'platform' } : { scope: 'organization', organization };
  const roles = await Role.find(filter).sort({ isSystem: -1, name: 1 });
  res.json({
    success: true,
    scope,
    assignablePermissions: PERMISSIONS.filter((p) => assignable.includes(p.key)),
    roles: roles.map((r) => r.toClientJSON()),
  });
});

function validatePermissions(permissions, assignable) {
  if (!Array.isArray(permissions)) return [];
  const cleaned = [...new Set(permissions)];
  const invalid = cleaned.filter((p) => !assignable.includes(p));
  if (invalid.length) throw new ApiError(400, `Permissions not allowed in this scope: ${invalid.join(', ')}`);
  return cleaned;
}

// POST /api/roles
export const createRole = asyncHandler(async (req, res) => {
  const { scope, organization, assignable } = scopeFor(req);
  const { name, description = '', permissions = [] } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Role name is required.');

  const key = slugify(name);
  if (!key) throw new ApiError(400, 'Role name must contain letters or numbers.');
  if (await Role.findOne({ organization, key })) {
    throw new ApiError(409, 'A role with a similar name already exists.');
  }

  const role = await Role.create({
    name: name.trim(),
    key,
    description: String(description).trim(),
    permissions: validatePermissions(permissions, assignable),
    scope,
    organization,
    isSystem: false,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, role: role.toClientJSON() });
});

// Loads a role the caller may edit (same scope, not a system role).
async function findEditableRole(req) {
  const { scope, organization } = scopeFor(req);
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.scope !== scope || String(role.organization || '') !== String(organization || '')) {
    throw new ApiError(403, 'You can only manage roles within your own scope.');
  }
  if (role.isSystem) throw new ApiError(400, 'Built-in roles cannot be modified.');
  return role;
}

// PATCH /api/roles/:id
export const updateRole = asyncHandler(async (req, res) => {
  const { assignable } = scopeFor(req);
  const role = await findEditableRole(req);
  const { name, description, permissions } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Role name cannot be empty.');
    role.name = String(name).trim();
  }
  if (description !== undefined) role.description = String(description).trim();
  if (permissions !== undefined) role.permissions = validatePermissions(permissions, assignable);
  await role.save();
  res.json({ success: true, role: role.toClientJSON() });
});

// DELETE /api/roles/:id — also unassign it from every user that held it.
export const deleteRole = asyncHandler(async (req, res) => {
  const role = await findEditableRole(req);
  await User.updateMany({ roles: role._id }, { $pull: { roles: role._id } });
  await role.deleteOne();
  res.json({ success: true, message: 'Role deleted.' });
});

// PUT /api/roles/assign — set a user's custom roles. Admin-scoped: target must be
// in the admin's org and roles must be that org's roles.
export const assignUserRoles = asyncHandler(async (req, res) => {
  const { scope, organization } = scopeFor(req);
  if (scope !== 'organization') {
    throw new ApiError(403, 'Only organization admins can assign roles to users.');
  }
  const { userId, roleIds = [] } = req.body;
  if (!userId) throw new ApiError(400, 'userId is required.');

  const user = await User.findById(userId);
  if (!user || String(user.organization) !== String(organization) || user.role === 'owner') {
    throw new ApiError(404, 'User not found in your organization.');
  }

  // All supplied roles must be org roles of this organization.
  const roles = roleIds.length
    ? await Role.find({ _id: { $in: roleIds }, scope: 'organization', organization })
    : [];
  if (roles.length !== roleIds.length) {
    throw new ApiError(400, 'One or more roles are invalid for your organization.');
  }

  user.roles = roles.map((r) => r._id);
  await user.save();
  await user.populate('roles', 'name key');
  res.json({ success: true, user: user.toSafeJSON() });
});
