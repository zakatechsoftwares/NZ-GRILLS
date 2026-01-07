import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Database } from '../../types/supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function MenuManagementScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({}); // For Add/Edit

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [itemsRes, catRes] = await Promise.all([
      supabase.from('menu_items').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*')
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('menu_items').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        } 
      }
    ]);
  };

  const handleSave = async () => {
    if (!editingItem.name || !editingItem.price || !editingItem.category_id) {
        Alert.alert('Error', 'Please fill required fields (Name, Price, Category)');
        return;
    }

    try {
        if (editingItem.id) {
             // Update
             const { error } = await supabase.from('menu_items').update(editingItem as any).eq('id', editingItem.id);
             if (error) throw error;
        } else {
            // Create
            const { error } = await supabase.from('menu_items').insert(editingItem as any);
            if (error) throw error;
        }
        setModalVisible(false);
        fetchData();
    } catch (error: any) {
        Alert.alert('Error', error.message);
    }
  };

  const openAddModal = () => {
      setEditingItem({ category_id: categories[0]?.id || '' }); // Default to first cat
      setModalVisible(true);
  };

  const openEditModal = (item: MenuItem) => {
      setEditingItem(item);
      setModalVisible(true);
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.card}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Menu Items</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
                <Ionicons name="add" size={24} color={COLORS.surface} />
            </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={COLORS.primary} /> : (
            <FlatList 
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
            />
        )}

        {/* Edit/Add Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={styles.modalBg}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{editingItem.id ? 'Edit Item' : 'Add Item'}</Text>
                    
                    <TextInput 
                        style={styles.input} 
                        placeholder="Item Name" 
                        value={editingItem.name} 
                        onChangeText={t => setEditingItem({...editingItem, name: t})} 
                    />
                    
                    <TextInput 
                        style={styles.input} 
                        placeholder="Price" 
                        keyboardType="numeric"
                        value={editingItem.price?.toString()} 
                        onChangeText={t => setEditingItem({...editingItem, price: parseFloat(t) || 0})} 
                    />

                    <TextInput 
                        style={styles.input} 
                        placeholder="Description" 
                        value={editingItem.description || ''} 
                        onChangeText={t => setEditingItem({...editingItem, description: t})} 
                    />

                    {/* Simple Category Selection (could be dropdown) */}
                    <Text style={styles.label}>Category ID (Use ID for now)</Text>
                    <TextInput 
                        style={styles.input} 
                        value={editingItem.category_id} 
                        onChangeText={t => setEditingItem({...editingItem, category_id: t})} 
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  title: {
      fontSize: 24,
      fontFamily: FONTS.bold,
      color: COLORS.text,
  },
  addBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
  },
  list: { padding: SPACING.m },
  card: {
      backgroundColor: COLORS.surface,
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.m,
      borderRadius: 12,
      marginBottom: SPACING.s,
      elevation: 2,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  itemPrice: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.primary },
  itemDesc: { fontSize: 12, color: COLORS.textSecondary },
  actions: { flexDirection: 'row' },
  editBtn: { padding: SPACING.s, marginRight: SPACING.s },
  deleteBtn: { padding: SPACING.s },
  
  // Modal Styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.m },
  modalContent: { backgroundColor: COLORS.surface, padding: SPACING.l, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontFamily: FONTS.bold, marginBottom: SPACING.m, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.s, marginBottom: SPACING.m },
  label: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { padding: SPACING.m },
  saveBtn: { backgroundColor: COLORS.primary, padding: SPACING.m, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  cancelText: { color: COLORS.textSecondary, fontFamily: FONTS.medium },
  saveText: { color: COLORS.surface, fontFamily: FONTS.bold },
});
