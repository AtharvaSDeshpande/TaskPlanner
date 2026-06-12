import mongoose from 'mongoose';

// A teaching term within an organization. Exactly one semester is active per org
// at a time; courses, assignments and groups are scoped to a semester, so
// starting a new one "resets" the active views without deleting history
// (archive-by-scope).
const semesterSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true }, // e.g. "Fall 2026"
    isActive: { type: Boolean, default: false, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

semesterSchema.index({ organization: 1, isActive: 1 });

semesterSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this._id,
    name: this.name,
    isActive: this.isActive,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    createdAt: this.createdAt,
  };
};

export const Semester = mongoose.model('Semester', semesterSchema);
