import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading">Loading VertexWM...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // An admin-forced password change blocks every other route until the user
  // sets a new one on their own Profile page (see Profile.jsx's
  // handleChangePassword, which clears this flag on success).
  if (user.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  return <Outlet />;
}
