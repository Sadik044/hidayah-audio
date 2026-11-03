import { supabase } from '../lib/supabase';
import type { AuditLog, Json } from '../types/database.types';

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  category?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  totalCount: number;
  error: string | null;
}

export type AllowedClientEventType =
  | 'client_login_password_success'
  | 'client_login_failed'
  | 'client_login_rate_limited'
  | 'client_permission_denied'
  | 'client_mfa_enrollment_started'
  | 'client_mfa_enrollment_completed'
  | 'client_mfa_verification_failed'
  | 'client_mfa_challenge_failed'
  | 'client_mfa_challenge_success'
  | 'client_inactivity_timeout'
  | 'client_manual_logout'
  | 'client_global_logout'
  | 'client_cover_uploaded'
  | 'client_cover_deleted'
  | 'client_audio_uploaded'
  | 'client_audio_deleted';

export interface ClientSecurityEventInput {
  event_type: AllowedClientEventType;
  event_category: 'authentication' | 'mfa' | 'session' | 'access_denial' | 'storage_activity';
  target_type?: string | null;
  target_id?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fetches centralized audit logs with pagination and multi-parameter filtering.
 * Strictly requires AAL2 administrative authorization enforced by PostgreSQL RLS.
 */
export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogsResponse> {
  const {
    page = 1,
    pageSize = 20,
    category,
    eventType,
    startDate,
    endDate,
  } = filters;

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (category && category !== 'all') {
      query = query.eq('event_category', category);
    }

    if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return { logs: [], totalCount: 0, error: error.message };
    }

    return {
      logs: (data as AuditLog[]) || [],
      totalCount: count || 0,
      error: null,
    };
  } catch (err) {
    return {
      logs: [],
      totalCount: 0,
      error: err instanceof Error ? err.message : 'অডিট লগ লোড করতে অপ্রত্যাশিত সমস্যা হয়েছে।',
    };
  }
}

/**
 * Dispatches an audit event to the secure PostgreSQL log_security_event RPC function.
 * Actor identity and AAL are extracted reliably by PostgreSQL from the trusted JWT context.
 * Silently catches errors so client-side telemetry failures never break user flows.
 */
export async function logSecurityEvent(input: ClientSecurityEventInput): Promise<{ success: boolean; logId?: string }> {
  try {
    const { data, error } = await supabase.rpc('log_security_event', {
      p_event_type: input.event_type,
      p_event_category: input.event_category,
      p_target_type: input.target_type ?? null,
      p_target_id: input.target_id ?? null,
      p_description: input.description,
      p_metadata: (input.metadata as unknown as Json) ?? {},
    });

    if (error) {
      console.warn('Audit log dispatch failed:', error.message);
      return { success: false };
    }

    return { success: true, logId: data as string };
  } catch (err) {
    console.warn('Unexpected error logging audit event:', err);
    return { success: false };
  }
}
