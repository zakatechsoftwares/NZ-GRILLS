import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Order = Database['public']['Tables']['orders']['Row'] & {
  profiles?: { full_name: string; email: string } | null;
  order_items?: { count: number }[];
  rating?: number | null;
  review?: string | null;
};

export default function AllOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered'>('all');

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          profiles!orders_customer_id_fkey (full_name, email),
          order_items (count)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching all orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('admin-all-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'preparing': return COLORS.info;
      case 'ready': return COLORS.success;
      case 'out_for_delivery': return COLORS.primary;
      case 'delivered': return COLORS.textSecondary;
      case 'cancelled': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'hourglass-outline';
      case 'preparing': return 'restaurant-outline';
      case 'ready': return 'checkmark-circle-outline';
      case 'out_for_delivery': return 'bicycle-outline';
      case 'delivered': return 'home-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const renderFilterChip = (label: string, value: typeof filter) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        filter === value && styles.filterChipActive,
      ]}
      onPress={() => setFilter(value)}
    >
      <Text
        style={[
          styles.filterChipText,
          filter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRating = (rating: number | null | undefined) => {
    if (!rating) return null;
    return (
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color={COLORS.warning}
          />
        ))}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: Order; index: number }) => {
    const status = item.status || 'pending';
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <PremiumCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.customerInfo}>
              <Ionicons name="person-circle" size={20} color={COLORS.textSecondary} />
              <Text style={styles.customerName}>
                {item.profiles?.full_name || item.profiles?.email || 'Unknown'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
              <Ionicons name={getStatusIcon(status)} size={12} color={getStatusColor(status)} />
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                {status.toUpperCase()}
              </Text>
            </View>
          </View>

        {/* Rating Section */}
        {!!item.rating && (
          <View style={styles.reviewSection}>
             <View style={styles.ratingRow}>
               <Text style={styles.label}>Rated:</Text>
               {renderRating(item.rating)}
             </View>
             {item.review && (
               <Text style={styles.reviewText}>"{item.review}"</Text>
             )}
          </View>
        )}

        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Order ID:</Text>
            <Text style={styles.value}>#{item.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Amount:</Text>
            <Text style={[styles.value, styles.amount]}>${item.total_amount.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Items:</Text>
            <Text style={styles.value}>{item.order_items?.[0]?.count || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>
              {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </PremiumCard>
    </Animated.View>
  );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>All Orders</Text>

      {/* Filter Chips */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {renderFilterChip('All', 'all')}
          {renderFilterChip('Pending', 'pending')}
          {renderFilterChip('Preparing', 'preparing')}
          {renderFilterChip('Ready', 'ready')}
          {renderFilterChip('Delivering', 'out_for_delivery')}
          {renderFilterChip('Delivered', 'delivered')}
        </ScrollView>
      </View>

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrders();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No orders found</Text>
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
    ...FONTS.h1,
    color: COLORS.text,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  filterChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 0,
    ...SHADOWS.light,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.surface,
    fontFamily: FONTS.bold,
  },
  list: {
    padding: SPACING.m,
    paddingTop: 0,
  },
  card: {
    marginBottom: SPACING.m,
    padding: SPACING.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    flex: 1,
  },
  customerName: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  orderInfo: {
    gap: SPACING.s,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  value: {
    ...FONTS.body2,
    color: COLORS.text,
  },
  amount: {
    ...FONTS.h4,
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: SPACING.m,
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },

  reviewSection: {
    marginBottom: SPACING.s,
    padding: SPACING.s,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    ...FONTS.body3,
    color: COLORS.text,
    fontStyle: 'italic',
  },
});
