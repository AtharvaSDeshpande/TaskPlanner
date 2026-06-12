import { Router } from 'express';
import {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  setProgress,
} from '../controllers/assignmentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listAssignments);
router.get('/:id', getAssignment);

// Personal completion tracking — available to any member who can see it.
router.patch('/:id/progress', setProgress);

// Authoring is permission-gated per course inside the controller (admins org-wide,
// course moderators for their assigned courses), so no coarse role guard here.
router.post('/', createAssignment);
router.patch('/:id', updateAssignment);
router.delete('/:id', deleteAssignment);

export default router;
