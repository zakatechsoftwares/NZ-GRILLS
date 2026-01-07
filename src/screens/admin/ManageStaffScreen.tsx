import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import PremiumCard from '../../components/PremiumCard';
import PremiumInput from '../../components/PremiumInput';
import PremiumButton from '../../components/PremiumButton';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'staff' | 'courier' | 'customer';
};

export default function ManageStaffScreen() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'staff', 'courier'])
        .order('role');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      Alert.alert('Error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      // Search by email or name, limited to top 5
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      console.log('Attempting to update role:', { userId, newRole });
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Role update successful:', data);
      Alert.alert('Success', `User role updated to ${newRole}`);
      setRoleModalVisible(false);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      fetchStaff();
    } catch (error: any) {
      console.error('Update role error:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to update role. Check console for details.'
      );
    }
  };

  const renderRoleBadge = (role: string) => {
    let color = COLORS.textSecondary;
    if (role === 'admin') color = COLORS.error;
    if (role === 'staff') color = COLORS.primary;
    if (role === 'courier') color = COLORS.info;

    return (
      <View style={[styles.badge, { backgroundColor: color + '20' }]}>
        <Text style={[styles.badgeText, { color }]}>{role.toUpperCase()}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Profile }) => (
    <PremiumCard style={styles.card}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
           <Text style={styles.avatarText}>{item.full_name?.charAt(0) || item.email?.charAt(0) || '?'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.m }}>
          <Text style={styles.name}>{item.full_name || 'No Name'}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        {renderRoleBadge(item.role)}
      </View>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => {
            setSelectedUser(item);
            setRoleModalVisible(true);
        }}
      >
        <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </PremiumCard>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Staff Management</Text>
      
      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Add New Staff</Text>
        <View style={styles.searchRow}>
            <PremiumInput
                placeholder="Search by email..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
                <Ionicons name="search" size={24} color={COLORS.surface} />
            </TouchableOpacity>
        </View>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
            <View style={styles.searchResults}>
                <Text style={styles.subTitle}>Results</Text>
                {searchResults.map(user => (
                    <TouchableOpacity 
                        key={user.id} 
                        style={styles.resultItem}
                        onPress={() => {
                            setSelectedUser(user);
                            setRoleModalVisible(true);
                        }}
                    >
                        <Text style={styles.resultText}>{user.email} ({user.role})</Text>
                        <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                ))}
            </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Current Staff</Text>
      <FlatList
        data={users}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
      />

      {/* Role Selection Modal */}
      <Modal
        visible={roleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Assign Role</Text>
                <Text style={styles.modalSubtitle}>For {selectedUser?.full_name || selectedUser?.email}</Text>
                
                <TouchableOpacity style={styles.roleOption} onPress={() => updateUserRole(selectedUser!.id, 'customer')}>
                    <Ionicons name="person-outline" size={24} color={COLORS.textSecondary} />
                    <Text style={styles.roleText}>Customer (Remove Access)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.roleOption} onPress={() => updateUserRole(selectedUser!.id, 'staff')}>
                    <Ionicons name="restaurant-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.roleText}>Kitchen Staff</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.roleOption} onPress={() => updateUserRole(selectedUser!.id, 'courier')}>
                    <Ionicons name="bicycle-outline" size={24} color={COLORS.info} />
                    <Text style={styles.roleText}>Courier</Text>
                </TouchableOpacity>

                 <TouchableOpacity style={styles.roleOption} onPress={() => updateUserRole(selectedUser!.id, 'admin')}>
                    <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.error} />
                    <Text style={styles.roleText}>Admin</Text>
                </TouchableOpacity>

                <PremiumButton 
                    title="Cancel"
                    onPress={() => setRoleModalVisible(false)}
                    variant="secondary"
                    style={{ marginTop: SPACING.m }}
                />
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
    padding: SPACING.m,
  },
  header: {
    ...FONTS.h1,
    color: COLORS.text,
    marginBottom: SPACING.l,
    marginTop: SPACING.m,
  },
  sectionTitle: {
      ...FONTS.h3,
      color: COLORS.text,
      marginBottom: SPACING.s,
      marginTop: SPACING.m,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.surfaceHighlight,
      alignItems: 'center',
      justifyContent: 'center',
  },
  avatarText: {
      ...FONTS.h3,
      color: COLORS.text,
  },
  name: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  email: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: SPACING.s,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  list: {
    paddingBottom: 50,
  },
  editButton: {
      padding: SPACING.s,
  },
  searchSection: {
      marginBottom: SPACING.l,
  },
  searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.s,
  },
  searchBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radius,
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOWS.light,
  },
  searchResults: {
      marginTop: SPACING.m,
      backgroundColor: COLORS.surface,
      borderRadius: SIZES.radius,
      padding: SPACING.m,
  },
  subTitle: {
      ...FONTS.h4,
      color: COLORS.textSecondary,
      marginBottom: SPACING.s,
  },
  resultItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.s,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
  },
  resultText: {
      ...FONTS.body3,
      color: COLORS.text,
  },
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.l,
  },
  modalContent: {
      backgroundColor: COLORS.surface,
      width: '100%',
      borderRadius: SIZES.radius,
      padding: SPACING.l,
      ...SHADOWS.medium,
  },
  modalTitle: {
      ...FONTS.h2,
      color: COLORS.text,
      textAlign: 'center',
  },
  modalSubtitle: {
      ...FONTS.body2,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.l,
  },
  roleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.m,
      backgroundColor: COLORS.background,
      borderRadius: SIZES.radius,
      marginBottom: SPACING.s,
  },
  roleText: {
      marginLeft: SPACING.m,
      ...FONTS.h4,
      color: COLORS.text,
  },
});
