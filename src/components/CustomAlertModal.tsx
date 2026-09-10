import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors } from '../constants/colors';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface AlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

interface Props {
  visible: boolean;
  config: AlertConfig | null;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CustomAlertModal = ({ visible, config, onDismiss }: Props) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
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

  if (!config) return null;

  const { title, message, type = 'info', buttons } = config;

  // Default button if none provided
  const actionButtons: AlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default', onPress: onDismiss }];

  const getIconForType = () => {
    switch (type) {
      case 'success':
        return '💜';
      case 'warning':
        return '⚠️';
      case 'error':
        return '✕';
      case 'confirm':
        return '❓';
      case 'info':
      default:
        return '✨';
    }
  };

  const getBadgeColor = () => {
    switch (type) {
      case 'error':
        return '#FEE2E2';
      case 'warning':
        return '#FEF3C7';
      case 'success':
      case 'info':
      default:
        return '#EDE9FE';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
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
          <View style={[styles.badge, { backgroundColor: getBadgeColor() }]}>
            <Text style={styles.badgeIcon}>{getIconForType()}</Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonContainer,
              actionButtons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal,
            ]}
          >
            {actionButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnStyle: object = styles.btnPrimary;
              let textStyle: object = styles.btnTextPrimary;

              if (isCancel) {
                btnStyle = styles.btnCancel;
                textStyle = styles.btnTextCancel;
              } else if (isDestructive) {
                btnStyle = styles.btnDestructive;
                textStyle = styles.btnTextDestructive;
              }

              return (
                <TouchableOpacity
                  key={`btn_${idx}`}
                  style={[
                    styles.baseBtn,
                    btnStyle,
                    actionButtons.length <= 2 && styles.halfBtn,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    onDismiss();
                    if (btn.onPress) {
                      btn.onPress();
                    }
                  }}
                >
                  <Text style={[styles.baseBtnText, textStyle]}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: SCREEN_WIDTH - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13.5,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 6,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  baseBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtn: {
    flex: 1,
  },
  baseBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnTextPrimary: {
    color: '#FFFFFF',
  },
  btnCancel: {
    backgroundColor: '#F3F0FF',
  },
  btnTextCancel: {
    color: Colors.primary,
  },
  btnDestructive: {
    backgroundColor: '#FEE2E2',
  },
  btnTextDestructive: {
    color: '#EF4444',
  },
});
