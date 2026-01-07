import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING } from '../constants/theme';
import PremiumButton from './PremiumButton';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export default function RatingModal({ visible, onClose, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await onSubmit(rating, comment);
      setComment('');
      setRating(5);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Rate your Order</Text>
          
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons 
                  name={star <= rating ? "star" : "star-outline"} 
                  size={32} 
                  color={COLORS.primary} 
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Write a review (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />

          <View style={styles.buttons}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <PremiumButton 
              title="Submit Review"
              onPress={handleSubmit}
              isLoading={submitting}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.m,
  },
  container: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    padding: SPACING.l,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.l,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SPACING.m,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.l,
    color: COLORS.text,
    fontFamily: FONTS.regular,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
  },
  cancelButton: {
    padding: SPACING.m,
  },
  cancelText: {
    ...FONTS.body3,
    color: COLORS.textSecondary,
  },
});
