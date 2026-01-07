# Canteen App Setup Guide

## 1. Prerequisites
- Node.js installed
- Expo CLI installed
- Supabase Account

## 2. Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory (copied from `.env.example` if available) and add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Database Setup**
   - Go to your Supabase Dashboard -> SQL Editor.
   - Run the contents of `supabase_schema.sql` located in this project's root.
   - This will create all necessary tables (Profiles, Orders, Menu Items, etc.) and Row Level Security policies.

## 3. Running the App

   ```bash
   npx expo start
   ```
   - Scan the QR code with your phone (Expo Go app) or press `a` for Android Emulator / `i` for iOS Simulator.

## 4. Usage Roles

- **Customer**: Sign up normally.
- **Admin/Staff/Courier**: Sign up, then manually update your role in the Supabase `profiles` table to 'admin', 'staff', or 'courier'. (Or use the Admin panel later if user management is added).

## 5. Features

- **Customer**: Browse menu, add to cart, checkout, view order history.
- **Staff**: View incoming orders, update status to 'Preparing' -> 'Ready'.
- **Courier**: See 'Ready' orders, accept delivery, mark as 'Delivered'.
- **Admin**: View stats, add/edit menu items.
