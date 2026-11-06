-- Account deletion (required by Google Play for apps with sign-up).
--
-- delete_my_account() removes the caller's login, profile, addresses,
-- favorites, reviews, notifications and courier offers. Their orders are kept
-- for sales records but anonymised: customer link, delivery address, notes and
-- review text are removed.
--
-- To make that possible, every foreign key to profiles / auth.users gets an
-- explicit ON DELETE rule below. Any foreign key not listed stops this
-- migration with an error instead of being guessed.

-- ---------------------------------------------------------------------------
-- 1. Foreign keys: cascade owned data, detach orders and staff references
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fk record;
  v_rule text;
BEGIN
  FOR fk IN
    SELECT c.conname,
           c.conrelid::regclass AS tbl,
           c.conrelid::regclass::text AS tbl_name,
           a.attname AS col,
           c.confrelid::regclass AS ref_tbl,
           ra.attname AS ref_col
      FROM pg_constraint c
      JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
       AND c.conrelid::regclass::text NOT LIKE 'auth.%'
  LOOP
    v_rule := CASE fk.tbl_name || '.' || fk.col
      WHEN 'profiles.id' THEN 'CASCADE'
      WHEN 'addresses.user_id' THEN 'CASCADE'
      WHEN 'favorites.user_id' THEN 'CASCADE'
      WHEN 'reviews.user_id' THEN 'CASCADE'
      WHEN 'notifications.user_id' THEN 'CASCADE'
      WHEN 'courier_offers.courier_id' THEN 'CASCADE'
      WHEN 'courier_offers.responded_by' THEN 'SET NULL'
      WHEN 'orders.customer_id' THEN 'SET NULL'
      WHEN 'orders.staff_id' THEN 'SET NULL'
      WHEN 'orders.courier_id' THEN 'SET NULL'
      WHEN 'orders.completed_by' THEN 'SET NULL'
    END;

    IF v_rule IS NULL THEN
      RAISE EXCEPTION 'Unhandled foreign key %.% -> % (%); add a rule for it before deleting accounts',
        fk.tbl_name, fk.col, fk.ref_tbl, fk.conname;
    END IF;

    IF v_rule = 'SET NULL' THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', fk.tbl, fk.col);
    END IF;

    -- Recreate with the same name (the app joins on e.g. orders_customer_id_fkey)
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s',
      fk.tbl, fk.conname, fk.col, fk.ref_tbl, fk.ref_col, v_rule);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Delete the caller's account
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_user_role() = 'admin'
     AND (SELECT count(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'You are the only admin. Make another user an admin before deleting your account.';
  END IF;

  -- Keep orders for sales records, without personal details
  UPDATE public.orders
     SET delivery_address = jsonb_build_object('address', 'Deleted account'),
         delivery_notes = NULL,
         review = NULL
   WHERE customer_id = v_user_id;

  -- Cascades to addresses, notifications and courier offers; detaches orders
  -- and staff references
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Cascades to favorites and reviews; removes the login
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
