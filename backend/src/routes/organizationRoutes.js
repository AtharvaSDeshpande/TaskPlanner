import { Router } from 'express';
import {
  listOrganizations,
  createOrganization,
  setOrganizationStatus,
  deleteOrganization,
} from '../controllers/organizationController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

// Organization management is exclusively the platform owner's domain.
router.use(protect, requireRole('owner'));

router.route('/').get(listOrganizations).post(createOrganization);
router.patch('/:id/status', setOrganizationStatus);
router.delete('/:id', deleteOrganization);

export default router;
