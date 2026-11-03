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

  // Keep a ref to the current user ID to track changes across async boundaries
  const activeUserIdRef = useRef<string | null>(null);

  // 1. Session initialization & synchronous auth listener
  useEffect(() => {
    let isSubscribed = true;

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isSubscribed) return;
        setSession(initialSession);
        const nextUser = initialSession?.user ?? null;
        activeUserIdRef.current = nextUser?.id ?? null;
        setUser(nextUser);
        setAal(parseJwtAal(initialSession?.access_token));

        if (nextUser) {
          setProfileLoading(true);
        } else {
          setProfile(null);
          setHasMfaEnrolled(false);
          setProfileLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error getting initial session:', err);
        if (isSubscribed) {
          setProfile(null);
          setAal(null);
          setHasMfaEnrolled(false);
          setProfileLoading(false);
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setSessionLoading(false);
        }
      });

    // Listen to auth changes - strictly synchronous callback
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isSubscribed) return;
      setSession(currentSession);
      const nextUser = currentSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const previousUserId = activeUserIdRef.current;
      activeUserIdRef.current = nextUserId;
      setUser(nextUser);
      setAal(parseJwtAal(currentSession?.access_token));

      if (nextUserId) {
        if (nextUserId !== previousUserId || !profile) {
          setProfileLoading(true);
        }
        if (previousUserId && nextUserId !== previousUserId) {
          broadcastAuthSignal({ type: 'USER_CHANGED', userId: nextUserId, timestamp: Date.now() });
        }
      } else {
        if (previousUserId) {
          broadcastAuthSignal({ type: 'SIGNED_OUT', timestamp: Date.now() });
        }
        setProfile(null);
        setAal(null);
        setHasMfaEnrolled(false);
        setProfileLoading(false);
      }
      setSessionLoading(false);
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Cross-tab session synchronization listener
  useEffect(() => {
    let isSubscribed = true;
    let channel: BroadcastChannel | null = null;

    const handleSyncSignal = (signal: unknown) => {
      if (!isSubscribed || !signal || typeof signal !== 'object') return;
      const { type, userId, timestamp } = signal as Partial<AuthSyncSignal>;

      // Ignore expired signals older than 60 seconds
      if (typeof timestamp === 'number' && Date.now() - timestamp > 60000) {
        return;
      }

      if (type === 'SIGNED_OUT') {
        // Tab B promptly reflects signed-out state when Tab A signs out
        if (activeUserIdRef.current !== null || user !== null) {
          activeUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setAal(null);
          setHasMfaEnrolled(false);
          setProfileLoading(false);
          // Note: Avoid duplicate supabase.auth.signOut() to prevent infinite network loops
        }
      } else if (type === 'USER_CHANGED') {
        // Account switched in another tab
        if (userId && userId !== activeUserIdRef.current) {
          supabase.auth
            .getSession()
            .then(({ data: { session: newSession } }) => {
              if (!isSubscribed) return;
              setSession(newSession);
              const nextUser = newSession?.user ?? null;
              activeUserIdRef.current = nextUser?.id ?? null;
              setUser(nextUser);
              setAal(parseJwtAal(newSession?.access_token));
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
      if (!isSubscribed) return;

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
      isSubscribed = false;
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

  // 3. Fetch profile & check MFA factors in a separate useEffect triggered strictly by user?.id
  useEffect(() => {
    let isCurrent = true;
    const userId = user?.id;

    if (!userId) {
      setProfile(null);
      setAal(null);
      setHasMfaEnrolled(false);
      setProfileLoading(false);
      return;
    }

    const loadProfileAndMfa = async () => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!isCurrent) return;

        if (!error && data) {
          const loadedProfile = data as Profile;
          setProfile(loadedProfile);

          // If admin, check enrolled MFA factors
          if (loadedProfile.role === 'admin') {
            try {
              const { data: factorsData } = await supabase.auth.mfa.listFactors();
              const verified = factorsData?.totp?.some((f) => f.status === 'verified') || false;
              if (isCurrent) {
                setHasMfaEnrolled(verified);
              }
            } catch {
              if (isCurrent) setHasMfaEnrolled(false);
            }
          }
        } else {
          if (error) {
            console.error('Error fetching profile:', error.message);
          }
          setProfile(null);
          setHasMfaEnrolled(false);
        }
      } catch (err) {
        if (!isCurrent) return;
        console.error('Unexpected error fetching profile:', err);
        setProfile(null);
        setHasMfaEnrolled(false);
      } finally {
        if (isCurrent) {
          setProfileLoading(false);
        }
      }
    };

    loadProfileAndMfa();

    return () => {
      isCurrent = false;
    };
  }, [user?.id]);

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
      setUser(null);
      setSession(null);
      setProfile(null);
      setAal(null);
      setHasMfaEnrolled(false);
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    const currentId = user?.id;
    if (!currentId) return;
    try {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentId)
        .maybeSingle();

      if (activeUserIdRef.current === currentId) {
        if (!error && data) {
          setProfile(data as Profile);
        } else {
          setProfile(null);
        }
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
      if (activeUserIdRef.current === currentId) {
        setProfile(null);
      }
    } finally {
      if (activeUserIdRef.current === currentId) {
        setProfileLoading(false);
      }
    }
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
      signOut,
      refreshProfile,
      refreshMfaStatus,
    }),
    [user, session, profile, isAdmin, aal, hasMfaEnrolled, loading]
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
