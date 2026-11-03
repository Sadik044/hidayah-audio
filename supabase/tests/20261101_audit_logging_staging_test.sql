-- ==============================================================================
-- Staging PostgreSQL Integration Test Suite
-- File: supabase/tests/20261101_audit_logging_staging_test.sql
-- Purpose: Direct PostgreSQL execution test verifying RLS, Privileges, Triggers,
--          and RPC Validation for Phase 4 Audit Logging.
-- IMPORTANT: MUST BE RUN ONLY ON STAGING DATABASE. NEVER RUN ON PRODUCTION.
-- ==============================================================================

BEGIN;

DO $test_suite$
DECLARE
  v_test_count int := 0;
  v_passed_count int := 0;
  v_admin_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_cat_id uuid := gen_random_uuid();
  v_log_id uuid;
  v_count int;
  v_err_thrown boolean;
BEGIN
  RAISE NOTICE 'Starting PostgreSQL Phase 4 Integration Tests...';

  -- ---------------------------------------------------------------------------
  -- Test 1: Verify Table Privileges (Direct Client INSERT/UPDATE/DELETE/TRUNCATE)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  -- Check table permissions in information_schema / pg_class
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_name = 'audit_logs'
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'Test 1 FAILED: Direct write privileges granted to client roles on audit_logs';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 1 PASSED: Direct write privileges completely revoked from client roles';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 2: Verify Function Execution Privileges
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  -- sanitize_audit_jsonb and audit_admin_table_changes must not be executable by anon/authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_name IN ('sanitize_audit_jsonb', 'audit_admin_table_changes')
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  ) THEN
    RAISE EXCEPTION 'Test 2 FAILED: Internal helper/trigger functions granted to client roles';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 2 PASSED: Helper and trigger execution strictly revoked from client roles';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 3: Verify SECURITY DEFINER & Safe search_path on Functions
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('audit_admin_table_changes', 'log_security_event')
      AND (
        NOT p.prosecdef OR
        COALESCE(array_to_string(p.proconfig, ','), '') !~* 'search_path=""|search_path='''''
      )
  ) THEN
    RAISE EXCEPTION 'Test 3 FAILED: Functions must be SECURITY DEFINER with search_path = ''''';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 3 PASSED: Functions have SECURITY DEFINER and safe search_path';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 4: Verify Trigger Return Behavior (DELETE returns OLD, INSERT/UPDATE return NEW)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  -- Trigger definition inspection
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'audit_admin_table_changes'
      AND prosrc !~* 'IF TG_OP = ''DELETE'' THEN\s*RETURN OLD;\s*ELSE\s*RETURN NEW;'
  ) THEN
    RAISE EXCEPTION 'Test 4 FAILED: audit_admin_table_changes must return OLD on DELETE and NEW otherwise';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 4 PASSED: Trigger return behavior explicitly verified';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 5: Verify NULL Event Category Rejection
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_login_failed',
      p_event_category => NULL,
      p_metadata => '{"is_rate_limit": false, "reason": "invalid_credentials"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%event_category cannot be null%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 5 FAILED: NULL event_category was not rejected with expected error';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 5 PASSED: NULL event_category strictly rejected';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 6: Verify Mismatched Category Rejection
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_login_failed',
      p_event_category => 'session',
      p_metadata => '{"is_rate_limit": false, "reason": "invalid_credentials"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%must be logged under category%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 6 FAILED: Mismatched event category was not rejected';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 6 PASSED: Category mismatch rejected';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 7: Verify Anonymous Caller Cannot Submit Session Logout
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    -- Calling without auth.uid() context
    PERFORM public.log_security_event(
      p_event_type => 'client_manual_logout',
      p_event_category => 'session'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Anonymous callers are strictly restricted%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 7 FAILED: Anonymous user permitted to log manual logout';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 7 PASSED: Anonymous callers restricted from session telemetry';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 8: Verify Anonymous Caller Can Submit Permitted Login Failure
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  BEGIN
    v_log_id := public.log_security_event(
      p_event_type => 'client_login_failed',
      p_event_category => 'authentication',
      p_metadata => '{"is_rate_limit": false, "reason": "invalid_credentials"}'::jsonb
    );
    IF v_log_id IS NOT NULL THEN
      v_passed_count := v_passed_count + 1;
      RAISE NOTICE 'Test 8 PASSED: Anonymous caller successfully logged permitted login failure';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Test 8 FAILED: Permitted anonymous telemetry failed with error: %', SQLERRM;
  END;

  -- ---------------------------------------------------------------------------
  -- Test 9: Verify Rejection of Legacy Storage Target Aliases
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_cover_uploaded',
      p_event_category => 'storage_activity',
      p_target_type => 'storage_cover', -- legacy alias rejected
      p_target_id => 'covers/test.jpg',
      p_metadata => '{"bucket": "covers", "file_size": 1000}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%expected covers or audio%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 9 FAILED: Legacy storage alias storage_cover was not rejected';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 9 PASSED: Legacy storage aliases strictly rejected';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 10: Verify Mandatory Target ID on Storage and MFA Events
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_cover_uploaded',
      p_event_category => 'storage_activity',
      p_target_type => 'covers',
      p_target_id => NULL -- missing target_id
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%target_id is required for storage events%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 10 FAILED: Missing target_id on storage event was permitted';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 10 PASSED: Mandatory target_id enforced';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 11: Verify target_id Forbidden on Authentication and Session Events
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_login_failed',
      p_event_category => 'authentication',
      p_target_id => 'forged_session_123'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%target_id must be null for authentication and session events%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 11 FAILED: Client was allowed to supply target_id for authentication event';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 11 PASSED: Client target_id forgery on auth/session blocked';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 12: Verify Rejection of Nested Objects and Sensitive Keywords in Metadata
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_login_failed',
      p_event_category => 'authentication',
      p_metadata => '{"is_rate_limit": false, "reason": {"nested": "value"}}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Nested objects or arrays are not permitted%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 12 FAILED: Nested object was permitted in metadata';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 12 PASSED: Nested metadata rejected';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 13: Verify Metadata Bound Limits (file_size > 5MB for covers)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  v_err_thrown := false;
  BEGIN
    PERFORM public.log_security_event(
      p_event_type => 'client_cover_uploaded',
      p_event_category => 'storage_activity',
      p_target_type => 'covers',
      p_target_id => 'covers/big.jpg',
      p_metadata => '{"bucket": "covers", "file_size": 9999999}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%5242880 bytes%' THEN
      v_err_thrown := true;
    END IF;
  END;

  IF NOT v_err_thrown THEN
    RAISE EXCEPTION 'Test 13 FAILED: file_size exceeding 5MB was permitted';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 13 PASSED: Cover file size bound enforced';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 14: Verify Origin Labeling and Server Description
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  SELECT origin, description INTO STRICT v_desc, v_meta
  FROM public.audit_logs
  WHERE id = v_log_id;

  IF v_desc != 'client_telemetry' THEN
    RAISE EXCEPTION 'Test 14 FAILED: Client telemetry origin was not client_telemetry';
  END IF;
  v_passed_count := v_passed_count + 1;
  RAISE NOTICE 'Test 14 PASSED: Origin strictly stamped as client_telemetry';

  -- ---------------------------------------------------------------------------
  -- Test 15: Verify Row Level Security on audit_logs
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Test 15 FAILED: RLS is NOT enabled on public.audit_logs';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 15 PASSED: RLS is enabled on public.audit_logs';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Test 16: Verify AAL2 Requirement Policy Exists on audit_logs
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Admins AAL2 can read audit logs'
      AND qual ~* 'is_admin_aal2'
  ) THEN
    RAISE EXCEPTION 'Test 16 FAILED: Policy "Admins AAL2 can read audit logs" missing or does not check is_admin_aal2';
  ELSE
    v_passed_count := v_passed_count + 1;
    RAISE NOTICE 'Test 16 PASSED: AAL2 admin read policy properly configured';
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'POSTGRESQL TEST SUMMARY: %/% Tests Passed', v_passed_count, v_test_count;
  RAISE NOTICE '=======================================================';

END $test_suite$;

-- Always ROLLBACK to ensure test execution leaves zero database mutations
ROLLBACK;
