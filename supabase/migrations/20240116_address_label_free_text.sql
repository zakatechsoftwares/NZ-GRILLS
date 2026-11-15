-- The addresses table (created outside migrations) only allowed the labels
-- 'Home', 'Work' and 'Other', but the app lets users type a label and
-- suggests 'Hostel' and 'Office', so saving failed with
-- addresses_label_check. Allow any non-blank label up to 40 characters.

ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_label_check;

ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_label_check
  CHECK (length(btrim(label)) BETWEEN 1 AND 40);
