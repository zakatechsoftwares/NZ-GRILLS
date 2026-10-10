-- Cancel card orders whose payment was closed or failed.
--
-- 1. cancel_unpaid_order(order_id): the customer who owns a pending, unpaid
--    order can mark it cancelled/failed (customers cannot update orders
--    directly).
-- 2. verify_payment_flutterwave: if Flutterwave confirms a payment for an
--    order that was cancelled this way (e.g. the checkout "closed" event
--    raced the success callback), the payment wins and the order goes back
--    to pending so the kitchen sees it. Otherwise unchanged from
--    20240109_fix_security_triggers_and_payment.sql.

-- ---------------------------------------------------------------------------
-- 1. Cancel an unpaid order
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_unpaid_order(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.orders o
     SET status = 'cancelled',
         payment_status = 'failed'
   WHERE o.id = cancel_unpaid_order.order_id
     AND o.customer_id = auth.uid()
     AND o.status = 'pending'
     AND o.payment_status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_unpaid_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_unpaid_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payment verification: restore cancelled orders on confirmed payment
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
         payment_id = v_transaction_id,
         status = CASE WHEN status = 'cancelled' THEN 'pending' ELSE status END
   WHERE id = v_order_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN others THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_payment_flutterwave(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_payment_flutterwave(text, uuid) TO authenticated;
