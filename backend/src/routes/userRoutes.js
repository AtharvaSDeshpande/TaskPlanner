import { Router } from 'express';
import {
  listUsers,
  createUser,
  bulkCreateUsers,
  updateUser,
  resetPassword,
  deleteUser,
  setUserModeratedCourses,
} from '../controllers/userController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(protect);

// User management is permission-gated (base admins and any custom role granting
// user:manage). Subject-moderation assignment needs course:manage instead.
router.route('/').get(requirePermission('user:manage'), listUsers).post(requirePermission('user:manage'), createUser);
router.post('/bulk', requirePermission('user:manage'), bulkCreateUsers);
router.patch('/:id', requirePermission('user:manage'), updateUser);
router.delete('/:id', requirePermission('user:manage'), deleteUser);
router.post('/:id/reset-password', requirePermission('user:manage'), resetPassword);
router.put('/:id/moderated-courses', requirePermission('course:manage'), setUserModeratedCourses);

export default router;
