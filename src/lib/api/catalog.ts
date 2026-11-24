import { supabase } from '../supabase';
import { createCategory, getCategories } from './categories';

// Free fake-data API (no key) used to fill the menu quickly for demos
const CATALOG_URL =
  'https://dummyjson.com/recipes?limit=0&select=name,image,cuisine,mealType,prepTimeMinutes,cookTimeMinutes,ingredients';

export interface CatalogDish {
  id: number;
  name: string;
  image: string;
  cuisine: string;
  category: string;
  description: string;
  preparationTime: number;
  suggestedPrice: number;
}

// The API has no prices; suggest a Naira price by meal type, varied per dish
const BASE_PRICE: Record<string, number> = {
  Beverage: 1500,
  Snack: 2000,
  Appetizer: 2500,
  Dessert: 2500,
  Breakfast: 3000,
  'Side Dish': 2000,
  Lunch: 4000,
  Dinner: 5000,
};

export async function fetchCatalog(): Promise<CatalogDish[]> {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`Catalog unavailable (HTTP ${response.status})`);
  const { recipes } = await response.json();

  return recipes.map((recipe: any): CatalogDish => {
    const category = recipe.mealType?.[0] || 'Other';
    return {
      id: recipe.id,
      name: recipe.name,
      image: recipe.image,
      cuisine: recipe.cuisine,
      category,
      description: `${recipe.cuisine} · ${recipe.ingredients.slice(0, 4).join(', ')}`,
      preparationTime: (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0),
      suggestedPrice: (BASE_PRICE[category] ?? 3000) + (recipe.id % 5) * 250,
    };
  });
}

export async function getMenuItemNames(): Promise<Set<string>> {
  const { data, error } = await supabase.from('menu_items').select('name');
  if (error) throw error;
  return new Set((data || []).map(item => item.name.trim().toLowerCase()));
}

// Adds dishes to menu_items, creating any missing categories by name
export async function importDishes(dishes: { dish: CatalogDish; price: number }[]): Promise<number> {
  const categories = await getCategories();
  const categoryIds = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.id]));

  for (const { dish } of dishes) {
    const key = dish.category.toLowerCase();
    if (!categoryIds.has(key)) {
      const created = await createCategory({ name: dish.category, image_url: dish.image });
      categoryIds.set(key, created.id);
    }
  }

  const rows = dishes.map(({ dish, price }) => ({
    name: dish.name,
    description: dish.description,
    price,
    image_url: dish.image,
    category_id: categoryIds.get(dish.category.toLowerCase())!,
    preparation_time: dish.preparationTime || null,
    is_available: true,
  }));

  const { error } = await supabase.from('menu_items').insert(rows);
  if (error) throw error;
  return rows.length;
}
