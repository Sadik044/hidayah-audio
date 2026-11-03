import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Copy, Check, AlertCircle, LogOut, KeyRound } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getSafeRedirectPath } from './AdminLogin';
import { logSecurityEvent } from '../../services/auditService';
import { useAdminInactivity } from '../../hooks/useAdminInactivity';
import { toBengaliNumber } from '../../lib/utils';

/**
 * Validates raw SVG string for strict security:
 * - Strips XML declarations and comments
 * - Ensures top-level <svg ...>...</svg> structure
 * - Rejects scripts, event handlers, foreignObject, iframe/object/embed
 * - Rejects external references (http/https href, use, image, feImage)
 */
function validateAndSanitizeSvg(rawSvg: string): string | null {
  if (!rawSvg || typeof rawSvg !== 'string') return null;

  // 1. Strip XML declaration (e.g. <?xml version="1.0" encoding="utf-8"?>)
  let content = rawSvg.trim().replace(/^<\?xml[\s\S]*?\?>/i, '').trim();

  // 2. Strip leading and trailing XML comments (e.g. <!-- ... -->)
  content = content.replace(/^<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*?-->$/g, '').trim();

  // 3. Reject entity declarations / DOCTYPE (XXE prevention)
  const lower = content.toLowerCase();
  if (lower.includes('<!doctype') || lower.includes('<!entity')) {
    return null;
  }

  // 4. Must begin with <svg and end with </svg>
  if (!content.startsWith('<svg') || !content.endsWith('</svg>')) {
    return null;
  }

  // 5. Reject executable elements and scripts
  if (
    lower.includes('<script') ||
    lower.includes('<foreignobject') ||
    lower.includes('<iframe') ||
    lower.includes('<object') ||
    lower.includes('<embed') ||
    lower.includes('<link') ||
    lower.includes('javascript:')
  ) {
    return null;
  }

  // 6. Reject inline event handlers (e.g. onload=, onclick=, onerror=)
  if (/\son[a-z0-9_-]+\s*=/i.test(content)) {
    return null;
  }

  // 7. Reject external resource references, remote images, use tags, or CSS imports
  // Note: allows xmlns="http://www.w3.org/2000/svg" (standard namespace)
  if (
    lower.includes('<use') ||
    lower.includes('<image') ||
    lower.includes('<feimage') ||
    /(?:href|xlink:href|src)\s*=\s*["']?\s*(?:https?:|\/\/|data:)/i.test(content) ||
    /url\s*\(\s*["']?\s*(?:https?:|\/\/|data:)/i.test(content)
  ) {
    return null;
  }

  return content;
}

/**
 * Validates and converts QR code data (SVG markup or image Data URI) into a safe Data URL
 * to be rendered strictly through an HTML <img> element, neutralizing XSS vectors and preventing
 * inline DOM script execution.
 */
export function getSafeQrCodeUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Safe PNG Data URIs (strictly check base64 format)
  if (trimmed.startsWith('data:image/png;base64,')) {
    const base64Data = trimmed.slice('data:image/png;base64,'.length).trim();
    if (/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return trimmed;
    }
    return null;
  }

  // 2. SVG Data URIs: decode payload and pass through strict SVG validator
  if (trimmed.startsWith('data:image/svg+xml')) {
    let decodedPayload: string | null = null;
    if (trimmed.startsWith('data:image/svg+xml;base64,')) {
      const b64 = trimmed.slice('data:image/svg+xml;base64,'.length).trim();
      if (/^[A-Za-z0-9+/=]+$/.test(b64)) {
        try {
          decodedPayload = typeof atob === 'function'
            ? atob(b64)
            : Buffer.from(b64, 'base64').toString('utf8');
        } catch {
          return null;
        }
      } else {
        return null;
      }
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx !== -1) {
        try {
          decodedPayload = decodeURIComponent(trimmed.slice(commaIdx + 1));
        } catch {
          return null;
        }
      }
    }

    if (!decodedPayload) return null;
    const validatedSvg = validateAndSanitizeSvg(decodedPayload);
    return validatedSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(validatedSvg)}` : null;
  }

  // 3. Raw SVG Markup: validate structure and encode safely
  const validatedSvg = validateAndSanitizeSvg(trimmed);
  if (validatedSvg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(validatedSvg)}`;
  }

  return null;
}

