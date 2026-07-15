import { Router } from 'express';
import {
  listSemesters,
  getActive,
  startSemester,
  updateSemester,
} from '../controllers/semesterController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listSemesters);
router.get('/active', getActive);
router.post('/start', requirePermission('semester:manage'), startSemester);
router.patch('/:id', requirePermission('semester:manage'), updateSemester);

export default router;
