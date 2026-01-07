import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';
import PremiumCard from '../../components/PremiumCard';
import Skeleton from '../../components/Skeleton';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & { menu_items: { name: string } };

export default function OrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetail();
    
    const subscription = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => fetchOrderDetail()
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [orderId]);

  const fetchOrderDetail = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          courier:profiles!orders_courier_id_fkey(full_name, phone)
        `)
        .eq('id', orderId)
        .single();
      
      if (orderError) throw orderError;
      setOrder(orderData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*, menu_items(name)')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;
      setItems(itemsData as any || []);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.container}>
         <View style={styles.header}>
             <Skeleton width={40} height={40} borderRadius={20} />
             <Skeleton width={150} height={24} style={{ marginLeft: SPACING.m }} />
         </View>
         <View style={{ padding: SIZES.padding }}>
             <Skeleton width="100%" height={150} borderRadius={SIZES.radius} style={{ marginBottom: SPACING.m }} />
             <Skeleton width="100%" height={200} borderRadius={SIZES.radius} />
         </View>
      </View>
    );
  }

  // Visual Tracker
  const steps = ['pending', 'preparing', 'ready', 'delivered'];
  const currentStepIndex = steps.indexOf(order.status) > -1 ? steps.indexOf(order.status) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Order Status</Text>
      </View>

      <Animated.View layout={Layout.springify()}>
        <PremiumCard style={styles.statusCard}>
            <View style={styles.statusHeader}>
                <Ionicons name="time-outline" size={24} color={COLORS.primary} />
                <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.estimatedText}>
                {order.status === 'pending' ? 'Waiting for restaurant confirmation...' : 
                order.status === 'preparing' ? 'Kitchen is preparing your food.' :
                order.status === 'ready' ? 'Your food is ready for pickup/delivery.' :
                order.status === 'delivered' ? 'Order delivered. Enjoy your meal!' : ''}
            </Text>
            
            {/* Simple Step Indicator */}
            <View style={styles.stepsContainer}>
                {steps.map((step, index) => {
                    const isActive = index <= currentStepIndex;
                    return (
                        <View key={step} style={[styles.stepDot, isActive && styles.stepDotActive]} />
                    );
                })}
            </View>
        </PremiumCard>
      </Animated.View>

      <PremiumCard>
        <Text style={styles.sectionTitle}>Items</Text>
        {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName}>{item.menu_items?.name || 'Unknown Item'}</Text>
                <Text style={styles.itemPrice}>₦{item.subtotal.toFixed(2)}</Text>
            </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₦{order.total_amount.toFixed(2)}</Text>
        </View>
      </PremiumCard>
      
      <PremiumCard>
        <Text style={styles.sectionTitle}>Delivery Info</Text>
        <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>{(order.delivery_address as any)?.address || 'N/A'}</Text>
        </View>
        <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>{order.delivery_notes || 'No special notes'}</Text>
        </View>
      </PremiumCard>

      {order.status === 'out_for_delivery' && (order as any).courier && (
        <PremiumCard>
            <Text style={styles.sectionTitle}>Courier Info</Text>
            <View style={styles.courierRow}>
                <View>
                    <Text style={styles.courierName}>{(order as any).courier?.full_name || 'Courier'}</Text>
                    <Text style={styles.courierPhone}>{(order as any).courier?.phone || 'No phone'}</Text>
                </View>
                {(order as any).courier?.phone && (
                    <TouchableOpacity 
                        onPress={() => Linking.openURL(`tel:${(order as any).courier.phone}`)} 
                        style={styles.callButton}
                    >
                        <Ionicons name="call" size={20} color={COLORS.surface} />
                        <Text style={styles.callButtonText}>Call</Text>
                    </TouchableOpacity>
                )}
            </View>
        </PremiumCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  backButton: {
    padding: SPACING.s,
    marginRight: SPACING.m,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  statusCard: {
      backgroundColor: COLORS.primary + '10', // Tinted background
      borderColor: COLORS.primary,
      borderWidth: 1,
  },
  statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.s,
  },
  statusText: {
    ...FONTS.h2,
    color: COLORS.primary,
    marginLeft: SPACING.s,
  },
  estimatedText: {
    ...FONTS.body1,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  stepsContainer: {
      flexDirection: 'row',
      gap: 8,
  },
  stepDot: {
      height: 4,
      flex: 1,
      backgroundColor: COLORS.border,
      borderRadius: 2,
  },
  stepDotActive: {
      backgroundColor: COLORS.primary,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
    alignItems: 'center',
  },
  itemQty: {
    width: 30,
    fontFamily: FONTS.medium,
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
    marginVertical: SPACING.m,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  totalAmount: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  infoText: {
    ...FONTS.body2,
    color: COLORS.text,
  },
  courierRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  courierName: {
      ...FONTS.h4,
      color: COLORS.text,
  },
  courierPhone: {
      ...FONTS.body2,
      color: COLORS.textSecondary,
      marginTop: 2,
  },
  callButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.success,
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.s,
      borderRadius: SIZES.radius,
      gap: 4,
  },
  callButtonText: {
      ...FONTS.h4,
      color: COLORS.surface,
  },
});
