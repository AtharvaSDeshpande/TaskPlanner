import mongoose from 'mongoose';

// An organization-wide announcement posted by staff (admins / moderators /
// subject moderators) and visible to every member. An announcement is either
// informative (no date) or carries an upcoming date/deadline (`dueAt`).
const announcementSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    // Optional. Present → a dated/deadline announcement; absent → informative.
    dueAt: { type: Date, default: null },
    // Optional subject the announcement relates to (a course in the active term).
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

announcementSchema.methods.toClientJSON = function toClientJSON() {
  const author = this.createdBy;
  const course = this.course;
  return {
    id: this._id,
    title: this.title,
    body: this.body,
    dueAt: this.dueAt,
    type: this.dueAt ? 'deadline' : 'info',
    subject:
      course && course.code ? { id: course._id, code: course.code, title: course.title } : null,
    createdBy:
      author && author.name ? { id: author._id, name: author.name, role: author.role } : null,
    createdAt: this.createdAt,
  };
};

export const Announcement = mongoose.model('Announcement', announcementSchema);
