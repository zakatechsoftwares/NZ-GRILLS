-- RLS Policy for Admin Role Management
-- This allows admins to update user roles in the profiles table

-- First, ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow admins to update any user's role
CREATE POLICY "Admins can update user roles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow users to view all profiles (needed for search functionality)
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Allow users to update their own profile (name, avatar, etc - but not role)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
