import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Image,
  PanResponder,
} from 'react-native';
import { ScannedDocument } from '../types/document';
import { Colors } from '../constants/colors';
import { FileStorageService, formatFileSize } from '../services/FileStorageService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ActionSheetOption {
  id: string;
  label: string;
  icon: string;
  hasStarBadge?: boolean;
  isDestructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  document: ScannedDocument | null;
  onClose: () => void;
  onSharePdf: (doc: ScannedDocument) => void;
  onSaveJpeg: (doc: ScannedDocument) => void;
  onGoogleDriveSync: (doc: ScannedDocument) => void;
  onRename: (doc: ScannedDocument) => void;
  onDelete: (doc: ScannedDocument) => void;
  onModifyScan: (doc: ScannedDocument) => void;
  onAskAi?: (doc: ScannedDocument) => void;
  onCompressPdf: (doc: ScannedDocument) => void;
  onSetPassword: (doc: ScannedDocument) => void;
  onCombineFiles: (doc: ScannedDocument) => void;
  onPrint: (doc: ScannedDocument) => void;
}

export const DocumentActionSheet = ({
  visible,
  document,
  onClose,
  onSharePdf,
  onSaveJpeg,
  onGoogleDriveSync,
  onRename,
  onDelete,
  onModifyScan,
  onAskAi,
  onCompressPdf,
  onSetPassword,
  onCombineFiles,
  onPrint,
}: Props) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Track if sheet is mounted
  const [modalVisible, setModalVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, translateY, backdropAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleActionClick = (action: () => void) => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      action();
    });
  };

  // Drag-to-dismiss PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Track real file size
  const [actualSizeStr, setActualSizeStr] = useState<string>('');

  useEffect(() => {
    let isCurrent = true;
    if (visible && document) {
      if (document.fileSize && document.fileSize > 0) {
        setActualSizeStr(formatFileSize(document.fileSize));
      }
      FileStorageService.getDocumentActualSize(document).then((bytes) => {
        if (isCurrent && bytes > 0) {
          setActualSizeStr(formatFileSize(bytes));
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [visible, document]);

  if (!modalVisible && !visible) return null;
  if (!document) return null;

  const dateFormatted = 'Today';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop overlay */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Sliding Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Header Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragPill} />
          </View>

          {/* Document Summary Header matching Screenshot 1 */}
          <View style={styles.docHeader}>
            <View style={styles.thumbWrapper}>
              {document.thumbnailUri ? (
                <Image
                  source={{ uri: document.thumbnailUri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbFallback}>
                  <Text style={styles.thumbFallbackIcon}>📄</Text>
                </View>
              )}
            </View>

            <View style={styles.docInfo}>
              <Text style={styles.docTitle} numberOfLines={1}>
                {document.title}
              </Text>
              <Text style={styles.docSubtitle}>
                {dateFormatted} • {document.pageCount} page{document.pageCount > 1 ? 's' : ''}{actualSizeStr ? ` • ${actualSizeStr}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Action List Items matching Screenshot 1 & 2 */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Section 1: Storage & Cloud */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onSaveJpeg(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>☁️</Text>
              </View>
              <Text style={styles.actionLabel}>Copy to device</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onGoogleDriveSync(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>📁</Text>
              </View>
              <Text style={styles.actionLabel}>Upload to Google Drive</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Section 2: PDF tools */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onSharePdf(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>📄</Text>
              </View>
              <Text style={styles.actionLabel}>Export PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onCombineFiles(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>📑</Text>
              </View>
              <Text style={styles.actionLabel}>Combine files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onSetPassword(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>🔒</Text>
              </View>
              <Text style={styles.actionLabel}>Set password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onCompressPdf(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>🗜️</Text>
              </View>
              <Text style={styles.actionLabel}>Compress PDF</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Section 3: Document Editing */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onModifyScan(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>📑</Text>
              </View>
              <Text style={styles.actionLabel}>Modify scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onRename(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>✏️</Text>
              </View>
              <Text style={styles.actionLabel}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onPrint(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={styles.actionIcon}>🖨️</Text>
              </View>
              <Text style={styles.actionLabel}>Print</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Section 4: Destructive Delete */}
            <TouchableOpacity
              style={[styles.actionRow, styles.deleteRow]}
              activeOpacity={0.7}
              onPress={() => handleActionClick(() => onDelete(document))}
            >
              <View style={styles.iconWrapper}>
                <Text style={[styles.actionIcon, { color: '#EF4444' }]}>🗑️</Text>
              </View>
              <Text style={[styles.actionLabel, styles.deleteLabel]}>Delete</Text>
            </TouchableOpacity>

            <View style={{ height: 28 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 20,
    overflow: 'hidden',
  },
  dragHandleArea: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  thumbWrapper: {
    width: 46,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F3F0FF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbFallbackIcon: {
    fontSize: 24,
  },
  docInfo: {
    flex: 1,
    marginLeft: 14,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    letterSpacing: 0.2,
  },
  docSubtitle: {
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  iconWrapper: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  starBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  starBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  deleteRow: {
    marginTop: 4,
  },
  deleteLabel: {
    color: '#EF4444',
  },
});
