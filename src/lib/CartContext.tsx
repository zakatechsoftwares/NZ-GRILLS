import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Database } from '../types/supabase';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export interface CartItem extends MenuItem {
  quantity: number;
  instructions?: string;
}

type CartContextType = {
  items: CartItem[];
  addToCart: (item: MenuItem, quantity: number, instructions?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalAmount: number;
  itemCount: number;
};

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalAmount: 0,
  itemCount: 0,
});

export const useCart = () => useContext(CartContext);

// Cart lines are stored in cart_items; the join returns current names, prices
// and photos, and dishes that are no longer available are dropped
async function loadCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select('quantity, instructions, menu_items(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data as any[])
    .filter(row => row.menu_items?.is_available)
    .map(row => ({ ...row.menu_items, quantity: row.quantity, instructions: row.instructions ?? undefined }));
}

async function saveCart(userId: string, items: CartItem[]) {
  if (items.length > 0) {
    const { error } = await supabase.from('cart_items').upsert(
      items.map(item => ({
        user_id: userId,
        menu_item_id: item.id,
        quantity: item.quantity,
        instructions: item.instructions ?? null,
        updated_at: new Date().toISOString(),
      }))
    );
    if (error) throw error;
  }

  let remove = supabase.from('cart_items').delete().eq('user_id', userId);
  if (items.length > 0) remove = remove.not('menu_item_id', 'in', `(${items.map(i => i.id).join(',')})`);
  const { error } = await remove;
  if (error) throw error;
}

const snapshot = (items: CartItem[]) =>
  JSON.stringify(items.map(i => [i.id, i.quantity, i.instructions ?? null]));

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  // Which account's cart is loaded; nothing is saved until it is, so a failed
  // load (e.g. offline) can't overwrite the stored cart with an empty one
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const lastSaved = useRef<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Each account has its own cart in the database; switch to it when the account changes
  useEffect(() => {
    setItems([]);
    setLoadedFor(null);
    if (!userId) return;

    let cancelled = false;
    loadCart(userId)
      .then(loaded => {
        if (cancelled) return;
        lastSaved.current = snapshot(loaded);
        setItems(loaded);
        setLoadedFor(userId);
      })
      .catch(error => console.log('Failed to load cart', error));

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [userId]);

  // Save changes shortly after the last edit
  useEffect(() => {
    if (!userId || loadedFor !== userId) return;
    const current = snapshot(items);
    if (current === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCart(userId, items)
        .then(() => {
          lastSaved.current = current;
        })
        .catch(error => console.log('Failed to save cart', error));
    }, 500);
  }, [items, userId, loadedFor]);

  const addToCart = (item: MenuItem, quantity: number, instructions?: string) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.id === item.id);
      if (existingItem) {
        return prevItems.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity, instructions: instructions ?? i.instructions } : i
        );
      }
      return [...prevItems, { ...item, quantity, instructions }];
    });
    Alert.alert('Added', `${item.name} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((i) => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalAmount,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
