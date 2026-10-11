-- Account settings: notification preferences and saved addresses.
--
-- 1. profiles.notify_push / notify_promotions preferences, readable by the
--    user (column grants from 20240110 hide other new columns by default).
-- 2. broadcast_notification skips users who opted out of promotions.
-- 3. addresses: table already exists in production (created outside
--    migrations); recorded here for fresh installs, with RLS so each user
--    only sees and edits their own.

-- ---------------------------------------------------------------------------
-- 1. Notification preferences
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_promotions boolean NOT NULL DEFAULT true;

GRANT SELECT (notify_push, notify_promotions) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Broadcasts respect the promotions preference
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
    FROM public.profiles p
    WHERE p.notify_promotions;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_notification(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Saved addresses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can add own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;

CREATE POLICY "Users can view own addresses"
  ON public.addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = user_id);
