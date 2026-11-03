import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
  const {
    user,
    profile,
    isAdmin,
    aal,
    hasMfaEnrolled,
    loading,
    profileError,
    refreshProfile,
  } = useAuth();
  const location = useLocation();

  // 1. Initial resolution loading:
  // Only display full blocking loading spinner when:
  // - Session is still initializing without a determined user, OR
  // - User is authenticated, but their profile has never arrived and is currently fetching without error.
  // Note: Once user & profile are in memory, background token refreshes execute silently without blocking.
  const isResolving = loading && (!user || (!profile && !profileError));

  if (isResolving) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-xs text-stone-500 animate-pulse">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span>অ্যাকাউন্ট ও নিরাপত্তা অধিকার যাচাই করা হচ্ছে...</span>
      </div>
    );
  }

  // 2. Unauthenticated users -> redirect to /admin/login
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // 3. Recoverable error state: User is authenticated, but profile query encountered a network/server failure
  if (!profile && profileError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-6 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-sand-900 dark:text-stone-100">
            নিরাপত্তা প্রোফাইল যাচাই ব্যর্থ
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            সার্ভার বা নেটওয়ার্ক সংযোগে সাময়িক সমস্যা দেখা দিয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।
          </p>
        </div>
        <button
          onClick={() => refreshProfile()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-emerald-800 text-white hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>পুনরায় চেষ্টা করুন</span>
        </button>
      </div>
    );
  }

  // 4. Authenticated but non-admin users -> redirect to public homepage
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // 5. For routes requiring full AAL2 (e.g. /admin dashboard):
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

  // 6. Authorized -> render content
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
