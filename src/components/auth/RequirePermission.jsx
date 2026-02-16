import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Component wrapper that only renders children if user has the required permission(s)
 * @param {string|string[]} permission - Single permission or array of permissions (requires ALL)
 * @param {React.ReactNode} children - Content to render if permission check passes
 * @param {React.ReactNode} fallback - Content to render if permission check fails (optional)
 */
export const RequirePermission = ({ permission, children, fallback = null }) => {
  const { hasPermission, hasAllPermissions } = useAuth();

  // Handle single permission
  if (typeof permission === 'string') {
    return hasPermission(permission) ? children : fallback;
  }

  // Handle array of permissions (require all)
  if (Array.isArray(permission)) {
    return hasAllPermissions(...permission) ? children : fallback;
  }

  return fallback;
};

/**
 * Component wrapper that renders children if user has ANY of the specified permissions
 * @param {string[]} permissions - Array of permissions (requires at least one)
 * @param {React.ReactNode} children - Content to render if permission check passes
 * @param {React.ReactNode} fallback - Content to render if permission check fails (optional)
 */
export const RequireAnyPermission = ({ permissions, children, fallback = null }) => {
  const { hasAnyPermission } = useAuth();

  if (!Array.isArray(permissions)) {
    console.error('RequireAnyPermission: permissions must be an array');
    return fallback;
  }

  return hasAnyPermission(...permissions) ? children : fallback;
};
