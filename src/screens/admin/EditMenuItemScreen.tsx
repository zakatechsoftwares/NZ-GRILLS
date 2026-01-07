import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import { Database } from '../../types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];

export default function EditMenuItemScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingItem = route.params?.item;

  const [name, setName] = useState(editingItem?.name || '');
  const [description, setDescription] = useState(editingItem?.description || '');
  const [price, setPrice] = useState(editingItem?.price?.toString() || '');
  const [categoryId, setCategoryId] = useState(editingItem?.category_id || '');
  const [image, setImage] = useState(editingItem?.image_url || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
    if (!categoryId && data && data.length > 0) {
      setCategoryId(data[0].id);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to photos to upload images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);
      const base64 = asset.base64;
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${fileName}`;
      const contentType = 'image/jpeg';

      if (!base64) throw new Error('No image data found');

      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(filePath, decode(base64), { contentType });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);

      setImage(publicUrl);
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveItem = async () => {
    if (!name || !price || !categoryId) {
      Alert.alert('Missing Fields', 'Please fill in name, price, and category');
      return;
    }

    try {
      setLoading(true);
      const itemData = {
        name,
        description,
        price: parseFloat(price),
        category_id: categoryId,
        image_url: image,
        is_available: true,
      };

      let error;
      if (editingItem) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update(itemData as any)
          .eq('id', editingItem.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('menu_items')
          .insert(itemData as any);
        error = insertError;
      }

      if (error) throw error;
      
      Alert.alert('Success', 'Menu item saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{editingItem ? 'Edit Item' : 'Add New Item'}</Text>
      </View>

      <View style={styles.content}>
        {/* Image Picker */}
        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera" size={40} color={COLORS.textSecondary} />
              <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Tap to Upload Image'}</Text>
            </View>
          )}
          {uploading && (
             <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
             </View>
          )}
        </TouchableOpacity>

        <PremiumInput
          label="Item Name"
          placeholder="e.g. Chicken Rice"
          value={name}
          onChangeText={setName}
        />

        <PremiumInput
          label="Price (₦)"
          placeholder="0.00"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        <PremiumInput
          label="Description"
          placeholder="Describe the dish..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, categoryId === cat.id && styles.catChipActive]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.catText, categoryId === cat.id && styles.catTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <PremiumButton
          title={editingItem ? 'Update Item' : 'Create Item'}
          onPress={saveItem}
          isLoading={loading}
          style={styles.saveButton}
        />
      </View>
    </ScrollView>
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
    marginBottom: SPACING.m,
  },
  backButton: {
    marginRight: SPACING.m,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  content: {
    padding: SPACING.m,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    marginBottom: SPACING.m,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
  },
  uploadText: {
    ...FONTS.body3,
    marginTop: SPACING.s,
    color: COLORS.textSecondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...FONTS.body2,
    color: COLORS.text,
    marginBottom: SPACING.s,
    marginTop: SPACING.s,
    fontFamily: FONTS.medium,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.l,
  },
  catChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.s,
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  catTextActive: {
    color: COLORS.textInverse,
    fontFamily: FONTS.bold,
  },
  saveButton: {
    marginTop: SPACING.m,
  },
});
