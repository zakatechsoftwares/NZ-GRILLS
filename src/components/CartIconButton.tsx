import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../lib/CartContext';
import { COLORS, FONTS } from '../constants/theme';

// Cart icon with the number of items in the cart
export default function CartIconButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const navigation = useNavigation<any>();
  const { itemCount } = useCart();

  return (
    <TouchableOpacity style={style} onPress={() => navigation.navigate('Cart')}>
      <Ionicons name="cart-outline" size={24} color={COLORS.text} />
      {itemCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: COLORS.textInverse,
    fontSize: 10,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
});
