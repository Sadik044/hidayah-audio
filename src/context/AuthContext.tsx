import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database.types';

/**
 * Synchronously parses the Authenticator Assurance Level (aal1 vs aal2) from a Supabase JWT.
 * Ensures zero network latency and avoids asynchronous auth listener deadlocks.
 */
function parseJwtAal(accessToken?: string | null): 'aal1' | 'aal2' | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

/**
 * Cross-tab authentication synchronization signal.
 * Strictly transmits high-level operational signals without credentials, tokens, or JWTs.
 * Note: Local tab synchronization only coordinates client-side state across tabs;
 * actual server-side token revocation is handled by Supabase Auth backend.
 */
export interface AuthSyncSignal {
  type: 'SIGNED_OUT' | 'USER_CHANGED';
  userId?: string | null;
  timestamp: number;
}

export const AUTH_SYNC_CHANNEL = 'hidayah_auth_sync';
export const AUTH_SYNC_STORAGE_KEY = 'hidayah_auth_sync_event';

export function broadcastAuthSignal(signal: AuthSyncSignal) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.postMessage(signal);
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel errors in restricted contexts
  }

  try {
    localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(signal));
  } catch {
    // Ignore localStorage access errors
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  aal: 'aal1' | 'aal2' | null;
  hasMfaEnrolled: boolean;
  loading: boolean;
  profileError: string | null;
  signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMfaStatus: () => Promise<{ aal: 'aal1' | 'aal2' | null; hasMfaEnrolled: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<'aal1' | 'aal2' | null>(null);
  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Synchronous refs for async boundaries and closures
  const activeUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const fetchVersionRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  /**
   * Unified helper to fetch user profile & MFA status with version tracking.
   * Prevents race conditions and stale closure hangs.
   */
  const loadUserProfile = async (userId: string, version: number) => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // If component unmounted or superseded by a newer fetch/auth change, discard
      if (!isMountedRef.current || version !== fetchVersionRef.current) return;

      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfile(null);
        profileRef.current = null;
        setProfileError(error.message);
        setHasMfaEnrolled(false);
      } else if (data) {
        const loadedProfile = data as Profile;
        setProfile(loadedProfile);
        profileRef.current = loadedProfile;
        setProfileError(null);

        // If admin, check enrolled MFA factors
        if (loadedProfile.role === 'admin') {
          try {
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const verified = factorsData?.totp?.some((f) => f.status === 'verified') || false;
            if (isMountedRef.current && version === fetchVersionRef.current) {
              setHasMfaEnrolled(verified);
            }
          } catch {
            if (isMountedRef.current && version === fetchVersionRef.current) {
              setHasMfaEnrolled(false);
            }
          }
        } else {
          setHasMfaEnrolled(false);
        }
      } else {
        setProfile(null);
        profileRef.current = null;
        setHasMfaEnrolled(false);
      }
    } catch (err) {
      if (!isMountedRef.current || version !== fetchVersionRef.current) return;
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
      profileRef.current = null;
      setProfileError(err instanceof Error ? err.message : 'Unknown profile error');
      setHasMfaEnrolled(false);
    } finally {
      if (isMountedRef.current && version === fetchVersionRef.current) {
        setProfileLoading(false);
      }
    }
  };

  // 1. Session initialization & synchronous auth listener
  useEffect(() => {
    isMountedRef.current = true;

    // Get initial session with deterministic 8s fallback timeout to prevent hangs
    const getInitialSession = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) => {
          timeoutId = setTimeout(() => resolve({ data: { session: null }, error: new Error('Session timeout') }), 8000);
        });

        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ]);
        if (timeoutId) clearTimeout(timeoutId);

        if (!isMountedRef.current) return;

        if (error && error.message !== 'Session timeout') {
          console.error('Error getting initial session:', error);
        }

        const initialSession = data?.session ?? null;
        setSession(initialSession);
        const nextUser = initialSession?.user ?? null;
        const nextUserId = nextUser?.id ?? null;
        activeUserIdRef.current = nextUserId;
        setUser(nextUser);
        setAal(parseJwtAal(initialSession?.access_token));

        if (nextUserId) {
          const version = ++fetchVersionRef.current;
          await loadUserProfile(nextUserId, version);
        } else {
          setProfile(null);
          profileRef.current = null;
          setHasMfaEnrolled(false);
          setProfileLoading(false);
        }
      } catch (err) {
        console.error('Initial session fetch failed:', err);
        if (isMountedRef.current) {
          setProfile(null);
          profileRef.current = null;
          setAal(null);
          setHasMfaEnrolled(false);
          setProfileLoading(false);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setSessionLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMountedRef.current) return;

      const nextUser = currentSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const previousUserId = activeUserIdRef.current;
      const currentAal = parseJwtAal(currentSession?.access_token);

      setSession(currentSession);
      setUser(nextUser);
      setAal(currentAal);

      if (!nextUserId) {
        // User logged out
        activeUserIdRef.current = null;
        profileRef.current = null;
        setProfile(null);
        setAal(null);
        setHasMfaEnrolled(false);
        setProfileLoading(false);
        setProfileError(null);
        setSessionLoading(false);

        if (previousUserId) {
          broadcastAuthSignal({ type: 'SIGNED_OUT', timestamp: Date.now() });
        }
        return;
      }

      // User is authenticated
      if (nextUserId !== previousUserId) {
        // User changed or new login
        activeUserIdRef.current = nextUserId;
        if (previousUserId) {
          broadcastAuthSignal({ type: 'USER_CHANGED', userId: nextUserId, timestamp: Date.now() });
        }
        const version = ++fetchVersionRef.current;
        await loadUserProfile(nextUserId, version);
      } else {
        // SAME USER: e.g. TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED
        if (event === 'MFA_CHALLENGE_VERIFIED' || currentAal === 'aal2') {
          setHasMfaEnrolled(true);
        }
        // If profile is missing (e.g. earlier network failure), attempt to fetch it now
        if (!profileRef.current) {
          const version = ++fetchVersionRef.current;
          await loadUserProfile(nextUserId, version);
        }
        // Note: If profile is already in memory, background token refresh executes silently
        // without setting profileLoading=true or interrupting active views.
      }

      setSessionLoading(false);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Cross-tab session synchronization listener
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleSyncSignal = (signal: unknown) => {
      if (!isMountedRef.current || !signal || typeof signal !== 'object') return;
      const { type, userId, timestamp } = signal as Partial<AuthSyncSignal>;

      // Ignore expired signals older than 60 seconds
      if (typeof timestamp === 'number' && Date.now() - timestamp > 60000) {
        return;
      }

      if (type === 'SIGNED_OUT') {
        // Tab B promptly reflects signed-out state when Tab A signs out
        if (activeUserIdRef.current !== null || user !== null) {
          activeUserIdRef.current = null;
          profileRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setAal(null);
          setHasMfaEnrolled(false);
          setProfileLoading(false);
          setProfileError(null);
        }
      } else if (type === 'USER_CHANGED') {
        // Account switched in another tab
        if (userId && userId !== activeUserIdRef.current) {
          supabase.auth
            .getSession()
            .then(({ data: { session: newSession } }) => {
              if (!isMountedRef.current) return;
              setSession(newSession);
              const nextUser = newSession?.user ?? null;
              activeUserIdRef.current = nextUser?.id ?? null;
              setUser(nextUser);
              setAal(parseJwtAal(newSession?.access_token));
              if (nextUser?.id) {
                const version = ++fetchVersionRef.current;
                loadUserProfile(nextUser.id, version);
              }
            })
            .catch(() => {});
        }
      }
    };

    // Listen via BroadcastChannel if supported
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
        channel.onmessage = (event) => {
          handleSyncSignal(event.data);
        };
      }
    } catch {
      channel = null;
    }

    // Storage event listener fallback (handles browsers without BroadcastChannel or manual storage clearance)
    const handleStorageEvent = (event: StorageEvent) => {
      if (!isMountedRef.current) return;

      if (event.key === AUTH_SYNC_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          handleSyncSignal(parsed);
        } catch {
          // Ignore parse errors
        }
      }

      // Check if Supabase session token was cleared in another tab
      if (
        event.key &&
        event.key.startsWith('sb-') &&
        event.key.endsWith('-auth-token') &&
        !event.newValue
      ) {
        if (activeUserIdRef.current !== null) {
          handleSyncSignal({ type: 'SIGNED_OUT', timestamp: Date.now() });
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (channel) {
        try {
          channel.close();
        } catch {
          // Ignore
        }
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [user]);

  const signOut = async (options?: { scope?: 'global' | 'local' | 'others' }) => {
    // Broadcast the sign-out event to synchronize across all browser tabs immediately
    broadcastAuthSignal({
      type: 'SIGNED_OUT',
      timestamp: Date.now(),
    });

    try {
      const { error } = await supabase.auth.signOut(options);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error signing out:', err);
      throw err;
    } finally {
      activeUserIdRef.current = null;
      profileRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setAal(null);
      setHasMfaEnrolled(false);
      setProfileLoading(false);
      setProfileError(null);
    }
  };

  const refreshProfile = async () => {
    const currentId = activeUserIdRef.current;
    if (!currentId) return;
    const version = ++fetchVersionRef.current;
    await loadUserProfile(currentId, version);
  };

  const refreshMfaStatus = async () => {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verified = factorsData?.totp?.some((f) => f.status === 'verified') || false;
      const rawLevel = aalData?.currentLevel ?? parseJwtAal(session?.access_token);
      const currentLevel: 'aal1' | 'aal2' | null =
        rawLevel === 'aal2' ? 'aal2' : rawLevel === 'aal1' ? 'aal1' : null;
      setAal(currentLevel);
      setHasMfaEnrolled(verified);
      return { aal: currentLevel, hasMfaEnrolled: verified };
    } catch {
      return { aal, hasMfaEnrolled };
    }
  };

  const isAdmin = profile?.role === 'admin';
  const loading = sessionLoading || profileLoading;

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      aal,
      hasMfaEnrolled,
      loading,
      profileError,
      signOut,
      refreshProfile,
      refreshMfaStatus,
    }),
    [user, session, profile, isAdmin, aal, hasMfaEnrolled, loading, profileError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
