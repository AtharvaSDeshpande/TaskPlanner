import { QueryClient } from '@tanstack/react-query';

// Shared client. Defaults tuned for an authenticated dashboard:
//  • staleTime 30s  — cached data is reused instantly across navigations without
//    refetching, which is the "caching" win (no spinner when revisiting a page).
//  • gcTime 5min    — unused cache is kept for 5 minutes before garbage collection.
//  • one retry, no refetch-on-focus — avoids hammering the API.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Central registry of query keys so invalidation stays consistent.
export const qk = {
  assignments: (params = 'all') => ['assignments', params],
  users: (params = {}) => ['users', params],
  organizations: () => ['organizations'],
  groups: () => ['groups'],
  group: (id) => ['group', id],
  groupTodos: (id) => ['group', id, 'todos'],
  todos: () => ['todos'],
  roles: () => ['roles'],
  semesters: () => ['semesters'],
  activeSemester: () => ['semesters', 'active'],
  courses: (semesterId = 'active') => ['courses', semesterId],
};
