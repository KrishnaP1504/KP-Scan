import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Baseline guideline dimensions based on standard modern viewport (iPhone 14 / Pixel 7)
const GUIDELINE_BASE_WIDTH = 390;
const GUIDELINE_BASE_HEIGHT = 844;

/**
 * Standard A4 Aspect Ratio (ISO 216 paper standard: 1 : √2 ≈ 1 : 1.4142)
 * Useful for locking document review viewfinder & thumbnail proportions.
 */
export const A4_ASPECT_RATIO = 1 / 1.4142;

/**
 * Proportional width scale. Use for horizontal margins, paddings, and widths.
 */
export const scale = (size: number): number =>
  (WINDOW_WIDTH / GUIDELINE_BASE_WIDTH) * size;

/**
 * Proportional height scale. Use for vertical heights, margins, and paddings.
 */
export const verticalScale = (size: number): number =>
  (WINDOW_HEIGHT / GUIDELINE_BASE_HEIGHT) * size;

/**
 * Moderated scale with factor damping. Best for font sizes, border radiuses, and icons.
 * Factor 0.5 balances scaling between small and large viewports without stretching.
 */
export const moderateScale = (size: number, factor = 0.5): number =>
  size + (scale(size) - size) * factor;

/**
 * Normalizes font sizes against device pixel density and platform typography conventions.
 */
export const normalizeFont = (size: number): number => {
  const scaledSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize)) - 1;
};

export const SCREEN_WIDTH = WINDOW_WIDTH;
export const SCREEN_HEIGHT = WINDOW_HEIGHT;
export const IS_TABLET = WINDOW_WIDTH >= 768;
