-- Add start_date and end_date to promotions
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS start_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_date timestamp with time zone DEFAULT (now() + interval '7 days');

-- Update RLS to check dates (optional, but good practice)
-- DROP POLICY IF EXISTS "everyone can view active promotions" ON public.promotions;

-- CREATE POLICY "everyone can view active promotions"
--   ON public.promotions FOR SELECT
--   USING (is_active = true AND now() >= start_date AND now() <= end_date);
