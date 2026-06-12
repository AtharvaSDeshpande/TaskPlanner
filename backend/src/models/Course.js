import mongoose from 'mongoose';
import { PROGRAMS } from '../config/academics.js';

// A subject offered in a given semester. `moderators` are the users allowed to
// post assignments for this course — this is what makes moderation subject-level
// rather than program-level.
const courseSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "FIN101"
    title: { type: String, required: true, trim: true }, // e.g. "Corporate Finance"
    program: { type: String, enum: [...PROGRAMS, ''], default: '' },

    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

courseSchema.index({ semester: 1, code: 1 }, { unique: true });

courseSchema.methods.toClientJSON = function toClientJSON() {
  const mapMod = (m) => (m && m._id ? { id: m._id, name: m.name, email: m.email } : { id: m });
  return {
    id: this._id,
    code: this.code,
    title: this.title,
    program: this.program,
    semester: String(this.semester._id || this.semester),
    moderators: (this.moderators || []).map(mapMod),
    createdAt: this.createdAt,
  };
};

export const Course = mongoose.model('Course', courseSchema);
