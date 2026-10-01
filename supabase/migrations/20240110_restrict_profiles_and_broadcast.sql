-- Restrict profile visibility and lock down broadcast notifications.
--
-- 1. broadcast_notification was callable by anyone (including anon) and
--    inserted a notification for every user. Admins only now.
-- 2. Profiles were readable by everyone, exposing emails, phones and push
--    tokens. Now:
--      - users see their own profile
--      - staff/admin see all profiles
--      - couriers see customers of orders assigned to them
--      - customers see couriers assigned to their orders
--    Push token columns are not readable by app users at all (the
--    push-notification edge function uses the service role).

-- ---------------------------------------------------------------------------
-- 1. Broadcast: admins only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.broadcast_notification(
    title text,
    body text,
    data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF coalesce(public.current_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'Only admins can broadcast notifications';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, data)
    SELECT p.id, broadcast_notification.title, broadcast_notification.body, broadcast_notification.data
    FROM public.profiles p;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_notification(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profiles: row visibility
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the policy can look at orders without triggering
-- orders policies (which query profiles) and recursing.
CREATE OR REPLACE FUNCTION public.shares_order_with(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE (o.customer_id = auth.uid() AND o.courier_id = profile_id)
        OR (o.courier_id = auth.uid() AND o.customer_id = profile_id)
  );
$$;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view permitted profiles" ON public.profiles;

CREATE POLICY "Users can view permitted profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() IN ('admin', 'staff')
    OR public.shares_order_with(id)
  );

-- ---------------------------------------------------------------------------
-- 2b. Profiles: hide push token columns from app users
-- ---------------------------------------------------------------------------
-- Column grants: new profile columns must be added to this list to be
-- readable from the app.

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, role, full_name, phone, avatar_url, email, created_at, updated_at)
  ON public.profiles TO authenticated;
