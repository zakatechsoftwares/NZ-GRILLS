import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import PremiumInput from '../../components/PremiumInput';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function ManageMenuScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes] = await Promise.all([
        supabase.from('menu_items').select('*').order('name'),
        supabase.from('categories').select('*').order('display_order')
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catRes.error) throw catRes.error;

      setItems(itemsRes.data || []);
      setCategories(catRes.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation]);

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !item.is_available })
        .eq('id', item.id);

      if (error) throw error;
      
      // Update local state
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, is_available: !item.is_available } : i
      ));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteItem = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('menu_items')
                .delete()
                .eq('id', item.id);
              
              if (error) throw error;
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderItem = ({ item }: { item: MenuItem }) => (
    <PremiumCard style={styles.card}>
      <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
      <View style={styles.details}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>₦{item.price.toFixed(2)}</Text>
        <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: item.is_available ? COLORS.success + '20' : COLORS.error + '20' }]}>
                <Text style={[styles.statusText, { color: item.is_available ? COLORS.success : COLORS.error }]}>
                    {item.is_available ? 'In Stock' : 'Unavailable'}
                </Text>
            </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => navigation.navigate('EditMenuItem', { item })} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleAvailability(item)} style={styles.actionBtn}>
            <Ionicons name={item.is_available ? "eye-off-outline" : "eye-outline"} size={24} color={COLORS.warning} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteItem(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={24} color={COLORS.error} />
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
        <Text style={styles.title}>Manage Menu</Text>
        <TouchableOpacity onPress={() => navigation.navigate('EditMenuItem')} style={styles.addButton}>
          <Ionicons name="add" size={24} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <PremiumInput
            placeholder="Search items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Ionicons name="search" size={20} color={COLORS.textSecondary} />}
        />
      </View>

      <View style={styles.categoryScroll}>
        <FlatList
          horizontal
          data={[{ id: 'all', name: 'All' } as any, ...categories]}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.catChip, selectedCategory === item.id && styles.catChipActive]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text style={[styles.catText, selectedCategory === item.id && styles.catTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.m }}
        />
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
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
  categoryScroll: {
    marginBottom: SPACING.m,
  },
  catChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  catTextActive: {
    color: COLORS.textInverse,
    fontFamily: FONTS.bold,
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
  image: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radiusSm,
    marginRight: SPACING.m,
  },
  details: {
    flex: 1,
  },
  name: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  price: {
    ...FONTS.h3,
    color: COLORS.primary,
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
});
