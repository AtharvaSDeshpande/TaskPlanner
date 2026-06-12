import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PROGRAMS, SECTIONS, domainOf } from '../config/academics.js';

// 'owner' is the platform super-admin (no organization). admin/moderator/student
// all belong to exactly one organization.
export const ROLES = ['owner', 'admin', 'moderator', 'student'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },

    // Custom roles layered on top of the base role (the permission engine unions
    // base-role defaults with the permissions from these roles).
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],

    // Tenant membership. null only for the platform owner.
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    // Academic mapping. Relevant for moderators (scope) and students (scope).
    program: { type: String, enum: [...PROGRAMS, ''], default: '' },
    section: { type: String, enum: [...SECTIONS, ''], default: '' },
    rollNumber: { type: String, trim: true, default: '' },

    // Contact / profile details.
    phone: { type: String, trim: true, default: '' },
    enrollmentYear: { type: String, trim: true, default: '' },

    // Per-user salt for client-side PBKDF2 key derivation (E2E To-Do board).
    // This is NOT secret — security comes from the password, which the server
    // never sees. The browser derives the AES key from password + salt, so the
    // server only ever stores ciphertext and can never decrypt the user's todos.
    encSalt: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex'),
    },

    mustChangePassword: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.domain = function domain() {
  return domainOf(this.email);
};

// Lazily provisions a derivation salt for accounts created before the field
// existed, so legacy users get a stable salt. Call then save. Returns the salt.
userSchema.methods.ensureEncSalt = function ensureEncSalt() {
  if (!this.encSalt) this.encSalt = crypto.randomBytes(16).toString('hex');
  return this.encSalt;
};

// Pass an `authContext` (from buildAuthContext) to additionally include the
// user's effective permissions + moderated courses — used for the user's OWN
// session responses (login / me / profile). Admin listings call it without one.
userSchema.methods.toSafeJSON = function toSafeJSON(authContext) {
  const org = this.organization;
  // organization may be populated (object) or a raw ObjectId.
  const orgObj = org && org._id ? { id: org._id, name: org.name, domain: org.domain, status: org.status } : null;
  const mapRole = (r) => (r && r._id ? { id: r._id, name: r.name, key: r.key } : { id: r });
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    roles: (this.roles || []).map(mapRole),
    organization: orgObj,
    organizationId: org ? (org._id || org).toString() : null,
    program: this.program,
    section: this.section,
    rollNumber: this.rollNumber,
    phone: this.phone,
    enrollmentYear: this.enrollmentYear,
    // The salt is not secret; the client needs it to derive the E2E key.
    encSalt: this.encSalt,
    mustChangePassword: this.mustChangePassword,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    ...(authContext
      ? {
          permissions: [...authContext.permissions],
          moderatedCourses: authContext.moderatedCourses,
        }
      : {}),
  };
};

export const User = mongoose.model('User', userSchema);
