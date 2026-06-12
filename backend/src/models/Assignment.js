import mongoose from 'mongoose';
import { PROGRAMS } from '../config/academics.js';

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },

    // Subject + term this assignment belongs to.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },

    // Tenant + academic scoping.
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    // Target sections. Empty array = visible to every section in the program.
    sections: { type: [String], default: [] },

    dueAt: { type: Date, required: true, index: true },
    attachmentUrl: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Set once the lead-time reminder batch has gone out, to avoid re-sending.
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assignmentSchema.index({ organization: 1, semester: 1, program: 1, dueAt: 1 });
assignmentSchema.index({ course: 1, dueAt: 1 });
assignmentSchema.index({ dueAt: 1, reminderSentAt: 1 });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
