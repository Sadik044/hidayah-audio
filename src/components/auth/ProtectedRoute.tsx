import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  /**
   * If true (default), requires the session to have reached Authenticator Assurance Level 2 (aal2).
   * If false, allows authenticated admins at AAL1 (used strictly for /admin/mfa and /admin/mfa-setup).
   */
  requireAal2?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAal2 = true,
}) => {
  const { user, isAdmin, aal, hasMfaEnrolled, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-xs text-stone-500 animate-pulse">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span>অ্যাকাউন্ট ও নিরাপত্তা অধিকার যাচাই করা হচ্ছে...</span>
      </div>
    );
  }

  // 1. Unauthenticated users -> redirect to /admin/login
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // 2. Authenticated but non-admin users -> redirect to public homepage
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // 3. For routes requiring full AAL2 (e.g. /admin dashboard):
  if (requireAal2) {
    if (aal !== 'aal2') {
      if (hasMfaEnrolled) {
        // Admin has enrolled factor -> verify OTP challenge
        return <Navigate to="/admin/mfa" state={{ from: location }} replace />;
      } else {
        // Admin has not enrolled factor yet -> mandatory initial enrollment
        return <Navigate to="/admin/mfa-setup" state={{ from: location }} replace />;
      }
    }
  } else {
    // For MFA setup/challenge routes: if already at AAL2, redirect straight to dashboard
    if (aal === 'aal2') {
      return <Navigate to="/admin" replace />;
    }
  }

  // 4. Authorized -> render content
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
