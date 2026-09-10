import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  PanResponder,
  NativeModules,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useDocuments } from '../../context/DocumentContext';
import { useAlert } from '../../context/AlertContext';
import RNFS from 'react-native-fs';
import { DocumentScannerService } from '../../services/DocumentScannerService';
import { FileStorageService } from '../../services/FileStorageService';
import { RenameModal } from '../../components/RenameModal';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { Colors } from '../../constants/colors';
import { ScannedDocument } from '../../types/document';

const { ImageCropper } = NativeModules;

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentReview'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Custom Vector Icons (Crisp Dark Outline) ---

const HomeIcon = () => (
  <Image
    source={require('../../assets/images/home_icon.png')}
    style={styles.homeIconImage}
    resizeMode="contain"
  />
);

const RetakeIcon = () => (
  <View style={styles.retakeContainer}>
    <View style={styles.cameraBody}>
      <View style={styles.cameraLens} />
    </View>
    <View style={styles.retakeBadge}>
      <Text style={styles.retakeArrowText}>↺</Text>
    </View>
  </View>
);

const CropIcon = () => (
  <View style={styles.cropContainer}>
    <View style={styles.cropTopLeft} />
    <View style={styles.cropBottomRight} />
  </View>
);

const RotateIcon = () => (
  <View style={styles.rotateContainer}>
    <View style={styles.rotateArc} />
    <View style={styles.rotateArrow} />
  </View>
);

const EditTextIcon = () => (
  <View style={styles.editTextContainer}>
    <View style={styles.editTextDoc}>
      <View style={styles.editTextLine1} />
      <View style={styles.editTextLine2} />
    </View>
    <View style={styles.editTextBadge}>
      <Text style={styles.editTextBadgeStar}>★</Text>
    </View>
  </View>
);

const FiltersIcon = () => (
  <View style={styles.filtersContainer}>
    <View style={[styles.filterCircle, styles.filterCircleTop]} />
    <View style={[styles.filterCircle, styles.filterCircleLeft]} />
    <View style={[styles.filterCircle, styles.filterCircleRight]} />
  </View>
);

const DeleteIcon = () => (
  <View style={styles.deleteContainer}>
    <Text style={styles.deleteGlyph}>🗑</Text>
  </View>
);

// --- Formatted Date Helper ---
const getDefaultScanTitle = () => {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `KP Scan ${dateStr} (1)`;
};

