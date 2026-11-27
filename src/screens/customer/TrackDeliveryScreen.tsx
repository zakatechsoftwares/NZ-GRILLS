import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { calculateDistance, calculateETA, formatDistance, MAPS_ENABLED, openDeliveryAddressInMaps } from '../../lib/location';
import MapPlaceholder from '../../components/MapPlaceholder';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Order = Database['public']['Tables']['orders']['Row'];

export default function TrackDeliveryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [courierLocation, setCourierLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [courier, setCourier] = useState<{ full_name: string | null; phone: string | null } | null>(null);

  useEffect(() => {
    fetchOrder();

    // Subscribe to real-time location updates
    const subscription = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrder(updatedOrder);
          if (updatedOrder.courier_id) fetchCourier();

          // Update courier location if available
          if (updatedOrder.courier_latitude && updatedOrder.courier_longitude) {
            const newLocation = {
              latitude: updatedOrder.courier_latitude as number,
              longitude: updatedOrder.courier_longitude as number,
            };
            setCourierLocation(newLocation);

            // Calculate distance and ETA
            const deliveryAddr = updatedOrder.delivery_address as any;
            if (deliveryAddr?.latitude && deliveryAddr?.longitude) {
              const dist = calculateDistance(
                newLocation.latitude,
                newLocation.longitude,
                deliveryAddr.latitude,
                deliveryAddr.longitude
              );
              setDistance(dist);
              setEta(calculateETA(dist));
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId]);

  const fetchCourier = async () => {
    const { data } = await supabase
      .from('orders')
      .select('courier:profiles!orders_courier_id_fkey(full_name, phone)')
      .eq('id', orderId)
      .single();
    setCourier((data as any)?.courier ?? null);
  };

  const fetchOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    fetchCourier();

    if (data) {
      setOrder(data);

      // Set initial courier location if available
      if (data.courier_latitude && data.courier_longitude) {
        setCourierLocation({
          latitude: data.courier_latitude as number,
          longitude: data.courier_longitude as number,
        });
      }
    }
  };

  const handleCallCourier = () => {
    if (courier?.phone) Linking.openURL(`tel:${courier.phone}`);
  };

  const callButton = courier?.phone && order?.status === 'out_for_delivery' ? (
    <TouchableOpacity style={styles.callBtn} onPress={handleCallCourier}>
      <Ionicons name="call" size={20} color={COLORS.surface} />
      <Text style={styles.callText}>Call {courier.full_name?.split(' ')[0] || 'Courier'}</Text>
    </TouchableOpacity>
  ) : null;

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const deliveryAddr = order.delivery_address as any;
  const region = {
    latitude: deliveryAddr?.latitude || 6.5244,
    longitude: deliveryAddr?.longitude || 3.3792,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      {MAPS_ENABLED ? (
        <MapView
          style={styles.map}
          initialRegion={region}
          provider={PROVIDER_GOOGLE}
        >
          {/* Delivery Destination */}
          <Marker
            coordinate={{
              latitude: deliveryAddr?.latitude || 6.5244,
              longitude: deliveryAddr?.longitude || 3.3792,
            }}
            title="Your Location"
            pinColor={COLORS.success}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="home" size={24} color={COLORS.surface} />
            </View>
          </Marker>

          {/* Courier Location */}
          {courierLocation && (
            <Marker
              coordinate={courierLocation}
              title="Courier"
              pinColor={COLORS.primary}
            >
              <Animated.View
                entering={FadeInDown}
                style={styles.courierMarker}
              >
                <Ionicons name="bicycle" size={24} color={COLORS.surface} />
              </Animated.View>
            </Marker>
          )}
        </MapView>
      ) : (
        <MapPlaceholder
          style={styles.map}
          address={deliveryAddr?.address}
          onOpenMaps={() => openDeliveryAddressInMaps(deliveryAddr, 'Your Location')}
        />
      )}

      {/* Status Card */}
      <View style={styles.statusCard}>
        {courierLocation ? (
          <>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Ionicons name="navigate-circle" size={32} color={COLORS.primary} />
                <Text style={styles.statusLabel}>Distance</Text>
                <Text style={styles.statusValue}>
                  {distance ? formatDistance(distance) : '---'}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.statusItem}>
                <Ionicons name="time" size={32} color={COLORS.success} />
                <Text style={styles.statusLabel}>ETA</Text>
                <Text style={styles.statusValue}>
                  {eta ? `${eta} min` : '---'}
                </Text>
              </View>
            </View>

            {callButton}
          </>
        ) : order.status === 'delivered' ? (
          <View style={styles.waitingContainer}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
            <Text style={styles.waitingText}>Delivered. Enjoy your meal!</Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.waitingText}>Your order is on the way</Text>
            <Text style={styles.waitingSubtext}>The courier's live location will show here when it is shared</Text>
            {callButton}
          </View>
        )}
      </View>

      {/* Order Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{deliveryAddr?.address || 'No address'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="document-text" size={16} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{order.delivery_notes || 'No delivery notes'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.m,
    paddingTop: SPACING.xl,
    backgroundColor: COLORS.surface,
    ...SHADOWS.light,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.45,
  },
  loadingText: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 50,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.m,
    padding: SPACING.l,
    borderRadius: 16,
    ...SHADOWS.medium,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.m,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
  statusValue: {
    ...FONTS.h2,
    color: COLORS.text,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.m,
  },
  callBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: 12,
    gap: SPACING.s,
  },
  callText: {
    ...FONTS.h4,
    color: COLORS.surface,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.l,
  },
  waitingText: {
    ...FONTS.h4,
    color: COLORS.text,
    marginTop: SPACING.m,
    textAlign: 'center',
  },
  waitingSubtext: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.m,
    marginTop: 0,
    padding: SPACING.m,
    borderRadius: 12,
    ...SHADOWS.light,
  },
  infoTitle: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: SPACING.s,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    flex: 1,
  },
  destinationMarker: {
    backgroundColor: COLORS.success,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    ...SHADOWS.medium,
  },
  courierMarker: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    ...SHADOWS.medium,
  },
});
