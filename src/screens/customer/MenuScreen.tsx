import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';
import PremiumInput from '../../components/PremiumInput';
import PremiumCard from '../../components/PremiumCard';
import { toggleFavorite, getFavorites } from '../../lib/api/engagement';

type Category = Database['public']['Tables']['categories']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
    fetchFavorites();
  }, []);

  useEffect(() => {
    filterItems();
  }, [selectedCategory, searchQuery, menuItems]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('menu_items').select('*').eq('is_available', true).order('name')
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setMenuItems(itemsRes.data || []);
      setFilteredItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    const favs = await getFavorites();
    setFavoriteIds(new Set(favs.map(f => f.menu_item_id)));
  };

  const handleToggleFavorite = async (itemId: string) => {
    // Optimistic update
    const newFavs = new Set(favoriteIds);
    if (newFavs.has(itemId)) {
      newFavs.delete(itemId);
    } else {
      newFavs.add(itemId);
    }
    setFavoriteIds(newFavs);
    
    await toggleFavorite(itemId);
  };

  const filterItems = () => {
    let filtered = menuItems;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category_id === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  };

  const renderCategoryChip = ({ item }: { item: Category | { id: string; name: string } }) => (
    <TouchableOpacity
      style={[styles.categoryChip, selectedCategory === item.id && styles.categoryChipActive]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Text style={[styles.categoryChipText, selectedCategory === item.id && styles.categoryChipTextActive]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity onPress={() => navigation.navigate('ItemDetail', { item })}>
      <PremiumCard style={styles.itemCard}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="fast-food" size={40} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
          )}
          <Text style={styles.itemPrice}>₦{item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.surface }]}
            onPress={(e) => {
               e.stopPropagation();
               handleToggleFavorite(item.id);
            }}
          >
            <Ionicons 
              name={favoriteIds.has(item.id) ? "heart" : "heart-outline"} 
              size={20} 
              color={COLORS.error} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
               e.stopPropagation();
               // logic to add to cart
            }}
          >
            <Ionicons name="add" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
      </PremiumCard>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { marginLeft: SPACING.s }]}>Menu</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Favorites')} style={styles.headerButton}>
            <Ionicons name="heart-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.headerButton}>
            <Ionicons name="cart-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <PremiumInput
          placeholder="Search menu..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Ionicons name="search" size={20} color={COLORS.textSecondary} />}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          data={[{ id: 'all', name: 'All' }, ...categories]}
          renderItem={renderCategoryChip}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Check back later for new items'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  backButton: {
    padding: SPACING.s,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  cartButton: {
    padding: SPACING.s,
  },
  searchContainer: {
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.s,
  },
  categoryContainer: {
    marginBottom: SPACING.m,
  },
  categoryList: {
    paddingHorizontal: SPACING.m,
  },
  categoryChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: COLORS.textInverse,
    fontFamily: FONTS.bold,
  },
  listContent: {
    paddingHorizontal: SPACING.m,
    paddingBottom: 100,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.s,
    marginBottom: SPACING.m,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.surfaceHighlight,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.m,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  itemDescription: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  itemPrice: {
    ...FONTS.h4,
    color: COLORS.primary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  actions: {
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  headerButton: {
    padding: SPACING.s,
    marginLeft: SPACING.s,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    marginTop: SPACING.xxl,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
  },
  emptySubtext: {
    ...FONTS.body2,
    color: COLORS.textLight,
    marginTop: SPACING.s,
  },
});
