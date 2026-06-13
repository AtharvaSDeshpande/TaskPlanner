import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';
import { qk } from './queryClient.js';

// ─────────────────────────────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────────────────────────────
export function useAssignments(scope = 'all', options = {}) {
  return useQuery({
    queryKey: qk.assignments(scope),
    queryFn: async () => (await api.get('/assignments', { params: { scope } })).data.assignments,
    ...options,
  });
}

export function useSetAssignmentProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }) => api.patch(`/assignments/${id}/progress`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useSaveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) =>
      id ? api.patch(`/assignments/${id}`, body) : api.post('/assignments', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Users (admin, org-scoped)
// ─────────────────────────────────────────────────────────────────────────────
export function useUsers(params = {}, options = {}) {
  return useQuery({
    queryKey: qk.users(params),
    queryFn: async () => (await api.get('/users', { params })).data,
    ...options,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/users', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.patch(`/users/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reset-password`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// Bulk import users (rows parsed from the admin's spreadsheet on the client).
export function useBulkCreateUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (users) => api.post('/users/bulk', { users }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// Sets which active-semester courses a user moderates (from the user view).
export function useSetUserModeratedCourses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, courseIds }) =>
      api.put(`/users/${id}/moderated-courses`, { courseIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Organizations (owner)
// ─────────────────────────────────────────────────────────────────────────────
export function useOrganizations() {
  return useQuery({
    queryKey: qk.organizations(),
    queryFn: async () => (await api.get('/organizations')).data,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/organizations', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.organizations() }),
  });
}

export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.patch(`/organizations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.organizations() }),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.organizations() }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups + shared boards
// ─────────────────────────────────────────────────────────────────────────────
export function useGroups() {
  return useQuery({
    queryKey: qk.groups(),
    queryFn: async () => (await api.get('/groups')).data.groups,
  });
}

export function useGroup(id) {
  return useQuery({
    queryKey: qk.group(id),
    queryFn: async () => (await api.get(`/groups/${id}`)).data.group,
    enabled: Boolean(id),
  });
}

export function useGroupTodos(id) {
  return useQuery({
    queryKey: qk.groupTodos(id),
    queryFn: async () => (await api.get(`/groups/${id}/todos`)).data.todos,
    enabled: Boolean(id),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/groups', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups() }),
  });
}

export function useGroupMembers(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.group(id) });
    qc.invalidateQueries({ queryKey: qk.groups() });
  };
  const add = useMutation({
    mutationFn: (emails) => api.post(`/groups/${id}/members`, { emails }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId) => api.delete(`/groups/${id}/members/${userId}`).then((r) => r.data),
    onSuccess: invalidate,
  });
  return { add, remove };
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups() }),
  });
}

export function useGroupTodoMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.groupTodos(id) });
  const save = useMutation({
    mutationFn: ({ todoId, body }) =>
      todoId
        ? api.patch(`/groups/${id}/todos/${todoId}`, body)
        : api.post(`/groups/${id}/todos`, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (todoId) => api.delete(`/groups/${id}/todos/${todoId}`),
    onSuccess: invalidate,
  });
  return { save, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body) => api.patch('/auth/profile', body).then((r) => r.data),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal E2E todos (returns raw ciphertext; the page decrypts client-side)
// ─────────────────────────────────────────────────────────────────────────────
export function useEncryptedTodos(enabled) {
  return useQuery({
    queryKey: qk.todos(),
    queryFn: async () => (await api.get('/todos')).data.todos,
    enabled: Boolean(enabled),
  });
}

export function useTodoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.todos() });
  const save = useMutation({
    mutationFn: ({ id, body }) => (id ? api.put(`/todos/${id}`, body) : api.post('/todos', body)),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/todos/${id}`),
    onSuccess: invalidate,
  });
  return { save, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment authoring view (only what the caller can manage)
// ─────────────────────────────────────────────────────────────────────────────
export function useManagedAssignments() {
  return useQuery({
    queryKey: qk.assignments('manage'),
    queryFn: async () =>
      (await api.get('/assignments', { params: { scope: 'all', manage: 1 } })).data.assignments,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Roles & permissions
// ─────────────────────────────────────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: qk.roles(),
    queryFn: async () => (await api.get('/roles')).data,
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => (id ? api.patch(`/roles/${id}`, body) : api.post('/roles', body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles() }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles() });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAssignUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleIds }) => api.put('/roles/assign', { userId, roleIds }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Semesters
// ─────────────────────────────────────────────────────────────────────────────
export function useSemesters() {
  return useQuery({
    queryKey: qk.semesters(),
    queryFn: async () => (await api.get('/semesters')).data.semesters,
  });
}

export function useActiveSemester() {
  return useQuery({
    queryKey: qk.activeSemester(),
    queryFn: async () => (await api.get('/semesters/active')).data.semester,
  });
}

export function useStartSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/semesters/start', body).then((r) => r.data),
    onSuccess: () => {
      // New term archives the active views — refresh everything EXCEPT todos.
      ['assignments', 'groups', 'courses', 'semesters'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Courses
// ─────────────────────────────────────────────────────────────────────────────
export function useCourses(semesterId) {
  return useQuery({
    queryKey: qk.courses(semesterId || 'active'),
    queryFn: async () =>
      (await api.get('/courses', { params: semesterId ? { semesterId } : {} })).data.courses,
  });
}

export function useSaveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => (id ? api.patch(`/courses/${id}`, body) : api.post('/courses', body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useSetCourseModerators() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }) => api.put(`/courses/${id}/moderators`, { userIds }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useGenerateGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/groups/generate', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups() }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────────────────────────────────────
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (body) => api.post('/feedback', body).then((r) => r.data),
  });
}
