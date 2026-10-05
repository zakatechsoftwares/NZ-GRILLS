-- Server-side pricing: order prices come from menu_items, not the app.
--
-- 1. order_items.unit_price / subtotal are set from menu_items.price on
--    insert, whatever the app sends. Unavailable items and non-positive
--    quantities are rejected.
-- 2. orders.total_amount is recalculated from its items after each insert.
--    verify_payment_flutterwave compares the Flutterwave amount against this
--    total, so an underpaid order cannot be marked paid.
-- 3. Items can only be added while the order is still pending and unpaid.

-- ---------------------------------------------------------------------------
-- 1. Price each item from the menu
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_available boolean;
BEGIN
  SELECT price, coalesce(is_available, true)
    INTO v_price, v_available
    FROM public.menu_items
   WHERE id = new.menu_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu item not found';
  END IF;
  IF NOT v_available THEN
    RAISE EXCEPTION 'Menu item is not available';
  END IF;
  IF new.quantity IS NULL OR new.quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  new.unit_price := v_price;
  new.subtotal := v_price * new.quantity;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_order_item_price ON public.order_items;
CREATE TRIGGER set_order_item_price
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_order_item_price();

-- ---------------------------------------------------------------------------
-- 2. Recalculate the order total
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: runs as the owner, so enforce_order_update_rules lets it
-- change total_amount (customers cannot change it directly).
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders o
     SET total_amount = (
       SELECT coalesce(sum(oi.subtotal), 0)
         FROM public.order_items oi
        WHERE oi.order_id = o.id
     )
   WHERE o.id IN (SELECT DISTINCT order_id FROM new_items);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_order_total ON public.order_items;
CREATE TRIGGER recalculate_order_total
  AFTER INSERT ON public.order_items
  REFERENCING NEW TABLE AS new_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.recalculate_order_total();

-- ---------------------------------------------------------------------------
-- 3. Only add items to your own pending, unpaid order
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert order items." ON public.order_items;
CREATE POLICY "Users can insert order items."
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_items.order_id
         AND o.customer_id = auth.uid()
         AND o.status = 'pending'
         AND o.payment_status = 'pending'
    )
  );
