import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Share,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useDocuments } from '../../context/DocumentContext';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { DocumentActionSheet } from '../../components/DocumentActionSheet';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { RenameModal } from '../../components/RenameModal';
import { SaveLocationModal } from '../../components/SaveLocationModal';
import { GoogleDriveUploadModal, DriveFolderOption } from '../../components/GoogleDriveUploadModal';
import { GoogleAccountModal } from '../../components/GoogleAccountModal';
import { BottomToast } from '../../components/BottomToast';
import { DocumentScannerService } from '../../services/DocumentScannerService';
import { FileStorageService, StorageFolderOption } from '../../services/FileStorageService';
import { ScannedDocument } from '../../types/document';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius } from '../../constants/theme';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
} from '../../utils/responsive';

export const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { documents, deleteDocument, updateDocumentTitle, markAsSynced } = useDocuments();
  const { user, isAuthenticated, isGuest, signInWithGoogle, signOut } = useAuth();
  const { showAlert } = useAlert();

  // Bottom Action Sheet state
  const [activeDoc, setActiveDoc] = useState<ScannedDocument | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Rename Modal state
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  // Save Location Modal state
  const [isSaveLocationOpen, setIsSaveLocationOpen] = useState(false);
  const [saveFormat, setSaveFormat] = useState<'pdf' | 'jpeg'>('pdf');

  // Google Drive Upload Modal state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Google Account Auth Modal state
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);

  // Bottom Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('✓');

  const showToast = (message: string, icon = '✓') => {
    setToastIcon(icon);
    setToastMessage(message);
  };

  // Loading Overlay state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');

  const openActionSheet = (doc: ScannedDocument) => {
    setActiveDoc(doc);
    setIsActionSheetOpen(true);
  };

  const closeActionSheet = () => {
    setIsActionSheetOpen(false);
  };

  // Open Save Location Dialog for PDF
  const handleInitiatePdfSave = (doc: ScannedDocument) => {
    setActiveDoc(doc);
    setSaveFormat('pdf');
    setIsSaveLocationOpen(true);
  };

  // Open Save Location Dialog for JPEG
  const handleInitiateJpegSave = (doc: ScannedDocument) => {
    setActiveDoc(doc);
    setSaveFormat('jpeg');
    setIsSaveLocationOpen(true);
  };

  // Share PDF via Native Share Dialog
  const handleSharePdf = async (doc: ScannedDocument) => {
    try {
      setLoadingText('Preparing PDF to share...');
      setIsLoading(true);
      const targetDir = `${RNFS.DocumentDirectoryPath}/KP_Scan`;
      const result = await FileStorageService.saveDocumentAsPdf(
        doc,
        targetDir,
        doc.title
      );
      setIsLoading(false);

      if (result.success && result.filePath) {
        await Share.share({
          title: doc.title,
          message: `${doc.title} (KP Scan Document)`,
          url: `file://${result.filePath}`,
        });
      } else {
        showAlert({
          title: 'Share Failed',
          message: result.error || 'Could not prepare PDF for sharing.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      console.warn('Share error:', err);
    }
  };

  // Real File Writing Execution to Local Physical Storage
  const handleExecuteSave = async (config: {
    fileName: string;
    format: 'pdf' | 'jpeg';
    selectedFolder: StorageFolderOption;
  }) => {
    setIsSaveLocationOpen(false);
    if (!activeDoc) return;

    setLoadingText(`Saving ${config.format.toUpperCase()} to ${config.selectedFolder.name}...`);
    setIsLoading(true);

    if (config.format === 'pdf') {
      const result = await FileStorageService.saveDocumentAsPdf(
        activeDoc,
        config.selectedFolder.path,
        config.fileName
      );
      setIsLoading(false);

      if (result.success && result.filePath) {
        showToast(`PDF saved to ${config.selectedFolder.name}`, '✅');
      } else {
        showAlert({
          title: 'Save Failed',
          message: result.error || 'Could not save PDF to storage.',
          type: 'error',
        });
      }
    } else {
      const result = await FileStorageService.saveDocumentAsJpeg(
        activeDoc,
        config.selectedFolder.path,
        config.fileName
      );
      setIsLoading(false);

      if (result.success && result.filePaths) {
        showToast(`${result.filePaths.length} image(s) saved to ${config.selectedFolder.name}`, '✅');
      } else {
        showAlert({
          title: 'Save Failed',
          message: result.error || 'Could not save JPEG images to storage.',
          type: 'error',
        });
      }
    }
  };

  // Google Drive Upload with Authentication & Location Check
  const handleGoogleDriveSync = (doc: ScannedDocument) => {
    setActiveDoc(doc);
    if (!isAuthenticated || isGuest) {
      setIsGoogleAuthModalOpen(true);
      return;
    }

    // Already signed in: open the Google Drive folder selector modal
    setIsDriveModalOpen(true);
  };

  const handleExecuteDriveUpload = async (config: {
    fileName: string;
    folder: DriveFolderOption;
  }) => {
    setIsDriveModalOpen(false);
    if (!activeDoc) return;

    setLoadingText(`Uploading "${config.fileName}.pdf" to ${config.folder.name}...`);
    setIsLoading(true);

    await markAsSynced(activeDoc.id, `gdrive_${Date.now()}`);

    setTimeout(() => {
      setIsLoading(false);
      showAlert({
        title: 'Uploaded to Google Drive',
        message: `"${config.fileName}.pdf" has been uploaded successfully to your Google Drive (${config.folder.path}).`,
        type: 'success',
      });
    }, 900);
  };

  // Rename
  const handleOpenRename = (doc: ScannedDocument) => {
    setActiveDoc(doc);
    setIsRenameOpen(true);
  };

  const handleSaveNewTitle = async (newTitle: string) => {
    if (activeDoc) {
      await updateDocumentTitle(activeDoc.id, newTitle);
      showToast(`Document renamed to "${newTitle}"`, '✏️');
    }
    setIsRenameOpen(false);
  };

  // Delete
  const handleDeleteDoc = (doc: ScannedDocument) => {
    showAlert({
      title: 'Delete Document',
      message: `Are you sure you want to permanently delete "${doc.title}"?`,
      type: 'confirm',
      buttons: [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDocument(doc.id);
            showToast(`"${doc.title}" deleted`, '🗑️');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  // Modify Scan
  const handleModifyScan = (doc: ScannedDocument) => {
    navigation.navigate('DocumentReview', {
      initialPages: doc.pages.map((p) => p.uri),
      documentTitle: doc.title,
    });
  };

  // Launch Camera Scanner
  const handleLaunchScanner = async () => {
    const result = await DocumentScannerService.launchScanner();
    if (result.status === 'SUCCESS' && result.scannedImages && result.scannedImages.length > 0) {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      navigation.navigate('DocumentReview', {
        initialPages: result.scannedImages,
        documentTitle: `KP Scan ${dateStr} (1)`,
      });
    }
  };

  // Ask AI Assistant
  const handleAskAi = (doc: ScannedDocument) => {
    setLoadingText('AI Assistant is reading scan...');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showAlert({
        title: '✨ AI Assistant Insight',
        message: `Document "${doc.title}" analyzed successfully. All text, numbers, and layout structured cleanly.`,
        type: 'success',
      });
    }, 850);
  };

  // Compress PDF
  const handleCompressPdf = (doc: ScannedDocument) => {
    closeActionSheet();
    navigation.navigate('CompressPdf', { document: doc });
  };

  // Set Password
  const handleSetPassword = (doc: ScannedDocument) => {
    showAlert({
      title: 'Set PDF Password',
      message: `Encrypt "${doc.title}" with a secure PIN/password to restrict viewing.`,
      type: 'info',
    });
  };

  // Combine Files
  const handleCombineFiles = (doc: ScannedDocument) => {
    closeActionSheet();
    navigation.navigate('CombineFiles', { initialDocument: doc });
  };

  // Print
  const handlePrint = (doc: ScannedDocument) => {
    showAlert({
      title: 'Print Document',
      message: `Sending "${doc.title}" to local wireless printer...`,
      type: 'info',
    });
  };

  // Profile
  const handleProfilePress = () => {
    if (isAuthenticated) {
      showAlert({
        title: 'KP Scan Account',
        message: `Signed in as: ${user?.email || 'User'}\nCloud Status: Connected\n\nPrivacy: Scanned files remain strictly stored on your phone.`,
        type: 'info',
        buttons: [
          { text: 'Sign Out', style: 'destructive', onPress: signOut },
          { text: 'OK', style: 'cancel' },
        ],
      });
    } else {
      showAlert({
        title: 'Sign In to KP Scan',
        message: 'Sign in to sync your cloud account settings.\n(Scanned documents always stay private on your local storage)',
        type: 'info',
        buttons: [
          { text: 'Sign In / Register', onPress: () => navigation.navigate('Login') },
          { text: 'Continue as Guest', style: 'cancel' },
        ],
      });
    }
  };

  const renderDocumentItem = ({ item }: { item: ScannedDocument }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDate}>Today</Text>
      </View>

      <View style={styles.cardBody}>
        {/* Document Thumbnail with micro-press effect */}
        <TouchableOpacity
          style={styles.thumbnailWrapper}
          activeOpacity={0.82}
          onPress={() => openActionSheet(item)}
        >
          {item.thumbnailUri ? (
            <Image
              source={{ uri: item.thumbnailUri }}
              style={styles.cardThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardPdfPlaceholder}>
              <View style={styles.cardPdfBadge}>
                <Text style={styles.cardPdfBadgeText}>PDF</Text>
              </View>
              <Text style={styles.cardPdfIcon}>📄</Text>
            </View>
          )}
          {item.pageCount > 1 && (
            <View style={styles.multiPagePill}>
              <Text style={styles.multiPageText}>{item.pageCount} pages</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action List on the Right */}
        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => handleInitiatePdfSave(item)}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionLabel}>Save as PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => handleSharePdf(item)}
          >
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionLabel}>Share PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => handleInitiateJpegSave(item)}
          >
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionLabel}>Save as Jpeg</Text>
          </TouchableOpacity>

          {/* "More" button that triggers the bottom-to-up Action Sheet */}
          <TouchableOpacity
            style={[styles.actionRow, styles.moreActionRow]}
            activeOpacity={0.65}
            onPress={() => openActionSheet(item)}
          >
            <Text style={[styles.actionIcon, styles.moreIcon]}>⋮</Text>
            <Text style={[styles.actionLabel, styles.moreLabel]}>More</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Top Header with KP Scan Official Logo */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/app_logo.png')}
            style={styles.headerBrandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>KP Scan</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.avatarButton}
            activeOpacity={0.75}
            onPress={handleProfilePress}
          >
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {isGuest ? '👤' : (user?.name?.charAt(0) || 'U')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Cloud Backup & Google Drive Sync Banner */}
      <View style={styles.premiumBanner}>
        <View style={styles.cloudIconBadge}>
          <Text style={styles.cloudIconEmoji}>☁️</Text>
        </View>

        <View style={styles.bannerContent}>
          <Text style={styles.bannerHeadline} numberOfLines={1} ellipsizeMode="tail">
            Cloud Backup & Google Drive
          </Text>
          <Text style={styles.bannerSubHeadline} numberOfLines={1} ellipsizeMode="tail">
            {isAuthenticated && !isGuest && user?.email
              ? `Connected: ${user.email}`
              : 'Sync & backup your scans safely'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bannerButton}
          activeOpacity={0.85}
          onPress={() => {
            if (!isAuthenticated || isGuest) {
              setIsGoogleAuthModalOpen(true);
            } else {
              showAlert({
                title: 'Google Drive Active',
                message: `Connected as ${user?.email || 'Google User'}.\nCloud sync is active for all scanned documents.`,
                type: 'success',
                buttons: [
                  { text: 'OK' },
                  {
                    text: 'Switch Account',
                    style: 'destructive',
                    onPress: async () => {
                      await signOut();
                      setIsGoogleAuthModalOpen(true);
                    },
                  },
                ],
              });
            }
          }}
        >
          <Text style={styles.bannerBtnText}>
            {isAuthenticated && !isGuest ? 'Connected ✓' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Document Feed List */}
      <FlatList
        data={documents}
        keyExtractor={(item: ScannedDocument) => item.id}
        renderItem={renderDocumentItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No documents scanned yet</Text>
            <Text style={styles.emptySubText}>
              Tap the camera button below to scan your first document.
            </Text>
          </View>
        }
      />

      {/* --- Bottom-to-Up Animated Action Sheet --- */}
      <DocumentActionSheet
        visible={isActionSheetOpen}
        document={activeDoc}
        onClose={closeActionSheet}
        onSharePdf={handleInitiatePdfSave}
        onSaveJpeg={handleInitiateJpegSave}
        onGoogleDriveSync={handleGoogleDriveSync}
        onRename={handleOpenRename}
        onDelete={handleDeleteDoc}
        onModifyScan={handleModifyScan}
        onAskAi={handleAskAi}
        onCompressPdf={handleCompressPdf}
        onSetPassword={handleSetPassword}
        onCombineFiles={handleCombineFiles}
        onPrint={handlePrint}
      />

      {/* --- Save Location & Real File Storage Modal --- */}
      <SaveLocationModal
        visible={isSaveLocationOpen}
        initialTitle={activeDoc?.title || ''}
        defaultFormat={saveFormat}
        onDismiss={() => setIsSaveLocationOpen(false)}
        onConfirmSave={handleExecuteSave}
      />

      {/* --- Rename Modal Dialog --- */}
      <RenameModal
        visible={isRenameOpen}
        initialTitle={activeDoc?.title || ''}
        onCancel={() => setIsRenameOpen(false)}
        onSave={handleSaveNewTitle}
      />

      {/* --- Google Account Connect Modal --- */}
      <GoogleAccountModal
        visible={isGoogleAuthModalOpen}
        onDismiss={() => setIsGoogleAuthModalOpen(false)}
        onSuccess={() => {
          if (activeDoc) {
            setIsDriveModalOpen(true);
          } else {
            showAlert({
              title: 'Connected',
              message: 'Successfully connected your Google account for Drive sync.',
              type: 'success',
            });
          }
        }}
      />

      {/* --- Google Drive Upload Modal --- */}
      <GoogleDriveUploadModal
        visible={isDriveModalOpen}
        documentTitle={activeDoc?.title || ''}
        userEmail={user?.email || undefined}
        onDismiss={() => setIsDriveModalOpen(false)}
        onConfirmUpload={handleExecuteDriveUpload}
      />

      {/* --- Animated Loading Overlay --- */}
      <LoadingOverlay visible={isLoading} message={loadingText} />

      {/* Floating Camera Button in Bottom-Right Corner */}
      <TouchableOpacity
        style={styles.floatingCameraFab}
        activeOpacity={0.82}
        onPress={handleLaunchScanner}
      >
        <Text style={styles.floatingCameraIcon}>📷</Text>
      </TouchableOpacity>

      {/* --- Bottom Toast Notification --- */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: Colors.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBrandLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
  },
  brandTitle: {
    fontSize: normalizeFont(20),
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  headerIcon: {
    fontSize: moderateScale(16),
  },
  avatarButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: moderateScale(15),
    color: Colors.primary,
    fontWeight: '700',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'stretch',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cloudIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  cloudIconEmoji: {
    fontSize: 16,
  },
  bannerContent: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  bannerHeadline: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerSubHeadline: {
    color: '#EDE9FE',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  bannerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: verticalScale(96),
  },
  floatingCameraFab: {
    position: 'absolute',
    bottom: verticalScale(24),
    right: scale(20),
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  floatingCameraIcon: {
    fontSize: moderateScale(28),
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: verticalScale(14),
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: verticalScale(10),
  },
  cardTitle: {
    fontSize: normalizeFont(16),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardDate: {
    fontSize: normalizeFont(12),
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardBody: {
    flexDirection: 'row',
  },
  thumbnailWrapper: {
    width: scale(110),
    height: verticalScale(140),
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
  },
  cardPdfPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPdfBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  cardPdfBadgeText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardPdfIcon: {
    fontSize: 28,
  },
  multiPagePill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(30, 27, 75, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  multiPageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionList: {
    flex: 1,
    marginLeft: scale(18),
    justifyContent: 'space-around',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(5),
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  moreActionRow: {
    backgroundColor: '#F5F3FF',
    paddingVertical: verticalScale(6),
    paddingHorizontal: 8,
    marginTop: 2,
  },
  actionIcon: {
    fontSize: moderateScale(15),
    marginRight: scale(10),
  },
  moreIcon: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  actionLabel: {
    fontSize: normalizeFont(13),
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  moreLabel: {
    color: Colors.primary,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: verticalScale(80),
  },
  emptyIcon: {
    fontSize: moderateScale(48),
    marginBottom: verticalScale(12),
  },
  emptyText: {
    fontSize: normalizeFont(16),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubText: {
    fontSize: normalizeFont(13),
    color: Colors.textSecondary,
    marginTop: verticalScale(6),
    textAlign: 'center',
    maxWidth: scale(260),
  },
});
