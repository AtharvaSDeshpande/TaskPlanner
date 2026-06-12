import { User } from '../models/User.js';
import { verifyToken } from '../utils/token.js';
import { buildAuthContext, can } from '../utils/permissions.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

// Verifies the bearer token and attaches the live user document to req.user.
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new ApiError(401, 'Not authenticated. Please log in.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Session expired or invalid. Please log in again.');
  }

  const user = await User.findById(payload.sub).populate('organization');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or deactivated.');
  }

  // A disabled organization locks out every member except the platform owner.
  if (user.role !== 'owner' && user.organization && user.organization.status === 'disabled') {
    throw new ApiError(403, 'Your organization has been disabled. Please contact your administrator.');
  }

  // One-time backfill so legacy accounts get a stable derivation salt persisted.
  if (!user.encSalt) {
    user.ensureEncSalt();
    await user.save();
  }

  req.user = user;
  // Effective permissions + moderated courses for this request.
  req.authContext = await buildAuthContext(user);
  next();
});

// Restricts a route to one or more base roles (coarse identity tier).
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  });

// Restricts a route to holders of a (non-course-scoped) permission. Course-scoped
// checks happen in controllers, which have the target course id.
export const requirePermission = (key) =>
  asyncHandler(async (req, _res, next) => {
    if (!can(req.authContext, key)) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  });
