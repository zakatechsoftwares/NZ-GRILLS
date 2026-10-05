import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../lib/CartContext';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumButton from '../../components/PremiumButton';
import PremiumInput from '../../components/PremiumInput';
import PremiumCard from '../../components/PremiumCard';
import FlutterwaveWebView from '../../components/FlutterwaveWebView';

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [address, setAddress] = useState('Room 305, Student Hostel A'); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Flutterwave Config
  // Generate a unique transaction reference
  const generateTxRef = () => `tx-ref-${Date.now()}`;
  const [txRef, setTxRef] = useState(generateTxRef());
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState(0);

  const FLUTTERWAVE_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-e4bb46908aa02f101fc0420306b1bc17-X';

  const handleFlutterwaveStart = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        // 1. Create order as pending FIRST
        const order = await createOrder('pending');
        setPendingOrderId(order.id);
        setPendingAmount(Number(order.total_amount));
        setTxRef(generateTxRef());
        setShowPaymentModal(true);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to initialize order');
      } finally {
        setLoading(false);
      }
  };

  const handleCashOrder = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        await createOrder('pending');
        handleSuccess();
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to place order');
      } finally {
        setLoading(false);
      }
  };

  const createOrder = async (paymentStatus: 'paid' | 'pending', transactionId?: string) => {
    if (!user) throw new Error('User not authenticated');

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: paymentStatus,
          delivery_address: { address },
          delivery_notes: 'Please ring the bell', // In a real app, bind this to an input
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
        special_instructions: item.instructions
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // The database prices items from the menu and recalculates the total
      const { data: pricedOrder, error: pricedError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      if (pricedError) throw pricedError;

      return pricedOrder;
  };

  const handleSuccess = () => {
    clearCart();
    setShowSuccess(true);
    setTimeout(() => {
        setShowSuccess(false);
        navigation.navigate('Orders');
    }, 2000);
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    try {
      setShowPaymentModal(false);
      setLoading(true);

      if (!pendingOrderId) {
          throw new Error('No pending order found');
      }

      // Verify payment via Database Function (Easier to deploy)
      const { data: verification, error: verifyError } = await supabase.rpc('verify_payment_flutterwave', {
        transaction_id: transactionId,
        order_id: pendingOrderId
      });

      if (verifyError) throw verifyError;
      
      // If edge function verification fails or returns error in body
      if (verification && !verification.success) {
          throw new Error(verification.error || 'Payment verification failed');
      }

      // If successful, show success screen
      handleSuccess();
      setPendingOrderId(null);

    } catch (error: any) {
       console.log('Verification failed', error);
       Alert.alert('Verification Failed', 'Payment not verified. Please contact support if you were charged.');
       // Optional: You could update order to 'failed' here
    } finally {
      setLoading(false);
      setTxRef(generateTxRef());
    }
  };

  const handlePaymentError = (error: string) => {
    setShowPaymentModal(false);
    Alert.alert('Payment Failed', error);
  };

  const handlePaymentClose = () => {
    setShowPaymentModal(false);
  };

  if (showSuccess) {
      return (
          <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
              <Text style={styles.successTitle}>Order Placed!</Text>
              <Text style={styles.successSub}>Your food is being prepared.</Text>
          </View>
      );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <PremiumCard>
            <View style={styles.row}>
                <Ionicons name="location-outline" size={24} color={COLORS.primary} style={styles.icon} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>Hostel Address</Text>
                    <Text style={styles.addressText}>{address}</Text>
                </View>
                <TouchableOpacity>
                   <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
            </View>
        </PremiumCard>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <TouchableOpacity onPress={() => setPaymentMethod('card')}>
            <PremiumCard style={[styles.paymentOption, paymentMethod === 'card' && styles.selectedOption]}>
                <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? COLORS.primary : COLORS.text} />
                <Text style={[styles.optionText, paymentMethod === 'card' && styles.selectedOptionText]}>Pay with Flutterwave</Text>
                {paymentMethod === 'card' && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
            </PremiumCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setPaymentMethod('cash')}>
            <PremiumCard style={[styles.paymentOption, paymentMethod === 'cash' && styles.selectedOption]}>
                <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash' ? COLORS.primary : COLORS.text} />
                <Text style={[styles.optionText, paymentMethod === 'cash' && styles.selectedOptionText]}>Cash on Delivery</Text>
                {paymentMethod === 'cash' && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
            </PremiumCard>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <PremiumCard>
            {items.map(item => (
                <View key={item.id} style={styles.summaryItem}>
                    <Text style={styles.summaryQty}>{item.quantity}x</Text>
                    <Text style={styles.summaryName}>{item.name}</Text>
                    <Text style={styles.summaryPrice}>₦{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total to Pay</Text>
                <Text style={styles.totalAmount}>₦{totalAmount.toFixed(2)}</Text>
            </View>
        </PremiumCard>
      </View>

      {paymentMethod === 'card' ? (
          <PremiumButton 
            title="Pay with Flutterwave"
            onPress={handleFlutterwaveStart}
            isLoading={loading}
            style={styles.placeOrderButton}
          />
      ) : (
          <PremiumButton 
            title="Place Order"
            onPress={handleCashOrder}
            isLoading={loading}
            style={styles.placeOrderButton}
          />
      )}

      {/* Flutterwave Payment Modal */}
      <FlutterwaveWebView
        visible={showPaymentModal}
        publicKey={FLUTTERWAVE_PUBLIC_KEY}
        txRef={txRef}
        amount={pendingAmount}
        currency="NGN"
        customerEmail={user?.email || 'customer@nzgrills.com'}
        customerName="NZ Grills User"
        customerPhone="08012345678"
        onClose={handlePaymentClose}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.m,
    paddingTop: 50,
    backgroundColor: COLORS.background,
    paddingBottom: 50,
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
  section: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.m,
  },
  addressLabel: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  addressText: {
    ...FONTS.body1,
    color: COLORS.text,
  },
  editText: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.s,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  optionText: {
    flex: 1,
    marginLeft: SPACING.m,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.medium,
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  summaryQty: {
    width: 30,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  summaryName: {
    flex: 1,
    ...FONTS.body1,
    color: COLORS.text,
  },
  summaryPrice: {
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
    ...FONTS.h1,
    color: COLORS.primary,
  },
  placeOrderButton: {
    marginTop: SPACING.m,
  },
  successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
  },
  successTitle: {
      ...FONTS.largeTitle,
      color: COLORS.text,
      marginTop: SPACING.l,
  },
  successSub: {
      ...FONTS.body1,
      color: COLORS.textSecondary,
      marginTop: SPACING.s,
  },
});
