-- Add rating and review columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS review TEXT;

-- Policy to allow customers to update their own order with rating
CREATE POLICY "Customers can rate their own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);
