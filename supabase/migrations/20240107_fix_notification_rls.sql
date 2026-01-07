-- Fix RLS policy for notifications to allow staff/couriers to create notifications for customers

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)" ON public.notifications;

-- Allow users to view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications (mark as read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow staff, couriers, and admins to insert notifications for any user
CREATE POLICY "Staff can create notifications for customers"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role IN ('staff', 'courier', 'admin')
    )
  );
