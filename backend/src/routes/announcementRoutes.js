import { Router } from 'express';
import {
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

// Announcements belong to organization members. Every member can read them;
// posting is gated inside the controller (admins / moderators / subject mods).
router.use(protect, requireRole('admin', 'moderator', 'student'));

router.route('/').get(listAnnouncements).post(createAnnouncement);
router.delete('/:id', deleteAnnouncement);

export default router;
