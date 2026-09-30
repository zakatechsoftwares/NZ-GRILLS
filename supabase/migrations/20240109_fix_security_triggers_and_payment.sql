-- Follow-up to 20240108_security_hardening.sql
--
-- 1. The enforcement triggers were SECURITY DEFINER, so inside them
--    current_user was the owner and is_app_user_request() was always false,
--    which skipped every check. Triggers must run as the caller.
--
-- 2. verify_payment_flutterwave: read the secret key from Vault instead of
--    hard-coding it, and check that the order belongs to the caller, the
--    transaction is not reused, and the amount/currency match.
--
-- Before running: create the Vault secret (Dashboard > Project Settings >
-- Vault, or SQL):
--   select vault.create_secret('<FLWSECK_...>', 'flutterwave_secret_key');

-- ---------------------------------------------------------------------------
-- 1. Run enforcement triggers with the caller's privileges
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.enforce_profile_role_change() SECURITY INVOKER;
ALTER FUNCTION public.enforce_order_update_rules() SECURITY INVOKER;

-- ---------------------------------------------------------------------------
-- 2. Payment verification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_payment_flutterwave(transaction_id text, order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_transaction_id text := verify_payment_flutterwave.transaction_id;
  v_order_id uuid := verify_payment_flutterwave.order_id;
  v_order record;
  flw_response http_response;
  flw_data json;
  secret_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_transaction_id IS NULL OR v_transaction_id !~ '^[0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid transaction id');
  END IF;

  SELECT o.id, o.customer_id, o.total_amount, o.payment_status, o.payment_id
    INTO v_order
    FROM public.orders o
   WHERE o.id = v_order_id
     FOR UPDATE;

  IF NOT FOUND OR v_order.customer_id <> auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.payment_status = 'paid' THEN
    IF v_order.payment_id = v_transaction_id THEN
      RETURN json_build_object('success', true);
    END IF;
    RETURN json_build_object('success', false, 'error', 'Order already paid');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.payment_id = v_transaction_id AND o.id <> v_order_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already used');
  END IF;

  SELECT decrypted_secret INTO secret_key
    FROM vault.decrypted_secrets
   WHERE name = 'flutterwave_secret_key';

  IF secret_key IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Payment verification not configured');
  END IF;

  SELECT * INTO flw_response FROM http((
    'GET',
    'https://api.flutterwave.com/v3/transactions/' || v_transaction_id || '/verify',
    ARRAY[http_header('Authorization', 'Bearer ' || secret_key)],
    NULL,
    NULL
  )::http_request);

  IF flw_response.status <> 200 THEN
    RETURN json_build_object('success', false, 'error', 'Failed to contact Flutterwave');
  END IF;

  flw_data := flw_response.content::json;

  IF flw_data->'data'->>'status' IS DISTINCT FROM 'successful' THEN
    RETURN json_build_object('success', false, 'error', 'Payment not successful');
  END IF;

  IF flw_data->'data'->>'currency' IS DISTINCT FROM 'NGN'
     OR (flw_data->'data'->>'amount')::numeric < v_order.total_amount THEN
    RETURN json_build_object('success', false, 'error', 'Payment amount does not match order');
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid',
         payment_id = v_transaction_id
   WHERE id = v_order_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN others THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_payment_flutterwave(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_payment_flutterwave(text, uuid) TO authenticated;
