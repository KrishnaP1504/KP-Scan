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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { getStorageLocations, StorageFolderOption } from '../services/FileStorageService';

interface Props {
  visible: boolean;
  initialTitle: string;
  defaultFormat?: 'pdf' | 'jpeg';
  onDismiss: () => void;
  onConfirmSave: (config: {
    fileName: string;
    format: 'pdf' | 'jpeg';
    selectedFolder: StorageFolderOption;
  }) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SaveLocationModal = ({
  visible,
  initialTitle,
  defaultFormat = 'pdf',
  onDismiss,
  onConfirmSave,
}: Props) => {
  const [fileName, setFileName] = useState(initialTitle);
  const [format, setFormat] = useState<'pdf' | 'jpeg'>(defaultFormat);
  const locations = getStorageLocations();
  const [selectedFolder, setSelectedFolder] = useState<StorageFolderOption>(locations[0]);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFileName(initialTitle);
    setFormat(defaultFormat);
  }, [initialTitle, defaultFormat, visible]);

  useEffect(() => {
    if (visible) {
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
            <Text style={styles.badgeIcon}>💾</Text>
          </View>

          <Text style={styles.header}>Save to Storage</Text>
          <Text style={styles.subHeader}>
            Choose save format and folder location on your device:
          </Text>

          {/* File Name Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>File Name</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.fileNameInput}
                value={fileName}
                onChangeText={setFileName}
                placeholder="Enter file name"
                placeholderTextColor="#9CA3AF"
                selectTextOnFocus
              />
              <View style={styles.extensionBadge}>
                <Text style={styles.extensionText}>
                  .{format === 'pdf' ? 'pdf' : 'jpg'}
                </Text>
              </View>
            </View>
          </View>

          {/* Format Selector Pills */}
          <View style={styles.formatRow}>
            <TouchableOpacity
              style={[
                styles.formatTab,
                format === 'pdf' && styles.activeFormatTab,
              ]}
              onPress={() => setFormat('pdf')}
            >
              <Text
                style={[
                  styles.formatTabText,
                  format === 'pdf' && styles.activeFormatTabText,
                ]}
              >
                📄 PDF Document
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatTab,
                format === 'jpeg' && styles.activeFormatTab,
              ]}
              onPress={() => setFormat('jpeg')}
            >
              <Text
                style={[
                  styles.formatTabText,
                  format === 'jpeg' && styles.activeFormatTabText,
                ]}
              >
                🖼️ JPEG Images
              </Text>
            </TouchableOpacity>
          </View>

          {/* Location Picker Section */}
          <Text style={styles.sectionLabel}>Select Folder Location</Text>

          <ScrollView style={styles.locationList}>
            {locations.map((loc) => {
              const isSelected = selectedFolder.id === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.locationCard,
                    isSelected && styles.selectedLocationCard,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedFolder(loc)}
                >
                  <Text style={styles.locationIcon}>{loc.icon}</Text>
                  <View style={styles.locationInfo}>
                    <Text
                      style={[
                        styles.locationTitle,
                        isSelected && styles.selectedLocationTitle,
                      ]}
                    >
                      {loc.name}
                    </Text>
                    <Text style={styles.locationSubtitle} numberOfLines={1}>
                      {loc.subTitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                if (fileName.trim()) {
                  onConfirmSave({
                    fileName: fileName.trim(),
                    format,
                    selectedFolder,
                  });
                }
              }}
            >
              <Text style={styles.saveBtnText}>Save File</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  card: {
    width: '100%',
    maxWidth: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeIcon: {
    fontSize: 24,
  },
  header: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  inputSection: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 12,
    paddingRight: 6,
  },
  fileNameInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#1E1B4B',
    fontWeight: '600',
  },
  extensionBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  extensionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  formatRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  formatTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFormatTab: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  formatTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeFormatTabText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  sectionLabel: {
    width: '100%',
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  locationList: {
    width: '100%',
    maxHeight: 170,
    marginBottom: 16,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
  },
  selectedLocationCard: {
    borderColor: Colors.primary,
    backgroundColor: '#F5F3FF',
  },
  locationIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  selectedLocationTitle: {
    color: Colors.primary,
  },
  locationSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F0FF',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
