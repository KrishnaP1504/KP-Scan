import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/theme';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
} from '../../utils/responsive';
import { PermissionsUtil } from '../../utils/permissions';

interface SplashScreenProps {
  onInitialized?: () => void;
}

export const SplashScreen = ({ onInitialized }: SplashScreenProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Fluid entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Subtle continuous pulse on the brand logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Proactive initialization
    const prepareApp = async () => {
      try {
        await PermissionsUtil.checkCameraPermission();
      } catch (err) {
        console.warn('Initial permission check error:', err);
      } finally {
        const timer = setTimeout(() => {
          if (onInitialized) {
            onInitialized();
          }
        }, 1600);
        return () => clearTimeout(timer);
      }
    };

    prepareApp();
  }, [fadeAnim, scaleAnim, pulseAnim, onInitialized]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} translucent={false} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Animated App Logo Container */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/images/app_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Typography */}
        <Text style={styles.appName}>KP Scan</Text>
        <Text style={styles.appTagline}>Smart Mobile Scanner & Cloud Vault</Text>
      </Animated.View>

      {/* Footer Privacy & Storage Notice */}
      <View style={styles.footer}>
        <View style={styles.securityRow}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.footerText}>PRIVATE LOCAL STORAGE & GOOGLE DRIVE</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  logoWrapper: {
    width: scale(110),
    height: scale(110),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(18),
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: normalizeFont(32),
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1.2,
  },
  appTagline: {
    fontSize: normalizeFont(14),
    color: Colors.textSecondary,
    marginTop: verticalScale(8),
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: verticalScale(36),
    alignItems: 'center',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: moderateScale(11),
    marginRight: scale(6),
  },
  footerText: {
    fontSize: normalizeFont(11),
    color: Colors.textMuted,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});
