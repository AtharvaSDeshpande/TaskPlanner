import { Announcement } from '../models/Announcement.js';
import { Course } from '../models/Course.js';
import { can, canManageAnyAssignment } from '../utils/permissions.js';
import { getActiveSemester } from '../utils/semester.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const orgIdOf = (user) => (user.organization ? user.organization._id || user.organization : null);

// GET /api/announcements?limit=  — any org member may read.
export const listAnnouncements = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) return res.json({ success: true, count: 0, announcements: [] });

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const items = await Announcement.find({ organization: orgId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name role')
    .populate('course', 'code title');

  res.json({
    success: true,
    count: items.length,
    announcements: items.map((a) => a.toClientJSON()),
  });
});

// POST /api/announcements  { title, body, dueAt? }
// Only staff who can author assignments (admins, moderators, subject moderators)
// may post.
export const createAnnouncement = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  if (!orgId) throw new ApiError(403, 'You are not attached to an organization.');
  if (!canManageAnyAssignment(req.authContext)) {
    throw new ApiError(403, 'Only moderators and admins can post announcements.');
  }

  const { title, body, dueAt, courseId } = req.body;
  if (!title || !title.trim()) throw new ApiError(400, 'A title is required.');
  if (!body || !body.trim()) throw new ApiError(400, 'A message is required.');

  let due = null;
  if (dueAt) {
    due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) throw new ApiError(400, 'Invalid date.');
  }

  // Optional subject: a course in the active semester. Posters who aren't org-wide
  // managers may only tag a subject they moderate.
  let course = null;
  if (courseId) {
    const active = await getActiveSemester(orgId);
    const found = active
      ? await Course.findOne({ _id: courseId, organization: orgId, semester: active._id })
      : null;
    if (!found) throw new ApiError(400, 'Choose a valid subject in the current semester.');
    if (
      !can(req.authContext, 'assignment:manage') &&
      !req.authContext.moderatedCourseIds.includes(String(found._id))
    ) {
      throw new ApiError(403, 'You can only post announcements for subjects you moderate.');
    }
    course = found._id;
  }

  let announcement = await Announcement.create({
    organization: orgId,
    title: title.trim(),
    body: body.trim(),
    dueAt: due,
    course,
    createdBy: req.user._id,
  });
  announcement = await announcement.populate([
    { path: 'createdBy', select: 'name role' },
    { path: 'course', select: 'code title' },
  ]);

  req.log?.info?.('Announcement posted by {UserEmail} ({Type})', {
    UserEmail: req.user.email,
    Type: due ? 'deadline' : 'info',
    AnnouncementId: announcement._id,
  });

  res.status(201).json({ success: true, announcement: announcement.toClientJSON() });
});

// DELETE /api/announcements/:id  — the author, or an org-wide manager (admin).
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const orgId = orgIdOf(req.user);
  const announcement = await Announcement.findOne({ _id: req.params.id, organization: orgId });
  if (!announcement) throw new ApiError(404, 'Announcement not found.');

  const isAuthor = String(announcement.createdBy) === String(req.user._id);
  const isOrgManager = req.authContext?.permissions?.has('assignment:manage');
  if (!isAuthor && !isOrgManager) {
    throw new ApiError(403, 'You can only delete your own announcements.');
  }

  await announcement.deleteOne();
  res.json({ success: true, message: 'Announcement deleted.' });
});