export const AdminMfaSetup: React.FC = () => {
  const { user, aal, signOut, refreshMfaStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);

  const rawFrom = (location.state as { from?: unknown })?.from;
  const safeFrom = useMemo(() => getSafeRedirectPath(rawFrom), [rawFrom]);
  const safeQrUrl = useMemo(() => getSafeQrCodeUrl(qrCode), [qrCode]);

  // 30-minute admin inactivity protection
  const handleInactivityLogout = async () => {
    try {
      await logSecurityEvent({
        event_type: 'client_inactivity_timeout',
        event_category: 'session',
        description: 'এমএফএ সেটআপে নিষ্ক্রিয়তার কারণে স্বয়ংক্রিয় সাইন আউট (৩০ মিনিট)',
      });
    } catch {
      // Best-effort audit logging
    }
    await signOut();
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
    enabled: Boolean(user),
  });

  // If already at AAL2, redirect straight to dashboard
  useEffect(() => {
    if (aal === 'aal2') {
      navigate(safeFrom, { replace: true });
    }
  }, [aal, navigate, safeFrom]);

  // Initialize enrollment on mount
  useEffect(() => {
    let isMounted = true;

    const setupMfa = async () => {
      setInitLoading(true);
      setError(null);

      try {
        // 1. Check existing factors
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        // If user already has a verified factor, redirect to the challenge route
        const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified');
        if (verifiedFactor) {
          if (isMounted) {
            navigate('/admin/mfa', { replace: true, state: { from: safeFrom } });
          }
          return;
        }

        // Clean up any unverified factor from previous attempts
        const unverifiedFactors = factorsData?.totp?.filter((f) => (f.status as string) !== 'verified') || [];
        for (const unv of unverifiedFactors) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: unv.id });
          } catch {
            // Ignore cleanup errors
          }
        }

        // 2. Enroll a new TOTP factor
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'Hidayah Audio',
          friendlyName: user?.email || 'Admin',
        });

        if (enrollError || !enrollData) {
          throw new Error(enrollError?.message || 'দ্বি-স্তরীয় প্রমাণীকরণ সেটআপ শুরু করতে ব্যর্থ হয়েছে।');
        }

        if (isMounted) {
          setFactorId(enrollData.id);
          setQrCode(enrollData.totp.qr_code);
          setSecret(enrollData.totp.secret);
          logSecurityEvent({
            event_type: 'client_mfa_enrollment_started',
            event_category: 'mfa',
            description: 'নতুন TOTP প্রমাণীকরণ ফ্যাক্টর তৈরি শুরু',
            target_type: 'mfa_factor',
            target_id: enrollData.id,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'MFA সেটআপ লোড করতে সমস্যা হয়েছে।');
        }
      } finally {
        if (isMounted) {
          setInitLoading(false);
        }
      }
    };

    setupMfa();

    return () => {
      isMounted = false;
    };
  }, [user, navigate, safeFrom]);

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    setError(null);

    const cleanCode = otpCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setError('অনুগ্রহ করে সঠিক ৬-সংখ্যার কোডটি প্রবেশ করান।');
      return;
    }

    if (!factorId) {
      setError('প্রমাণীকরণ ফ্যাক্টর পাওয়া যায়নি। পৃষ্ঠাটি রিফ্রেশ করুন।');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode,
      });

      if (verifyError) {
        logSecurityEvent({
          event_type: 'client_mfa_verification_failed',
          event_category: 'mfa',
          description: 'MFA সেটআপে ভুল ভেরিফিকেশন কোড প্রদান',
          target_type: 'mfa_factor',
          target_id: factorId,
        });
        throw new Error('ভুল ভেরিফিকেশন কোড। আপনার প্রমাণীকরণ অ্যাপে প্রদর্শিত চলতি ৬-সংখ্যার কোডটি প্রবেশ করান।');
      }

      // Refresh MFA and assurance status in AuthContext
      await refreshMfaStatus();

      logSecurityEvent({
        event_type: 'client_mfa_enrollment_completed',
        event_category: 'mfa',
        description: 'TOTP প্রমাণীকরণ ফ্যাক্টর সফলভাবে যাচাইকৃত ও সক্রিয় (AAL2 অর্জিত)',
        target_type: 'mfa_factor',
        target_id: factorId,
      });

      // Navigate to destination
      navigate(safeFrom, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'যাচাইকরণে অপ্রত্যাশিত সমস্যা দেখা দিয়েছে।');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-500">দ্বি-স্তরীয় প্রমাণীকরণ উপাদান প্রস্তুত করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-800 text-gold mx-auto flex items-center justify-center shadow-md">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-sand-900 dark:text-stone-100">
          দ্বি-স্তরীয় নিরাপত্তা সেটআপ
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          অ্যাডমিন কনসোলে প্রবেশের জন্য প্রমাণীকরণ (TOTP) অ্যাপ যুক্ত করা বাধ্যতামূলক
        </p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Scan QR Code */}
        <div className="space-y-3 text-center">
          <div className="inline-block px-2.5 py-1 rounded-full bg-sand-200/80 dark:bg-emerald-950/60 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            ধাপ ১: অ্যাপে স্ক্যান করুন
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            আপনার মোবাইলের <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, অথবা <strong>Bitwarden</strong> অ্যাপ দিয়ে নিচের কিউআর কোডটি স্ক্যান করুন:
          </p>

          {qrCode && (
            <div className="p-3 bg-white rounded-2xl border border-sand-200 dark:border-stone-700 shadow-xs inline-block">
              {safeQrUrl ? (
                <img src={safeQrUrl} alt="TOTP QR Code" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 mx-auto flex items-center justify-center p-4 text-center text-xs text-stone-500">
                  কিউআর কোড রেন্ডার করা সম্ভব হয়নি। নিচে প্রদত্ত সিক্রেট কি ব্যবহার করুন।
                </div>
              )}
            </div>
          )}

          {/* Manual Secret Key Accordion */}
          {secret && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowManualSecret(!showManualSecret)}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
              >
                {showManualSecret ? 'ম্যানুয়াল কোড লুকান' : 'স্ক্যান করতে সমস্যা হলে ম্যানুয়াল কোড দেখুন'}
              </button>

              {showManualSecret && (
                <div className="mt-2.5 p-3 rounded-xl bg-sand-100 dark:bg-stone-800/80 border border-sand-200 dark:border-stone-700 space-y-2 text-left">
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    আপনার প্রমাণীকরণ অ্যাপে এই কোডটি ম্যানুয়ালি পেস্ট করুন:
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-stone-900 px-3 py-2 rounded-lg border border-sand-200 dark:border-stone-700">
                    <span className="font-mono text-xs font-semibold tracking-wider text-sand-900 dark:text-stone-100 break-all select-all">
                      {secret}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-1 rounded-md text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shrink-0"
                      title="কপি করুন"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-sand-200/80 dark:border-emerald-900/40" />

        {/* Step 2: Enter 6-digit OTP */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="inline-block px-2.5 py-1 rounded-full bg-sand-200/80 dark:bg-emerald-950/60 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              ধাপ ২: ওটিপি কোড নিশ্চিত করুন
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              অ্যাপে প্রদর্শিত চলতি ৬-সংখ্যার কোডটি প্রবেশ করিয়ে সেটআপ সম্পন্ন করুন:
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              disabled={loading}
              className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 px-4 rounded-xl border border-sand-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sand-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-stone-300 dark:placeholder:text-stone-700"
              required
            />
          </div>

          <Button
            type="submit"
            isLoading={loading}
            disabled={otpCode.length !== 6 || loading}
            className="w-full gap-2"
          >
            <KeyRound className="h-4 w-4" />
            <span>যাচাই ও সক্রিয় করুন</span>
          </Button>
        </form>
      </Card>

      <div className="text-center">
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>অন্য অ্যাকাউন্ট দিয়ে প্রবেশ করতে লগআউট করুন</span>
        </button>
      </div>

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
