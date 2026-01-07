import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import { createCourierOffer, withdrawCourierOffer, getMyCourierOffers, confirmCourierPickup } from '../../lib/api/courier-offers';

type Order = Database['public']['Tables']['orders']['Row'];

interface CourierOffer {
  id: string;
  order_id: string;
  status: string;
  offered_at: string;
}

export default function CourierDashboard() {
  const { signOut, user } = useAuth();
  const navigation = useNavigation<any>();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([]);
  const [myOffers, setMyOffers] = useState<CourierOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');

  const fetchOrders = async () => {
    try {
      // Fetch available orders (ready for pickup, no courier assigned)
      const { data: available, error: availError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'ready')
        .is('courier_id', null)
        .order('created_at', { ascending: true });
      
      if (availError) throw availError;

      // Fetch my deliveries (assigned to me)
      const { data: mine, error: mineError } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', user?.id)
        .in('status', ['ready', 'out_for_delivery', 'delivered'])
        .order('created_at', { ascending: true });

      if (mineError) throw mineError;

      // Fetch my offers
      if (user) {
        const offers = await getMyCourierOffers(user.id);
        setMyOffers(offers);
      }

      setAvailableOrders(available || []);
      setMyDeliveries(mine || []);
    } catch (error) {
      console.error('Error fetching courier orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time updates
    const ordersSubscription = supabase
      .channel('courier-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    const offersSubscription = supabase
      .channel('courier-offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_offers' }, fetchOrders)
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
      offersSubscription.unsubscribe();
    };
  }, []);

  const handleExpressInterest = async (orderId: string) => {
    if (!user) return;

    const { success, error } = await createCourierOffer(orderId, user.id);
    
    if (success) {
      Alert.alert('Success', 'Your offer has been submitted to the staff!');
      fetchOrders();
    } else {
      Alert.alert('Error', error?.message || 'Failed to submit offer');
    }
  };

  const handleWithdrawOffer = async (offerId: string) => {
    Alert.alert(
      'Withdraw Offer',
      'Are you sure you want to withdraw this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            const { success } = await withdrawCourierOffer(offerId);
            if (success) {
              Alert.alert('Success', 'Offer withdrawn');
              fetchOrders();
            }
          },
        },
      ]
    );
  };

  const handleConfirmPickup = async (orderId: string) => {
    if (!user) return;

    Alert.alert(
      'Confirm Pickup',
      'Have you collected this order from the kitchen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { success } = await confirmCourierPickup(orderId, user.id);
            if (success) {
              Alert.alert('Success', 'Pickup confirmed! Staff can now mark it as out for delivery.');
              fetchOrders();
            } else {
              Alert.alert('Error', 'Failed to confirm pickup');
            }
          },
        },
      ]
    );
  };

  const hasOfferedForOrder = (orderId: string) => {
    return myOffers.some(offer => offer.order_id === orderId && offer.status === 'pending');
  };

  const getOfferForOrder = (orderId: string) => {
    return myOffers.find(offer => offer.order_id === orderId && offer.status === 'pending');
  };

  const renderAvailableItem = ({ item }: { item: Order }) => {
    const hasOffer = hasOfferedForOrder(item.id);
    const offer = getOfferForOrder(item.id);

    return (
      <PremiumCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.statusText}>READY</Text>
            </View>
          </View>
          <Text style={styles.amount}>₦{item.total_amount.toFixed(2)}</Text>
        </View>

        <View style={styles.addressRow}>
          <Ionicons name="location" size={16} color={COLORS.primary} />
          <Text style={styles.address}>{(item.delivery_address as any)?.address || 'No Address'}</Text>
        </View>

        {item.delivery_notes && (
          <View style={styles.notesRow}>
            <Ionicons name="document-text" size={16} color={COLORS.textSecondary} />
            <Text style={styles.notes} numberOfLines={2}>{item.delivery_notes}</Text>
          </View>
        )}

        {hasOffer ? (
          <View style={styles.offerStatus}>
            <Ionicons name="time" size={18} color={COLORS.warning} />
            <Text style={styles.offerStatusText}>Offer Pending...</Text>
            <TouchableOpacity 
              style={styles.withdrawBtn}
              onPress={() => offer && handleWithdrawOffer(offer.id)}
            >
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.expressBtn} 
            onPress={() => handleExpressInterest(item.id)}
          >
            <Ionicons name="hand-right" size={18} color={COLORS.surface} />
            <Text style={styles.expressBtnText}>Express Interest</Text>
          </TouchableOpacity>
        )}
      </PremiumCard>
    );
  };

  const renderMyDeliveryItem = ({ item }: { item: Order }) => {
    const needsPickupConfirmation = !item.courier_accepted_at;

    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('DeliveryDetail', { orderId: item.id })}
      >
        <PremiumCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
              <View style={[styles.statusBadge, { 
                backgroundColor: item.status === 'out_for_delivery' ? COLORS.primary + '20' : 
                               item.status === 'delivered' ? COLORS.textSecondary + '20' : 
                               COLORS.success + '20' 
              }]}>
                <Ionicons 
                  name={item.status === 'out_for_delivery' ? 'bicycle' : 
                        item.status === 'delivered' ? 'checkmark-done' : 'checkmark-circle'} 
                  size={14} 
                  color={item.status === 'out_for_delivery' ? COLORS.primary : 
                         item.status === 'delivered' ? COLORS.textSecondary : COLORS.success} 
                />
                <Text style={[styles.statusText, { 
                  color: item.status === 'out_for_delivery' ? COLORS.primary : 
                         item.status === 'delivered' ? COLORS.textSecondary : COLORS.success 
                }]}>
                  {(item.status || 'pending').toUpperCase().replace('_', ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.amount}>₦{item.total_amount.toFixed(2)}</Text>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.address}>{(item.delivery_address as any)?.address || 'No Address'}</Text>
          </View>

          {needsPickupConfirmation && (
            <TouchableOpacity 
              style={styles.confirmPickupBtn}
              onPress={() => handleConfirmPickup(item.id)}
            >
              <Ionicons name="checkmark-done" size={18} color={COLORS.surface} />
              <Text style={styles.confirmPickupText}>Confirm Pickup</Text>
            </TouchableOpacity>
          )}

          {!needsPickupConfirmation && item.status === 'ready' && (
            <View style={styles.waitingStatus}>
              <Ionicons name="hourglass" size={16} color={COLORS.warning} />
              <Text style={styles.waitingText}>Waiting for staff to mark as out for delivery...</Text>
            </View>
          )}
        </PremiumCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, Courier</Text>
          <Text style={styles.subtitle}>Ready to deliver?</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'available' && styles.filterChipActive]}
            onPress={() => setActiveTab('available')}
          >
            <Text style={[styles.filterChipText, activeTab === 'available' && styles.filterChipTextActive]}>
              Available
            </Text>
            {availableOrders.length > 0 && (
              <View style={[styles.badge, activeTab === 'available' ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, activeTab === 'available' ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {availableOrders.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'mine' && styles.filterChipActive]}
            onPress={() => setActiveTab('mine')}
          >
            <Text style={[styles.filterChipText, activeTab === 'mine' && styles.filterChipTextActive]}>
              My Deliveries
            </Text>
            {myDeliveries.length > 0 && (
              <View style={[styles.badge, activeTab === 'mine' ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, activeTab === 'mine' ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {myDeliveries.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={activeTab === 'available' ? availableOrders : myDeliveries}
        renderItem={activeTab === 'available' ? renderAvailableItem : renderMyDeliveryItem}
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
            <Ionicons 
              name={activeTab === 'available' ? 'fast-food-outline' : 'bicycle-outline'} 
              size={64} 
              color={COLORS.textSecondary} 
            />
            <Text style={styles.emptyText}>
              {activeTab === 'available' ? 'No orders available' : 'No deliveries assigned'}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  greeting: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
  },
  signOutButton: {
    padding: SPACING.s,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: COLORS.surface,
  },
  badgeInactive: {
    backgroundColor: COLORS.textSecondary + '20',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  badgeTextActive: {
    color: COLORS.primary,
  },
  badgeTextInactive: {
    color: COLORS.textSecondary,
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
    marginBottom: SPACING.s,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  orderId: {
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
    backgroundColor: COLORS.success + '20',
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.success,
  },
  amount: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: SPACING.s,
  },
  address: {
    ...FONTS.body2,
    color: COLORS.text,
    flex: 1,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  notes: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    flex: 1,
  },
  expressBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: 12,
    gap: SPACING.s,
    ...SHADOWS.medium,
  },
  expressBtnText: {
    ...FONTS.h4,
    color: COLORS.surface,
  },
  offerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.warning + '20',
    borderRadius: 12,
    gap: SPACING.s,
  },
  offerStatusText: {
    ...FONTS.body2,
    color: COLORS.warning,
    flex: 1,
  },
  withdrawBtn: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  withdrawText: {
    ...FONTS.body3,
    color: COLORS.error,
  },
  confirmPickupBtn: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: 12,
    gap: SPACING.s,
    marginTop: SPACING.s,
  },
  confirmPickupText: {
    ...FONTS.h4,
    color: COLORS.surface,
  },
  waitingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.warning + '10',
    borderRadius: 12,
    gap: SPACING.s,
    marginTop: SPACING.s,
  },
  waitingText: {
    ...FONTS.body3,
    color: COLORS.warning,
    flex: 1,
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
});
