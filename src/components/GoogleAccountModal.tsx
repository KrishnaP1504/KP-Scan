import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GoogleAccountModal = ({
  visible,
  onDismiss,
  onSuccess,
}: Props) => {
  const { signInWithGoogle, connectGoogleAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setEmail('');
      setStatusMessage(null);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleOneTapGoogle = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        onSuccess();
        onDismiss();
      } else {
        setStatusMessage('Google Play Services prompt closed or unavailable. You can also connect directly with your email below.');
      }
    } catch {
      setStatusMessage('Could not connect with Google. Enter your email below to proceed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailConnect = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setStatusMessage('Please enter a valid Google Account email.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const ok = await connectGoogleAccount(trimmed);
      if (ok) {
        onSuccess();
        onDismiss();
      } else {
        setStatusMessage('Failed to connect account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onDismiss}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Badge Icon */}
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>☁️</Text>
          </View>

          <Text style={styles.header}>Connect Google Drive</Text>
          <Text style={styles.subHeader}>
            Sign in to upload scanned PDFs directly to your Google Drive folders.
          </Text>

          {/* Status/Error notice if any */}
          {statusMessage ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          {/* One-Tap Google Sign-In Button */}
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={handleOneTapGoogle}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <View style={styles.googleBtnContent}>
                <Text style={styles.googleIconText}>G</Text>
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR LINK WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email input field */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Google Account Email</Text>
            <TextInput
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. name@gmail.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.linkBtn, !email.trim() && styles.linkBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleEmailConnect}
            disabled={isLoading || !email.trim()}
          >
            <Text style={styles.linkBtnText}>Link Account & Continue</Text>
          </TouchableOpacity>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.7}
            onPress={onDismiss}
            disabled={isLoading}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 40, 380),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
    borderColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeIcon: {
    fontSize: 28,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 6,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  statusText: {
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 16,
  },
  googleBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
    marginRight: 10,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  inputSection: {
    width: '100%',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  emailInput: {
    width: '100%',
    height: 46,
    backgroundColor: '#F8F9FD',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1E1B4B',
  },
  linkBtn: {
    width: '100%',
    height: 46,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  linkBtnDisabled: {
    opacity: 0.55,
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
});
