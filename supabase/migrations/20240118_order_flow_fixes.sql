-- Order-to-delivery fixes.
--
-- 1. orders.payment_method ('card' | 'cash'). Card orders are created before
--    the customer pays, so the kitchen could see (and start cooking) orders
--    that were never paid. The app now hides card orders until they are paid.
-- 2. Cash orders are marked paid when they are delivered (the courier
--    collects the money), instead of staying "pending" forever.
-- 3. A courier who withdrew an offer can offer again (the unique
--    order/courier pair made the second offer fail).

-- ---------------------------------------------------------------------------
-- 1. Payment method
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('card', 'cash'));

-- Existing orders that went through Flutterwave
UPDATE public.orders
   SET payment_method = 'card'
 WHERE payment_method = 'cash'
   AND (payment_id IS NOT NULL OR payment_status = 'failed');

-- ---------------------------------------------------------------------------
-- 2. Cash orders are paid on delivery
-- ---------------------------------------------------------------------------

-- Named to run after enforce_order_update_rules (triggers fire in name
-- order), so the courier's status change is checked first.
CREATE OR REPLACE FUNCTION public.set_cash_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF new.status = 'delivered'
     AND old.status IS DISTINCT FROM 'delivered'
     AND new.payment_method = 'cash'
     AND new.payment_status = 'pending' THEN
    new.payment_status := 'paid';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_cash_order_paid ON public.orders;
CREATE TRIGGER set_cash_order_paid
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_cash_order_paid();

-- Cash orders already delivered
UPDATE public.orders
   SET payment_status = 'paid'
 WHERE payment_method = 'cash'
   AND status = 'delivered'
   AND payment_status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. Couriers can renew a withdrawn offer
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Couriers can renew withdrawn offers" ON public.courier_offers;
CREATE POLICY "Couriers can renew withdrawn offers"
  ON public.courier_offers FOR UPDATE
  USING (
    auth.uid() = courier_id
    AND status = 'withdrawn'
  )
  WITH CHECK (
    auth.uid() = courier_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = courier_offers.order_id
         AND o.courier_id IS NULL
         AND o.status = 'ready'
    )
  );
