import mongoose from 'mongoose';

// A shared task on a group's collaborative board. Stored server-side (not E2E)
// so all members can read and update it.
const groupTodoSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true },
    dueDate: { type: Date, default: null },
    completed: { type: Boolean, default: false },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

const person = (u) => (u && u._id ? { id: u._id, name: u.name } : null);

groupTodoSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this._id,
    title: this.title,
    notes: this.notes,
    dueDate: this.dueDate,
    completed: this.completed,
    assignedTo: person(this.assignedTo),
    createdBy: person(this.createdBy),
    completedBy: person(this.completedBy),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const GroupTodo = mongoose.model('GroupTodo', groupTodoSchema);
