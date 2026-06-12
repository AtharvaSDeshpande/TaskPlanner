import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleRoute, PermissionRoute, homePathFor } from './components/RouteGuards.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { can, canManageAnyAssignment } from './utils/permissions.js';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DeadlinesPage from './pages/DeadlinesPage.jsx';
import TodosPage from './pages/TodosPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import ManageAssignmentsPage from './pages/manage/ManageAssignmentsPage.jsx';
import ManageUsersPage from './pages/manage/ManageUsersPage.jsx';
import RolesPage from './pages/manage/RolesPage.jsx';
import SemesterPage from './pages/manage/SemesterPage.jsx';
import OrganizationsPage from './pages/OrganizationsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import GroupsPage from './pages/groups/GroupsPage.jsx';
import GroupDetailPage from './pages/groups/GroupDetailPage.jsx';

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
      </Route>

      <Route path="/" element={<RoleHome />} />
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
