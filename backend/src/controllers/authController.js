import { User } from '../models/User.js';
import { Todo } from '../models/Todo.js';
import { signToken } from '../utils/token.js';
import { buildAuthContext } from '../utils/permissions.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

function isStrongPassword(pw) {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw)
  );
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() })
    .select('+passwordHash')
    .populate('organization');
  // Generic message to avoid leaking which emails exist.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');
  if (user.role !== 'owner' && user.organization && user.organization.status === 'disabled') {
    throw new ApiError(403, 'Your organization has been disabled. Please contact your administrator.');
  }

  user.ensureEncSalt(); // backfill a stable derivation salt for legacy accounts
  user.lastLoginAt = new Date();
  await user.save();

  const ctx = await buildAuthContext(user);
  res.json({
    success: true,
    token: signToken(user),
    user: user.toSafeJSON(ctx),
  });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON(req.authContext) });
});

// PATCH /api/auth/profile — a user updates their own contact details.
// Role, organization and academic mapping remain admin-controlled.
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Name cannot be empty.');
    req.user.name = trimmed;
  }
  if (phone !== undefined) req.user.phone = String(phone).trim();

  await req.user.save();
  res.json({ success: true, user: req.user.toSafeJSON(req.authContext) });
});

// POST /api/auth/change-password
// The E2E key is derived from the password, so changing it changes the key.
// The client re-encrypts its todos with the new key and sends them here, so the
// board survives the change without the server ever seeing plaintext.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, reencryptedTodos } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current and new passwords are required.');
  }
  if (!isStrongPassword(newPassword)) {
    throw new ApiError(
      400,
      'New password must be at least 8 characters and include upper, lower case letters and a number.',
    );
  }

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }

  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Apply todos the client re-encrypted with the new key (still ciphertext).
  if (Array.isArray(reencryptedTodos) && reencryptedTodos.length) {
    await Promise.all(
      reencryptedTodos
        .filter((t) => t && t.id && t.ciphertext && t.iv)
        .map((t) =>
          Todo.updateOne(
            { _id: t.id, user: user._id },
            { ciphertext: t.ciphertext, iv: t.iv },
          ),
        ),
    );
  }

  res.json({
    success: true,
    message: 'Password updated successfully.',
    token: signToken(user),
    user: user.toSafeJSON(req.authContext),
  });
});
