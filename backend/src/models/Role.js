import mongoose from 'mongoose';

// A named bundle of permission keys. Platform roles (organization = null) are
// created by the owner and apply to every org; organization roles are created
// by an admin and apply only to their org. System roles map the four base roles
// and are not editable.
const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    permissions: { type: [String], default: [] },

    scope: { type: String, enum: ['platform', 'organization'], required: true, index: true },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    isSystem: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Unique per (organization, key); platform roles share the null-org namespace.
roleSchema.index({ organization: 1, key: 1 }, { unique: true });

roleSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this._id,
    name: this.name,
    key: this.key,
    description: this.description,
    permissions: this.permissions,
    scope: this.scope,
    organization: this.organization ? String(this.organization) : null,
    isSystem: this.isSystem,
    createdAt: this.createdAt,
  };
};

export const Role = mongoose.model('Role', roleSchema);
