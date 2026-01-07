-- Add courier location tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS courier_latitude decimal,
ADD COLUMN IF NOT EXISTS courier_longitude decimal,
ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Create index for faster location queries
CREATE INDEX IF NOT EXISTS idx_orders_courier_location 
ON public.orders(courier_id, location_updated_at) 
WHERE courier_latitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.courier_latitude IS 'Real-time latitude of courier during delivery';
COMMENT ON COLUMN public.orders.courier_longitude IS 'Real-time longitude of courier during delivery';
COMMENT ON COLUMN public.orders.location_updated_at IS 'Timestamp of last GPS update';
