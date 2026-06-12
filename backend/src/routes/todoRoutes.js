import { Router } from 'express';
import {
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} from '../controllers/todoController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// To-dos are strictly per-user; every route is authenticated.
router.use(protect);

router.route('/').get(listTodos).post(createTodo);
router.route('/:id').put(updateTodo).delete(deleteTodo);

export default router;
