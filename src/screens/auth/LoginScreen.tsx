import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius } from '../../constants/theme';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
} from '../../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, continueAsGuest } = useAuth();
  const { showAlert } = useAlert();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({
        title: 'Required Fields',
        message: 'Please enter your email and password.',
        type: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      let success = false;
      if (isSignUp) {
        success = await signUpWithEmail(email.trim(), password, fullName.trim());
      } else {
        success = await signInWithEmail(email.trim(), password);
      }

      if (success) {
        navigation.replace('MainTabs');
      } else {
        showAlert({
          title: 'Authentication Failed',
          message: 'Please check your credentials and try again.',
          type: 'error',
        });
      }
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.message || 'Authentication error',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const ok = await signInWithGoogle();
      if (ok) {
        navigation.replace('MainTabs');
      }
    } catch (err: any) {
      console.log('Google sign-in notice:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = async () => {
    await continueAsGuest();
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Brand Hero with Logo */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/app_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>KP Scan</Text>
            <Text style={styles.subtitle}>
              Document scanner & cloud manager. Fast, secure, and multi-page.
            </Text>
          </View>

          {/* Form Tab Selector (Sign In / Register) */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, !isSignUp && styles.activeTabBtn]}
              onPress={() => setIsSignUp(false)}
            >
              <Text style={[styles.tabBtnText, !isSignUp && styles.activeTabText]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, isSignUp && styles.activeTabBtn]}
              onPress={() => setIsSignUp(true)}
            >
              <Text style={[styles.tabBtnText, isSignUp && styles.activeTabText]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email / Password Fields */}
          <View style={styles.inputCard}>
            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.primaryAuthButton}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryAuthText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <View style={styles.btnRow}>
              <Text style={styles.googleIconPlaceholder}>G</Text>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </View>
          </TouchableOpacity>

          {/* Continue as Guest Button */}
          <TouchableOpacity
            style={styles.guestButton}
            activeOpacity={0.7}
            onPress={handleGuestContinue}
            disabled={loading}
          >
            <Text style={styles.guestBtnText}>Skip / Continue as Guest</Text>
          </TouchableOpacity>

          {/* Scanned Files Privacy Guarantee */}
          <View style={styles.privacyNoteBox}>
            <Text style={styles.privacyNoteIcon}>🔒</Text>
            <Text style={styles.disclaimer}>
              <Text style={styles.boldNote}>Privacy Guarantee:</Text> Scanned document files are NEVER stored on remote servers. All scans stay safely in your phone’s local storage.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: verticalScale(20),
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(18),
  },
  logoContainer: {
    width: scale(84),
    height: scale(84),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(14),
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: normalizeFont(28),
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: normalizeFont(13),
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: verticalScale(6),
    paddingHorizontal: scale(20),
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    borderRadius: BorderRadius.pill,
    padding: 4,
    marginBottom: verticalScale(16),
    width: '100%',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(9),
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
  },
  activeTabBtn: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: normalizeFont(13),
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inputCard: {
    width: '100%',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: verticalScale(12),
    fontSize: normalizeFont(14),
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: verticalScale(10),
  },
  primaryAuthButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: verticalScale(48),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(4),
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryAuthText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(14),
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: verticalScale(16),
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: scale(10),
    color: Colors.textMuted,
    fontSize: normalizeFont(11),
    fontWeight: '700',
  },
  googleButton: {
    width: '100%',
    height: verticalScale(48),
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIconPlaceholder: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: '#4285F4',
    marginRight: scale(10),
  },
  googleBtnText: {
    fontSize: normalizeFont(14),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  guestButton: {
    paddingVertical: verticalScale(10),
  },
  guestBtnText: {
    fontSize: normalizeFont(14),
    color: Colors.primary,
    fontWeight: '700',
  },
  privacyNoteBox: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: verticalScale(16),
    borderWidth: 1,
    borderColor: '#EDE9FE',
    alignItems: 'flex-start',
  },
  privacyNoteIcon: {
    fontSize: moderateScale(14),
    marginRight: scale(8),
    marginTop: 2,
  },
  disclaimer: {
    flex: 1,
    fontSize: normalizeFont(11),
    color: Colors.textSecondary,
    lineHeight: normalizeFont(16),
  },
  boldNote: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});
