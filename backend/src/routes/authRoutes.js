import { Router } from 'express';
import { login, me, changePassword, updateProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', protect, me);
router.patch('/profile', protect, updateProfile);
router.post('/change-password', protect, changePassword);

export default router;
