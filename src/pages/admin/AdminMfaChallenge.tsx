import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, AlertCircle, LogOut, ArrowRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getSafeRedirectPath } from './AdminLogin';
import { logSecurityEvent } from '../../services/auditService';
import { useAdminInactivity } from '../../hooks/useAdminInactivity';
import { toBengaliNumber } from '../../lib/utils';

export const AdminMfaChallenge: React.FC = () => {
  const { aal, signOut, refreshMfaStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState<string>('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawFrom = (location.state as { from?: unknown })?.from;
  const safeFrom = useMemo(() => getSafeRedirectPath(rawFrom), [rawFrom]);

  // 30-minute admin inactivity protection
  const handleInactivityLogout = async () => {
    try {
      await logSecurityEvent({
        event_type: 'client_inactivity_timeout',
        event_category: 'session',
        description: 'এমএফএ ভেরিফিকেশনে নিষ্ক্রিয়তার কারণে স্বয়ংক্রিয় সাইন আউট (৩০ মিনিট)',
      });
    } catch {
      // Best-effort audit logging
    }
    await signOut({ scope: 'local' });
    navigate('/admin/login', { replace: true, state: { reason: 'inactivity' } });
  };

  const {
    showWarning: showInactivityWarning,
    remainingSeconds: inactivityRemainingSeconds,
    keepActive: keepSessionActive,
  } = useAdminInactivity({
    timeoutMs: 30 * 60 * 1000,
    warningMs: 2 * 60 * 1000,
    onTimeout: handleInactivityLogout,
    enabled: Boolean(aal === 'aal1'),
  });

  // If already elevated to AAL2, redirect straight to dashboard
  useEffect(() => {
    if (aal === 'aal2') {
      navigate(safeFrom, { replace: true });
    }
  }, [aal, navigate, safeFrom]);

  // Load verified factor on mount
  useEffect(() => {
    let isMounted = true;

    const loadFactor = async () => {
      setInitLoading(true);
      setError(null);

      try {
        const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const verified = data?.totp?.find((f) => f.status === 'verified');
        if (!verified) {
          // If no verified factor exists, redirect to setup
          if (isMounted) {
            navigate('/admin/mfa-setup', { replace: true, state: { from: safeFrom } });
          }
          return;
        }

        if (isMounted) {
          setFactorId(verified.id);
          setFriendlyName(verified.friendly_name || 'Authenticator App');
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'MFA নিরাপত্তা ফ্যাক্টর লোড করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
          );
        }
      } finally {
        if (isMounted) {
          setInitLoading(false);
          // Focus OTP input after loading
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    };

    loadFactor();

    return () => {
      isMounted = false;
    };
  }, [navigate, safeFrom]);

  const verifyCode = async (codeToVerify: string) => {
    if (isSubmittingRef.current || loading) return;

    const cleanCode = codeToVerify.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setError('অনুগ্রহ করে সঠিক ৬-সংখ্যার নিরাপত্তা কোডটি প্রদান করুন।');
      return;
    }

    if (!factorId) {
      setError('প্রমাণীকরণ ফ্যাক্টর পাওয়া যায়নি। পৃষ্ঠাটি রিলোড করুন।');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode,
      });

      if (verifyError) {
        logSecurityEvent({
          event_type: 'client_mfa_challenge_failed',
          event_category: 'mfa',
          description: 'TOTP চ্যালেঞ্জে ভুল বা অকার্যকর কোড প্রদান',
          target_type: 'mfa_factor',
          target_id: factorId,
        });

        const msg = verifyError.message || '';
        if (/expired/i.test(msg)) {
          throw new Error('কোডের সময়সীমা উত্তীর্ণ হয়েছে। অ্যাপ থেকে নতুন কোড দিয়ে চেষ্টা করুন।');
        }
        if (/rate limit|too many requests/i.test(msg)) {
          throw new Error('অতিরিক্ত ভুল কোড দেওয়া হয়েছে। কিছু সময় অপেক্ষা করুন।');
        }
        throw new Error('ভুল ভেরিফিকেশন কোড। আপনার প্রমাণীকরণ অ্যাপের চলতি কোডটি যাচাই করুন।');
      }

      // Refresh MFA & AAL status in AuthContext
      await refreshMfaStatus();

      logSecurityEvent({
        event_type: 'client_mfa_challenge_success',
        event_category: 'mfa',
        description: 'TOTP নিরাপত্তা কোড যাচাই সফল (AAL2 সেশন কার্যকর)',
        target_type: 'mfa_factor',
        target_id: factorId,
      });

      // Navigate to destination
      navigate(safeFrom, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'যাচাইকরণে ত্রুটি হয়েছে।');
      setOtpCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(otpCode);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(rawVal);
    setError(null);

    // Auto-submit once 6 digits are typed
    if (rawVal.length === 6) {
      verifyCode(rawVal);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut({ scope: 'local' });
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  if (initLoading) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-500">MFA নিরাপত্তা ফ্যাক্টর যাচাই করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-800 text-gold mx-auto flex items-center justify-center shadow-md">
          <ShieldCheck className="h-6 w-6 text-gold" />
        </div>
        <h1 className="text-2xl font-bold text-sand-900 dark:text-stone-100">
          দ্বি-স্তরীয় প্রমাণীকরণ (TOTP)
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          আপনার অ্যাকাউন্টের উচ্চতর নিরাপত্তার জন্য ভেরিফিকেশন কোড প্রদান করুন
        </p>
      </div>

      <Card className="p-6 space-y-6 border-stone-200/80 dark:border-stone-800 shadow-sm">
        {error && (
          <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 text-center">
            <label
              htmlFor="otpCode"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              প্রমাণীকরণ অ্যাপে প্রদর্শিত ৬-সংখ্যার কোড
            </label>
            {friendlyName && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                সংযুক্ত অ্যাপ / ডিভাইস: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">{friendlyName}</span>
              </p>
            )}

            <div className="pt-2">
              <input
                ref={inputRef}
                id="otpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={handleInputChange}
                disabled={loading}
                placeholder="000000"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sand-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
              />
            </div>
            <p className="text-[11px] text-stone-400">
              ৬টি সংখ্যা প্রবেশ করালে স্বয়ংক্রিয়ভাবে যাচাই করা হবে
            </p>
          </div>

          <Button
            type="submit"
            className="w-full justify-center h-11 text-sm bg-emerald-800 hover:bg-emerald-900 text-white font-medium"
            disabled={loading || otpCode.replace(/\D/g, '').length !== 6}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                নিরাপত্তা কোড যাচাই হচ্ছে...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                প্রবেশ নিশ্চিত করুন
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleLogout}
            className="text-stone-500 hover:text-sand-900 dark:hover:text-stone-200 flex items-center gap-1.5 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            অন্য অ্যাকাউন্ট দিয়ে লগইন করুন
          </button>
        </div>
      </Card>

      {/* Admin Inactivity Warning Modal */}
      <Modal
        isOpen={showInactivityWarning}
        onClose={keepSessionActive}
        title="সেশন মেয়াদোত্তীর্ণের সতর্কতা"
        description="নিরাপত্তার স্বার্থে দীর্ঘক্ষণ নিষ্ক্রিয় থাকলে অ্যাডমিন সেশন স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">আপনার সেশন শীঘ্রই শেষ হবে</p>
              <p className="text-xs mt-1 text-amber-700/80 dark:text-amber-300/80">
                আর মাত্র{' '}
                <span className="font-mono font-bold text-base text-amber-900 dark:text-amber-100">
                  {toBengaliNumber(inactivityRemainingSeconds)}
                </span>{' '}
                সেকেন্ডের মধ্যে কোনো কার্যকলাপ না করলে আপনি স্বয়ংক্রিয়ভাবে সাইন আউট হয়ে যাবেন।
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInactivityLogout}
            >
              এখনই সাইন আউট
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={keepSessionActive}
            >
              সেশন সক্রিয় রাখুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminMfaChallenge;
