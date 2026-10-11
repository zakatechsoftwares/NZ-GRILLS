import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { Address, deleteAddress, formatAddress, listAddresses, setDefaultAddress } from '../../lib/api/addresses';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import PremiumCard from '../../components/PremiumCard';
import PremiumButton from '../../components/PremiumButton';
import ScreenHeader from '../../components/ScreenHeader';

// route.params.selectMode: opened from Checkout to pick a delivery address
export default function AddressesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const selectMode = !!route.params?.selectMode;
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setAddresses(await listAddresses());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handlePress = (address: Address) => {
    if (selectMode) {
      navigation.popTo('Checkout', { addressId: address.id });
    } else {
      navigation.navigate('AddressForm', { addressId: address.id });
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (!user) return;
    try {
      await setDefaultAddress(user.id, address.id);
      await load();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set default address');
    }
  };

  const handleDelete = (address: Address) => {
    Alert.alert('Delete Address', `Delete "${address.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddress(address.id);
            await load();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete address');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title={selectMode ? 'Delivery Address' : 'My Addresses'} />

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : addresses.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No saved addresses yet</Text>
        </View>
      ) : (
        addresses.map(address => (
          <TouchableOpacity key={address.id} onPress={() => handlePress(address)}>
            <PremiumCard style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.label}>{address.label}</Text>
                {address.is_default && <Text style={styles.defaultBadge}>Default</Text>}
              </View>
              <Text style={styles.addressText}>{formatAddress(address)}</Text>
              {!selectMode && (
                <View style={styles.actions}>
                  {!address.is_default && (
                    <TouchableOpacity onPress={() => handleSetDefault(address)}>
                      <Text style={styles.actionText}>Set as default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(address)}>
                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </PremiumCard>
          </TouchableOpacity>
        ))
      )}

      <PremiumButton
        title="Add New Address"
        variant="outline"
        onPress={() => navigation.navigate('AddressForm')}
        style={styles.addButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.m,
    paddingTop: 50,
    backgroundColor: COLORS.background,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    ...FONTS.body1,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
  card: {
    marginBottom: SPACING.m,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  label: {
    ...FONTS.h3,
    color: COLORS.text,
    marginLeft: SPACING.s,
    flex: 1,
  },
  defaultBadge: {
    fontSize: 12,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  addressText: {
    ...FONTS.body1,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.l,
    marginTop: SPACING.m,
  },
  actionText: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },
  deleteText: {
    color: COLORS.error,
  },
  addButton: {
    marginTop: SPACING.s,
  },
});
