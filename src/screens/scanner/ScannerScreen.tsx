import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { DocumentScannerService } from '../../services/DocumentScannerService';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius } from '../../constants/theme';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
} from '../../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'ScannerModal'>;

const SCAN_MODES = ['Whiteboard', 'Book', 'Document', 'ID card', 'Business'];

export const ScannerScreen = ({ navigation }: Props) => {
  const [activeMode, setActiveMode] = useState('Document');
  const [isLaunching, setIsLaunching] = useState(true);

  const getDefaultScanTitle = () => {
    const date = new Date();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `KP Scan ${day} ${month} ${year} (1)`;
  };

  useEffect(() => {
    let isActive = true;

    const startScan = async () => {
      const result = await DocumentScannerService.launchScanner();
      if (!isActive) return;

      if (result.status === 'SUCCESS' && result.scannedImages.length > 0) {
        navigation.replace('DocumentReview', {
          initialPages: result.scannedImages,
          documentTitle: getDefaultScanTitle(),
        });
      } else {
        navigation.goBack();
      }
    };

    startScan();

    return () => {
      isActive = false;
    };
  }, [navigation]);

  const handleManualShutter = async () => {
    const result = await DocumentScannerService.launchScanner();
    if (result.status === 'SUCCESS' && result.scannedImages.length > 0) {
      navigation.replace('DocumentReview', {
        initialPages: result.scannedImages,
        documentTitle: getDefaultScanTitle(),
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar with White & Purple styling */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.iconCircle}
        >
          <Text style={styles.topIcon}>🏠</Text>
        </TouchableOpacity>

        <View style={styles.topTitleBox}>
          <Text style={styles.scanHeaderTitle}>Camera Scanner</Text>
        </View>

        <TouchableOpacity style={styles.iconCircle}>
          <Text style={styles.topIcon}>⚡</Text>
        </TouchableOpacity>
      </View>

      {/* Central Viewfinder Area */}
      <View style={styles.viewfinder}>
        {isLaunching ? (
          <View style={styles.centerPrompt}>
            <View style={styles.spinnerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            <Text style={styles.promptText}>Activating Edge Detection Camera...</Text>
          </View>
        ) : (
          <View style={styles.frameContainer}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Text style={styles.guideText}>Align document within frame</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls with White & Purple theme */}
      <View style={styles.bottomControls}>
        <View style={styles.modeCarousel}>
          {SCAN_MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeTab,
                activeMode === mode && styles.activeModeTab,
              ]}
              onPress={() => setActiveMode(mode)}
            >
              <Text
                style={[
                  styles.modeText,
                  activeMode === mode && styles.activeModeText,
                ]}
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shutter and Quick Action Row */}
        <View style={styles.shutterRow}>
          <TouchableOpacity style={styles.galleryTrigger}>
            <Text style={styles.toolIcon}>🖼️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            activeOpacity={0.8}
            onPress={handleManualShutter}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashTrigger}>
            <Text style={styles.toolIcon}>🔦</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: verticalScale(10),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  iconCircle: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(19),
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topIcon: {
    fontSize: moderateScale(17),
  },
  topTitleBox: {
    alignItems: 'center',
  },
  scanHeaderTitle: {
    fontSize: normalizeFont(16),
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  viewfinder: {
    flex: 1,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPrompt: {
    alignItems: 'center',
  },
  spinnerBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(13.5),
    fontWeight: '600',
  },
  frameContainer: {
    width: '84%',
    height: '75%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
  },
  corner: {
    position: 'absolute',
    width: scale(26),
    height: scale(26),
    borderColor: Colors.primary,
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 3.5, borderLeftWidth: 3.5 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 3.5, borderRightWidth: 3.5 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 3.5, borderLeftWidth: 3.5 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 3.5, borderRightWidth: 3.5 },
  guideText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: normalizeFont(13),
    fontWeight: '600',
  },
  bottomControls: {
    backgroundColor: '#FFFFFF',
    paddingBottom: verticalScale(24),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  modeCarousel: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
  },
  modeTab: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: 12,
  },
  activeModeTab: {
    backgroundColor: '#F5F3FF',
  },
  modeText: {
    color: '#6B7280',
    fontSize: normalizeFont(13),
    fontWeight: '600',
  },
  activeModeText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: verticalScale(6),
  },
  galleryTrigger: {
    padding: scale(12),
    backgroundColor: '#F5F3FF',
    borderRadius: 22,
  },
  flashTrigger: {
    padding: scale(12),
    backgroundColor: '#F5F3FF',
    borderRadius: 22,
  },
  toolIcon: {
    fontSize: moderateScale(22),
  },
  shutterOuter: {
    width: scale(72),
    height: scale(72),
    borderRadius: moderateScale(36),
    borderWidth: 4,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shutterInner: {
    width: scale(54),
    height: scale(54),
    borderRadius: moderateScale(27),
    backgroundColor: Colors.primary,
  },
});
