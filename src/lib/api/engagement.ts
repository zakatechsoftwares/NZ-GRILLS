import { supabase } from '../supabase';

// Types
export interface Favorite {
  id: string;
  user_id: string;
  menu_item_id: string;
  created_at: string;
  menu_items?: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    category_id: string;
    is_available: boolean;
  };
}

export interface Review {
  id: string;
  user_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

// Favorites API
export const toggleFavorite = async (menuItemId: string): Promise<{ isFavorited: boolean; error: any }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if exists
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('menu_item_id', menuItemId)
      .single();

    if (existing) {
      // Remove
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id);
      return { isFavorited: false, error };
    } else {
      // Add
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, menu_item_id: menuItemId });
      return { isFavorited: true, error };
    }
  } catch (error) {
    return { isFavorited: false, error };
  }
};

export const getFavorites = async (): Promise<Favorite[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('*, menu_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }

  return data as Favorite[];
};

export const checkIsFavorite = async (menuItemId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('menu_item_id', menuItemId)
    .single();

  return !!data;
};

// Reviews API
export const submitReview = async (orderId: string, rating: number, comment: string): Promise<{ success: boolean; error: any }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        order_id: orderId,
        rating,
        comment
      });

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
};

export const getItemReviews = async (menuItemId: string): Promise<Review[]> => {
  // This is tricky because reviews are linked to ORDERS, not ITEMS directly in our schema design.
  // Ideally, we'd query reviews where order.order_items.menu_item_id = menuItemId
  // For MVP, we might skip "Item Reviews" unless we join tables heavily.
  // Alternative: Show "Recent Reviews" for the specific item if we had menu_item_id in reviews, but we put order_id.
  
  // Let's stick to Order Reviews for now.
  return [];
};
