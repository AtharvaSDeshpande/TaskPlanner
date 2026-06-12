import { Router } from 'express';
import {
  listGroups,
  createGroup,
  generateGroups,
  searchOrgUsers,
  getGroup,
  updateGroup,
  addMembers,
  removeMember,
  deleteGroup,
  listGroupTodos,
  createGroupTodo,
  updateGroupTodo,
  deleteGroupTodo,
} from '../controllers/groupController.js';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';

const router = Router();

// Groups belong to organization members (the platform owner has no org).
router.use(protect, requireRole('admin', 'moderator', 'student'));

router.route('/').get(listGroups).post(createGroup);
// Literal sub-paths must precede the ":id" route so they aren't captured by it.
router.get('/search-users', searchOrgUsers);
// Bulk auto-generation (admins / group:manage).
router.post('/generate', requirePermission('group:manage'), generateGroups);
router.route('/:id').get(getGroup).patch(updateGroup).delete(deleteGroup);

router.post('/:id/members', addMembers);
router.delete('/:id/members/:userId', removeMember);

router.route('/:id/todos').get(listGroupTodos).post(createGroupTodo);
router.route('/:id/todos/:todoId').patch(updateGroupTodo).delete(deleteGroupTodo);

export default router;
