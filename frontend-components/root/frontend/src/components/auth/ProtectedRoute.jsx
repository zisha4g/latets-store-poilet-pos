import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

export const ProtectedRoute = ({ children, redirectTo = '/login' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export const RoleProtectedRoute = ({
  children,
  roles,
  redirectTo = '/unauthorized',
  fallback = null,
}) => {
  const { user, hasRole, loading } = useAuth();
  const requestedRoles = 
    typeof roles === 'string' ? [roles] : Array.isArray(roles) ? roles : [];

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!requestedRoles.length) {
    return children;
  }

  if (!hasRole(...requestedRoles)) {
    return fallback || <Navigate to={redirectTo} replace />;
  }

  return children;
};

export const PermissionProtectedRoute = ({
  children,
  permission,
  requireAll = true,
  redirectTo = '/unauthorized',
  fallback = null,
}) => {
  const { user, hasPermission, hasAllPermissions, hasAnyPermission, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  let hasRequiredPermission = false;

  if (typeof permission === 'string') {
    hasRequiredPermission = hasPermission(permission);
  } else if (Array.isArray(permission) && permission.length) {
    hasRequiredPermission = requireAll
      ? hasAllPermissions(...permission)
      : hasAnyPermission(...permission);
  } else {
    hasRequiredPermission = true;
  }

  if (!hasRequiredPermission) {
    return fallback || <Navigate to={redirectTo} replace />;
  }

  return children;
};
