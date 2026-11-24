import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CatalogDish, fetchCatalog, getMenuItemNames, importDishes } from '../../lib/api/catalog';
import { COLORS, SPACING, FONTS, SIZES } from '../../constants/theme';
import PremiumButton from '../../components/PremiumButton';

export default function ImportMenuScreen() {
  const navigation = useNavigation<any>();
  const [dishes, setDishes] = useState<CatalogDish[]>([]);
  const [onMenu, setOnMenu] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog, names] = await Promise.all([fetchCatalog(), getMenuItemNames()]);
      setDishes(catalog);
      setOnMenu(names);
      setPrices(Object.fromEntries(catalog.map(d => [d.id, String(d.suggestedPrice)])));
    } catch (error: any) {
      setLoadError(error.message || 'Could not load the catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(dishes.map(d => d.category))).sort()], [dishes]);
  const visible = category === 'All' ? dishes : dishes.filter(d => d.category === category);
  const isOnMenu = (dish: CatalogDish) => onMenu.has(dish.name.trim().toLowerCase());

  const toggle = (dish: CatalogDish) => {
    if (isOnMenu(dish)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(dish.id) ? next.delete(dish.id) : next.add(dish.id);
      return next;
    });
  };

  const handleImport = async () => {
    const chosen = dishes.filter(d => selected.has(d.id));
    const invalid = chosen.find(d => !(Number(prices[d.id]) > 0));
    if (invalid) {
      Alert.alert('Check price', `Enter a price for "${invalid.name}".`);
      return;
    }

    setImporting(true);
    try {
      const count = await importDishes(chosen.map(dish => ({ dish, price: Number(prices[dish.id]) })));
      Alert.alert('Imported', `${count} item${count === 1 ? '' : 's'} added to the menu.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Import failed', error.message || 'Could not import items');
    } finally {
      setImporting(false);
    }
  };

  const renderDish = ({ item }: { item: CatalogDish }) => {
    const added = isOnMenu(item);
    const checked = selected.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, checked && styles.cardSelected, added && styles.cardDisabled]}
        onPress={() => toggle(item)}
        activeOpacity={added ? 1 : 0.7}
      >
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{item.category} · {item.cuisine}</Text>
          {added ? (
            <Text style={styles.onMenu}>Already on menu</Text>
          ) : (
            <View style={styles.priceRow}>
              <Text style={styles.currency}>₦</Text>
              <TextInput
                style={styles.priceInput}
                value={prices[item.id]}
                onChangeText={text => setPrices(prev => ({ ...prev, [item.id]: text.replace(/[^0-9.]/g, '') }))}
                keyboardType="numeric"
              />
            </View>
          )}
        </View>
        {!added && (
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={26}
            color={checked ? COLORS.primary : COLORS.textLight}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Import from Catalog</Text>
      </View>
      <Text style={styles.subtitle}>Pick dishes from a sample catalog (DummyJSON) and set their prices.</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <PremiumButton title="Try Again" variant="outline" onPress={load} />
        </View>
      ) : (
        <>
          <View>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={c => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chip, category === item && styles.chipActive]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          <FlatList
            data={visible}
            keyExtractor={d => String(d.id)}
            renderItem={renderDish}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />

          <View style={styles.footer}>
            <PremiumButton
              title={selected.size ? `Import ${selected.size} item${selected.size === 1 ? '' : 's'}` : 'Select dishes to import'}
              onPress={handleImport}
              disabled={!selected.size}
              isLoading={importing}
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
    paddingHorizontal: SPACING.m,
  },
  backButton: {
    padding: SPACING.s,
    marginRight: SPACING.s,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.m,
    marginTop: SPACING.xs,
    marginBottom: SPACING.m,
  },
  chips: {
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.s,
  },
  chip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs + 2,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.s,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.s,
    marginBottom: SPACING.s,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: COLORS.primary,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.surfaceHighlight,
  },
  info: {
    flex: 1,
    marginHorizontal: SPACING.m,
  },
  name: {
    ...FONTS.body1,
    fontWeight: '600',
    color: COLORS.text,
  },
  meta: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
  onMenu: {
    ...FONTS.body3,
    color: COLORS.success,
    marginTop: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  currency: {
    color: COLORS.text,
    marginRight: 2,
  },
  priceInput: {
    minWidth: 80,
    paddingVertical: 2,
    paddingHorizontal: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusSm,
    color: COLORS.text,
  },
  footer: {
    padding: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  errorBox: {
    padding: SPACING.m,
    gap: SPACING.m,
  },
  errorText: {
    ...FONTS.body1,
    color: COLORS.error,
  },
});
