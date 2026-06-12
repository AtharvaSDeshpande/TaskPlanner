import { Todo } from '../models/Todo.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

function validatePayload(body) {
  const { ciphertext, iv } = body;
  if (typeof ciphertext !== 'string' || typeof iv !== 'string' || !ciphertext || !iv) {
    throw new ApiError(400, 'Encrypted payload (ciphertext + iv) is required.');
  }
  return { ciphertext, iv };
}

// GET /api/todos  — returns only the current user's encrypted items.
export const listTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: todos.length, todos: todos.map((t) => t.toClientJSON()) });
});

// POST /api/todos
export const createTodo = asyncHandler(async (req, res) => {
  const { ciphertext, iv } = validatePayload(req.body);
  const todo = await Todo.create({ user: req.user._id, ciphertext, iv });
  res.status(201).json({ success: true, todo: todo.toClientJSON() });
});

// PUT /api/todos/:id
export const updateTodo = asyncHandler(async (req, res) => {
  const { ciphertext, iv } = validatePayload(req.body);
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { ciphertext, iv },
    { new: true },
  );
  if (!todo) throw new ApiError(404, 'To-do not found.');
  res.json({ success: true, todo: todo.toClientJSON() });
});

// DELETE /api/todos/:id
export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!todo) throw new ApiError(404, 'To-do not found.');
  res.json({ success: true, message: 'To-do deleted.' });
});
