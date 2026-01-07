import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Database } from '../../types/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import PremiumButton from '../../components/PremiumButton';
import PremiumInput from '../../components/PremiumInput';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { sendOrderNotification } from '../../lib/notifications';
import { getCourierOffers, acceptCourierOffer, rejectCourierOffer, assignCourier } from '../../lib/api/courier-offers';

type Order = Database['public']['Tables']['orders']['Row'] & {
  order_items?: Array<{
    id: string;
    quantity: number;
    menu_items: { name: string; price: number } | null;
  }>;
  profiles?: { full_name: string; email: string; phone: string } | null;
};

type TabType = 'all' | 'pending' | 'preparing' | 'ready' | 'delivered';

export default function StaffDashboard() {
  const { signOut, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // Courier assignment state
  const [courierModalVisible, setCourierModalVisible] = useState(false);
  const [selectedOrderForCourier, setSelectedOrderForCourier] = useState<Order | null>(null);
  const [courierOffers, setCourierOffers] = useState<any[]>([]);
  const [availableCouriers, setAvailableCouriers] = useState<any[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            menu_items (name, price)
          ),
          profiles!orders_customer_id_fkey (full_name, email, phone)
        `)
        .in('status', ['pending', 'preparing', 'ready', 'out_for_delivery', 'delivered'])
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching staff orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const subscription = supabase
      .channel('staff-orders')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders() 
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  const updateStatus = async (orderId: string, currentStatus: string) => {
    let newStatus = '';
    if (currentStatus === 'pending') newStatus = 'preparing';
    else if (currentStatus === 'preparing') newStatus = 'ready';
    else if (currentStatus === 'ready') newStatus = 'out_for_delivery';
    
    if (!newStatus) return;

    // Optimistically update local state for instant UI feedback
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus as any } : order
      )
    );

    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'ready' && user) {
        updates.completed_by = user.id;
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Send push notification to customer
      const order = orders.find(o => o.id === orderId);
      if (order && order.customer_id) {
        sendOrderNotification(
          order.customer_id, 
          order.id, 
          newStatus, 
          order.id.slice(0, 6).toUpperCase()
        );
      }
    } catch (error: any) {
      // Revert optimistic update on error
      fetchOrders();
      Alert.alert('Error', error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'preparing': return COLORS.info;
      case 'ready': return COLORS.success;
      case 'out_for_delivery': return COLORS.primary;
      case 'delivered': return COLORS.textSecondary;
      default: return COLORS.textSecondary;
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const isWithinDateFilter = (createdAt: string) => {
    if (dateFilter === 'all') return true;
    const orderDate = new Date(createdAt);
    const now = new Date();
    
    if (dateFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
    
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    }
    
    return true;
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;

    Alert.alert(
      'Bulk Update',
      `Update ${selectedOrders.size} order(s) to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const updates = Array.from(selectedOrders).map(orderId =>
                supabase.from('orders').update({ status: newStatus } as any).eq('id', orderId)
              );
              
              await Promise.all(updates);
              
              // Send notifications
              Array.from(selectedOrders).forEach(orderId => {
                const order = orders.find(o => o.id === orderId);
                if (order?.customer_id) {
                  sendOrderNotification(
                    order.customer_id,
                    order.id,
                    newStatus,
                    order.id.slice(0, 6).toUpperCase()
                  );
                }
              });
              
              setSelectedOrders(new Set());
              setBulkMode(false);
              fetchOrders();
              Alert.alert('Success', `${selectedOrders.size} order(s) updated`);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  // Courier Assignment Functions
  const openCourierModal = async (order: Order) => {
    setSelectedOrderForCourier(order);
    setLoadingCouriers(true);
    setCourierModalVisible(true);

    try {
      // Fetch courier offers for this order
      const offers = await getCourierOffers(order.id);
      setCourierOffers(offers);

      // Fetch all available couriers
      const { data: couriers } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .eq('role', 'courier');
      
      setAvailableCouriers(couriers || []);
    } catch (error) {
      console.error('Error loading couriers:', error);
    } finally {
      setLoadingCouriers(false);
    }
  };

  const handleAcceptOffer = async (offerId: string, courierId: string) => {
    if (!selectedOrderForCourier || !user) return;

    const { success } = await acceptCourierOffer(
      offerId,
      selectedOrderForCourier.id,
      courierId,
      user.id
    );

    if (success) {
      Alert.alert('Success', 'Courier assigned successfully!');
      setCourierModalVisible(false);
      fetchOrders();
    } else {
      Alert.alert('Error', 'Failed to assign courier');
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    if (!user) return;

    const { success } = await rejectCourierOffer(offerId, user.id);

    if (success) {
      Alert.alert('Success', 'Offer rejected');
      // Refresh offers
      if (selectedOrderForCourier) {
        const offers = await getCourierOffers(selectedOrderForCourier.id);
        setCourierOffers(offers);
      }
    }
  };

  const handleManualAssign = async (courierId: string) => {
    if (!selectedOrderForCourier || !user) return;

    Alert.alert(
      'Assign Courier',
      'Manually assign this courier to the order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            const { success } = await assignCourier(
              selectedOrderForCourier.id,
              courierId,
              user.id
            );

            if (success) {
              Alert.alert('Success', 'Courier assigned!');
              setCourierModalVisible(false);
              fetchOrders();
            } else {
              Alert.alert('Error', 'Failed to assign courier');
            }
          }
        }
      ]
    );
  };

  const handleMarkOutForDelivery = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.courier_id) {
      Alert.alert('Error', 'No courier assigned to this order');
      return;
    }

    // Check if courier has confirmed pickup
    if (!(order as any).courier_accepted_at) {
      Alert.alert('Wait', 'Courier must confirm pickup first');
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'out_for_delivery' })
        .eq('id', orderId);

      if (error) throw error;

      // Send notification to customer
      if (order.customer_id) {
        await sendOrderNotification(
          order.customer_id,
          order.id,
          'out_for_delivery',
          order.id.slice(0, 6).toUpperCase()
        );
      }

      Alert.alert('Success', 'Order marked as out for delivery!');
      fetchOrders();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    // Status filter
    if (activeTab !== 'all' && order.status !== activeTab) return false;
    
    // Date filter
    if (!isWithinDateFilter(order.created_at)) return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const customerName = order.profiles?.full_name?.toLowerCase() || '';
      const orderId = order.id.toLowerCase();
      if (!customerName.includes(query) && !orderId.includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  const renderOrderCard = ({ item, index }: { item: Order; index: number }) => {
    const itemCount = item.order_items?.length || 0;
    const isSelected = selectedOrders.has(item.id);
    
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <TouchableOpacity 
          onPress={() => bulkMode ? toggleOrderSelection(item.id) : setSelectedOrder(item)}
          onLongPress={() => {
            setBulkMode(true);
            toggleOrderSelection(item.id);
          }}
        >
          <PremiumCard style={[styles.orderCard, isSelected && styles.selectedCard]}>
            {bulkMode && (
              <TouchableOpacity 
                style={styles.checkbox}
                onPress={() => toggleOrderSelection(item.id)}
              >
                <Ionicons 
                  name={isSelected ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={isSelected ? COLORS.primary : COLORS.border} 
                />
              </TouchableOpacity>
            )}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.customerName}>{item.profiles?.full_name || 'Customer'}</Text>
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.timeElapsed}>{getTimeElapsed(item.created_at)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'pending') + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status || 'pending') }]}>
                    {(item.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.orderInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="fast-food-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>₦{item.total_amount.toFixed(2)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons 
                  name={item.payment_status === 'paid' ? 'checkmark-circle' : 'time-outline'} 
                  size={16} 
                  color={item.payment_status === 'paid' ? COLORS.success : COLORS.warning} 
                />
                <Text style={styles.infoText}>{item.payment_status}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {item.status === 'pending' && (
                <PremiumButton 
                  title="Start Preparing"
                  onPress={() => updateStatus(item.id, 'pending')}
                  style={styles.actionButton}
                  icon={<Ionicons name="restaurant" size={16} color={COLORS.textInverse} />}
                />
              )}
              {item.status === 'preparing' && (
                <PremiumButton 
                  title="Mark Ready"
                  onPress={() => updateStatus(item.id, 'preparing')}
                  style={styles.actionButton}
                  icon={<Ionicons name="checkmark-done" size={16} color={COLORS.textInverse} />}
                />
              )}
              {item.status === 'ready' && !item.courier_id && (
                <PremiumButton 
                  title="Assign Courier"
                  onPress={() => openCourierModal(item)}
                  style={styles.actionButton}
                  variant="outline"
                  icon={<Ionicons name="person-add" size={16} color={COLORS.primary} />}
                />
              )}
              {item.status === 'ready' && item.courier_id && !(item as any).courier_accepted_at && (
                <View style={styles.waitingCourier}>
                  <Ionicons name="hourglass" size={16} color={COLORS.warning} />
                  <Text style={styles.waitingText}>Waiting for courier pickup...</Text>
                </View>
              )}
              {item.status === 'ready' && item.courier_id && (item as any).courier_accepted_at && (
                <PremiumButton 
                  title="Mark Out for Delivery"
                  onPress={() => handleMarkOutForDelivery(item.id)}
                  style={styles.actionButton}
                  icon={<Ionicons name="bicycle" size={16} color={COLORS.textInverse} />}
                />
              )}
            </View>
          </PremiumCard>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {!bulkMode ? (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Kitchen Dashboard</Text>
              <Text style={styles.subtitle}>{filteredOrders.length} active orders</Text>
            </View>
            <TouchableOpacity onPress={() => signOut()} style={styles.signOutButton}>
              <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterContainer}>
            <PremiumInput
              placeholder="Search orders..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              icon={<Ionicons name="search" size={20} color={COLORS.textSecondary} />}
              containerStyle={{ marginBottom: SPACING.s }}
            />
            <View style={styles.dateFilterRow}>
              {(['all', 'today', 'week'] as const).map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.dateChip, dateFilter === filter && styles.activeDateChip]}
                  onPress={() => setDateFilter(filter)}
                >
                  <Text style={[styles.dateChipText, dateFilter === filter && styles.activeDateChipText]}>
                    {filter === 'all' ? 'All Time' : filter === 'today' ? 'Today' : 'This Week'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContainer}
            >
              {(['all', 'pending', 'preparing', 'ready', 'delivered'] as TabType[]).map(tab => {
                const count = orders.filter(o => o.status === tab).length;
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                    {tab !== 'all' && count > 0 && (
                      <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
                        <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      ) : (
        <View style={styles.bulkHeader}>
          <TouchableOpacity onPress={() => { setBulkMode(false); setSelectedOrders(new Set()); }}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.bulkTitle}>{selectedOrders.size} Selected</Text>
          <TouchableOpacity onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedOrders.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No {activeTab !== 'all' ? activeTab : ''} orders</Text>}
      />

      {/* Order Details Modal */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <PremiumCard style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <Text style={styles.detailText}>Name: {selectedOrder.profiles?.full_name || 'N/A'}</Text>
                <Text style={styles.detailText}>Email: {selectedOrder.profiles?.email || 'N/A'}</Text>
                <Text style={styles.detailText}>Phone: {selectedOrder.profiles?.phone || 'N/A'}</Text>
              </PremiumCard>

              <PremiumCard style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                {selectedOrder.order_items?.map((item, idx) => (
                  <View key={item.id} style={styles.orderItem}>
                    <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                    <Text style={styles.itemName}>{item.menu_items?.name || 'Item'}</Text>
                    <Text style={styles.itemPrice}>₦{((item.menu_items?.price || 0) * item.quantity).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>₦{selectedOrder.total_amount.toFixed(2)}</Text>
                </View>
              </PremiumCard>

              <PremiumCard style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Delivery Information</Text>
                <Text style={styles.detailText}>
                  Address: {(selectedOrder.delivery_address as any)?.address || 'N/A'}
                </Text>
                <Text style={styles.detailText}>Notes: {selectedOrder.delivery_notes || 'None'}</Text>
              </PremiumCard>

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Courier Assignment Modal */}
      <Modal
        visible={courierModalVisible}
        animationType="slide"
        onRequestClose={() => setCourierModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Courier</Text>
            <TouchableOpacity onPress={() => setCourierModalVisible(false)}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedOrderForCourier && (
              <>
                <PremiumCard style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Order #{selectedOrderForCourier.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.detailText}>Amount: ₦{selectedOrderForCourier.total_amount.toFixed(2)}</Text>
                  <Text style={styles.detailText}>
                    Address: {(selectedOrderForCourier.delivery_address as any)?.address || 'N/A'}
                  </Text>
                </PremiumCard>

                {/* Courier Offers */}
                {courierOffers.length > 0 && (
                  <PremiumCard style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Courier Offers ({courierOffers.length})</Text>
                    {courierOffers.map((offer: any) => (
                      <View key={offer.id} style={styles.offerItem}>
                        <View style={styles.offerInfo}>
                          <Text style={styles.courierName}>{offer.profiles?.full_name || 'Courier'}</Text>
                          <Text style={styles.courierPhone}>{offer.profiles?.phone || 'No phone'}</Text>
                          <Text style={styles.offerTime}>
                            Offered {new Date(offer.offered_at).toLocaleTimeString()}
                          </Text>
                        </View>
                        {offer.status === 'pending' && (
                          <View style={styles.offerActions}>
                            <TouchableOpacity
                              style={styles.acceptBtn}
                              onPress={() => handleAcceptOffer(offer.id, offer.courier_id)}
                            >
                              <Ionicons name="checkmark" size={20} color={COLORS.surface} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.rejectBtn}
                              onPress={() => handleRejectOffer(offer.id)}
                            >
                              <Ionicons name="close" size={20} color={COLORS.surface} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </PremiumCard>
                )}

                {/* Manual Assignment */}
                <PremiumCard style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Or Manually Assign</Text>
                  {loadingCouriers ? (
                    <Text style={styles.loadingText}>Loading couriers...</Text>
                  ) : availableCouriers.length > 0 ? (
                    availableCouriers.map((courier: any) => (
                      <TouchableOpacity
                        key={courier.id}
                        style={styles.courierItem}
                        onPress={() => handleManualAssign(courier.id)}
                      >
                        <View>
                          <Text style={styles.courierName}>{courier.full_name}</Text>
                          <Text style={styles.courierPhone}>{courier.phone || 'No phone'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No couriers available</Text>
                  )}
                </PremiumCard>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <View style={styles.bulkToolbar}>
          <TouchableOpacity 
            style={styles.bulkAction} 
            onPress={() => handleBulkStatusUpdate('preparing')}
          >
            <Ionicons name="restaurant" size={24} color={COLORS.info} />
            <Text style={styles.bulkActionText}>Prepare</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.bulkAction} 
            onPress={() => handleBulkStatusUpdate('ready')}
          >
            <Ionicons name="checkmark-done-circle" size={24} color={COLORS.success} />
            <Text style={styles.bulkActionText}>Ready</Text>
          </TouchableOpacity>
          
           <TouchableOpacity 
            style={styles.bulkAction} 
            onPress={() => handleBulkStatusUpdate('out_for_delivery')}
          >
            <Ionicons name="bicycle" size={24} color={COLORS.primary} />
            <Text style={styles.bulkActionText}>Deliver</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  title: {
    ...FONTS.h1,
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
  },
  orderCard: {
    marginBottom: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  orderId: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  customerName: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  timeElapsed: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: SIZES.radiusSm,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  orderInfo: {
    flexDirection: 'row',
    gap: SPACING.m,
    marginBottom: SPACING.m,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  actionRow: {
    marginTop: SPACING.s,
  },
  actionButton: {
    height: 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.m,
  },
  detailSection: {
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.s,
  },
  detailText: {
    ...FONTS.body1,
    color: COLORS.text,
    marginBottom: 4,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
    alignItems: 'center',
  },
  itemQuantity: {
    width: 40,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  itemName: {
    flex: 1,
    ...FONTS.body1,
    color: COLORS.text,
  },
  itemPrice: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  totalAmount: {
    ...FONTS.h2,
    color: COLORS.primary,
  },

  dateFilterRow: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  dateChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeDateChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateChipText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  activeDateChipText: {
    color: COLORS.textInverse,
    fontFamily: FONTS.bold,
  },
  bulkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
    height: 50,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    marginHorizontal: SPACING.m,
  },
  bulkTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  selectAllText: {
    ...FONTS.body2,
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.surfaceHighlight,
  },
  checkbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  bulkToolbar: {
    position: 'absolute',
    bottom: 20,
    left: SPACING.m,
    right: SPACING.m,
    backgroundColor: COLORS.text,
    borderRadius: SIZES.radius,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.m,
    ...SHADOWS.dark,
  },
  bulkAction: {
    alignItems: 'center',
    gap: 4,
  },
  bulkActionText: {
    fontSize: 12,
    color: COLORS.textInverse,
    fontFamily: FONTS.medium,
  },
  waitingCourier: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.warning + '20',
    borderRadius: 12,
    gap: SPACING.s,
  },
  waitingText: {
    ...FONTS.body3,
    color: COLORS.warning,
  },
  offerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: SPACING.s,
  },
  offerInfo: {
    flex: 1,
  },
  courierName: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: 4,
  },
  courierPhone: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  offerTime: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  offerActions: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  acceptBtn: {
    backgroundColor: COLORS.success,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: SPACING.s,
  },
  loadingText: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: SPACING.m,
  },
  emptyText: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: SPACING.m,
  },
});
