import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Animated, PanResponder } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { 
  startLocationTracking, 
  getCurrentLocation, 
  calculateDistance, 
  calculateETA, 
  formatDistance,
  MAPS_ENABLED,
  openDeliveryAddressInMaps
} from '../../lib/location';
import MapPlaceholder from '../../components/MapPlaceholder';
import { useAuth } from '../../lib/AuthContext';
import { sendOrderNotification } from '../../lib/notifications';
import { confirmCourierPickup } from '../../lib/api/courier-offers';

type Order = Database['public']['Tables']['orders']['Row'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.7;

export default function DeliveryDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [courierLocation, setCourierLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  
  const stopTracking = useRef<(() => void) | null>(null);
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  // The swipe handler is created once, so it reads the latest order and
  // completeDelivery through refs instead of the first render's values.
  const orderRef = useRef<Order | null>(null);
  orderRef.current = order;
  const completeDeliveryRef = useRef<() => void>(() => {});

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx < SWIPE_THRESHOLD) {
          swipeAnimation.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe completed - confirm delivery
          Animated.timing(swipeAnimation, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            completeDeliveryRef.current();
          });
        } else {
          // Swipe not far enough - reset
          Animated.spring(swipeAnimation, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    fetchOrder();
    return () => {
      // Cleanup tracking on unmount
      if (stopTracking.current) {
        stopTracking.current();
      }
    };
  }, []);

  const fetchOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    setOrder(data);
    // Already on the way (started earlier, or marked by the kitchen): carry on
    // tracking and show the swipe to complete, without changing the status.
    if (data?.status === 'out_for_delivery') {
      beginTracking(data);
    }
  };

  // Live location for the customer's tracking screen. Optional: without
  // location access the delivery can still be completed.
  const beginTracking = async (current: Order) => {
    setIsTracking(true);
    if (stopTracking.current) return;

    const location = await getCurrentLocation();
    if (!location) return;

    setCourierLocation(location);
    stopTracking.current = startLocationTracking(orderId, 10000); // every 10 seconds

    const addr = current.delivery_address as any;
    if (addr?.latitude && addr?.longitude) {
      const dist = calculateDistance(location.latitude, location.longitude, addr.latitude, addr.longitude);
      setDistance(dist);
      setEta(calculateETA(dist));
    }
  };

  const confirmPickup = async () => {
    if (!user) return;
    const { success } = await confirmCourierPickup(orderId, user.id);
    if (success) {
      fetchOrder();
    } else {
      Alert.alert('Error', 'Failed to confirm pickup');
    }
  };

  const startDelivery = async () => {
    if (!order) return;

    // Only move it on if it is still waiting; the kitchen may already have
    // marked it out for delivery.
    const { data: changed, error } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', orderId)
      .eq('status', 'ready')
      .select('id');

    if (error) {
      Alert.alert('Error', 'Failed to start delivery');
      return;
    }

    if (changed?.length && order.customer_id) {
      await sendOrderNotification(
        order.customer_id,
        orderId,
        'out_for_delivery',
        orderId.slice(0, 6).toUpperCase()
      );
    }

    const updated = { ...order, status: 'out_for_delivery' };
    setOrder(updated);
    beginTracking(updated);
  };

  const completeDelivery = async () => {
    const current = orderRef.current;
    if (stopTracking.current) {
      stopTracking.current();
      stopTracking.current = null;
    }

    const { data: changed, error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        courier_latitude: null,
        courier_longitude: null,
        location_updated_at: null
      })
      .eq('id', orderId)
      .eq('status', 'out_for_delivery')
      .select('id');

    if (error || !changed?.length) {
      // Put the swipe button back so the courier can try again
      Animated.spring(swipeAnimation, { toValue: 0, useNativeDriver: true }).start();
      Alert.alert('Error', 'Failed to complete delivery. Please try again.');
      fetchOrder();
      return;
    }

    if (current) setOrder({ ...current, status: 'delivered' });
    Alert.alert('Success', 'Delivery Completed!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);

    if (current?.customer_id) {
      await sendOrderNotification(
        current.customer_id,
        orderId,
        'delivered',
        orderId.slice(0, 6).toUpperCase()
      );
    }
  };
  completeDeliveryRef.current = completeDelivery;

  const handleOpenMaps = () => {
    openDeliveryAddressInMaps(order?.delivery_address as any, 'Delivery Location');
  };

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
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      {MAPS_ENABLED ? (
        <MapView 
          style={styles.map} 
          initialRegion={region}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={isTracking}
          showsMyLocationButton={isTracking}
        >
          {/* Destination Marker */}
          <Marker
            coordinate={{
              latitude: deliveryAddr?.latitude || 6.5244,
              longitude: deliveryAddr?.longitude || 3.3792,
            }}
            title="Delivery Location"
            pinColor={COLORS.error}
          />
        
          {/* Courier Location Marker */}
          {courierLocation && (
            <Marker
              coordinate={courierLocation}
              title="Your Location"
              pinColor={COLORS.primary}
            >
              <View style={styles.courierMarker}>
                <Ionicons name="bicycle" size={24} color={COLORS.surface} />
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <MapPlaceholder
          style={styles.map}
          address={deliveryAddr?.address}
          onOpenMaps={handleOpenMaps}
        />
      )}

      {/* Top Status Bar */}
      {isTracking && (
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Ionicons name="navigate" size={20} color={COLORS.primary} />
            <Text style={styles.statusText}>
              {distance ? formatDistance(distance) : '---'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="time" size={20} color={COLORS.success} />
            <Text style={styles.statusText}>
              {eta ? `${eta} min` : '---'}
            </Text>
          </View>
        </View>
      )}

      {/* Details Sheet */}
      <View style={styles.detailsSheet}>
        <Text style={styles.title}>Delivery Details</Text>
        
        <View style={styles.row}>
          <Ionicons name="person" size={20} color={COLORS.textSecondary} />
          <Text style={styles.text}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        
        <View style={styles.row}>
          <Ionicons name="location" size={20} color={COLORS.primary} />
          <Text style={styles.address}>{deliveryAddr?.address || 'No address'}</Text>
        </View>
        
        <View style={styles.row}>
          <Ionicons name="document-text" size={20} color={COLORS.textSecondary} />
          <Text style={styles.text}>{order.delivery_notes || 'No notes'}</Text>
        </View>

        {order.status === 'delivered' ? (
          <View style={styles.completedContainer}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            <Text style={styles.completedText}>Delivery Completed</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : !isTracking && !order.courier_accepted_at ? (
          <>
            <TouchableOpacity style={styles.startBtn} onPress={confirmPickup}>
              <Ionicons name="bag-check" size={24} color={COLORS.surface} />
              <Text style={styles.startText}>Confirm Pickup</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Go Back</Text>
            </TouchableOpacity>
          </>
        ) : !isTracking ? (
          <>
            <TouchableOpacity style={styles.startBtn} onPress={startDelivery}>
              <Ionicons name="play-circle" size={24} color={COLORS.surface} />
              <Text style={styles.startText}>Start Delivery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.mapsBtn} onPress={handleOpenMaps}>
              <Ionicons name="map" size={20} color={COLORS.primary} />
              <Text style={styles.mapsText}>Open in Maps</Text>
            </TouchableOpacity>

            {/* Swipe to Confirm */}
            <View style={styles.swipeContainer}>
              <Text style={styles.swipeLabel}>Swipe to Complete Delivery →</Text>
              <View style={styles.swipeTrack}>
                <Animated.View
                  style={[
                    styles.swipeThumb,
                    {
                      transform: [{ translateX: swipeAnimation }],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.surface} />
                </Animated.View>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.55,
  },
  loadingText: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 50,
  },
  statusBar: {
    position: 'absolute',
    top: 50,
    left: SPACING.m,
    right: SPACING.m,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.m,
    ...SHADOWS.medium,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  statusText: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  detailsSheet: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.l,
    ...SHADOWS.dark,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  text: {
    marginLeft: SPACING.m,
    ...FONTS.body2,
    color: COLORS.text,
  },
  address: {
    marginLeft: SPACING.m,
    ...FONTS.h4,
    color: COLORS.text,
    flex: 1,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.l,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.s,
    ...SHADOWS.medium,
  },
  startText: {
    ...FONTS.h3,
    color: COLORS.surface,
  },
  mapsBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.m,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.s,
  },
  mapsText: {
    ...FONTS.h4,
    color: COLORS.primary,
  },
  cancelBtn: {
    marginTop: SPACING.m,
    alignItems: 'center',
    padding: SPACING.s,
  },
  cancelText: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
  },
  swipeContainer: {
    marginTop: SPACING.l,
  },
  swipeLabel: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.s,
  },
  swipeTrack: {
    height: 60,
    backgroundColor: COLORS.success + '30',
    borderRadius: 30,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeThumb: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.success,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  courierMarker: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  completedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.l,
    gap: SPACING.m,
  },
  completedText: {
    ...FONTS.h2,
    color: COLORS.success,
  },
});
