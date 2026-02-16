import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Component wrapper that only renders children if user has the required role(s)
 * @param {string|string[]} role - Single role or array of roles (requires ANY)
 * @param {React.ReactNode} children - Content to render if role check passes
 * @param {React.ReactNode} fallback - Content to render if role check fails (optional)
 */
export const RequireRole = ({ role, children, fallback = null }) => {
  const { hasRole } = useAuth();

  // Handle single role
  if (typeof role === 'string') {
    return hasRole(role) ? children : fallback;
  }

  // Handle array of roles (require any)
  if (Array.isArray(role)) {
    return hasRole(...role) ? children : fallback;
  }

  return fallback;
};
