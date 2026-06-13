import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import todoRoutes from './todoRoutes.js';
import organizationRoutes from './organizationRoutes.js';
import groupRoutes from './groupRoutes.js';
import roleRoutes from './roleRoutes.js';
import semesterRoutes from './semesterRoutes.js';
import courseRoutes from './courseRoutes.js';
import logRoutes from './logRoutes.js';
import feedbackRoutes from './feedbackRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', ts: Date.now() }));

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/semesters', semesterRoutes);
router.use('/courses', courseRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/todos', todoRoutes);
router.use('/groups', groupRoutes);
router.use('/logs', logRoutes);
router.use('/feedback', feedbackRoutes);

export default router;
