import mongoose from 'mongoose';

// Tracks whether an individual user has marked an assignment as done/submitted.
// One record per (user, assignment).
const assignmentProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assignmentProgressSchema.index({ user: 1, assignment: 1 }, { unique: true });

export const AssignmentProgress = mongoose.model('AssignmentProgress', assignmentProgressSchema);
