-- Function to broadcast a notification to all users
CREATE OR REPLACE FUNCTION public.broadcast_notification(
    title text,
    body text,
    data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres) to bypass RLS on notifications insert for other users
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, data)
    SELECT id, title, body, data
    FROM public.profiles;
END;
$$;
