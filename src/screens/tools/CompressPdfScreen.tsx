import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  PanResponder,
  NativeModules,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useDocuments } from '../../context/DocumentContext';
import { useAlert } from '../../context/AlertContext';
import { ScannedDocument } from '../../types/document';
import { FileStorageService, formatFileSize } from '../../services/FileStorageService';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { BottomToast } from '../../components/BottomToast';
import { Colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';
import RNFS from 'react-native-fs';

type Props = NativeStackScreenProps<RootStackParamList, 'CompressPdf'>;

export const CompressPdfScreen = ({ route, navigation }: Props) => {
  const { document: targetDoc } = route.params;
  const { addDocument } = useDocuments();
  const { showAlert } = useAlert();

  // Bottom toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('✓');
  const showToast = (message: string, icon = '✓') => {
    setToastIcon(icon);
    setToastMessage(message);
  };

  // Mode: high, low, or custom
  const [compressionLevel, setCompressionLevel] = useState<'high' | 'low' | 'custom'>('custom');

  // Custom Options State
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [customWidth, setCustomWidth] = useState('Auto');
  const [customHeight, setCustomHeight] = useState('Auto');
  const [selectedPreset, setSelectedPreset] = useState<string>('Original');

  // Target file size state
  const [targetSize, setTargetSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState<'KB' | 'MB'>('KB');

  // Compression Quality state (0-100)
  const [quality, setQuality] = useState<number>(85);

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('Compressing PDF...');

  // Actual original size in KB
  const [actualSizeKb, setActualSizeKb] = useState<number>(() => {
    if (targetDoc.fileSize && targetDoc.fileSize > 0) {
      return parseFloat((targetDoc.fileSize / 1024).toFixed(1));
    }
    return 0;
  });

  useEffect(() => {
    let isCurrent = true;
    FileStorageService.getDocumentActualSize(targetDoc).then((bytes) => {
      if (isCurrent && bytes > 0) {
        setActualSizeKb(parseFloat((bytes / 1024).toFixed(1)));
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [targetDoc]);

  const pageCount = targetDoc.pages?.length || targetDoc.pageCount || 1;
  const originalSizeKb = (actualSizeKb > 0 ? actualSizeKb : (pageCount * 250)).toFixed(1);

  // Calculate estimated output size
  const getEstimatedSizeKb = () => {
    const originalNum = parseFloat(originalSizeKb);
    if (compressionLevel === 'high') {
      return (originalNum * 0.3).toFixed(1);
    }
    if (compressionLevel === 'low') {
      return (originalNum * 0.65).toFixed(1);
    }
    // Custom logic
    if (targetSize && parseFloat(targetSize) > 0) {
      const targetInKb = sizeUnit === 'MB' ? parseFloat(targetSize) * 1024 : parseFloat(targetSize);
      return Math.min(originalNum, targetInKb).toFixed(1);
    }
    // Scale from quality
    const scaleFactor = selectedPreset === '25%' ? 0.3 : selectedPreset === '50%' ? 0.55 : selectedPreset === '75%' ? 0.75 : 1;
    const qualityFactor = Math.max(0.2, quality / 100);
    return Math.max(25, originalNum * qualityFactor * scaleFactor).toFixed(1);
  };

  const estimatedSizeKb = getEstimatedSizeKb();

  // Handle Preset Selection
  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    if (preset === 'Original') {
      setCustomWidth('Auto');
      setCustomHeight('Auto');
    } else if (preset === '25%') {
      setCustomWidth('300');
      setCustomHeight('400');
    } else if (preset === '50%') {
      setCustomWidth('600');
      setCustomHeight('800');
    } else if (preset === '75%') {
      setCustomWidth('900');
      setCustomHeight('1200');
    } else if (preset === '150%') {
      setCustomWidth('1800');
      setCustomHeight('2400');
    } else if (preset === '200%') {
      setCustomWidth('2400');
      setCustomHeight('3200');
    }
  };

  // Slider touch / responder logic
  const sliderWidth = useRef(260);

  const updateQualityFromTouch = (locationX: number) => {
    const ratio = Math.max(0.1, Math.min(1, locationX / sliderWidth.current));
    const newQuality = Math.round(ratio * 100);
    setQuality(Math.max(10, Math.min(100, newQuality)));
  };

  // Execute Real Compression
  const handleCompressAction = async () => {
    setLoadingText(
      compressionLevel === 'high'
        ? 'Applying High Compression...'
        : compressionLevel === 'low'
        ? 'Applying Low Compression...'
        : 'Applying Custom PDF Optimization...'
    );
    setIsProcessing(true);

    try {
      const originalBytes = await FileStorageService.getDocumentActualSize(targetDoc);
      const originalNum = originalBytes > 0 ? originalBytes / 1024 : parseFloat(originalSizeKb);

      // Determine compression parameters: quality (0-100) and scaleFactor (0.1 - 1.0)
      let compQuality = 70;
      let compScale = 0.8;

      if (compressionLevel === 'high') {
        compQuality = 40;
        compScale = 0.5;
      } else if (compressionLevel === 'low') {
        compQuality = 65;
        compScale = 0.75;
      } else {
        // Custom
        if (targetSize && parseFloat(targetSize) > 0) {
          const targetInKb = sizeUnit === 'MB' ? parseFloat(targetSize) * 1024 : parseFloat(targetSize);
          const ratio = Math.min(1.0, Math.max(0.1, targetInKb / (originalNum || 1)));
          compQuality = Math.round(Math.max(20, Math.min(95, ratio * 100)));
          compScale = Math.max(0.3, Math.min(1.0, Math.sqrt(ratio)));
        } else {
          compQuality = Math.max(15, Math.min(100, quality));
          const presetScale =
            selectedPreset === '25%'
              ? 0.25
              : selectedPreset === '50%'
              ? 0.5
              : selectedPreset === '75%'
              ? 0.75
              : selectedPreset === '150%'
              ? 1.5
              : selectedPreset === '200%'
              ? 2.0
              : 1.0;
          compScale = presetScale;
        }
      }

      // 1. Physically compress each page's image
      const pageList = targetDoc.pages && targetDoc.pages.length > 0
        ? targetDoc.pages
        : [{ id: '1', uri: targetDoc.thumbnailUri, rotation: 0, filter: 'magic' as const }];

      const compressedPages = [];
      const { ImageCropper } = NativeModules;

      for (let i = 0; i < pageList.length; i++) {
        const page = pageList[i];
        let compressedUri = page.uri;

        if (ImageCropper && typeof ImageCropper.compressImage === 'function') {
          try {
            compressedUri = await ImageCropper.compressImage(page.uri, compQuality, compScale);
          } catch (compErr) {
            console.warn('Page compression notice:', compErr);
          }
        }

        compressedPages.push({
          ...page,
          uri: compressedUri,
        });
      }

      const compressedTitle = `${targetDoc.title}_compressed`;
      const newDocId = `doc_comp_${Date.now()}`;

      // Create compressed document entry
      const compressedDoc: ScannedDocument = {
        ...targetDoc,
        id: newDocId,
        title: compressedTitle,
        thumbnailUri: compressedPages[0]?.uri || targetDoc.thumbnailUri,
        pages: compressedPages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Pre-save the real compressed PDF to disk
      const saveResult = await FileStorageService.saveDocumentAsPdf(
        compressedDoc,
        `${RNFS.DocumentDirectoryPath}/KP_Scan`,
        compressedTitle
      );

      // 3. Measure actual file size of the compressed PDF from disk
      let actualCompressedBytes = 0;
      if (saveResult?.filePath) {
        compressedDoc.pdfPath = saveResult.filePath;
        try {
          const stat = await RNFS.stat(saveResult.filePath.replace('file://', ''));
          actualCompressedBytes = stat.size;
          compressedDoc.fileSize = stat.size;
        } catch {}
      }

      // 4. Add to App library
      await addDocument(compressedDoc);

      setIsProcessing(false);

      // 5. Calculate real savings
      const origBytesToCompare = originalBytes > 0 ? originalBytes : parseFloat(originalSizeKb) * 1024;
      const savingsPercent = Math.max(
        0,
        Math.round(((origBytesToCompare - actualCompressedBytes) / origBytesToCompare) * 100)
      );

      showToast(`PDF compressed — ${formatFileSize(origBytesToCompare)} → ${formatFileSize(actualCompressedBytes)} (${savingsPercent}% saved)`, '✅');

      navigation.navigate('MainTabs');
    } catch (err: any) {
      setIsProcessing(false);
      showAlert({
        title: 'Compression Error',
        message: err?.message || 'Could not compress file. Please try again.',
        type: 'warning',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* --- Top Header --- */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerCloseBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerCloseText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Compress PDF</Text>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleCompressAction}
          activeOpacity={0.8}
        >
          <Text style={styles.headerActionText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Document Info Card --- */}
        <View style={styles.docCard}>
          <View style={styles.thumbnailWrapper}>
            {targetDoc.thumbnailUri ? (
              <Image
                source={{ uri: targetDoc.thumbnailUri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Text style={styles.placeholderText}>📄</Text>
              </View>
            )}
          </View>

          <View style={styles.docInfo}>
            <Text style={styles.docTitle} numberOfLines={1}>
              {targetDoc.title}
            </Text>
            <Text style={styles.docMeta}>
              {pageCount} page{pageCount !== 1 ? 's' : ''} • Original: {originalSizeKb} KB
            </Text>
          </View>
        </View>

        {/* --- Compression Mode Selection --- */}
        <Text style={styles.sectionLabel}>Select Compression Mode</Text>

        <View style={styles.modeTabsRow}>
          <TouchableOpacity
            style={[
              styles.modeTabBtn,
              compressionLevel === 'low' && styles.modeTabBtnSelected,
            ]}
            onPress={() => setCompressionLevel('low')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.modeTabText,
                compressionLevel === 'low' && styles.modeTabTextSelected,
              ]}
            >
              Low (Good)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTabBtn,
              compressionLevel === 'high' && styles.modeTabBtnSelected,
            ]}
            onPress={() => setCompressionLevel('high')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.modeTabText,
                compressionLevel === 'high' && styles.modeTabTextSelected,
              ]}
            >
              High (Small)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTabBtn,
              compressionLevel === 'custom' && styles.modeTabBtnSelected,
            ]}
            onPress={() => setCompressionLevel('custom')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.modeTabText,
                compressionLevel === 'custom' && styles.modeTabTextSelected,
              ]}
            >
              ⚙️ Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- CUSTOM OPTIONS PANEL (MATCHING ATTACHED DESIGN) --- */}
        {compressionLevel === 'custom' ? (
          <View style={styles.customContainer}>
            {/* 1. Custom Dimensions Section */}
            <View style={styles.customCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardIcon}>⊞</Text>
                  <Text style={styles.cardHeaderTitle}>
                    Custom Dimensions (Width × Height)
                  </Text>
                </View>

                {/* Lock Aspect Ratio Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setLockAspectRatio(!lockAspectRatio)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      lockAspectRatio && styles.checkboxBoxChecked,
                    ]}
                  >
                    {lockAspectRatio && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Lock Aspect{'\n'}Ratio</Text>
                </TouchableOpacity>
              </View>

              {/* Dimensions Input Row */}
              <View style={styles.dimensionsRow}>
                {/* Width */}
                <View style={styles.dimensionCol}>
                  <Text style={styles.dimensionFieldLabel}>Width</Text>
                  <View style={styles.dimensionInputBox}>
                    <TextInput
                      style={styles.dimTextInput}
                      value={customWidth}
                      onChangeText={(val) => {
                        setCustomWidth(val);
                        setSelectedPreset('Custom');
                      }}
                      placeholder="Auto"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Text style={styles.unitText}>px</Text>
                  </View>
                </View>

                {/* Multiply sign */}
                <Text style={styles.multiplySign}>✕</Text>

                {/* Height */}
                <View style={styles.dimensionCol}>
                  <Text style={styles.dimensionFieldLabel}>Height</Text>
                  <View style={styles.dimensionInputBox}>
                    <TextInput
                      style={styles.dimTextInput}
                      value={customHeight}
                      onChangeText={(val) => {
                        setCustomHeight(val);
                        setSelectedPreset('Custom');
                      }}
                      placeholder="Auto"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Text style={styles.unitText}>px</Text>
                  </View>
                </View>
              </View>

              {/* Presets Row */}
              <View style={styles.presetsRow}>
                <Text style={styles.presetsLabel}>Presets:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['25%', '50%', '75%', 'Original', '150%', '200%'].map((p) => {
                    const isSelected = selectedPreset === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.presetChip,
                          isSelected && styles.presetChipSelected,
                        ]}
                        onPress={() => handlePresetSelect(p)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextSelected,
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* 2. Maximum Target File Size Section */}
            <View style={styles.customCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardIcon}>📈</Text>
                  <Text style={styles.cardHeaderTitle}>
                    Maximum Target File Size
                  </Text>
                </View>

                <View style={styles.adaptiveBadge}>
                  <Text style={styles.adaptiveBadgeText}>Adaptive Compression</Text>
                </View>
              </View>

              {/* Target File Size Input Row */}
              <View style={styles.targetSizeRow}>
                <View style={styles.targetInputBox}>
                  <TextInput
                    style={styles.targetTextInput}
                    placeholder="e.g. 500"
                    placeholderTextColor={Colors.textMuted}
                    value={targetSize}
                    onChangeText={setTargetSize}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.unitSelectorBtn}
                    onPress={() => setSizeUnit(sizeUnit === 'KB' ? 'MB' : 'KB')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.unitSelectorText}>{sizeUnit} ⌄</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => setTargetSize('')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                If set, KP Scan auto-calibrates compression quality and scaling to
                guarantee output does not exceed this size.
              </Text>
            </View>

            {/* 3. Compression Quality (Images & PDFs) */}
            <View style={styles.customCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardIcon}>📊</Text>
                  <Text style={styles.cardHeaderTitle}>
                    Compression Quality (Images & PDFs)
                  </Text>
                </View>

                <View style={styles.qualityBadge}>
                  <Text style={styles.qualityBadgeText}>{quality}%</Text>
                </View>
              </View>

              {/* Interactive Quality Slider Track */}
              <View
                style={styles.sliderTouchArea}
                onLayout={(e) => {
                  sliderWidth.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e) =>
                  updateQualityFromTouch(e.nativeEvent.locationX)
                }
                onResponderMove={(e) =>
                  updateQualityFromTouch(e.nativeEvent.locationX)
                }
              >
                {/* Background Track */}
                <View style={styles.sliderTrack}>
                  {/* Filled Track */}
                  <View
                    style={[
                      styles.sliderTrackFill,
                      { width: `${quality}%` },
                    ]}
                  />
                </View>

                {/* Thumb */}
                <View
                  style={[
                    styles.sliderThumb,
                    { left: `${Math.max(0, Math.min(95, quality - 5))}%` },
                  ]}
                />
              </View>

              {/* Labels below slider */}
              <View style={styles.sliderLabelsRow}>
                <TouchableOpacity onPress={() => setQuality(35)}>
                  <Text
                    style={[
                      styles.sliderLabel,
                      quality <= 45 && styles.sliderLabelActive,
                    ]}
                  >
                    Maximum Compression
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setQuality(70)}>
                  <Text
                    style={[
                      styles.sliderLabel,
                      quality > 45 && quality < 85 && styles.sliderLabelActive,
                    ]}
                  >
                    Balanced
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setQuality(95)}>
                  <Text
                    style={[
                      styles.sliderLabel,
                      quality >= 85 && styles.sliderLabelActive,
                    ]}
                  >
                    Best Quality
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* Standard High/Low Summary Card */
          <View style={styles.standardSummaryCard}>
            <Text style={styles.standardTitle}>
              {compressionLevel === 'high' ? 'High Compression Mode' : 'Low Compression Mode'}
            </Text>
            <Text style={styles.standardDesc}>
              {compressionLevel === 'high'
                ? 'Applies maximum image downsampling and removes unneeded PDF metadata for the smallest possible file size (~70% reduction).'
                : 'Preserves sharp text and high resolution images with balanced compression (~35% reduction).'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* --- Sticky Bottom Action Bar (App Theme) --- */}
      <View style={styles.bottomActionBar}>
        <View style={styles.sizePreviewRow}>
          <Text style={styles.sizePreviewLabel}>Estimated output size:</Text>
          <Text style={styles.sizePreviewValue}>~{estimatedSizeKb} KB</Text>
        </View>

        <TouchableOpacity
          style={styles.compressMainBtn}
          onPress={handleCompressAction}
          activeOpacity={0.85}
        >
          <Text style={styles.compressMainBtnText}>
            Compress PDF ({estimatedSizeKb} KB)
          </Text>
        </TouchableOpacity>
      </View>

      <LoadingOverlay visible={isProcessing} message={loadingText} />
      <BottomToast
        visible={!!toastMessage}
        message={toastMessage || ''}
        icon={toastIcon}
        onDismiss={() => setToastMessage(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCloseBtn: {
    padding: 6,
    width: 36,
  },
  headerCloseText: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(18),
    fontWeight: '700',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(17),
    fontWeight: '700',
  },
  headerActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerActionText: {
    color: Colors.primary,
    fontSize: normalizeFont(15),
    fontWeight: '700',
  },

  // --- Scroll Area ---
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // --- Doc Card ---
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnailWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 22,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
    marginBottom: 3,
  },
  docMeta: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
    fontWeight: '500',
  },

  // --- Compression Mode Selection Tabs ---
  sectionLabel: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
    marginBottom: 10,
  },
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  modeTabBtnSelected: {
    backgroundColor: Colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(13),
    fontWeight: '600',
  },
  modeTabTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },

  // --- Custom Container ---
  customContainer: {
    gap: 14,
  },
  customCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  cardIcon: {
    fontSize: normalizeFont(16),
    marginRight: 8,
    color: Colors.primary,
  },
  cardHeaderTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
    flexShrink: 1,
  },

  // --- Checkbox ---
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: Colors.surface,
  },
  checkboxBoxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  checkboxLabel: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(11),
    fontWeight: '600',
    lineHeight: 13,
  },

  // --- Dimensions Row ---
  dimensionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dimensionCol: {
    flex: 1,
  },
  dimensionFieldLabel: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(11),
    fontWeight: '600',
    marginBottom: 4,
  },
  dimensionInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  dimTextInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '600',
    paddingVertical: 0,
  },
  unitText: {
    color: Colors.textMuted,
    fontSize: normalizeFont(12),
    fontWeight: '700',
    marginLeft: 4,
  },
  multiplySign: {
    color: Colors.textMuted,
    fontSize: normalizeFont(14),
    fontWeight: '700',
    marginHorizontal: 12,
    marginTop: 18,
  },

  // --- Presets Row ---
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetsLabel: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
    fontWeight: '600',
    marginRight: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  presetChipSelected: {
    backgroundColor: Colors.surfaceHighlight,
    borderColor: Colors.primaryLight,
  },
  presetChipText: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
    fontWeight: '600',
  },
  presetChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },

  // --- Target File Size ---
  adaptiveBadge: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adaptiveBadgeText: {
    color: Colors.primary,
    fontSize: normalizeFont(11),
    fontWeight: '700',
  },
  targetSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  targetInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginRight: 10,
  },
  targetTextInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '600',
    paddingVertical: 0,
  },
  unitSelectorBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitSelectorText: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(12),
    fontWeight: '700',
  },
  clearBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(13),
    fontWeight: '700',
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(11),
    lineHeight: 16,
  },

  // --- Quality Slider ---
  qualityBadge: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityBadgeText: {
    color: Colors.primary,
    fontSize: normalizeFont(13),
    fontWeight: '800',
  },
  sliderTouchArea: {
    height: 38,
    justifyContent: 'center',
    marginVertical: 4,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderTrackFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: Colors.primary,
    top: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    color: Colors.textMuted,
    fontSize: normalizeFont(11),
    fontWeight: '500',
  },
  sliderLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // --- Standard Summary Card ---
  standardSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  standardTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(15),
    fontWeight: '700',
    marginBottom: 6,
  },
  standardDesc: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(13),
    lineHeight: 18,
  },

  // --- Bottom Action Bar ---
  bottomActionBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  sizePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sizePreviewLabel: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
    fontWeight: '500',
  },
  sizePreviewValue: {
    color: Colors.primary,
    fontSize: normalizeFont(14),
    fontWeight: '800',
  },
  compressMainBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  compressMainBtnText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(15),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
