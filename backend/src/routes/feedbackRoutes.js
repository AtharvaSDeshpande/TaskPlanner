import { Router } from 'express';
import { submitFeedback } from '../controllers/feedbackController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Any authenticated user (including the owner) can submit product feedback.
router.use(protect);
router.post('/', submitFeedback);

export default router;
