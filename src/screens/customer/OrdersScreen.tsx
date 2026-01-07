import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import PremiumCard from '../../components/PremiumCard';
import { useAuth } from '../../lib/AuthContext';
import RatingModal from '../../components/RatingModal';
import { submitReview } from '../../lib/api/engagement';
import PremiumButton from '../../components/PremiumButton';
import { Alert } from 'react-native';

type Order = Database['public']['Tables']['orders']['Row'] & {
  order_items: { count: number }[];
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(count)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time updates for YOUR orders only
    const subscription = supabase
      .channel('customer-orders')
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `customer_id=eq.${user?.id}` 
        },
        payload => {
          console.log('Order update received:', payload);
          fetchOrders(); // Reload orders to get fresh data
        }
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [user]);

  const handleRateOrder = (orderId: string) => {
    setRatingOrderId(orderId);
    setShowRatingModal(true);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!ratingOrderId) return;
    
    // Optimistic / UI feedback
    const { success, error } = await submitReview(ratingOrderId, rating, comment);
    
    if (success) {
      Alert.alert('Thank You', 'Your review has been submitted.');
    } else {
      Alert.alert('Error', error?.message || 'Failed to submit review');
    }
  };

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
      default: return 'help-circle-outline';
    }
  };

  const getProgress = (status: string) => {
    switch (status) {
      case 'pending': return 0.1;
      case 'preparing': return 0.4;
      case 'ready': return 0.7;
      case 'out_for_delivery': return 0.9;
      case 'delivered': return 1.0;
      default: return 0;
    }
  };

  const renderItem = ({ item, index }: { item: Order; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)} layout={Layout.springify()}>
      <PremiumCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={12} color={getStatusColor(item.status)} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.amount}>₦{item.total_amount.toFixed(2)}</Text>
        </View>

        {/* Progress Bar */}
        {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(item.status) && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${getProgress(item.status) * 100}%`, backgroundColor: getStatusColor(item.status) }]} />
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.itemsCount}>{item.order_items[0]?.count || 0} items</Text>
          <Text style={styles.orderId}>ID: #{item.id.slice(0, 8)}</Text>
        </View>

        {/* Track Delivery Button */}
        {item.status === 'out_for_delivery' && (
          <View style={styles.actionRow}>
            <PremiumButton
              title="Track Delivery"
              onPress={() => (navigation as any).navigate('TrackDelivery', { orderId: item.id })}
              variant="primary"
              style={styles.trackButton}
              icon={<Ionicons name="navigate" size={18} color={COLORS.surface} />}
            />
          </View>
        )}

        {/* Rate Order Button */}
        {item.status === 'delivered' && (
          <View style={styles.actionRow}>
            <PremiumButton
              title="Rate Order"
              onPress={() => handleRateOrder(item.id)}
              variant="outline"
              style={styles.rateButton}
              textStyle={styles.rateButtonText}
            />
          </View>
        )}
      </PremiumCard>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Orders</Text>
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
      />

      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleSubmitReview}
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
  list: {
    padding: SPACING.m,
  },
  card: {
    marginBottom: SPACING.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  date: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: SIZES.radiusSm,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  totalLabel: {
    ...FONTS.body2,
    color: COLORS.text,
  },
  amount: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  progressContainer: {
    height: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    marginBottom: SPACING.m,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.s,
  },
  itemsCount: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  orderId: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
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
  actionRow: {
    marginTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
  },
  rateButton: {
    height: 40,
    marginTop: 0,
  },
  rateButtonText: {
    fontSize: 14,
  },
  trackButton: {
    marginTop: 0,
  },
});
