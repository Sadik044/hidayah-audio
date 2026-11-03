-- ==============================================================================
-- Migration: 20261101110000_audit_logging.sql (Final Hardening)
-- Description: Centralized Audit Logging & Security Monitoring System
--              - Table: public.audit_logs (Append-Only at Application Layer)
--              - Strict Table Privileges: Revoked all writes from anon & authenticated
--              - Strict Event-Type-to-Category 1:1 Server Binding
--              - Server-Defined Descriptions & Rigid Target Validation
--              - Event-Specific Metadata Allowlisting + Recursive Camel/Snake Sanitization
--              - Locked-down Helper Privileges (sanitize_audit_jsonb restricted)
--              - Automatic Database Triggers for Admin CRUD (Server-Generated)
--              - Clear Separation: Database-Generated (db_trigger) vs Client Telemetry
--              - Strict AAL2 Row Level Security (RLS) Protection
-- ==============================================================================

-- 1. Create audit_logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_category text NOT NULL,
  origin text NOT NULL DEFAULT 'db_trigger' CHECK (origin IN ('db_trigger', 'client_telemetry')),
  actor_id uuid NULL,
  target_type text NULL,
  target_id text NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  aal_level text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documentation integrity
COMMENT ON TABLE public.audit_logs IS 'Central security and administrative activity log. Append-only via application privileges.';
COMMENT ON COLUMN public.audit_logs.origin IS 'Source of the audit record: db_trigger (server-generated database event) or client_telemetry (unverified client report)';
COMMENT ON COLUMN public.audit_logs.event_type IS 'Specific event identifier validated against server allowlists and category bindings';
COMMENT ON COLUMN public.audit_logs.event_category IS 'Category: admin_activity, authentication, mfa, session, access_denial, storage_activity';
COMMENT ON COLUMN public.audit_logs.actor_id IS 'Supabase auth.uid() of the actor who performed the action, or NULL if unauthenticated';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Strictly allowlisted and recursively sanitized JSON context. Free from credentials, keys, or OTP secrets.';
COMMENT ON COLUMN public.audit_logs.aal_level IS 'Authenticator Assurance Level of the session: aal1, aal2, or NULL';

