import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { getAddress, saveAddress } from '../../lib/api/addresses';
import { getCurrentLocation } from '../../lib/location';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import ScreenHeader from '../../components/ScreenHeader';

const LABEL_SUGGESTIONS = ['Hostel', 'Home', 'Office'];

// route.params.addressId: edit an existing address; omitted to add a new one
export default function AddressFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const addressId: string | undefined = route.params?.addressId;
  const { user } = useAuth();

  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(!!addressId);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!addressId) return;
    getAddress(addressId)
      .then(address => {
        if (!address) return;
        setLabel(address.label);
        setLine1(address.address_line1);
        setLine2(address.address_line2 || '');
        setCity(address.city || '');
        setPostalCode(address.postal_code || '');
        setIsDefault(!!address.is_default);
        if (address.latitude != null && address.longitude != null) {
          setCoords({ latitude: address.latitude, longitude: address.longitude });
        }
      })
      .catch(error => Alert.alert('Error', error.message || 'Failed to load address'))
      .finally(() => setLoading(false));
  }, [addressId]);

  const handleUseLocation = async () => {
    setLocating(true);
    const location = await getCurrentLocation();
    setLocating(false);
    if (location) {
      setCoords(location);
    } else {
      Alert.alert('Location unavailable', 'Allow location access to pin this address for your courier.');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!label.trim() || !line1.trim()) {
      Alert.alert('Error', 'Please enter a label and address');
      return;
    }

    setSaving(true);
    try {
      await saveAddress(
        user.id,
        {
          label: label.trim(),
          address_line1: line1.trim(),
          address_line2: line2.trim() || null,
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          is_default: isDefault,
        },
        addressId
      );
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={addressId ? 'Edit Address' : 'New Address'} />

      <View style={styles.form}>
        <PremiumInput label="Label" placeholder="e.g. Hostel" value={label} onChangeText={setLabel} />
        <View style={styles.chips}>
          {LABEL_SUGGESTIONS.map(suggestion => (
            <TouchableOpacity key={suggestion} style={styles.chip} onPress={() => setLabel(suggestion)}>
              <Text style={styles.chipText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PremiumInput
          label="Address"
          placeholder="Room 305, Student Hostel A"
          value={line1}
          onChangeText={setLine1}
        />
        <PremiumInput
          label="Landmark / Extra details (optional)"
          placeholder="Near the main gate"
          value={line2}
          onChangeText={setLine2}
        />
        <PremiumInput label="City (optional)" placeholder="Lagos" value={city} onChangeText={setCity} />
        <PremiumInput
          label="Postal Code (optional)"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="number-pad"
        />

        <TouchableOpacity style={styles.locationRow} onPress={handleUseLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Ionicons name={coords ? 'checkmark-circle' : 'navigate-outline'} size={22} color={COLORS.primary} />
          )}
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationTitle}>
              {coords ? 'Location pinned' : 'Use my current location'}
            </Text>
            <Text style={styles.locationHint}>
              {coords
                ? 'Tap to update. Couriers use this to find you.'
                : 'Optional. Helps couriers find you on the map.'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.defaultRow}>
          <Text style={styles.defaultText}>Set as default address</Text>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
      </View>

      <PremiumButton title="Save Address" onPress={handleSave} isLoading={saving} />
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  chips: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginTop: -SPACING.s,
  },
  chip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationTextWrap: {
    marginLeft: SPACING.m,
    flex: 1,
  },
  locationTitle: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  locationHint: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultText: {
    ...FONTS.body1,
    color: COLORS.text,
  },
});
