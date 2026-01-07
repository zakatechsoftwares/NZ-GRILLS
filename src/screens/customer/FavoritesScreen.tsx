import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import PremiumCard from '../../components/PremiumCard';
import { getFavorites, toggleFavorite, Favorite } from '../../lib/api/engagement';
import { useCart } from '../../lib/CartContext';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { addToCart } = useCart();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = async () => {
    try {
      const data = await getFavorites();
      setFavorites(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const handleRemove = async (itemId: string) => {
    // Optimistic update
    setFavorites(prev => prev.filter(f => f.menu_item_id !== itemId));
    await toggleFavorite(itemId);
  };

  const renderItem = ({ item }: { item: Favorite }) => {
    const menuItem = item.menu_items;
    if (!menuItem) return null;

    return (
      <PremiumCard style={styles.card}>
        <Image source={{ uri: menuItem.image_url }} style={styles.image} />
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.name}>{menuItem.name}</Text>
            <TouchableOpacity onPress={() => handleRemove(menuItem.id)}>
              <Ionicons name="heart" size={24} color={COLORS.error} />
            </TouchableOpacity>
          </View>
          <Text style={styles.description} numberOfLines={2}>{menuItem.description}</Text>
          <View style={styles.footer}>
            <Text style={styles.price}>₦{menuItem.price.toFixed(2)}</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => addToCart(menuItem, 1)}
            >
              <Text style={styles.addButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PremiumCard>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Favorites</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFavorites(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={60} color={COLORS.border} />
              <Text style={styles.emptyText}>No favorites yet</Text>
              <Text style={styles.emptySub}>Save items you love!</Text>
            </View>
          }
        />
      )}
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
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: SPACING.m,
  },
  card: {
    flexDirection: 'row',
    padding: SPACING.s,
    marginBottom: SPACING.m,
    alignItems: 'center',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surfaceHighlight,
  },
  content: {
    flex: 1,
    marginLeft: SPACING.m,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...FONTS.h4,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.s,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: SIZES.radius,
  },
  addButtonText: {
    ...FONTS.body3,
    color: COLORS.textInverse,
    fontFamily: FONTS.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.text,
    marginTop: SPACING.m,
  },
  emptySub: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
});
