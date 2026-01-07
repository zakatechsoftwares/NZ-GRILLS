import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import PremiumInput from '../../components/PremiumInput';
import { getCategories, deleteCategory, reorderCategory } from '../../lib/api/categories';

type Category = Database['public']['Tables']['categories']['Row'];

export default function ManageCategoriesScreen() {
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories(false); // Get all categories including inactive
      setCategories(data);
      setFilteredCategories(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    const unsubscribe = navigation.addListener('focus', fetchCategories);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCategories(categories);
    } else {
      const filtered = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [searchQuery, categories]);

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              Alert.alert('Success', 'Category deleted successfully');
              fetchCategories();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleReorder = async (category: Category, direction: 'up' | 'down') => {
    try {
      await reorderCategory(category.id, direction);
      fetchCategories();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderItem = ({ item, index }: { item: Category; index: number }) => (
    <PremiumCard style={styles.card}>
      <View style={styles.orderBadge}>
        <Text style={styles.orderText}>#{item.display_order}</Text>
      </View>

      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
        style={styles.image}
      />

      <View style={styles.details}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.is_active ? COLORS.success + '20' : COLORS.error + '20' }
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.is_active ? COLORS.success : COLORS.error }
              ]}
            >
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => handleReorder(item, 'up')}
          style={[styles.actionBtn, index === 0 && styles.actionBtnDisabled]}
          disabled={index === 0}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={index === 0 ? COLORS.textLight : COLORS.info}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReorder(item, 'down')}
          style={[styles.actionBtn, index === filteredCategories.length - 1 && styles.actionBtnDisabled]}
          disabled={index === filteredCategories.length - 1}
        >
          <Ionicons
            name="arrow-down"
            size={20}
            color={index === filteredCategories.length - 1 ? COLORS.textLight : COLORS.info}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('EditCategory', { category: item })}
          style={styles.actionBtn}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </PremiumCard>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Categories</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditCategory')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <PremiumInput
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Ionicons name="search" size={20} color={COLORS.textSecondary} />}
        />
      </View>

      <FlatList
        data={filteredCategories}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchCategories} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No categories found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Tap + to create your first category'}
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
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  backButton: {
    padding: SPACING.s,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.s,
  },
  list: {
    padding: SPACING.m,
    paddingBottom: 100,
  },
  card: {
    marginBottom: SPACING.m,
    flexDirection: 'row',
    padding: SPACING.s,
    alignItems: 'center',
  },
  orderBadge: {
    position: 'absolute',
    top: SPACING.s,
    left: SPACING.s,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  orderText: {
    color: COLORS.textInverse,
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radiusSm,
    marginRight: SPACING.m,
    backgroundColor: COLORS.surfaceHighlight,
  },
  details: {
    flex: 1,
  },
  name: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  actions: {
    justifyContent: 'space-between',
    height: 80,
    paddingLeft: SPACING.s,
  },
  actionBtn: {
    padding: 4,
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
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
