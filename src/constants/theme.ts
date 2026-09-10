import { moderateScale, scale, verticalScale } from '../utils/responsive';

export const Spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

export const BorderRadius = {
  sm: moderateScale(6),
  md: moderateScale(12),
  lg: moderateScale(18),
  xl: moderateScale(24),
  pill: moderateScale(999),
};

export const Shadows = {
  glowPrimary: {
    shadowColor: '#1473E6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
};
