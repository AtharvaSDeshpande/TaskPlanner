import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleRoute, PermissionRoute, homePathFor } from './components/RouteGuards.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { can, canManageAnyAssignment } from './utils/permissions.js';
import AppLayout from './components/AppLayout.jsx';
import Loading from './components/Loading.jsx';

// Pages are route-split: each is fetched only when its route is first visited,
// so the initial bundle carries the shell (layout, guards, auth) rather than
// every screen. Heavy page-only deps (e.g. the date-picker widget) ride along
// in the page chunk instead of bloating index.js.
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const DeadlinesPage = lazy(() => import('./pages/DeadlinesPage.jsx'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage.jsx'));
const TodosPage = lazy(() => import('./pages/TodosPage.jsx'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'));
const ManageAssignmentsPage = lazy(() => import('./pages/manage/ManageAssignmentsPage.jsx'));
const ManageUsersPage = lazy(() => import('./pages/manage/ManageUsersPage.jsx'));
const RolesPage = lazy(() => import('./pages/manage/RolesPage.jsx'));
const SemesterPage = lazy(() => import('./pages/manage/SemesterPage.jsx'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage.jsx'));
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage.jsx'));
const GroupDetailPage = lazy(() => import('./pages/groups/GroupDetailPage.jsx'));

const canManageRoles = (u) => can(u, 'role:manage') || can(u, 'role:manage:global');
const canManageTerm = (u) => can(u, 'semester:manage') || can(u, 'course:manage') || can(u, 'group:manage');

// Sends each authenticated user to their role's home screen.
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />;
}

const STUDENT_STAFF = ['admin', 'moderator', 'student'];

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Owner */}
          <Route
            path="/organizations"
            element={
              <RoleRoute roles={['owner']}>
                <OrganizationsPage />
              </RoleRoute>
            }
          />

          {/* Organization members */}
          <Route
            path="/dashboard"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <DashboardPage />
              </RoleRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <AnnouncementsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/deadlines"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <DeadlinesPage />
              </RoleRoute>
            }
          />
          <Route
            path="/todos"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <TodosPage />
              </RoleRoute>
            }
          />
          <Route
            path="/manage/assignments"
            element={
              <PermissionRoute check={canManageAnyAssignment}>
                <ManageAssignmentsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/manage/users"
            element={
              <PermissionRoute permission="user:manage">
                <ManageUsersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/manage/roles"
            element={
              <PermissionRoute check={canManageRoles}>
                <RolesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/manage/semester"
            element={
              <PermissionRoute check={canManageTerm}>
                <SemesterPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <GroupsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/groups/:id"
            element={
              <RoleRoute roles={STUDENT_STAFF}>
                <GroupDetailPage />
              </RoleRoute>
            }
          />

          {/* Available to everyone, including the owner */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Route>

        <Route path="/" element={<RoleHome />} />
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </Suspense>
  );
}
