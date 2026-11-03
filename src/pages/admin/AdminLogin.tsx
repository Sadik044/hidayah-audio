import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, Clock, Info } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { toBengaliNumber } from '../../lib/utils';
import { logSecurityEvent } from '../../services/auditService';

const ATTEMPTS_STORAGE_KEY = 'hidayah_admin_login_attempts';
const LOCKOUT_STORAGE_KEY = 'hidayah_admin_lockout_until';

/**
 * Validates and sanitizes a destination path to ensure it is strictly a safe,
 * internal relative path. Prevents open redirect attacks (e.g. //evil.com or https://evil.com).
 */
export function getSafeRedirectPath(fromState: unknown): string {
  const DEFAULT_FALLBACK = '/admin';

  if (!fromState) return DEFAULT_FALLBACK;

  let candidate = '';
  if (typeof fromState === 'string') {
    candidate = fromState;
  } else if (
    typeof fromState === 'object' &&
    fromState !== null &&
    'pathname' in fromState &&
    typeof (fromState as { pathname: unknown }).pathname === 'string'
  ) {
    const loc = fromState as { pathname: string; search?: string; hash?: string };
    candidate = loc.pathname + (loc.search || '') + (loc.hash || '');
  }

  candidate = candidate.trim();

  // Must begin with a single '/' and cannot begin with '//' or '/\'
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return DEFAULT_FALLBACK;
  }

  // Reject any backslashes anywhere in path
  if (candidate.includes('\\')) {
    return DEFAULT_FALLBACK;
  }

  // Extract path portion before query/hash to check for URI schemes (e.g. javascript:, http:, etc.)
  const pathOnly = candidate.split(/[?#]/)[0];
  if (pathOnly.includes(':')) {
    return DEFAULT_FALLBACK;
  }

  // Validate using URL parser in browser context
  try {
    const parsed = new URL(candidate, window.location.origin);
    // Strict origin match
    if (parsed.origin !== window.location.origin) {
      return DEFAULT_FALLBACK;
    }
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    if (!safePath.startsWith('/') || safePath.startsWith('//')) {
      return DEFAULT_FALLBACK;
    }
    return safePath;
  } catch {
    return DEFAULT_FALLBACK;
  }
}

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous submission lock preventing concurrent submissions
  const isSubmittingRef = useRef(false);

  // Rate limiting & backoff states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const { user, isAdmin, aal, hasMfaEnrolled, loading: authLoading, refreshMfaStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const rawFrom = (location.state as { from?: unknown })?.from;
  const safeFrom = useMemo(() => getSafeRedirectPath(rawFrom), [rawFrom]);
  const infoMessage = (location.state as { message?: string })?.message;
  const messageType = (location.state as { type?: 'success' | 'error' })?.type;

  // Initialize failure counts and lockout on mount from sessionStorage
  useEffect(() => {
    try {
      const storedAttempts = sessionStorage.getItem(ATTEMPTS_STORAGE_KEY);
      if (storedAttempts) {
        setFailedAttempts(parseInt(storedAttempts, 10) || 0);
      }
      const storedLockout = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (storedLockout) {
        const lockUntil = parseInt(storedLockout, 10);
        if (lockUntil > Date.now()) {
          setLockoutUntil(lockUntil);
          setSecondsRemaining(Math.ceil((lockUntil - Date.now()) / 1000));
        } else {
          sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
        }
      }
    } catch {
      // Ignore sessionStorage access issues
    }
  }, []);

  // Real-time countdown timer for rate limit cooldown
  useEffect(() => {
    if (!lockoutUntil) return;

    const interval = window.setInterval(() => {
      const diff = lockoutUntil - Date.now();
      if (diff <= 0) {
        setLockoutUntil(null);
        setSecondsRemaining(0);
        try {
          sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
        } catch {
          // Ignore
        }
      } else {
        setSecondsRemaining(Math.ceil(diff / 1000));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  // If already logged in, redirect
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        if (aal === 'aal2') {
          navigate(safeFrom, { replace: true });
        } else if (hasMfaEnrolled) {
          navigate('/admin/mfa', { state: { from: safeFrom }, replace: true });
        } else {
          navigate('/admin/mfa-setup', { state: { from: safeFrom }, replace: true });
        }
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, isAdmin, aal, hasMfaEnrolled, authLoading, navigate, safeFrom]);

  const handleFailedAttempt = (isRateLimit: boolean, customCooldown?: number) => {
    // Finding 3: Do not increment wrong-password failure counter for HTTP 429 rate limit errors
    const nextAttempts = isRateLimit ? failedAttempts : failedAttempts + 1;
    if (!isRateLimit) {
      setFailedAttempts(nextAttempts);
      try {
        sessionStorage.setItem(ATTEMPTS_STORAGE_KEY, nextAttempts.toString());
      } catch {
        // Ignore
      }
    }

    // Determine progressive backoff cooldown in seconds:
    // 1-2 attempts: 0s
    // 3 attempts: 10s
    // 4 attempts: 30s
    // 5 attempts: 60s
    // 6+ attempts: 120s (2 minutes maximum cap)
    let cooldown = 0;
    if (customCooldown && customCooldown > 0) {
      cooldown = customCooldown;
    } else if (isRateLimit) {
      cooldown = 60;
    } else if (nextAttempts === 3) {
      cooldown = 10;
    } else if (nextAttempts === 4) {
      cooldown = 30;
    } else if (nextAttempts === 5) {
      cooldown = 60;
    } else if (nextAttempts >= 6) {
      cooldown = 120;
    }

    if (cooldown > 0) {
      const lockUntil = Date.now() + cooldown * 1000;
      setLockoutUntil(lockUntil);
      setSecondsRemaining(cooldown);
      try {
        sessionStorage.setItem(LOCKOUT_STORAGE_KEY, lockUntil.toString());
      } catch {
        // Ignore
      }
    }
  };

  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    setSecondsRemaining(0);
    try {
      sessionStorage.removeItem(ATTEMPTS_STORAGE_KEY);
      sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Fix 2: Synchronous in-flight lock preventing duplicate concurrent submissions
    if (isSubmittingRef.current || loading) return;

    setError(null);

    if (secondsRemaining > 0) {
      setError(`অনেকবার ব্যর্থ চেষ্টা করা হয়েছে। অনুগ্রহ করে ${toBengaliNumber(secondsRemaining)} সেকেন্ড অপেক্ষা করুন।`);
      return;
    }

    if (!email || !password) {
      setError('ইমেইল এবং পাসওয়ার্ড দুটিই আবশ্যক।');
      return;
    }

    // Set lock synchronously before starting any asynchronous operations
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.user) {
        // Check for Supabase HTTP 429 or rate limit notice
        const isRateLimit =
          authError?.status === 429 ||
          (authError?.message && /rate limit|too many requests|over_request_rate_limit/i.test(authError.message));

        handleFailedAttempt(Boolean(isRateLimit));
        logSecurityEvent({
          event_type: isRateLimit ? 'client_login_rate_limited' : 'client_login_failed',
          event_category: 'authentication',
          description: isRateLimit
            ? 'অতিরিক্ত অনুরোধের কারণে অ্যাডমিন লগইন স্থগিত (রেট লিমিট)'
            : 'অ্যাডমিন লগইন ব্যর্থ (ভুল পরিচয়পত্র বা তথ্য)',
          metadata: isRateLimit
            ? { is_rate_limit: true, cooldown_seconds: 60 }
            : { is_rate_limit: false, reason: 'invalid_credentials' },
        });

        if (isRateLimit) {
          throw new Error('অতিরিক্ত অনুরোধ পাঠানো হয়েছে। সার্ভার সুরক্ষার জন্য ৬০ সেকেন্ড পর আবার চেষ্টা করুন।');
        }

        throw new Error(authError?.message || 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করুন।');
      }

      // Check profile role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      const userRole = (profile as { role?: string } | null)?.role;
      if (userRole !== 'admin') {
        handleFailedAttempt(false);
        const attemptedRole = (userRole === 'moderator' || userRole === 'user') ? userRole : 'unknown';
        logSecurityEvent({
          event_type: 'client_permission_denied',
          event_category: 'access_denial',
          description: 'অননুমোদিত অ-অ্যাডমিন অ্যাকাউন্টে অ্যাডমিন প্রবেশ প্রচেষ্টা',
          metadata: { attempted_role: attemptedRole },
        });
        await supabase.auth.signOut();
        throw new Error('আপনার অ্যাকাউন্টে অ্যাডমিন অধিকার নেই।');
      }

      // Success! Log event, reset client failure counters & check MFA state
      logSecurityEvent({
        event_type: 'client_login_password_success',
        event_category: 'authentication',
        description: 'অ্যাডমিন প্রাথমিক পাসওয়ার্ড যাচাইকরণ সফল (AAL1 সেশন)',
      });
      resetFailedAttempts();
      const mfaState = await refreshMfaStatus();
      if (mfaState.aal === 'aal2') {
        navigate(safeFrom, { replace: true });
      } else if (mfaState.hasMfaEnrolled) {
        navigate('/admin/mfa', { state: { from: safeFrom }, replace: true });
      } else {
        navigate('/admin/mfa-setup', { state: { from: safeFrom }, replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লগইন করতে অপ্রত্যাশিত সমস্যা দেখা দিয়েছে।');
    } finally {
      // Synchronously release lock on every exit path (both success and error)
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-800 text-gold mx-auto flex items-center justify-center shadow-md">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-sand-900 dark:text-stone-100">
          অ্যাডমিন প্রবেশদ্বার
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          হিদায়াহ অডিওর কন্টেন্ট ও সিস্টেম পরিচালনার জন্য লগইন করুন
        </p>
      </div>

      {infoMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            messageType === 'error'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {messageType === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="leading-relaxed">{infoMessage}</span>
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {secondsRemaining > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold">
                  লগইন সাময়িক স্থগিত: {toBengaliNumber(secondsRemaining)} সেকেন্ড অপেক্ষা করুন।
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  একাধিকবার ব্যর্থ লগইন প্রচেষ্টার কারণে সিস্টেম সুরক্ষায় সাময়িক বিলম্ব কার্যকর করা হয়েছে।
                </p>
              </div>
            </div>
          )}

          <Input
            label="অ্যাডমিন ইমেইল"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hidayahaudio.com"
            icon={<Mail className="h-4 w-4" />}
            required
            autoComplete="email"
            disabled={secondsRemaining > 0 || loading}
          />

          <Input
            label="পাসওয়ার্ড"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="current-password"
            disabled={secondsRemaining > 0 || loading}
          />

          <Button
            type="submit"
            isLoading={loading}
            disabled={secondsRemaining > 0 || loading}
            className="w-full mt-2"
          >
            {secondsRemaining > 0
              ? `অনুগ্রহ করে অপেক্ষা করুন (${toBengaliNumber(secondsRemaining)} সে.)`
              : 'প্রবেশ করুন'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-stone-400">
        শুধুমাত্র অনুমোদিত অ্যাডমিন ও সম্পাদকদের ব্যবহারের জন্য সংরক্ষিত।
      </p>
    </div>
  );
};