export const DocumentReviewScreen = ({ route, navigation }: Props) => {
  const { initialPages, documentTitle: defaultTitle } = route.params;
  const { addDocument } = useDocuments();
  const { showAlert } = useAlert();

  const [pages, setPages] = useState<string[]>(initialPages || []);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [docTitle, setDocTitle] = useState<string>(
    defaultTitle || getDefaultScanTitle()
  );
  const [rotations, setRotations] = useState<number[]>(
    new Array(initialPages?.length || 1).fill(0)
  );
  const [filterMode, setFilterMode] = useState<'magic' | 'grayscale' | 'original'>('magic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  // --- Interactive Crop State ---
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: SCREEN_WIDTH - 32,
    height: 480,
  });
  const [imageLayout, setImageLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    x: 0,
    y: 0,
    width: SCREEN_WIDTH - 32,
    height: 480,
  });
  const [cropBox, setCropBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    x: 10,
    y: 10,
    width: SCREEN_WIDTH - 52,
    height: 460,
  });

  const thumbnailScrollRef = useRef<ScrollView>(null);

  const cardSizeRef = useRef(cardSize);
  cardSizeRef.current = cardSize;

  const imageLayoutRef = useRef(imageLayout);
  imageLayoutRef.current = imageLayout;

  const cropBoxRef = useRef(cropBox);
  cropBoxRef.current = cropBox;

  const initialBox = useRef(cropBox);

  // Measure visible image bounds inside the paperCard
  useEffect(() => {
    const currentUri = pages[currentPageIndex];
    if (currentUri && cardSize.width > 0 && cardSize.height > 0) {
      Image.getSize(
        currentUri,
        (w, h) => {
          const rot = rotations[currentPageIndex] || 0;
          const isRotated = rot === 90 || rot === 270;
          const imgW = isRotated ? h : w;
          const imgH = isRotated ? w : h;

          const scale = Math.min(cardSize.width / imgW, cardSize.height / imgH);
          const dispW = imgW * scale;
          const dispH = imgH * scale;
          const offsetX = (cardSize.width - dispW) / 2;
          const offsetY = (cardSize.height - dispH) / 2;

          const newLayout = {
            x: offsetX,
            y: offsetY,
            width: dispW,
            height: dispH,
          };
          setImageLayout(newLayout);
          imageLayoutRef.current = newLayout;

          // Set crop box framing the full image exactly (no area cropped by default)
          setCropBox({
            x: offsetX,
            y: offsetY,
            width: dispW,
            height: dispH,
          });
        },
        () => {}
      );
    }
  }, [currentPageIndex, pages, rotations, cardSize]);

  useEffect(() => {
    if (pages.length >= 2 && thumbnailScrollRef.current) {
      const itemWidth = 64;
      thumbnailScrollRef.current.scrollTo({
        x: Math.max(0, currentPageIndex * itemWidth - SCREEN_WIDTH / 2 + itemWidth / 2),
        animated: true,
      });
    }
  }, [currentPageIndex, pages.length]);

  // PanResponder helper factory for crop handles
  const minCropSize = 40;

  const createHandleResponder = (
    onMove: (
      dx: number,
      dy: number,
      start: { x: number; y: number; width: number; height: number },
      layout: { x: number; y: number; width: number; height: number }
    ) => void
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialBox.current = { ...cropBoxRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        onMove(gestureState.dx, gestureState.dy, initialBox.current, imageLayoutRef.current);
      },
    });

  // Top-Left corner: changes x, y, width, height
  const panTL = useRef(
    createHandleResponder((dx, dy, start, layout) => {
      const maxX = start.x + start.width - minCropSize;
      const maxY = start.y + start.height - minCropSize;
      const newX = Math.max(layout.x, Math.min(start.x + dx, maxX));
      const newY = Math.max(layout.y, Math.min(start.y + dy, maxY));
      const newW = start.width - (newX - start.x);
      const newH = start.height - (newY - start.y);
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    })
  ).current;

  // Top-Right corner: changes y, width, height
  const panTR = useRef(
    createHandleResponder((dx, dy, start, layout) => {
      const maxY = start.y + start.height - minCropSize;
      const newY = Math.max(layout.y, Math.min(start.y + dy, maxY));
      const newH = start.height - (newY - start.y);
      const maxW = layout.x + layout.width - start.x;
      const newW = Math.max(minCropSize, Math.min(start.width + dx, maxW));
      setCropBox({ x: start.x, y: newY, width: newW, height: newH });
    })
  ).current;

  // Bottom-Left corner: changes x, width, height
  const panBL = useRef(
    createHandleResponder((dx, dy, start, layout) => {
      const maxX = start.x + start.width - minCropSize;
      const newX = Math.max(layout.x, Math.min(start.x + dx, maxX));
      const newW = start.width - (newX - start.x);
      const maxH = layout.y + layout.height - start.y;
      const newH = Math.max(minCropSize, Math.min(start.height + dy, maxH));
      setCropBox({ x: newX, y: start.y, width: newW, height: newH });
    })
  ).current;

  // Bottom-Right corner: changes width, height
  const panBR = useRef(
    createHandleResponder((dx, dy, start, layout) => {
      const maxW = layout.x + layout.width - start.x;
      const maxH = layout.y + layout.height - start.y;
      const newW = Math.max(minCropSize, Math.min(start.width + dx, maxW));
      const newH = Math.max(minCropSize, Math.min(start.height + dy, maxH));
      setCropBox({ x: start.x, y: start.y, width: newW, height: newH });
    })
  ).current;

  // Top edge: changes y, height
  const panTop = useRef(
    createHandleResponder((_, dy, start, layout) => {
      const maxY = start.y + start.height - minCropSize;
      const newY = Math.max(layout.y, Math.min(start.y + dy, maxY));
      const newH = start.height - (newY - start.y);
      setCropBox({ x: start.x, y: newY, width: start.width, height: newH });
    })
  ).current;

  // Bottom edge: changes height
  const panBottom = useRef(
    createHandleResponder((_, dy, start, layout) => {
      const maxH = layout.y + layout.height - start.y;
      const newH = Math.max(minCropSize, Math.min(start.height + dy, maxH));
      setCropBox({ x: start.x, y: start.y, width: start.width, height: newH });
    })
  ).current;

  // Left edge: changes x, width
  const panLeft = useRef(
    createHandleResponder((dx, _, start, layout) => {
      const maxX = start.x + start.width - minCropSize;
      const newX = Math.max(layout.x, Math.min(start.x + dx, maxX));
      const newW = start.width - (newX - start.x);
      setCropBox({ x: newX, y: start.y, width: newW, height: start.height });
    })
  ).current;

  // Right edge: changes width
  const panRight = useRef(
    createHandleResponder((dx, _, start, layout) => {
      const maxW = layout.x + layout.width - start.x;
      const newW = Math.max(minCropSize, Math.min(start.width + dx, maxW));
      setCropBox({ x: start.x, y: start.y, width: newW, height: start.height });
    })
  ).current;

  // --- Crop Actions ---
  const handleToggleCrop = () => {
    if (imageLayout.width > 0 && imageLayout.height > 0) {
      setCropBox({
        x: imageLayout.x,
        y: imageLayout.y,
        width: imageLayout.width,
        height: imageLayout.height,
      });
    }
    setIsCropping(true);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
  };

  const handleResetCrop = () => {
    setCropBox({
      x: imageLayout.x,
      y: imageLayout.y,
      width: imageLayout.width,
      height: imageLayout.height,
    });
  };

  const handleApplyCrop = async () => {
    if (!imageLayout.width || !imageLayout.height) {
      setIsCropping(false);
      return;
    }

    const leftPercent = Math.max(0, (cropBox.x - imageLayout.x) / imageLayout.width);
    const topPercent = Math.max(0, (cropBox.y - imageLayout.y) / imageLayout.height);
    const widthPercent = Math.min(1 - leftPercent, cropBox.width / imageLayout.width);
    const heightPercent = Math.min(1 - topPercent, cropBox.height / imageLayout.height);
    const rot = rotations[currentPageIndex] || 0;

    setIsProcessing(true);
    setLoadingText('Cropping image...');

    try {
      if (ImageCropper && typeof ImageCropper.cropImage === 'function') {
        const croppedUri = await ImageCropper.cropImage(
          pages[currentPageIndex],
          leftPercent,
          topPercent,
          widthPercent,
          heightPercent,
          rot
        );

        if (croppedUri) {
          const updatedPages = [...pages];
          updatedPages[currentPageIndex] = croppedUri;
          setPages(updatedPages);

          // Reset rotation for this page since cropped image is saved in current orientation
          const updatedRot = [...rotations];
          updatedRot[currentPageIndex] = 0;
          setRotations(updatedRot);
        }
      }
    } catch (err) {
      console.warn('Native crop error:', err);
      showAlert({
        title: 'Crop Error',
        message: 'Could not crop the image. Please try again.',
        type: 'warning',
      });
    } finally {
      setIsProcessing(false);
      setIsCropping(false);
    }
  };

  // 90-degree clockwise rotation
  const handleRotate = () => {
    const updatedRotations = [...rotations];
    updatedRotations[currentPageIndex] = (updatedRotations[currentPageIndex] + 90) % 360;
    setRotations(updatedRotations);
  };

  // Launch scanner to append pages
  const handleKeepScanning = async () => {
    setIsProcessing(true);
    setLoadingText('Opening camera...');
    const result = await DocumentScannerService.launchScanner();
    setIsProcessing(false);
    if (result.status === 'SUCCESS' && result.scannedImages.length > 0) {
      setPages((prev) => [...prev, ...result.scannedImages]);
      setRotations((prev) => [...prev, ...new Array(result.scannedImages.length).fill(0)]);
      setCurrentPageIndex(pages.length);
    }
  };

  // Retake current page
  const handleRetake = async () => {
    setIsProcessing(true);
    setLoadingText('Retaking page...');
    const result = await DocumentScannerService.launchScanner();
    setIsProcessing(false);
    if (result.status === 'SUCCESS' && result.scannedImages.length > 0) {
      const updated = [...pages];
      updated[currentPageIndex] = result.scannedImages[0];
      setPages(updated);
    }
  };

  // Delete current page
  const handleDeletePage = () => {
    if (pages.length <= 1) {
      showAlert({
        title: 'Cannot Delete',
        message: 'A document must have at least one scanned page.',
        type: 'warning',
      });
      return;
    }

    showAlert({
      title: 'Delete Page',
      message: `Delete page ${currentPageIndex + 1} of ${pages.length}?`,
      type: 'confirm',
      buttons: [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedPages = pages.filter((_, idx) => idx !== currentPageIndex);
            const updatedRot = rotations.filter((_, idx) => idx !== currentPageIndex);
            setPages(updatedPages);
            setRotations(updatedRot);
            setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  // Directly save PDF
  const handleSavePdfDirectly = async () => {
    setLoadingText('Saving PDF...');
    setIsProcessing(true);

    const newDocId = `doc_${Date.now()}`;
    const targetDoc: ScannedDocument = {
      id: newDocId,
      title: docTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pageCount: pages.length,
      thumbnailUri: pages[0],
      isSynced: false,
      pages: pages.map((uri, idx) => ({
        id: `page_${idx}`,
        uri,
        rotation: rotations[idx] || 0,
        filter: filterMode,
      })),
    };

    // 1. Pre-generate and store PDF in app storage
    try {
      const saveResult = await FileStorageService.saveDocumentAsPdf(
        targetDoc,
        `${RNFS.DocumentDirectoryPath}/KP_Scan`,
        docTitle
      );
      if (saveResult && saveResult.success && saveResult.filePath) {
        targetDoc.pdfPath = saveResult.filePath;
        const cleanPath = saveResult.filePath.replace('file://', '');
        if (await RNFS.exists(cleanPath)) {
          const stat = await RNFS.stat(cleanPath);
          targetDoc.fileSize = stat.size;
        }
      }
    } catch (err) {
      console.warn('Background PDF save notice:', err);
    }

    // 2. Add to App library with real path and size
    await addDocument(targetDoc);

    setIsProcessing(false);
    navigation.navigate('MainTabs');
  };

  const currentRotation = rotations[currentPageIndex] || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* --- Top Bar: Home | Title (with dashed underline) | [Empty Placeholder] --- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={styles.headerButton}
        >
          <HomeIcon />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleContainer}
          onPress={() => setIsRenameModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
            {docTitle}
          </Text>
          <View style={styles.dashedUnderline} />
        </TouchableOpacity>

        {/* Empty placeholder to keep title centered */}
        <View style={styles.headerButton} />
      </View>

      {/* --- Center Canvas: Clean Paper Preview (No blue border or box when reviewing) --- */}
      <View style={styles.canvasArea}>
        {isProcessing ? (
          <View style={styles.loadingContainer}>
            <View style={styles.spinnerOuterRing}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          </View>
        ) : pages[currentPageIndex] ? (
          <View style={styles.imageWrapper}>
            <View
              style={styles.paperCard}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setCardSize({ width, height });
                }
              }}
            >
              <Image
                source={{ uri: pages[currentPageIndex] }}
                style={[
                  styles.previewImage,
                  { transform: [{ rotate: `${currentRotation}deg` }] },
                ]}
                resizeMode="contain"
              />

              {/* Viewfinder ONLY shown during active Crop mode - clean white frame, NO blue border */}
              {isCropping && (
                <View
                  style={[
                    styles.cropOverlay,
                    {
                      left: cropBox.x,
                      top: cropBox.y,
                      width: cropBox.width,
                      height: cropBox.height,
                    },
                  ]}
                  pointerEvents="auto"
                >
                  {/* 3x3 Rule-of-Thirds Grid Lines */}
                  <View style={styles.gridLineH1} />
                  <View style={styles.gridLineH2} />
                  <View style={styles.gridLineV1} />
                  <View style={styles.gridLineV2} />

                  {/* 4 Corner Touch Handles */}
                  <View {...panTL.panHandlers} style={[styles.handleTouchTarget, styles.cornerTLTouch]}>
                    <View style={styles.cropCornerHandle} />
                  </View>

                  <View {...panTR.panHandlers} style={[styles.handleTouchTarget, styles.cornerTRTouch]}>
                    <View style={styles.cropCornerHandle} />
                  </View>

                  <View {...panBL.panHandlers} style={[styles.handleTouchTarget, styles.cornerBLTouch]}>
                    <View style={styles.cropCornerHandle} />
                  </View>

                  <View {...panBR.panHandlers} style={[styles.handleTouchTarget, styles.cornerBRTouch]}>
                    <View style={styles.cropCornerHandle} />
                  </View>

                  {/* 4 Midpoint Edge Touch Handles */}
                  <View {...panTop.panHandlers} style={[styles.handleTouchTarget, styles.edgeTopTouch]}>
                    <View style={styles.cropEdgeHandleH} />
                  </View>

                  <View {...panBottom.panHandlers} style={[styles.handleTouchTarget, styles.edgeBottomTouch]}>
                    <View style={styles.cropEdgeHandleH} />
                  </View>

                  <View {...panLeft.panHandlers} style={[styles.handleTouchTarget, styles.edgeLeftTouch]}>
                    <View style={styles.cropEdgeHandleV} />
                  </View>

                  <View {...panRight.panHandlers} style={[styles.handleTouchTarget, styles.edgeRightTouch]}>
                    <View style={styles.cropEdgeHandleV} />
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <View style={styles.spinnerOuterRing}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          </View>
        )}

        {/* Filter Selection Bar if toggled */}
        {showFilterPicker && (
          <View style={styles.filterPickerBar}>
            {(['magic', 'grayscale', 'original'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.filterModeTab,
                  filterMode === mode && styles.filterModeTabActive,
                ]}
                onPress={() => {
                  setFilterMode(mode);
                  setShowFilterPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.filterModeText,
                    filterMode === mode && styles.filterModeTextActive,
                  ]}
                >
                  {mode === 'magic' ? 'Magic' : mode === 'grayscale' ? 'Grayscale' : 'Original'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* --- Multi-Page Thumbnail Strip & Navigation (ONLY shown when 2 or more images) --- */}
      {pages.length >= 2 && !isCropping && (
        <View style={styles.multiPageContainer}>
          {/* Top Pagination Row: < | [⧉⁺] Page X of Y | > */}
          <View style={styles.pageNavigatorRow}>
            <TouchableOpacity
              style={[
                styles.pageNavArrowButton,
                currentPageIndex === 0 && styles.pageNavArrowDisabled,
              ]}
              onPress={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentPageIndex === 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pageNavArrowText,
                  currentPageIndex === 0 && styles.pageNavArrowTextDisabled,
                ]}
              >
                ‹
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pageCountCapsule}
              activeOpacity={0.8}
              onPress={handleKeepScanning}
            >
              <Text style={styles.pageCountAddIcon}>⧉⁺</Text>
              <Text style={styles.pageCountCapsuleText}>
                Page {currentPageIndex + 1} of {pages.length}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pageNavArrowButton,
                currentPageIndex === pages.length - 1 && styles.pageNavArrowDisabled,
              ]}
              onPress={() =>
                setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))
              }
              disabled={currentPageIndex === pages.length - 1}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pageNavArrowText,
                  currentPageIndex === pages.length - 1 && styles.pageNavArrowTextDisabled,
                ]}
              >
                ›
              </Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Thumbnails Carousel */}
          <ScrollView
            ref={thumbnailScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailListContent}
          >
            {pages.map((uri, idx) => {
              const isSelected = idx === currentPageIndex;
              const rot = rotations[idx] || 0;
              return (
                <TouchableOpacity
                  key={`thumb_${idx}`}
                  style={[
                    styles.thumbnailCard,
                    isSelected && styles.thumbnailCardSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCurrentPageIndex(idx)}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.thumbnailImage,
                      { transform: [{ rotate: `${rot}deg` }] },
                    ]}
                    resizeMode="cover"
                  />
                  <View style={styles.thumbNumberBadge}>
                    <Text style={styles.thumbNumberText}>{idx + 1}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* --- Horizontal Tool Bar (Without Magic Icon) --- */}
      {!isCropping && (
        <View style={styles.toolbarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarScrollContent}
          >
            {/* 1. Retake */}
            <TouchableOpacity
              style={styles.toolItem}
              activeOpacity={0.7}
              onPress={handleRetake}
            >
              <RetakeIcon />
              <Text style={styles.toolLabel}>Retake</Text>
            </TouchableOpacity>

            {/* 2. Crop (In-Page Cropping Toggle) */}
            <TouchableOpacity
              style={[styles.toolItem, isCropping && styles.toolItemActive]}
              activeOpacity={0.7}
              onPress={handleToggleCrop}
            >
              <CropIcon />
              <Text style={[styles.toolLabel, isCropping && styles.toolLabelActive]}>
                Crop
              </Text>
            </TouchableOpacity>

            {/* 3. Rotate */}
            <TouchableOpacity
              style={styles.toolItem}
              activeOpacity={0.7}
              onPress={handleRotate}
            >
              <RotateIcon />
              <Text style={styles.toolLabel}>Rotate</Text>
            </TouchableOpacity>

            {/* 4. Edit text */}
            <TouchableOpacity
              style={styles.toolItem}
              activeOpacity={0.7}
              onPress={() => setIsRenameModalOpen(true)}
            >
              <EditTextIcon />
              <Text style={styles.toolLabel}>Edit text</Text>
            </TouchableOpacity>

            {/* 5. Filters */}
            <TouchableOpacity
              style={styles.toolItem}
              activeOpacity={0.7}
              onPress={() => setShowFilterPicker((prev) => !prev)}
            >
              <FiltersIcon />
              <Text style={styles.toolLabel}>Filters</Text>
            </TouchableOpacity>

            {/* 6. Delete */}
            {pages.length > 1 && (
              <TouchableOpacity
                style={styles.toolItem}
                activeOpacity={0.7}
                onPress={handleDeletePage}
              >
                <DeleteIcon />
                <Text style={styles.toolLabel}>Delete</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* --- Bottom Action Row --- */}
      {isCropping ? (
        /* Crop Mode Bottom Action Bar */
        <View style={styles.cropActionBar}>
          <TouchableOpacity
            style={styles.cropCancelButton}
            activeOpacity={0.8}
            onPress={handleCancelCrop}
          >
            <Text style={styles.cropCancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cropResetButton}
            activeOpacity={0.8}
            onPress={handleResetCrop}
          >
            <Text style={styles.cropResetText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cropDoneButton}
            activeOpacity={0.85}
            onPress={handleApplyCrop}
          >
            <Text style={styles.cropDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Standard Review Bottom Action Bar: Both buttons at right corner */
        <View style={styles.bottomActionRow}>
          <TouchableOpacity
            style={styles.keepScanningButton}
            activeOpacity={0.8}
            onPress={handleKeepScanning}
          >
            <Text style={styles.keepScanningText}>Keep scanning</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.savePdfButton}
            activeOpacity={0.85}
            onPress={handleSavePdfDirectly}
          >
            <Text style={styles.savePdfText}>Save PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- Custom Rename Modal --- */}
      <RenameModal
        visible={isRenameModalOpen}
        initialTitle={docTitle}
        onCancel={() => setIsRenameModalOpen(false)}
        onSave={(newTitle) => {
          setDocTitle(newTitle);
          setIsRenameModalOpen(false);
        }}
      />

      {/* --- Loading Overlay --- */}
      <LoadingOverlay visible={isProcessing} message={loadingText} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },

  // --- Top Bar (White Theme) ---
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  titleText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dashedUnderline: {
    width: '100%',
    height: 1,
    borderBottomWidth: 1.5,
    borderColor: '#9CA3AF',
    borderStyle: 'dashed',
    marginTop: 4,
  },

  // --- Center Canvas ---
  canvasArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerOuterRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  paperCard: {
    width: '100%',
    height: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },

  // --- Crop Overlay (Clean White Border, Zero Blue) ---
  cropOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },

  // 3x3 Grid Lines inside crop box
  gridLineH1: {
    position: 'absolute',
    top: '33.33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.66%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },

  // Handle touch wrapper targets
  handleTouchTarget: {
    position: 'absolute',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  cornerTLTouch: {
    top: -22,
    left: -22,
  },
  cornerTRTouch: {
    top: -22,
    right: -22,
  },
  cornerBLTouch: {
    bottom: -22,
    left: -22,
  },
  cornerBRTouch: {
    bottom: -22,
    right: -22,
  },
  edgeTopTouch: {
    top: -22,
    left: '50%',
    marginLeft: -22,
  },
  edgeBottomTouch: {
    bottom: -22,
    left: '50%',
    marginLeft: -22,
  },
  edgeLeftTouch: {
    left: -22,
    top: '50%',
    marginTop: -22,
  },
  edgeRightTouch: {
    right: -22,
    top: '50%',
    marginTop: -22,
  },

  // Visible Handles Styling (White with crisp dark border, Zero Blue)
  cropCornerHandle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  cropEdgeHandleH: {
    width: 34,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  cropEdgeHandleV: {
    width: 10,
    height: 34,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },

  // --- Filter Selector Bar ---
  filterPickerBar: {
    position: 'absolute',
    top: 14,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  filterModeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterModeTabActive: {
    backgroundColor: Colors.primary,
  },
  filterModeText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  filterModeTextActive: {
    color: '#FFFFFF',
  },

  // --- Toolbar ---
  toolbarContainer: {
    height: 72,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  toolbarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minWidth: SCREEN_WIDTH,
    justifyContent: 'space-around',
  },
  toolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 54,
  },
  toolItemActive: {
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
  },
  toolLabel: {
    color: '#111827',
    fontSize: 11,
    marginTop: 5,
    fontWeight: '600',
  },
  toolLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // --- Crop Mode Bottom Action Bar ---
  cropActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cropCancelButton: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    borderColor: '#6B7280',
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  cropResetButton: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropResetText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  cropDoneButton: {
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 22,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  cropDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // --- Standard Bottom Action Row (Both Buttons at Right Corner) ---
  bottomActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  keepScanningButton: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#111827',
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  keepScanningText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  savePdfButton: {
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  savePdfText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // --- Custom Stroke Icons ---
  homeIconImage: {
    width: 22,
    height: 22,
  },

  retakeContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBody: {
    width: 19,
    height: 15,
    borderWidth: 1.8,
    borderColor: '#111827',
    borderRadius: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLens: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  retakeBadge: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 1,
  },
  retakeArrowText: {
    color: '#111827',
    fontSize: 10,
    fontWeight: 'bold',
  },

  cropContainer: {
    width: 22,
    height: 22,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropTopLeft: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#111827',
    borderTopLeftRadius: 1,
  },
  cropBottomRight: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#111827',
    borderBottomRightRadius: 1,
  },

  rotateContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateArc: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 2,
    borderColor: '#111827',
    borderTopColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  rotateArrow: {
    position: 'absolute',
    top: 3,
    right: 2.5,
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#111827',
    transform: [{ rotate: '45deg' }],
  },

  editTextContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTextDoc: {
    width: 17,
    height: 20,
    borderWidth: 1.8,
    borderColor: '#111827',
    borderRadius: 3,
    padding: 2.5,
  },
  editTextLine1: {
    width: 8,
    height: 1.5,
    backgroundColor: '#111827',
    marginTop: 4,
    borderRadius: 1,
  },
  editTextLine2: {
    width: 5,
    height: 1.5,
    backgroundColor: '#111827',
    marginTop: 2,
    borderRadius: 1,
  },
  editTextBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTextBadgeStar: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },

  filtersContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: '#111827',
    position: 'absolute',
  },
  filterCircleTop: {
    top: 1,
  },
  filterCircleLeft: {
    bottom: 2,
    left: 2,
  },
  filterCircleRight: {
    bottom: 2,
    right: 2,
  },

  deleteContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteGlyph: {
    color: '#111827',
    fontSize: 17,
  },

  // --- Multi-Page Thumbnail Section ---
  multiPageContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pageNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pageNavArrowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  pageNavArrowDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  pageNavArrowText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -2,
    lineHeight: 22,
  },
  pageNavArrowTextDisabled: {
    color: '#E5E7EB',
  },
  pageCountCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pageCountAddIcon: {
    color: '#FFFFFF',
    fontSize: 13,
    marginRight: 6,
    fontWeight: 'bold',
  },
  pageCountCapsuleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  thumbnailListContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thumbnailCard: {
    width: 54,
    height: 72,
    borderRadius: 6,
    marginHorizontal: 5,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    position: 'relative',
  },
  thumbnailCardSelected: {
    borderWidth: 2.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbNumberBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  thumbNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
