import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONTS, SIZES, SHADOWS } from '../../constants/theme';
import PremiumButton from '../../components/PremiumButton';
import PremiumInput from '../../components/PremiumInput';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

export default function PromotionsScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default 7 days
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleSend = async () => {
    if (!title || !body) {
      Alert.alert('Error', 'Please enter a title and message');
      return;
    }

    if (endDate <= startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Promotion Record
      const { data: promo, error: promoError } = await supabase
        .from('promotions')
        .insert({
          title,
          body,
          code: code || null,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        })
        .select()
        .single();

      if (promoError) throw promoError;

      // 2. Broadcast via Database Function
      const { error: broadcastError } = await supabase.rpc('broadcast_notification', {
        title,
        body,
        data: { 
          promotion_id: promo.id, 
          code, 
          valid_from: startDate.toISOString(),
          valid_until: endDate.toISOString() 
        }
      });

      if (broadcastError) {
        console.error('Broadcast error:', broadcastError);
        Alert.alert('Warning', 'Promotion saved but broadcast failed.');
      } else {
        Alert.alert('Success', 'Promotion broadcasted to all users!');
      }

      setTitle('');
      setBody('');
      setCode('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
  };

  const renderDatePicker = (
    label: string, 
    date: Date, 
    show: boolean, 
    setShow: (v: boolean) => void, 
    onChange: (e: any, d?: Date) => void
  ) => (
    <View style={styles.dateGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={styles.dateButton}>
        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
        <Text style={styles.dateText}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="default"
          onChange={onChange}
          minimumDate={new Date()}
        />
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Send Promotion</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <PremiumInput 
          placeholder="e.g. Lunch Special!"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter the notification body..."
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          placeholderTextColor={COLORS.textLight}
        />

        <View style={styles.row}>
          {renderDatePicker('Start Date', startDate, showStartPicker, setShowStartPicker, onStartChange)}
          {renderDatePicker('End Date', endDate, showEndPicker, setShowEndPicker, onEndChange)}
        </View>

        <Text style={styles.label}>Promo Code (Optional)</Text>
        <PremiumInput 
          placeholder="e.g. SAVE20"
          value={code}
          onChangeText={setCode}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ This will send a push notification to ALL registered users.
          </Text>
        </View>

        <PremiumButton 
          title="Broadcast Promotion"
          onPress={handleSend}
          isLoading={loading}
          style={styles.button}
        />
      </View>
    </ScrollView>
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
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: SIZES.radius,
    ...SHADOWS.light,
  },
  label: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: SPACING.s,
    marginTop: SPACING.m,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    padding: SPACING.m,
    height: 100,
    textAlignVertical: 'top',
    color: COLORS.text,
    fontFamily: FONTS.regular,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    marginTop: SPACING.xl,
  },
  infoBox: {
    backgroundColor: COLORS.info + '20', // transparent info color
    padding: SPACING.m,
    borderRadius: SIZES.radiusSm,
    marginTop: SPACING.m,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.info,
  },
  row: {
    flexDirection: 'column', 
    marginTop: SPACING.s,
  },
  dateGroup: {
    marginBottom: SPACING.s,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.m,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateText: {
    marginLeft: SPACING.s,
    color: COLORS.text,
    ...FONTS.body3,
  },
});
