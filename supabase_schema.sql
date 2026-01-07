-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  role text check (role in ('customer', 'staff', 'admin', 'courier')) default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create Categories Table
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  image_url text,
  display_order integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on categories
alter table public.categories enable row level security;

create policy "Categories are viewable by everyone."
  on categories for select
  using ( true );

create policy "Only admin can insert/update/delete categories."
  on categories for all
  using ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

-- Create Menu Items Table
create table public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  category_id uuid references public.categories(id) not null,
  name text not null,
  description text,
  price decimal(10,2) not null,
  image_url text,
  is_available boolean default true,
  preparation_time integer, -- in minutes
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on menu_items
alter table public.menu_items enable row level security;

create policy "Menu items are viewable by everyone."
  on menu_items for select
  using ( true );

create policy "Only admin/staff can manage menu items."
  on menu_items for all
  using ( exists ( select 1 from profiles where id = auth.uid() and role in ('admin', 'staff') ) );

-- Create Orders Table
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.profiles(id) not null,
  staff_id uuid references public.profiles(id),
  courier_id uuid references public.profiles(id),
  status text check (status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')) default 'pending',
  total_amount decimal(10,2) not null,
  payment_status text check (payment_status in ('pending', 'paid', 'failed', 'refunded')) default 'pending',
  payment_intent_id text,
  delivery_address jsonb,
  delivery_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on orders
alter table public.orders enable row level security;

create policy "Users can view their own orders."
  on orders for select
  using ( auth.uid() = customer_id );

create policy "Staff and Admin can view all orders."
  on orders for select
  using ( exists ( select 1 from profiles where id = auth.uid() and role in ('admin', 'staff') ) );

create policy "Users can insert their own orders."
  on orders for insert
  with check ( auth.uid() = customer_id );

create policy "Staff and Admin can update orders."
  on orders for update
  using ( exists ( select 1 from profiles where id = auth.uid() and role in ('admin', 'staff') ) );

-- Create Order Items Table
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) not null,
  menu_item_id uuid references public.menu_items(id) not null,
  quantity integer not null,
  unit_price decimal(10,2) not null,
  subtotal decimal(10,2) not null,
  special_instructions text
);

-- Enable RLS on order_items
alter table public.order_items enable row level security;

create policy "Users can view their own order items."
  on order_items for select
  using ( exists ( select 1 from orders where id = order_items.order_id and customer_id = auth.uid() ) );

create policy "Staff/Admin can view order items."
  on order_items for select
  using ( exists ( select 1 from profiles where id = auth.uid() and role in ('admin', 'staff') ) );

create policy "Users can insert order items."
  on order_items for insert
  with check ( exists ( select 1 from orders where id = order_items.order_id and customer_id = auth.uid() ) );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert dummy categories
insert into categories (name, description, display_order) values
('Burgers', 'Juicy grilled burgers', 1),
('Beverages', 'Cold and hot drinks', 2),
('Snacks', 'Quick bites and sides', 3);

-- Insert dummy menu items (assuming UUIDs are generated, but for script we need to know them, so this is just illustrative)
-- In a real scenario, you'd insert them via the app or admin panel. 
