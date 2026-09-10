import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { scale, verticalScale, normalizeFont } from '../utils/responsive';

interface Props {
  visible: boolean;
  message: string;
  icon?: string;
  duration?: number;
  onDismiss: () => void;
}

export const BottomToast = ({
  visible,
  message,
  icon = '✓',
  duration = 2200,
  onDismiss,
}: Props) => {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 40,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(60);
      opacity.setValue(0);
    }
  }, [visible, duration, translateY, opacity, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toast}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: verticalScale(32),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: 24,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    maxWidth: scale(320),
  },
  icon: {
    fontSize: normalizeFont(14),
    marginRight: scale(8),
  },
  message: {
    color: '#FFFFFF',
    fontSize: normalizeFont(13),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
