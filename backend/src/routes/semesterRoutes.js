import { Router } from 'express';
import { listSemesters, getActive, startSemester } from '../controllers/semesterController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listSemesters);
router.get('/active', getActive);
router.post('/start', requirePermission('semester:manage'), startSemester);

export default router;
