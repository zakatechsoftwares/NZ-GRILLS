import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../lib/CartContext';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumButton from '../../components/PremiumButton';
import PremiumCard from '../../components/PremiumCard';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

export default function CartScreen() {
  const navigation = useNavigation();
  const { items, removeFromCart, updateQuantity, totalAmount } = useCart();

  const handleCheckout = () => {
    if (items.length === 0) return;
    navigation.navigate('Checkout' as never);
  };

  const renderItem = ({ item }: { item: any }) => (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} layout={FadeInRight}>
      <PremiumCard style={styles.cartItem}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>₦{item.price.toFixed(2)}</Text>
          {item.instructions ? (
              <Text style={styles.instructions} numberOfLines={1}>Note: {item.instructions}</Text>
          ) : null}
        </View>
        
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={styles.controlButton}>
            <Ionicons name="remove" size={16} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.controlButton}>
            <Ionicons name="add" size={16} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </PremiumCard>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Your Cart</Text>
        <TouchableOpacity onPress={() => {}} style={{ padding: SIZES.padding }}>
             {/* Optional trash all icon or similar */}
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="cart-outline" size={60} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubText}>Looks like you haven't added anything yet.</Text>
          <PremiumButton 
            title="Browse Menu" 
            onPress={() => navigation.goBack()} 
            style={{ marginTop: SIZES.margin, width: 200 }} 
          />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
          
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>₦{totalAmount.toFixed(2)}</Text>
            </View>
            <PremiumButton 
              title="Proceed to Checkout"
              onPress={handleCheckout}
            />
          </View>
        </>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  backButton: {
    padding: SPACING.s,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  list: {
    padding: SPACING.m,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
    padding: SPACING.m,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  itemPrice: {
    ...FONTS.body2,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  instructions: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.m,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: 2,
  },
  controlButton: {
    padding: 6,
    borderRadius: 4,
  },
  quantity: {
    marginHorizontal: SPACING.s,
    ...FONTS.h4,
    fontSize: 16,
  },
  removeButton: {
    padding: SPACING.s,
    backgroundColor: COLORS.error + '10',
    borderRadius: SIZES.radiusFull,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  emptyText: {
    ...FONTS.h2,
    color: COLORS.text,
    marginTop: SPACING.m,
  },
  emptySubText: {
    ...FONTS.body2,
    color: COLORS.textSecondary,
    marginBottom: SPACING.l,
  },
  footer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.dark,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
  },
  totalLabel: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  totalAmount: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
});
