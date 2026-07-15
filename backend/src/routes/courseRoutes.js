import { Router } from 'express';
import {
  listCourses,
  createCourse,
  bulkCreateCourses,
  updateCourse,
  setModerators,
  deleteCourse,
} from '../controllers/courseController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(protect);

// Listing is open to any org member (dropdowns); mutations need course:manage.
router.get('/', listCourses);
router.post('/', requirePermission('course:manage'), createCourse);
router.post('/bulk', requirePermission('course:manage'), bulkCreateCourses);
router.patch('/:id', requirePermission('course:manage'), updateCourse);
router.put('/:id/moderators', requirePermission('course:manage'), setModerators);
router.delete('/:id', requirePermission('course:manage'), deleteCourse);

export default router;
