import mongoose from 'mongoose';

export const ORG_STATUS = ['active', 'disabled'];

// An organization is a tenant, identified uniquely by its email domain.
// Every member's email must end in `@<domain>`. Disabling an organization
// blocks all of its members from logging in without deleting any data.
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Please provide a valid domain, e.g. acme.com'],
    },
    status: { type: String, enum: ORG_STATUS, default: 'active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

organizationSchema.methods.toClientJSON = function toClientJSON(counts = {}) {
  return {
    id: this._id,
    name: this.name,
    domain: this.domain,
    status: this.status,
    createdAt: this.createdAt,
    counts: {
      total: counts.total || 0,
      admins: counts.admins || 0,
      moderators: counts.moderators || 0,
      students: counts.students || 0,
    },
  };
};

export const Organization = mongoose.model('Organization', organizationSchema);
