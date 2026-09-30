-- Security hardening: close privilege-escalation and payment-tampering holes.
--
-- 1. New signups are always 'customer'; roles are granted by an admin only.
-- 2. Users cannot change their own role.
-- 3. Customers cannot create orders as paid or edit orders after placing them
--    (other than rating/review).
-- 4. Couriers can only update orders assigned to them, and only delivery fields.
--
-- Restrictions below apply to requests made directly by app users (the
-- 'authenticated' / 'anon' database roles). SECURITY DEFINER functions, the
-- service role and the SQL editor are not affected.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_app_user_request()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user IN ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------------
-- 1. Signup trigger ignores client-supplied role
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'customer',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Profiles: only admins may change roles
-- ---------------------------------------------------------------------------

-- The original policy (with trailing period) had no WITH CHECK and was never
-- dropped, so it OR-ed with the stricter one and allowed self-promotion.
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.enforce_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_app_user_request()
     AND new.role IS DISTINCT FROM old.role
     AND coalesce(public.current_user_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_role_change ON public.profiles;
CREATE TRIGGER enforce_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_change();

-- Also block setting a privileged role on a directly inserted profile row.
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND coalesce(role, 'customer') = 'customer');

-- ---------------------------------------------------------------------------
-- 3 & 4. Orders
-- ---------------------------------------------------------------------------

-- Customers may only create unpaid, unassigned, pending orders.
DROP POLICY IF EXISTS "Users can insert their own orders." ON public.orders;
DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;

CREATE POLICY "Customers can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND status = 'pending'
    AND payment_status = 'pending'
    AND courier_id IS NULL
    AND staff_id IS NULL
    AND completed_by IS NULL
    AND rating IS NULL
  );

-- Replace the overly broad update policies.
DROP POLICY IF EXISTS "Customers can rate their own orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update their assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;

CREATE POLICY "Customers can rate their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Couriers can update their assigned orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = courier_id AND public.current_user_role() = 'courier')
  WITH CHECK (auth.uid() = courier_id);

-- Staff/admin update access remains via "Staff and Admin can update orders."
-- and "Admins can update all orders". Recreate the former in case it is missing.
DROP POLICY IF EXISTS "Staff and Admin can update orders." ON public.orders;
CREATE POLICY "Staff and Admin can update orders."
  ON public.orders FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'staff'));

-- Column-level rules per role (RLS alone cannot restrict columns).
CREATE OR REPLACE FUNCTION public.enforce_order_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actor_role text := public.current_user_role();
  old_rest jsonb;
  new_rest jsonb;
BEGIN
  IF NOT public.is_app_user_request() OR actor_role = 'admin' THEN
    RETURN new;
  END IF;

  IF actor_role = 'staff' THEN
    IF new.customer_id IS DISTINCT FROM old.customer_id
       OR new.total_amount IS DISTINCT FROM old.total_amount
       OR new.rating IS DISTINCT FROM old.rating
       OR new.review IS DISTINCT FROM old.review
       OR to_jsonb(new)->'payment_id' IS DISTINCT FROM to_jsonb(old)->'payment_id'
       OR new.payment_intent_id IS DISTINCT FROM old.payment_intent_id THEN
      RAISE EXCEPTION 'Staff cannot modify customer, amount, payment reference or rating fields';
    END IF;
    RETURN new;
  END IF;

  IF actor_role = 'courier' AND old.courier_id = auth.uid() THEN
    old_rest := to_jsonb(old) - 'status' - 'courier_latitude' - 'courier_longitude'
                - 'location_updated_at' - 'courier_accepted_at' - 'updated_at';
    new_rest := to_jsonb(new) - 'status' - 'courier_latitude' - 'courier_longitude'
                - 'location_updated_at' - 'courier_accepted_at' - 'updated_at';
    IF new_rest IS DISTINCT FROM old_rest THEN
      RAISE EXCEPTION 'Couriers can only update delivery status and location';
    END IF;
    IF new.status IS DISTINCT FROM old.status
       AND new.status NOT IN ('out_for_delivery', 'delivered') THEN
      RAISE EXCEPTION 'Couriers can only set status to out_for_delivery or delivered';
    END IF;
    RETURN new;
  END IF;

  IF old.customer_id = auth.uid() THEN
    old_rest := to_jsonb(old) - 'rating' - 'review' - 'updated_at';
    new_rest := to_jsonb(new) - 'rating' - 'review' - 'updated_at';
    IF new_rest IS DISTINCT FROM old_rest THEN
      RAISE EXCEPTION 'Customers can only add a rating or review to their orders';
    END IF;
    IF old.status <> 'delivered' THEN
      RAISE EXCEPTION 'Only delivered orders can be rated';
    END IF;
    RETURN new;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this order';
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_update_rules ON public.orders;
CREATE TRIGGER enforce_order_update_rules
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_update_rules();
