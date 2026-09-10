/**
 * Modern White & Purple Color Palette for KP Scan
 */
export const Colors = {
  // Backgrounds (Clean White & Soft Lavender/Slate)
  background: '#F8F9FD',
  backgroundSecondary: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F3FF',
  surfaceHighlight: '#EDE9FE',

  // Primary Branding - Vibrant Royal Purple
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  primaryLight: '#8B5CF6',
  primaryMuted: 'rgba(124, 58, 237, 0.12)',
  brandPurpleLight: '#A78BFA',
  brandPurpleDark: '#5B21B6',

  // Accents & Actions
  accentTeal: '#0D9488',
  accentPurple: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Typography (Dark & Crisp for High Readability)
  textPrimary: '#1E1B4B',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textDisabled: '#D1D5DB',

  // Borders & Dividers
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#F3F4F6',

  // Overlays
  scrim: 'rgba(15, 23, 42, 0.55)',
  viewfinderBorder: '#7C3AED',
  edgeDetectionFill: 'rgba(124, 58, 237, 0.25)',
} as const;

export type ColorName = keyof typeof Colors;
