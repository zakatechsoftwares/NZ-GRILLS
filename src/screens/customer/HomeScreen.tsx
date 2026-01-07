import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';
import PremiumInput from '../../components/PremiumInput';
import PremiumCard from '../../components/PremiumCard';
import Skeleton from '../../components/Skeleton';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '../../lib/AuthContext';

type Category = Database['public']['Tables']['categories']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredItems, setFeaturedItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('menu_items').select('*').eq('is_available', true).limit(5)
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setFeaturedItems(itemsRes.data || []);
      
      // Fetch unread notifications count
      if (user) {
        const countRes = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
          
        setUnreadCount(countRes.count || 0);
      }

    } catch (error) {
      console.error('Error in HomeScreen fetchData:', error);
    } finally {
      // Simulate a bit of network delay to show off skeleton
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const renderCategory = ({ item, index }: { item: Category, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <TouchableOpacity style={styles.categoryCard} onPress={() => navigation.navigate('Menu')}>
        <View style={styles.categoryIcon}>
          <Text style={styles.categoryIconText}>{item.name.charAt(0)}</Text>
        </View>
        <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderFeaturedItem = ({ item, index }: { item: MenuItem, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 150 + 300).duration(500)}>
      <TouchableOpacity onPress={() => navigation.navigate('ItemDetail', { item })}>
        <PremiumCard style={styles.itemCard}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="fast-food" size={40} color={COLORS.textSecondary} /> 
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemPrice}>₦{item.price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.addButton}>
             <Ionicons name="add" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        </PremiumCard>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSkeletons = () => (
    <View>
      <View style={{ paddingHorizontal: SIZES.padding, marginBottom: SIZES.margin }}>
        <Skeleton width={120} height={24} style={{ marginBottom: SPACING.s }} />
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ marginRight: SIZES.margin, alignItems: 'center' }}>
              <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: SPACING.xs }} />
              <Skeleton width={50} height={12} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: SIZES.padding }}>
        <Skeleton width={150} height={24} style={{ marginBottom: SPACING.s }} />
        {[1, 2, 3].map(i => (
          <View key={i} style={{ marginBottom: SIZES.margin, flexDirection: 'row', alignItems: 'center' }}>
             <Skeleton width={80} height={80} borderRadius={SIZES.radius} />
             <View style={{ marginLeft: SIZES.margin, flex: 1 }}>
               <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
               <Skeleton width="40%" height={16} />
             </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hungry?</Text>
          <Text style={styles.title}>Order & Eat.</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            style={[styles.cartButton, { marginRight: SPACING.s }]} 
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
            <Ionicons name="cart-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <PremiumInput 
            placeholder="Search for food..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Ionicons name="search" size={20} color={COLORS.textSecondary} />}
            containerStyle={{ marginBottom: 0 }}
            style={{ fontSize: 16 }}
        />
      </View>

      {loading ? renderSkeletons() : (
        <FlatList
          ListHeaderComponent={
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Categories</Text>
              </View>
              <FlatList
                data={categories}
                renderItem={renderCategory}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              />

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Now</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
            </>
          }
          data={featuredItems}
          renderItem={renderFeaturedItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items found.</Text>
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
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },
  title: {
    ...FONTS.largeTitle,
    color: COLORS.text,
  },
  cartButton: {
    padding: SPACING.s,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    ...SHADOWS.light,
  },
  searchContainer: {
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
    marginTop: SPACING.s,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  seeAll: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },
  categoryList: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.margin,
  },
  categoryCard: {
    marginRight: SIZES.margin,
    alignItems: 'center',
    width: 70,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    ...SHADOWS.light,
  },
  categoryIconText: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  categoryName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: SIZES.padding,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.s,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SIZES.margin,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.text,
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
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: SPACING.xl,
    fontFamily: FONTS.medium,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: COLORS.textInverse,
    fontSize: 8,
    fontFamily: FONTS.bold,
  },
});
