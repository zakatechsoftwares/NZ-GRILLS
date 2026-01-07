-- Create courier_offers table for courier assignment workflow
CREATE TABLE IF NOT EXISTS public.courier_offers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  courier_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  offered_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  responded_at timestamp with time zone,
  responded_by uuid REFERENCES public.profiles(id), -- Staff who accepted/rejected
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(order_id, courier_id) -- Prevent duplicate offers from same courier
);

-- Add optional tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS courier_assigned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS courier_accepted_at timestamp with time zone;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_courier_offers_order_id ON public.courier_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_courier_offers_courier_id ON public.courier_offers(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_offers_status ON public.courier_offers(status);

-- Enable RLS
ALTER TABLE public.courier_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courier_offers

-- Couriers can view their own offers
CREATE POLICY "Couriers can view their own offers"
  ON public.courier_offers FOR SELECT
  USING (auth.uid() = courier_id);

-- Couriers can create offers for orders without assigned courier
CREATE POLICY "Couriers can create offers"
  ON public.courier_offers FOR INSERT
  WITH CHECK (
    auth.uid() = courier_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'courier'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND courier_id IS NULL AND status = 'ready'
    )
  );

-- Couriers can withdraw their own pending offers
CREATE POLICY "Couriers can withdraw their offers"
  ON public.courier_offers FOR UPDATE
  USING (
    auth.uid() = courier_id 
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = courier_id 
    AND status = 'withdrawn'
  );

-- Staff can view all offers
CREATE POLICY "Staff can view all offers"
  ON public.courier_offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Staff can update offers (accept/reject)
CREATE POLICY "Staff can update offers"
  ON public.courier_offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.courier_offers IS 'Tracks courier offers and assignments for order delivery';
COMMENT ON COLUMN public.courier_offers.status IS 'pending: awaiting staff response, accepted: courier assigned, rejected: offer declined, withdrawn: courier cancelled offer';
COMMENT ON COLUMN public.orders.courier_assigned_at IS 'Timestamp when courier was assigned to order';
COMMENT ON COLUMN public.orders.courier_accepted_at IS 'Timestamp when courier confirmed pickup of order';
