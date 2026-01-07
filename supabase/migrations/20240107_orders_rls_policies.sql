-- Add RLS policies for orders table to allow admin/staff access

-- Enable RLS on orders table (if not already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow customers to view their own orders
CREATE POLICY "Customers can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id);

-- Allow customers to insert their own orders
CREATE POLICY "Customers can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update any order
CREATE POLICY "Admins can update all orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow staff to view orders
CREATE POLICY "Staff can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('staff', 'courier')
    )
  );

-- Allow staff to update orders (for status changes)
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('staff', 'courier')
    )
  );

-- Allow couriers to update orders assigned to them
CREATE POLICY "Couriers can update their assigned orders"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = courier_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'courier'
    )
  );
