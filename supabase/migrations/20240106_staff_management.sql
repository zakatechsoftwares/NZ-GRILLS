-- Add completed_by column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id);

-- Function to get staff performance metrics
CREATE OR REPLACE FUNCTION public.get_staff_performance()
RETURNS TABLE (
    staff_id uuid,
    staff_name text,
    total_orders bigint,
    avg_prep_time interval
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as staff_id,
        COALESCE(p.full_name, 'Unknown Staff') as staff_name,
        COUNT(o.id) as total_orders,
        AVG(o.updated_at - o.created_at) as avg_prep_time
    FROM public.orders o
    JOIN public.profiles p ON o.completed_by = p.id
    WHERE o.status IN ('ready', 'completed', 'picked_up')
    GROUP BY p.id, p.full_name
    ORDER BY total_orders DESC;
END;
$$;
