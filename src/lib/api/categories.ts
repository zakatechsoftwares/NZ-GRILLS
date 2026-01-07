import { supabase } from '../supabase';
import { Database } from '../../types/supabase';
import { decode } from 'base64-arraybuffer';

type Category = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export interface CategoryFormData {
  name: string;
  description?: string;
  image_url?: string;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Get all categories ordered by display_order
 */
export async function getCategories(activeOnly: boolean = false) {
  let query = supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return data as Category[];
}

/**
 * Get a single category by ID
 */
export async function getCategoryById(id: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Upload category image to storage
 */
export async function uploadCategoryImage(base64: string): Promise<string> {
  const fileName = `${Date.now()}.jpg`;
  const filePath = `${fileName}`;
  const contentType = 'image/jpeg';

  const { data, error } = await supabase.storage
    .from('category-images')
    .upload(filePath, decode(base64), { contentType });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('category-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Create a new category
 */
export async function createCategory(categoryData: CategoryFormData) {
  // Get the highest display_order and add 1
  const { data: categories } = await supabase
    .from('categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = categories && categories.length > 0 
    ? (categories[0].display_order || 0) + 1 
    : 1;

  const newCategory: CategoryInsert = {
    name: categoryData.name,
    description: categoryData.description || null,
    image_url: categoryData.image_url || null,
    display_order: categoryData.display_order ?? nextOrder,
    is_active: categoryData.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('categories')
    .insert(newCategory)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Update an existing category
 */
export async function updateCategory(id: string, categoryData: Partial<CategoryFormData>) {
  const updateData: CategoryUpdate = {
    ...(categoryData.name && { name: categoryData.name }),
    ...(categoryData.description !== undefined && { description: categoryData.description }),
    ...(categoryData.image_url !== undefined && { image_url: categoryData.image_url }),
    ...(categoryData.display_order !== undefined && { display_order: categoryData.display_order }),
    ...(categoryData.is_active !== undefined && { is_active: categoryData.is_active }),
  };

  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Delete a category
 * Checks if any menu items are using this category first
 */
export async function deleteCategory(id: string) {
  // Check if any menu items use this category
  const { data: menuItems, error: checkError } = await supabase
    .from('menu_items')
    .select('id')
    .eq('category_id', id)
    .limit(1);

  if (checkError) {
    throw new Error(`Failed to check category usage: ${checkError.message}`);
  }

  if (menuItems && menuItems.length > 0) {
    throw new Error('Cannot delete category that has menu items. Please reassign or delete the menu items first.');
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }

  return true;
}

/**
 * Reorder a category (move up or down)
 */
export async function reorderCategory(id: string, direction: 'up' | 'down') {
  // Get current category
  const currentCategory = await getCategoryById(id);
  const currentOrder = currentCategory.display_order || 0;

  // Get all categories
  const allCategories = await getCategories();

  if (direction === 'up') {
    // Find the category with the next lower display_order
    const targetCategory = allCategories
      .filter(cat => (cat.display_order || 0) < currentOrder)
      .sort((a, b) => (b.display_order || 0) - (a.display_order || 0))[0];

    if (!targetCategory) {
      throw new Error('Category is already at the top');
    }

    // Swap display_orders
    await Promise.all([
      updateCategory(id, { display_order: targetCategory.display_order }),
      updateCategory(targetCategory.id, { display_order: currentOrder }),
    ]);
  } else {
    // Find the category with the next higher display_order
    const targetCategory = allCategories
      .filter(cat => (cat.display_order || 0) > currentOrder)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0];

    if (!targetCategory) {
      throw new Error('Category is already at the bottom');
    }

    // Swap display_orders
    await Promise.all([
      updateCategory(id, { display_order: targetCategory.display_order }),
      updateCategory(targetCategory.id, { display_order: currentOrder }),
    ]);
  }

  return true;
}
