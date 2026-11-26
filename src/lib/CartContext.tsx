import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const cartKey = (userId: string) => `cart:${userId}`;

// A saved cart may be days old: take current names, prices and photos from the
// menu, and drop dishes that were removed or made unavailable
async function refreshFromMenu(saved: CartItem[]): Promise<CartItem[]> {
  if (saved.length === 0) return saved;
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .in('id', saved.map(item => item.id))
    .eq('is_available', true);
  if (error) return saved;
  const current = new Map((data as MenuItem[]).map(item => [item.id, item]));
  return saved
    .filter(item => current.has(item.id))
    .map(item => ({ ...current.get(item.id)!, quantity: item.quantity, instructions: item.instructions }));
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  // Which account's saved cart is loaded; nothing is saved until it is
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Each account has its own saved cart; switch to it when the account changes
  useEffect(() => {
    setItems([]);
    setLoadedFor(null);
    if (!userId) return;

    let cancelled = false;
    (async () => {
      let saved: CartItem[] = [];
      try {
        const raw = await AsyncStorage.getItem(cartKey(userId));
        saved = raw ? JSON.parse(raw) : [];
      } catch {
        saved = [];
      }
      const refreshed = await refreshFromMenu(saved).catch(() => saved);
      if (cancelled) return;
      setItems(refreshed);
      setLoadedFor(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedFor !== userId) return;
    AsyncStorage.setItem(cartKey(userId), JSON.stringify(items)).catch(() => {});
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
