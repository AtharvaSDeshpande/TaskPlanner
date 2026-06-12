import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from './Loading.jsx';

// The landing route for each role.
export const homePathFor = (role) => (role === 'owner' ? '/organizations' : '/dashboard');

// Requires an authenticated session. Also enforces the first-login password
// reset: any user with `mustChangePassword` (single- or bulk-created, or seeded)
// is held on /change-password until they set their own password.
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

// Requires the user to hold one of the allowed roles; otherwise sends them to
// their own role-appropriate home (avoids redirect loops).
export function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}

// Permission-gated route. Pass a single `permission` key or a `check(user)`
// predicate (for composite/course-scoped capabilities like "manage any
// assignment"). Unauthorized users are sent to their home.
export function PermissionRoute({ permission, check, children }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = check ? check(user) : can(permission);
  if (!allowed) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}
