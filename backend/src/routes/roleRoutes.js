import { Router } from 'express';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  assignUserRoles,
} from '../controllers/roleController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Scope (platform vs organization) is resolved per-caller inside the controller,
// which enforces role:manage:global (owner) or role:manage (admin).
router.use(protect);

router.route('/').get(listRoles).post(createRole);
router.put('/assign', assignUserRoles);
router.route('/:id').patch(updateRole).delete(deleteRole);

export default router;
