import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  NativeModules,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useDocuments } from '../../context/DocumentContext';
import { useAlert } from '../../context/AlertContext';
import { ScannedDocument, ScannedPage } from '../../types/document';
import { DocumentScannerService } from '../../services/DocumentScannerService';
import { FileStorageService, formatFileSize } from '../../services/FileStorageService';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { Colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';
import RNFS from 'react-native-fs';

type Props = NativeStackScreenProps<RootStackParamList, 'CombineFiles'>;

export const CombineFilesScreen = ({ route, navigation }: Props) => {
  const { initialDocument } = route.params || {};
  const { documents, addDocument } = useDocuments();
  const { showAlert } = useAlert();

  // Selected files list
  const [selectedDocs, setSelectedDocs] = useState<ScannedDocument[]>(
    initialDocument ? [initialDocument] : documents.length > 0 ? [documents[0]] : []
  );

  // File name
  const [fileName, setFileName] = useState<string>(
    initialDocument
      ? `${initialDocument.title}_combined`
      : `KP Scan ${new Date().toLocaleDateString('en-GB')}_combined`
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');

  // Remove document from list
  const handleRemoveDoc = (index: number) => {
    if (selectedDocs.length <= 1) {
      showAlert({
        title: 'Notice',
        message: 'You need at least one file to combine.',
        type: 'info',
      });
      return;
    }
    setSelectedDocs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add document from library
  const handleAddFromLibrary = (doc: ScannedDocument) => {
    if (selectedDocs.some((d) => d.id === doc.id)) {
      showAlert({
        title: 'Already Added',
        message: `"${doc.title}" is already in the combine list.`,
        type: 'info',
      });
      return;
    }
    setSelectedDocs((prev) => [...prev, doc]);
    setIsAddModalOpen(false);
  };

  // Pick local files from device storage (strictly PDF or Image)
  const handlePickLocalFiles = async () => {
    setIsAddModalOpen(false);
    try {
      const { DocScanCamera } = NativeModules;
      if (!DocScanCamera || typeof DocScanCamera.pickLocalFiles !== 'function') {
        showAlert({
          title: 'Not Supported',
          message: 'Local file picker is not available on this build.',
          type: 'error',
        });
        return;
      }

      setLoadingText('Opening storage...');
      setIsProcessing(true);

      const result = await DocScanCamera.pickLocalFiles();

      if (result && result.status === 'SUCCESS' && Array.isArray(result.files) && result.files.length > 0) {
        setLoadingText('Processing selected files...');
        const importedDocs: ScannedDocument[] = [];

        for (let i = 0; i < result.files.length; i++) {
          const file = result.files[i];
          const isPdf = file.type === 'pdf';
          const cleanName = (file.name || `File_${i + 1}`).replace(/\.[^/.]+$/, '');

          // Build pages array from unpacked page images
          const pageList: ScannedPage[] =
            file.pages && Array.isArray(file.pages) && file.pages.length > 0
              ? file.pages.map((pUri: string, pIdx: number) => ({
                  id: `p_${Date.now()}_${i}_${pIdx}`,
                  uri: pUri,
                  rotation: 0,
                  filter: 'original' as const,
                }))
              : [
                  {
                    id: `p_${Date.now()}_${i}_0`,
                    uri: file.thumbnailUri || file.uri,
                    rotation: 0,
                    filter: 'original' as const,
                  },
                ];

          const thumbUri = file.thumbnailUri || pageList[0]?.uri || file.uri || '';

          importedDocs.push({
            id: `local_${file.type}_${Date.now()}_${i}`,
            title: cleanName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pageCount: file.pageCount || pageList.length,
            thumbnailUri: thumbUri,
            pdfPath: isPdf ? file.uri : undefined,
            fileSize: file.size || 0,
            isSynced: false,
            pages: pageList,
          });
        }

        if (importedDocs.length > 0) {
          setSelectedDocs((prev) => [...prev, ...importedDocs]);
          showAlert({
            title: 'Files Added',
            message: `Added ${importedDocs.length} file${importedDocs.length > 1 ? 's' : ''} to combine list.`,
            type: 'success',
          });
        }
      }
    } catch (err: any) {
      console.warn('File picker error:', err);
      showAlert({
        title: 'Error',
        message: err?.message || 'Could not pick files from storage.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Scan new document to add
  const handleScanNewDoc = async () => {
    setIsAddModalOpen(false);
    setIsProcessing(true);
    setLoadingText('Opening camera...');
    const result = await DocumentScannerService.launchScanner();
    setIsProcessing(false);

    if (result.status === 'SUCCESS' && result.scannedImages && result.scannedImages.length > 0) {
      const newDoc: ScannedDocument = {
        id: `doc_${Date.now()}`,
        title: `Scan ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageCount: result.scannedImages.length,
        thumbnailUri: result.scannedImages[0],
        isSynced: false,
        pages: result.scannedImages.map((uri, idx) => ({
          id: `page_${idx}`,
          uri,
          rotation: 0,
          filter: 'magic',
        })),
      };
      await addDocument(newDoc);
      setSelectedDocs((prev) => [...prev, newDoc]);
    }
  };

  // Move item up / down
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedDocs.length) return;

    const updated = [...selectedDocs];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSelectedDocs(updated);
  };

  // Execute Combine
  const handleCombineAction = async () => {
    if (selectedDocs.length === 0) {
      showAlert({
        title: 'Cannot Combine',
        message: 'Please add at least one document to combine.',
        type: 'warning',
      });
      return;
    }

    const cleanTitle = fileName.trim() || 'Combined_Document';

    setLoadingText('Combining files into PDF...');
    setIsProcessing(true);

    try {
      // 1. Gather all pages in order from selected documents
      const allPages: ScannedPage[] = [];
      selectedDocs.forEach((doc, docIdx) => {
        if (doc.pages && doc.pages.length > 0) {
          doc.pages.forEach((page, pageIdx) => {
            allPages.push({
              ...page,
              id: `combined_${docIdx}_${pageIdx}_${Date.now()}`,
            });
          });
        } else if (doc.thumbnailUri) {
          allPages.push({
            id: `combined_${docIdx}_0_${Date.now()}`,
            uri: doc.thumbnailUri,
            rotation: 0,
            filter: 'magic',
          });
        }
      });

      // 2. Target directory: internal app storage
      const internalDir = `${RNFS.DocumentDirectoryPath}/KP_Scan`;

      const combineResult = await FileStorageService.combineDocumentsAsPdf(
        selectedDocs,
        internalDir,
        cleanTitle
      );

      if (!combineResult.success || !combineResult.filePath) {
        throw new Error(combineResult.error || 'Failed to combine documents');
      }

      // 4. Calculate total page count
      const totalPages = allPages.length > 0
        ? allPages.length
        : selectedDocs.reduce((acc, d) => acc + (d.pageCount || 1), 0);

      const firstThumb =
        allPages[0]?.uri ||
        selectedDocs.find((d) => d.thumbnailUri)?.thumbnailUri ||
        '';

      // 5. Create combined document object
      const combinedDocId = `doc_${Date.now()}`;
      const combinedDoc: ScannedDocument = {
        id: combinedDocId,
        title: cleanTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageCount: totalPages,
        thumbnailUri: firstThumb,
        pdfPath: combineResult.filePath,
        fileSize: combineResult.fileSize || 0,
        isSynced: false,
        pages: allPages,
      };

      // 6. Add to library
      await addDocument(combinedDoc);

      setIsProcessing(false);

      showAlert({
        title: 'Files Combined Successfully',
        message: `Combined ${selectedDocs.length} files (${totalPages} pages) into "${cleanTitle}.pdf".`,
        type: 'success',
      });

      navigation.navigate('MainTabs');
    } catch (err: any) {
      setIsProcessing(false);
      showAlert({
        title: 'Combine Error',
        message: err?.message || 'Could not combine files. Please try again.',
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

        <Text style={styles.headerTitle}>Combine Files</Text>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleCombineAction}
          activeOpacity={0.8}
        >
          <Text style={styles.headerActionText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* --- File Name Input Section --- */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>File Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={fileName}
              onChangeText={setFileName}
              placeholder="Enter combined file name"
              placeholderTextColor={Colors.textMuted}
            />
            {fileName.length > 0 && (
              <TouchableOpacity
                style={styles.clearInputBtn}
                onPress={() => setFileName('')}
              >
                <Text style={styles.clearInputText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* --- Selected Files Heading --- */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionHeading}>
            Files to Combine ({selectedDocs.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Use arrows to reorder
          </Text>
        </View>

        {/* --- Files List --- */}
        {selectedDocs.map((doc, idx) => (
          <View key={`${doc.id}_${idx}`} style={styles.fileRow}>
            {/* Minus/Remove Button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveDoc(idx)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.removeIconCircle}>
                <View style={styles.removeMinusLine} />
              </View>
            </TouchableOpacity>

            {/* Thumbnail */}
            <View style={styles.thumbnailWrapper}>
              {doc.thumbnailUri ? (
                <Image
                  source={{ uri: doc.thumbnailUri }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <View style={styles.pdfIconBadge}>
                    <Text style={styles.pdfIconBadgeText}>PDF</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Details */}
            <View style={styles.fileDetails}>
              <Text style={styles.fileTitle} numberOfLines={1}>
                {doc.title}
              </Text>
              <Text style={styles.fileSubtitle}>
                {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
                {doc.fileSize && doc.fileSize > 0 ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                {doc.pdfPath ? ' • PDF' : ''}
              </Text>
            </View>

            {/* Reorder Up/Down arrows */}
            <View style={styles.reorderGroup}>
              {idx > 0 && (
                <TouchableOpacity
                  onPress={() => handleMoveItem(idx, 'up')}
                  style={styles.arrowStepBtn}
                >
                  <Text style={styles.arrowStepText}>▲</Text>
                </TouchableOpacity>
              )}
              {idx < selectedDocs.length - 1 && (
                <TouchableOpacity
                  onPress={() => handleMoveItem(idx, 'down')}
                  style={styles.arrowStepBtn}
                >
                  <Text style={styles.arrowStepText}>▼</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* --- Add Files Button --- */}
        <TouchableOpacity
          style={styles.addFilesBtn}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.addPlusCircle}>
            <Text style={styles.addPlusText}>+</Text>
          </View>
          <Text style={styles.addFilesText}>Add more files</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- Bottom Action Bar (App Theme) --- */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          style={[
            styles.combineMainBtn,
            selectedDocs.length === 0 && styles.combineMainBtnDisabled,
          ]}
          onPress={handleCombineAction}
          disabled={selectedDocs.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.combineMainBtnText}>
            Combine {selectedDocs.length} {selectedDocs.length === 1 ? 'File' : 'Files'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- Add Files Modal --- */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Document to Add</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Option 1: Import Local Storage (PDF or Image) */}
            <TouchableOpacity
              style={styles.localOption}
              onPress={handlePickLocalFiles}
              activeOpacity={0.8}
            >
              <View style={styles.localOptionIconBadge}>
                <Text style={styles.localOptionIcon}>📁</Text>
              </View>
              <View style={styles.optionTextCol}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.localOptionTitle}>Import from Local Storage</Text>
                  <View style={styles.formatTag}>
                    <Text style={styles.formatTagText}>PDF / IMAGE ONLY</Text>
                  </View>
                </View>
                <Text style={styles.optionSubtitle}>Select PDFs or images directly from device</Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Scan New Document with Camera */}
            <TouchableOpacity
              style={styles.scanNewOption}
              onPress={handleScanNewDoc}
              activeOpacity={0.8}
            >
              <View style={styles.scanNewIconBadge}>
                <Text style={styles.scanNewIcon}>📷</Text>
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.scanNewTitle}>Scan New Pages with Camera</Text>
                <Text style={styles.optionSubtitle}>Take new photos to add to combined PDF</Text>
              </View>
            </TouchableOpacity>

            {/* Section Divider */}
            <View style={styles.libraryDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR SELECT FROM SAVED LIBRARY</Text>
              <View style={styles.dividerLine} />
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {documents.length === 0 ? (
                <View style={styles.emptyNotice}>
                  <Text style={styles.emptyNoticeText}>
                    No saved documents in library yet.
                  </Text>
                </View>
              ) : (
                documents.map((doc) => {
                  const isAdded = selectedDocs.some((d) => d.id === doc.id);
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={[
                        styles.modalDocItem,
                        isAdded && styles.modalDocItemAdded,
                      ]}
                      onPress={() => handleAddFromLibrary(doc)}
                      disabled={isAdded}
                      activeOpacity={0.7}
                    >
                      {doc.thumbnailUri ? (
                        <Image
                          source={{ uri: doc.thumbnailUri }}
                          style={styles.modalDocThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.modalDocThumb, styles.thumbnailPlaceholder]}>
                          <View style={styles.pdfIconBadge}>
                            <Text style={styles.pdfIconBadgeText}>PDF</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.modalDocTextCol}>
                        <Text style={styles.modalDocTitle} numberOfLines={1}>
                          {doc.title}
                        </Text>
                        <Text style={styles.modalDocPages}>
                          {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
                          {doc.fileSize && doc.fileSize > 0 ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.modalDocStatusBadge,
                          isAdded && styles.modalDocStatusBadgeAdded,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalDocStatusText,
                            isAdded && styles.modalDocStatusTextAdded,
                          ]}
                        >
                          {isAdded ? 'Added ✓' : '+ Add'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isProcessing} message={loadingText} />
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

  // --- File Name Input ---
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(13),
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: normalizeFont(15),
    fontWeight: '500',
  },
  clearInputBtn: {
    padding: 6,
  },
  clearInputText: {
    color: Colors.textMuted,
    fontSize: normalizeFont(14),
    fontWeight: '700',
  },

  // --- List Section ---
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeading: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(15),
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: normalizeFont(12),
  },

  // --- File Row Item ---
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  removeBtn: {
    paddingRight: 10,
  },
  removeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMinusLine: {
    width: 11,
    height: 2,
    backgroundColor: Colors.error,
    borderRadius: 1,
  },
  thumbnailWrapper: {
    width: 50,
    height: 50,
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
    backgroundColor: '#FEE2E2',
  },
  pdfIconBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pdfIconBadgeText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(11),
    fontWeight: '800',
  },
  fileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  fileTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
    marginBottom: 3,
  },
  fileSubtitle: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
    fontWeight: '500',
  },
  reorderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
  },
  arrowStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  arrowStepText: {
    color: Colors.primary,
    fontSize: normalizeFont(11),
    fontWeight: '700',
  },

  // --- Add Files Button ---
  addFilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  addPlusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  addPlusText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(14),
    fontWeight: '800',
    lineHeight: 16,
  },
  addFilesText: {
    color: Colors.primary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
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
  combineMainBtn: {
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
  combineMainBtnDisabled: {
    backgroundColor: Colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  combineMainBtnText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(15),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // --- Add Files Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(17),
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(16),
    fontWeight: '700',
  },
  localOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  localOptionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  localOptionIcon: {
    fontSize: 20,
  },
  localOptionTitle: {
    color: Colors.primary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  optionSubtitle: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(11),
    marginTop: 2,
  },
  formatTag: {
    backgroundColor: '#DDD6FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  formatTagText: {
    color: Colors.primary,
    fontSize: normalizeFont(9),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scanNewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  scanNewIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scanNewIcon: {
    fontSize: 20,
  },
  scanNewTitle: {
    color: Colors.primary,
    fontSize: normalizeFont(14),
    fontWeight: '700',
  },
  libraryDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: normalizeFont(10),
    fontWeight: '700',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyNotice: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyNoticeText: {
    color: Colors.textMuted,
    fontSize: normalizeFont(14),
  },
  modalDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 8,
  },
  modalDocItemAdded: {
    opacity: 0.5,
    backgroundColor: Colors.borderLight,
  },
  modalDocThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    marginRight: 12,
  },
  modalDocTextCol: {
    flex: 1,
  },
  modalDocTitle: {
    color: Colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '600',
    marginBottom: 2,
  },
  modalDocPages: {
    color: Colors.textSecondary,
    fontSize: normalizeFont(12),
  },
  modalDocStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
  },
  modalDocStatusBadgeAdded: {
    backgroundColor: Colors.border,
  },
  modalDocStatusText: {
    color: Colors.primary,
    fontSize: normalizeFont(12),
    fontWeight: '700',
  },
  modalDocStatusTextAdded: {
    color: Colors.textSecondary,
  },
});
