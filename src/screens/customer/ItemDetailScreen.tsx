import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../lib/CartContext';
import { Database } from '../../types/supabase';
import PremiumButton from '../../components/PremiumButton';
import PremiumInput from '../../components/PremiumInput';
import Animated, { FadeInDown, FadeIn, SlideInDown, Extrapolation, interpolate, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;

export default function ItemDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { item } = route.params as { item: MenuItem };
  const { addToCart } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const handleAddToCart = () => {
    addToCart(item, quantity, instructions);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <Animated.ScrollView 
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="fast-food" size={80} color={COLORS.textSecondary} />
            </View>
          )}
          <View style={styles.imageOverlay} />
        </Animated.View>

        <View style={styles.contentContainer}>
          <View style={styles.headerBar}>
            <View style={styles.dragHandle} />
          </View>

          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>₦{item.price.toFixed(2)}</Text>
            <Text style={styles.description}>{item.description || 'No description available.'}</Text>
          </Animated.View>
          
          <View style={styles.divider} />
          
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <PremiumInput
              placeholder="e.g. No onions, extra spicy..."
              value={instructions}
              onChangeText={setInstructions}
              multiline
              style={styles.instructionInput}
              containerStyle={{ height: 100 }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.quantityContainer}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton} 
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity 
                style={styles.quantityButton} 
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={{ height: 100 }} /> 
        </View>
      </Animated.ScrollView>

      {/* Floting Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      {/* Bottom Action Bar */}
      <Animated.View entering={SlideInDown.delay(400)} style={styles.footer}>
        <PremiumButton 
          title={`Add to Cart - ₦${(item.price * quantity).toFixed(2)}`}
          onPress={handleAddToCart}
          icon={<Ionicons name="cart" size={20} color={COLORS.textInverse} />}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  imageContainer: {
    height: IMG_HEIGHT,
    width: width,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: SIZES.margin,
    backgroundColor: COLORS.surface,
    padding: SPACING.s,
    borderRadius: SIZES.radiusFull,
    zIndex: 100,
    ...SHADOWS.medium,
  },
  contentContainer: {
    marginTop: IMG_HEIGHT - 30, // Overlap slightly
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: SIZES.padding,
    minHeight: 800, // Ensure scroll
    ...SHADOWS.medium,
  },
  headerBar: {
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  name: {
    ...FONTS.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  price: {
    ...FONTS.h2,
    color: COLORS.primary,
    marginBottom: SPACING.m,
  },
  description: {
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.l,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.s,
  },
  instructionInput: {
    height: '100%', 
    textAlignVertical: 'top',
    paddingTop: SPACING.s,
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
    marginTop: SPACING.m,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quantityButton: {
    padding: SPACING.s,
    borderRadius: SIZES.radiusSm,
  },
  quantityText: {
    ...FONTS.h3,
    marginHorizontal: SPACING.m,
    minWidth: 20,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.dark,
    zIndex: 100,
  },
});