-- 2. Indexes for High-Performance Querying & Filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs (event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_origin ON public.audit_logs (origin);

-- 3. Row Level Security (RLS) & Table Privileges Hardening
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Reading audit logs strictly requires verified Admin role AND AAL2 session assurance
DROP POLICY IF EXISTS "Admins AAL2 can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins AAL2 can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

-- Revoke all table write privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;

-- Grant only SELECT privilege to authenticated users (RLS strictly limits rows to AAL2 admins)
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- 4. Recursive JSONB Metadata Sanitization Function
-- Replaces naive top-level-only key removal. Recursively purges sensitive keys at any nesting depth.
-- Handles both camelCase and snake_case variants universally via normalized lowercase matching.
CREATE OR REPLACE FUNCTION public.sanitize_audit_jsonb(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_val jsonb;
  v_result jsonb := '{}'::jsonb;
  v_normalized_key text;
  v_sensitive_keys text[] := ARRAY[
    'password', 'passwd', 'pass', 'code', 'token', 'secret', 'key',
    'accesstoken', 'refreshtoken', 'otp', 'totp', 'jwt', 'authcode',
    'signedurl', 'apikey', 'credential', 'private', 'authorization', 'authheader'
  ];
BEGIN
  IF p_data IS NULL OR p_data = 'null'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Recursively process arrays
  IF jsonb_typeof(p_data) = 'array' THEN
    RETURN (
      SELECT COALESCE(jsonb_agg(public.sanitize_audit_jsonb(value)), '[]'::jsonb)
      FROM jsonb_array_elements(p_data)
    );
  ELSIF jsonb_typeof(p_data) != 'object' THEN
    RETURN p_data;
  END IF;

  -- Recursively process objects and strip matched sensitive keys (both snake_case & camelCase)
  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_data) LOOP
    v_normalized_key := lower(replace(v_key, '_', ''));
    IF v_normalized_key = ANY(v_sensitive_keys) THEN
      CONTINUE; -- Strip sensitive key
    END IF;

    IF jsonb_typeof(v_val) = 'object' THEN
      v_result := jsonb_set(v_result, ARRAY[v_key], public.sanitize_audit_jsonb(v_val));
    ELSIF jsonb_typeof(v_val) = 'array' THEN
      v_result := jsonb_set(v_result, ARRAY[v_key], (
        SELECT COALESCE(jsonb_agg(public.sanitize_audit_jsonb(value)), '[]'::jsonb)
        FROM jsonb_array_elements(v_val)
      ));
    ELSE
      v_result := jsonb_set(v_result, ARRAY[v_key], v_val);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- 5. Database Trigger Function for Tamper-Proof Admin Operations
CREATE OR REPLACE FUNCTION public.audit_admin_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_aal text;
  v_event_type text;
  v_target_id text;
  v_desc text;
  v_meta jsonb := '{}'::jsonb;
BEGIN
  -- Extract actor and assurance level strictly from trusted database session context
  v_actor_id := auth.uid();
  v_aal := (SELECT auth.jwt()->>'aal');

  IF TG_OP = 'INSERT' THEN
    v_event_type := TG_TABLE_NAME || '_created';
    v_target_id := NEW.id::text;
    IF TG_TABLE_NAME = 'categories' THEN
      v_desc := 'নতুন বিষয়/ক্যাটাগরি তৈরি: ' || COALESCE(NEW.name, '');
      v_meta := jsonb_build_object('name', NEW.name, 'slug', NEW.slug);
    ELSIF TG_TABLE_NAME = 'series' THEN
      v_desc := 'নতুন সিরিজ তৈরি: ' || COALESCE(NEW.title, '');
      v_meta := jsonb_build_object('title', NEW.title, 'published', NEW.published);
    ELSIF TG_TABLE_NAME = 'episodes' THEN
      v_desc := 'নতুন অডিও পর্ব যোগ: ' || COALESCE(NEW.title, '');
      v_meta := jsonb_build_object('title', NEW.title, 'series_id', NEW.series_id, 'published', NEW.published);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      v_desc := 'নতুন ব্যবহারকারী প্রোফাইল তৈরি: ' || COALESCE(NEW.id::text, '');
      v_meta := jsonb_build_object('id', NEW.id, 'role', NEW.role);
    ELSE
      v_desc := TG_TABLE_NAME || ' রেকর্ড তৈরি করা হয়েছে';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := TG_TABLE_NAME || '_updated';
    v_target_id := NEW.id::text;
    IF TG_TABLE_NAME = 'categories' THEN
      v_desc := 'ক্যাটাগরি হালনাগাদ: ' || COALESCE(NEW.name, '');
      v_meta := jsonb_build_object('name', NEW.name, 'slug', NEW.slug);
    ELSIF TG_TABLE_NAME = 'series' THEN
      v_desc := 'সিরিজ হালনাগাদ: ' || COALESCE(NEW.title, '');
      v_meta := jsonb_build_object('title', NEW.title, 'published', NEW.published);
    ELSIF TG_TABLE_NAME = 'episodes' THEN
      v_desc := 'অডিও পর্ব হালনাগাদ: ' || COALESCE(NEW.title, '');
      v_meta := jsonb_build_object('title', NEW.title, 'published', NEW.published);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      v_desc := 'ব্যবহারকারীর রোল হালনাগাদ: ' || COALESCE(NEW.role, '');
      v_meta := jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role);
    ELSE
      v_desc := TG_TABLE_NAME || ' রেকর্ড হালনাগাদ করা হয়েছে';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := TG_TABLE_NAME || '_deleted';
    v_target_id := OLD.id::text;
    IF TG_TABLE_NAME = 'categories' THEN
      v_desc := 'ক্যাটাগরি মুছে ফেলা হয়েছে: ' || COALESCE(OLD.name, '');
      v_meta := jsonb_build_object('name', OLD.name, 'slug', OLD.slug);
    ELSIF TG_TABLE_NAME = 'series' THEN
      v_desc := 'সিরিজ মুছে ফেলা হয়েছে: ' || COALESCE(OLD.title, '');
      v_meta := jsonb_build_object('title', OLD.title);
    ELSIF TG_TABLE_NAME = 'episodes' THEN
      v_desc := 'অডিও পর্ব মুছে ফেলা হয়েছে: ' || COALESCE(OLD.title, '');
      v_meta := jsonb_build_object('title', OLD.title, 'series_id', OLD.series_id);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      v_desc := 'প্রোফাইল মুছে ফেলা হয়েছে: ' || OLD.id::text;
    ELSE
      v_desc := TG_TABLE_NAME || ' রেকর্ড মুছে ফেলা হয়েছে';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    event_type,
    event_category,
    origin,
    actor_id,
    target_type,
    target_id,
    description,
    metadata,
    aal_level
  ) VALUES (
    v_event_type,
    'admin_activity',
    'db_trigger',
    v_actor_id,
    TG_TABLE_NAME,
    v_target_id,
    v_desc,
    public.sanitize_audit_jsonb(v_meta),
    v_aal
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Apply Triggers to Public Admin Tables (including profiles INSERT)
DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS trg_audit_series ON public.series;
CREATE TRIGGER trg_audit_series
  AFTER INSERT OR UPDATE OR DELETE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS trg_audit_episodes ON public.episodes;
CREATE TRIGGER trg_audit_episodes
  AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

-- 6. Hardened SECURITY DEFINER RPC with Strict Event-to-Category 1:1 Server Binding
-- - Binds every allowed event type to exactly one permitted category.
-- - Server determines the canonical description; does not trust arbitrary client descriptions.
-- - Validates target_type and target_id against event-specific rules and regex format.
-- - Validates metadata against event-specific key allowlists.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_event_category text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_aal text;
  v_is_admin boolean;
  v_expected_category text;
  v_server_description text;
  v_allowed_meta_keys text[];
  v_filtered_meta jsonb := '{}'::jsonb;
  v_sanitized_meta jsonb;
  v_log_id uuid;
  v_meta_key text;
  v_meta_val jsonb;
BEGIN
  -- 1. Strict Event-Type-to-Category 1:1 Mapping & Server-Defined Descriptions
  CASE p_event_type
    WHEN 'client_login_failed' THEN
      v_expected_category := 'authentication';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: অ্যাডমিন লগইন ব্যর্থ (ভুল পরিচয়পত্র বা তথ্য)';
      v_allowed_meta_keys := ARRAY['is_rate_limit', 'reason'];

    WHEN 'client_login_rate_limited' THEN
      v_expected_category := 'authentication';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: অতিরিক্ত অনুরোধের কারণে অ্যাডমিন লগইন সাময়িক স্থগিত (রেট লিমিট)';
      v_allowed_meta_keys := ARRAY['cooldown_seconds', 'is_rate_limit'];

    WHEN 'client_login_password_success' THEN
      v_expected_category := 'authentication';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট (অযাচাইকৃত): অ্যাডমিন প্রাথমিক পাসওয়ার্ড যাচাইকরণ সম্পন্ন হয়েছে বলে ব্রাউজার জানিয়েছে';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_permission_denied' THEN
      v_expected_category := 'access_denial';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: অননুমোদিত অ্যাকাউন্টে অ্যাডমিন প্রবেশ প্রচেষ্টা';
      v_allowed_meta_keys := ARRAY['attempted_role'];

    WHEN 'client_mfa_enrollment_started' THEN
      v_expected_category := 'mfa';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: নতুন TOTP 2FA সেটআপ প্রক্রিয়া শুরু';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_mfa_enrollment_completed' THEN
      v_expected_category := 'mfa';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: TOTP 2FA ফ্যাক্টর সফলভাবে সংযুক্ত ও সক্রিয় (AAL2 অর্জিত)';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_mfa_verification_failed' THEN
      v_expected_category := 'mfa';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: MFA সেটআপে ভুল ভেরিফিকেশন কোড প্রদান';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_mfa_challenge_failed' THEN
      v_expected_category := 'mfa';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: TOTP চ্যালেঞ্জে ভুল বা মেয়াদোত্তীর্ণ কোড প্রদান';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_mfa_challenge_success' THEN
      v_expected_category := 'mfa';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: TOTP নিরাপত্তা কোড যাচাই সফল (AAL2 সেশন কার্যকর)';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_inactivity_timeout' THEN
      v_expected_category := 'session';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: ৩০ মিনিট নিষ্ক্রিয়তার কারণে স্বয়ংক্রিয় সেশন সমাপ্তি';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_manual_logout' THEN
      v_expected_category := 'session';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: স্থানীয় ডিভাইস থেকে অ্যাডমিন লগআউট';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_global_logout' THEN
      v_expected_category := 'session';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: সকল সক্রিয় ডিভাইস থেকে গ্লোবাল লগআউট কার্যকর';
      v_allowed_meta_keys := ARRAY[]::text[];

    WHEN 'client_cover_uploaded' THEN
      v_expected_category := 'storage_activity';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: সিরিজের কভার ইমেজ আপলোড সম্পন্ন';
      v_allowed_meta_keys := ARRAY['bucket', 'file_size'];

    WHEN 'client_cover_deleted' THEN
      v_expected_category := 'storage_activity';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: কভার ইমেজ ফাইল মুছে ফেলা হয়েছে';
      v_allowed_meta_keys := ARRAY['bucket'];

    WHEN 'client_audio_uploaded' THEN
      v_expected_category := 'storage_activity';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: পর্বের নতুন অডিও ফাইল আপলোড সম্পন্ন';
      v_allowed_meta_keys := ARRAY['bucket', 'file_size'];

    WHEN 'client_audio_deleted' THEN
      v_expected_category := 'storage_activity';
      v_server_description := 'ক্লায়েন্ট রিপোর্ট: অডিও ফাইল মুছে ফেলা হয়েছে';
      v_allowed_meta_keys := ARRAY['bucket'];

    ELSE
      RAISE EXCEPTION 'Invalid or unapproved audit event type: %', p_event_type;
  END CASE;

  -- 2. Reject NULL or Mismatched Event Type and Category Combinations
  IF p_event_category IS NULL THEN
    RAISE EXCEPTION 'event_category cannot be null';
  END IF;

  IF p_event_category != v_expected_category THEN
    RAISE EXCEPTION 'Event type % must be logged under category %, got %', p_event_type, v_expected_category, p_event_category;
  END IF;

  -- 3. Strict Event-Specific Target Validation
  CASE v_expected_category
    WHEN 'mfa' THEN
      IF p_target_type IS NULL OR p_target_type != 'mfa_factor' THEN
        RAISE EXCEPTION 'Invalid target_type for MFA event: %, expected mfa_factor', p_target_type;
      END IF;
      IF p_target_id IS NULL THEN
        RAISE EXCEPTION 'target_id is required for MFA events';
      END IF;
      IF octet_length(p_target_id) > 64 THEN
        RAISE EXCEPTION 'target_id for MFA event exceeds maximum length of 64 characters';
      END IF;
      IF p_target_id !~ '^[a-zA-Z0-9_\-]+$' THEN
        RAISE EXCEPTION 'target_id for MFA event must be alphanumeric or UUID format';
      END IF;

    WHEN 'storage_activity' THEN
      IF p_target_type IS NULL OR p_target_type NOT IN ('covers', 'audio') THEN
        RAISE EXCEPTION 'Invalid target_type for storage event: %, expected covers or audio', p_target_type;
      END IF;
      IF p_target_id IS NULL THEN
        RAISE EXCEPTION 'target_id is required for storage events';
      END IF;
      IF octet_length(p_target_id) > 128 THEN
        RAISE EXCEPTION 'target_id exceeds maximum length of 128 characters';
      END IF;
      IF p_target_id !~ '^[a-zA-Z0-9_\-\./]+$' THEN
        RAISE EXCEPTION 'target_id contains invalid characters';
      END IF;

    WHEN 'access_denial' THEN
      IF p_target_type IS NOT NULL AND p_target_type NOT IN ('profile', 'auth_session') THEN
        RAISE EXCEPTION 'Invalid target_type for access denial event: %', p_target_type;
      END IF;
      IF p_target_id IS NOT NULL THEN
        IF octet_length(p_target_id) > 128 THEN
          RAISE EXCEPTION 'target_id exceeds maximum length of 128 characters';
        END IF;
        IF p_target_id !~ '^[a-zA-Z0-9_\-\./:]+$' THEN
          RAISE EXCEPTION 'target_id contains invalid characters';
        END IF;
      END IF;

    WHEN 'authentication', 'session' THEN
      IF p_target_type IS NOT NULL AND p_target_type != 'auth_session' THEN
        RAISE EXCEPTION 'Invalid target_type for % event: %', v_expected_category, p_target_type;
      END IF;
      IF p_target_id IS NOT NULL THEN
        RAISE EXCEPTION 'target_id must be null for authentication and session events';
      END IF;

    ELSE
      RAISE EXCEPTION 'Unpermitted category: %', v_expected_category;
  END CASE;

  -- Sensitive keywords check on any target_id that was provided
  IF p_target_id IS NOT NULL THEN
    IF lower(p_target_id) ~* '(password|token|secret|bearer|jwt|otp|key)' THEN
      RAISE EXCEPTION 'target_id contains sensitive keywords';
    END IF;
  END IF;

  -- 4. Context Extraction from Trusted Server Authentication
  v_actor_id := auth.uid();
  v_aal := (SELECT auth.jwt()->>'aal');
  v_is_admin := public.is_admin();

  -- 5. Role & Category Authorization Enforcement
  -- Scenario A: Anonymous Caller (Pre-Authentication)
  IF v_actor_id IS NULL THEN
    IF p_event_type NOT IN ('client_login_failed', 'client_login_rate_limited') THEN
      RAISE EXCEPTION 'Anonymous callers are strictly restricted to login failure and rate-limiting telemetry';
    END IF;
  ELSE
    -- Scenario B: Authenticated Non-Admin User
    -- Non-admins can ONLY submit their own manual logout or access denial reports
    IF NOT v_is_admin THEN
      IF p_event_type NOT IN ('client_manual_logout', 'client_permission_denied') THEN
        RAISE EXCEPTION 'Non-admin users cannot submit administrative or privileged telemetry events';
      END IF;
    END IF;

    -- Scenario C: MFA Challenge Verification Claim
    -- A client cannot claim MFA challenge success unless their cryptographically signed JWT is already AAL2
    IF p_event_type = 'client_mfa_challenge_success' AND (v_aal IS NULL OR v_aal != 'aal2') THEN
      RAISE EXCEPTION 'Cannot report MFA challenge success without verified AAL2 session token';
    END IF;
  END IF;

  -- 6. Event-Specific Metadata Allowlisting and Deep Value Validation
  IF p_metadata IS NOT NULL AND p_metadata != '{}'::jsonb AND p_metadata != 'null'::jsonb THEN
    IF jsonb_typeof(p_metadata) != 'object' THEN
      RAISE EXCEPTION 'Metadata must be a JSON object';
    END IF;

    IF octet_length(p_metadata::text) > 2048 THEN
      RAISE EXCEPTION 'Metadata payload exceeds maximum allowed size of 2KB';
    END IF;

    -- If no metadata keys are permitted for this event, reject non-empty metadata
    IF cardinality(v_allowed_meta_keys) = 0 THEN
      RAISE EXCEPTION 'Metadata is not permitted for event %', p_event_type;
    END IF;

    FOR v_meta_key, v_meta_val IN SELECT * FROM jsonb_each(p_metadata) LOOP
      -- A. Key allowlist verification
      IF v_meta_key != ALL(v_allowed_meta_keys) THEN
        RAISE EXCEPTION 'Unknown or unpermitted metadata key % for event %', v_meta_key, p_event_type;
      END IF;

      -- B. Reject nested objects or arrays across all client events
      IF jsonb_typeof(v_meta_val) IN ('object', 'array') THEN
        RAISE EXCEPTION 'Nested objects or arrays are not permitted in metadata key %', v_meta_key;
      END IF;

      -- C. Check for sensitive substrings in string values
      IF jsonb_typeof(v_meta_val) = 'string' THEN
        IF lower(v_meta_val #>> '{}') ~* '(password|token|secret|bearer|jwt|otp|key)' THEN
          RAISE EXCEPTION 'Metadata key % contains sensitive keywords', v_meta_key;
        END IF;
      END IF;

      -- D. Strict value type, bounds, and enum validation per event type
      CASE p_event_type
        WHEN 'client_login_failed' THEN
          IF v_meta_key = 'is_rate_limit' THEN
            IF jsonb_typeof(v_meta_val) != 'boolean' THEN
              RAISE EXCEPTION 'is_rate_limit must be a boolean';
            END IF;
          ELSIF v_meta_key = 'reason' THEN
            IF jsonb_typeof(v_meta_val) != 'string' THEN
              RAISE EXCEPTION 'reason must be a string';
            END IF;
            IF octet_length(v_meta_val #>> '{}') > 32 THEN
              RAISE EXCEPTION 'reason exceeds maximum length of 32 characters';
            END IF;
            IF (v_meta_val #>> '{}') NOT IN ('invalid_credentials', 'rate_limited', 'network_error') THEN
              RAISE EXCEPTION 'Invalid reason value: %', v_meta_val #>> '{}';
            END IF;
          END IF;

        WHEN 'client_login_rate_limited' THEN
          IF v_meta_key = 'is_rate_limit' THEN
            IF jsonb_typeof(v_meta_val) != 'boolean' THEN
              RAISE EXCEPTION 'is_rate_limit must be a boolean';
            END IF;
          ELSIF v_meta_key = 'cooldown_seconds' THEN
            IF jsonb_typeof(v_meta_val) != 'number' THEN
              RAISE EXCEPTION 'cooldown_seconds must be a number';
            END IF;
            IF (v_meta_val #>> '{}')::numeric < 0 OR (v_meta_val #>> '{}')::numeric > 3600 THEN
              RAISE EXCEPTION 'cooldown_seconds must be between 0 and 3600';
            END IF;
          END IF;

        WHEN 'client_permission_denied' THEN
          IF v_meta_key = 'attempted_role' THEN
            IF jsonb_typeof(v_meta_val) != 'string' THEN
              RAISE EXCEPTION 'attempted_role must be a string';
            END IF;
            IF octet_length(v_meta_val #>> '{}') > 20 THEN
              RAISE EXCEPTION 'attempted_role exceeds maximum length of 20 characters';
            END IF;
            IF (v_meta_val #>> '{}') NOT IN ('user', 'moderator', 'unknown') THEN
              RAISE EXCEPTION 'Invalid attempted_role value: %', v_meta_val #>> '{}';
            END IF;
          END IF;

        WHEN 'client_cover_uploaded' THEN
          IF v_meta_key = 'bucket' THEN
            IF jsonb_typeof(v_meta_val) != 'string' OR (v_meta_val #>> '{}') != 'covers' THEN
              RAISE EXCEPTION 'bucket must be covers';
            END IF;
          ELSIF v_meta_key = 'file_size' THEN
            IF jsonb_typeof(v_meta_val) != 'number' THEN
              RAISE EXCEPTION 'file_size must be a number';
            END IF;
            IF (v_meta_val #>> '{}')::numeric < 1 OR (v_meta_val #>> '{}')::numeric > 5242880 THEN
              RAISE EXCEPTION 'file_size must be between 1 and 5242880 bytes (5MB)';
            END IF;
          END IF;

        WHEN 'client_cover_deleted' THEN
          IF v_meta_key = 'bucket' THEN
            IF jsonb_typeof(v_meta_val) != 'string' OR (v_meta_val #>> '{}') != 'covers' THEN
              RAISE EXCEPTION 'bucket must be covers';
            END IF;
          END IF;

        WHEN 'client_audio_uploaded' THEN
          IF v_meta_key = 'bucket' THEN
            IF jsonb_typeof(v_meta_val) != 'string' OR (v_meta_val #>> '{}') != 'audio' THEN
              RAISE EXCEPTION 'bucket must be audio';
            END IF;
          ELSIF v_meta_key = 'file_size' THEN
            IF jsonb_typeof(v_meta_val) != 'number' THEN
              RAISE EXCEPTION 'file_size must be a number';
            END IF;
            IF (v_meta_val #>> '{}')::numeric < 1 OR (v_meta_val #>> '{}')::numeric > 104857600 THEN
              RAISE EXCEPTION 'file_size must be between 1 and 104857600 bytes (100MB)';
            END IF;
          END IF;

        WHEN 'client_audio_deleted' THEN
          IF v_meta_key = 'bucket' THEN
            IF jsonb_typeof(v_meta_val) != 'string' OR (v_meta_val #>> '{}') != 'audio' THEN
              RAISE EXCEPTION 'bucket must be audio';
            END IF;
          END IF;

        ELSE
          RAISE EXCEPTION 'Metadata validation not configured for event %', p_event_type;
      END CASE;

      v_filtered_meta := jsonb_set(v_filtered_meta, ARRAY[v_meta_key], v_meta_val);
    END LOOP;
  END IF;

  -- Recursive sanitization pass
  v_sanitized_meta := public.sanitize_audit_jsonb(v_filtered_meta);

  -- 7. Insert Audit Record with Explicit client_telemetry Origin and Server-Defined Description
  INSERT INTO public.audit_logs (
    event_type,
    event_category,
    origin,
    actor_id,
    target_type,
    target_id,
    description,
    metadata,
    aal_level
  ) VALUES (
    p_event_type,
    v_expected_category,
    'client_telemetry',
    v_actor_id,
    p_target_type,
    p_target_id,
    v_server_description,
    v_sanitized_meta,
    v_aal
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 7. Function Ownership and Privileges Hardening
-- Revoke all permissions from PUBLIC to avoid default execution rights
REVOKE ALL ON FUNCTION public.sanitize_audit_jsonb(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_admin_table_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb) FROM PUBLIC;

-- Helper functions and triggers are internal; revoke direct execution from anon & authenticated
REVOKE ALL ON FUNCTION public.sanitize_audit_jsonb(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.sanitize_audit_jsonb(jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_admin_table_changes() FROM anon;
REVOKE ALL ON FUNCTION public.audit_admin_table_changes() FROM authenticated;

-- Grant EXECUTE on log_security_event strictly to the required client roles
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb) TO anon, authenticated;
