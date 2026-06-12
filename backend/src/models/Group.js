import mongoose from 'mongoose';

// A personalized collaboration group within an organization. Members share a
// group to-do board (see GroupTodo) for coordinating group assignments.
//
// Note: unlike the personal To-Do list (which is end-to-end encrypted), group
// to-dos are intentionally stored server-side so that every member can read
// them. True multi-user E2E would require per-user key exchange.
const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Term the group belongs to; starting a new semester archives old groups.
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  },
  { timestamps: true },
);

groupSchema.methods.isMember = function isMember(userId) {
  return this.members.some((m) => String(m._id || m) === String(userId));
};

groupSchema.methods.toClientJSON = function toClientJSON(currentUserId) {
  const mapMember = (m) =>
    m && m._id
      ? { id: m._id, name: m.name, email: m.email, role: m.role, program: m.program, section: m.section }
      : { id: m };
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    owner: String(this.owner._id || this.owner),
    isOwner: String(this.owner._id || this.owner) === String(currentUserId),
    members: this.members.map(mapMember),
    memberCount: this.members.length,
    createdAt: this.createdAt,
  };
};

export const Group = mongoose.model('Group', groupSchema);
