import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // Premium Palette
  primary: '#FF4B3A', // Vermilion Red-Orange (High appetite appeal)
  primaryDark: '#D43628',
  primaryLight: '#FFE0DD',
  
  secondary: '#2D3436', // Dark Slate
  secondaryLight: '#636E72',

  // Backgrounds
  background: '#F9FAFB', // Cool gray 50
  surface: '#FFFFFF',
  surfaceHighlight: '#F3F4F6',

  // Text
  text: '#111827', // Cool gray 900
  textSecondary: '#6B7280', // Cool gray 500
  textLight: '#9CA3AF', // Cool gray 400
  textInverse: '#FFFFFF',

  // Status
  success: '#10B981', // Emerald 500
  error: '#EF4444', // Red 500
  warning: '#F59E0B', // Amber 500
  info: '#3B82F6', // Blue 500

  // UI
  border: '#E5E7EB',
  divider: '#F3F4F6',
  backdrop: 'rgba(0, 0, 0, 0.4)',
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const SIZES = {
  width,
  height,
  radius: 16,
  radiusSm: 8,
  radiusLg: 24,
  radiusFull: 9999,
  margin: SPACING.m,
  padding: SPACING.m,
  // Common element sizes
  btnHeight: 56,
  inputHeight: 52,
  iconS: 16,
  iconM: 24,
  iconL: 32,
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.secondary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.secondary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5.46,
    elevation: 5,
  },
  dark: {
    shadowColor: COLORS.secondary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
};

export const FONTS = {
  // Using system weights for now, can be mapped to custom fonts
  largeTitle: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 32, fontWeight: '700' as const, color: COLORS.text },
  h1: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 28, fontWeight: '700' as const, color: COLORS.text },
  h2: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 24, fontWeight: '700' as const, color: COLORS.text },
  h3: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 20, fontWeight: '700' as const, color: COLORS.text },
  h4: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 18, fontWeight: '700' as const, color: COLORS.text },
  body1: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 16, lineHeight: 24, color: COLORS.text },
  body2: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 14, lineHeight: 22, color: COLORS.textSecondary },
  body3: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontSize: 12, lineHeight: 20, color: COLORS.textSecondary },
  regular: 'System', // Fallback
  medium: 'System', // Fallback
  bold: 'System', // Fallback
};

export const ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin',
  COURIER: 'courier',
} as const;

export const CURRENCY = '₦';
