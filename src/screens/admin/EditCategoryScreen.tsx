import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Switch } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, FONTS, SIZES } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';
import { createCategory, updateCategory, uploadCategoryImage } from '../../lib/api/categories';
import { Database } from '../../types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];

export default function EditCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingCategory = route.params?.category as Category | undefined;

  const [name, setName] = useState(editingCategory?.name || '');
  const [description, setDescription] = useState(editingCategory?.description || '');
  const [displayOrder, setDisplayOrder] = useState(editingCategory?.display_order?.toString() || '');
  const [isActive, setIsActive] = useState(editingCategory?.is_active ?? true);
  const [image, setImage] = useState(editingCategory?.image_url || null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to photos to upload images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
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

      if (!base64) throw new Error('No image data found');

      const publicUrl = await uploadCategoryImage(base64);
      setImage(publicUrl);
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveCategory = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Fields', 'Please enter a category name');
      return;
    }

    try {
      setLoading(true);
      const categoryData = {
        name: name.trim(),
        description: description.trim() || undefined,
        image_url: image || undefined,
        display_order: displayOrder ? parseInt(displayOrder) : undefined,
        is_active: isActive,
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
        Alert.alert('Success', 'Category updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        await createCategory(categoryData);
        Alert.alert('Success', 'Category created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
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
        <Text style={styles.title}>{editingCategory ? 'Edit Category' : 'Add New Category'}</Text>
      </View>

      <View style={styles.content}>
        {/* Image Picker */}
        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image" size={40} color={COLORS.textSecondary} />
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
          label="Category Name"
          placeholder="e.g. Burgers, Beverages"
          value={name}
          onChangeText={setName}
        />

        <PremiumInput
          label="Description"
          placeholder="Describe the category..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <PremiumInput
          label="Display Order (Optional)"
          placeholder="Leave empty for auto"
          value={displayOrder}
          onChangeText={setDisplayOrder}
          keyboardType="numeric"
        />

        <View style={styles.switchContainer}>
          <View>
            <Text style={styles.switchLabel}>Active Status</Text>
            <Text style={styles.switchSubtext}>
              {isActive ? 'Category is visible to customers' : 'Category is hidden'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
            thumbColor={isActive ? COLORS.primary : COLORS.textLight}
          />
        </View>

        <PremiumButton
          title={editingCategory ? 'Update Category' : 'Create Category'}
          onPress={saveCategory}
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
    height: 180,
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: SIZES.radius,
    marginBottom: SPACING.m,
  },
  switchLabel: {
    ...FONTS.body2,
    color: COLORS.text,
    fontFamily: FONTS.medium,
  },
  switchSubtext: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  saveButton: {
    marginTop: SPACING.m,
  },
});
