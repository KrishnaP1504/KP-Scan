import RNFS from 'react-native-fs';
import { PDFDocument } from 'pdf-lib';
import { ScannedDocument } from '../types/document';
import { ensureStoragePermission } from '../utils/permissions';

export interface StorageFolderOption {
  id: 'downloads' | 'documents' | 'pictures';
  name: string;
  subTitle: string;
  path: string;
  icon: string;
}

export const getStorageLocations = (): StorageFolderOption[] => [
  {
    id: 'downloads',
    name: 'Downloads Folder',
    subTitle: 'Internal storage > Download > KP_Scan',
    path: `${RNFS.DownloadDirectoryPath}/KP_Scan`,
    icon: '📥',
  },
  {
    id: 'documents',
    name: 'Documents Folder',
    subTitle: 'App Documents > KP_Scan',
    path: `${RNFS.DocumentDirectoryPath}/KP_Scan`,
    icon: '📁',
  },
  {
    id: 'pictures',
    name: 'Pictures & Gallery',
    subTitle: 'Internal storage > Pictures > KP_Scan',
    path: `${RNFS.PicturesDirectoryPath}/KP_Scan`,
    icon: '🖼️',
  },
];

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
};

export const FileStorageService = {
  /**
   * Generates a real multi-page PDF using pdf-lib and saves it to the selected directory.
   */
  async saveDocumentAsPdf(
    doc: ScannedDocument,
    targetDirectory: string,
    customName?: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const hasPermission = await ensureStoragePermission();
      if (!hasPermission) {
        return { success: false, error: 'Storage permission denied.' };
      }

      // 1. Ensure target directory exists
      const exists = await RNFS.exists(targetDirectory);
      if (!exists) {
        await RNFS.mkdir(targetDirectory);
      }

      const cleanName = sanitizeFileName(customName || doc.title || `Scan_${Date.now()}`);
      const filePath = `${targetDirectory}/${cleanName}.pdf`;

      // 1.1 If doc already has a pre-generated or imported PDF on disk, copy it directly
      if (doc.pdfPath) {
        const cleanSource = doc.pdfPath.replace('file://', '');
        if (await RNFS.exists(cleanSource)) {
          if (cleanSource !== filePath) {
            await RNFS.copyFile(cleanSource, filePath);
          }
          try {
            await RNFS.scanFile(filePath);
          } catch {}
          return { success: true, filePath };
        }
      }

      // 2. Build PDF document using pdf-lib
      const pdfDoc = await PDFDocument.create();

      const pageList = doc.pages && doc.pages.length > 0 ? doc.pages : [{ id: '1', uri: doc.thumbnailUri, rotation: 0, filter: 'magic' as const }];

      for (let i = 0; i < pageList.length; i++) {
        const pageItem = pageList[i];
        let uri = pageItem.uri;

        let base64Data = '';

        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          // Download temporary file to read base64
          const tempPath = `${RNFS.CachesDirectoryPath}/temp_page_${Date.now()}_${i}.jpg`;
          const downloadResult = await RNFS.downloadFile({
            fromUrl: uri,
            toFile: tempPath,
          }).promise;

          if (downloadResult.statusCode === 200) {
            base64Data = await RNFS.readFile(tempPath, 'base64');
            // Clean up temp file
            RNFS.unlink(tempPath).catch(() => {});
          }
        } else {
          // Local file path
          const cleanLocalUri = uri.replace('file://', '');
          base64Data = await RNFS.readFile(cleanLocalUri, 'base64');
        }

        if (base64Data) {
          try {
            // Embed as JPG or PNG
            let embeddedImage;
            try {
              embeddedImage = await pdfDoc.embedJpg(base64Data);
            } catch {
              embeddedImage = await pdfDoc.embedPng(base64Data);
            }

            const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
            page.drawImage(embeddedImage, {
              x: 0,
              y: 0,
              width: embeddedImage.width,
              height: embeddedImage.height,
            });
          } catch (embedError) {
            console.warn('Image embedding error on page', i, embedError);
          }
        }
      }

      // 3. Save PDF as base64 and write to storage
      const pdfBase64 = await pdfDoc.saveAsBase64();
      await RNFS.writeFile(filePath, pdfBase64, 'base64');

      return { success: true, filePath };
    } catch (err: any) {
      console.warn('PDF saving error:', err);
      return { success: false, error: err?.message || 'Failed to save PDF' };
    }
  },

  /**
   * Saves individual pages as JPEG images into the selected directory.
   */
  async saveDocumentAsJpeg(
    doc: ScannedDocument,
    targetDirectory: string,
    customName?: string
  ): Promise<{ success: boolean; filePaths?: string[]; error?: string }> {
    try {
      const hasPermission = await ensureStoragePermission();
      if (!hasPermission) {
        return { success: false, error: 'Storage permission denied.' };
      }

      const exists = await RNFS.exists(targetDirectory);
      if (!exists) {
        await RNFS.mkdir(targetDirectory);
      }

      const cleanName = sanitizeFileName(customName || doc.title || `Scan_${Date.now()}`);
      const savedPaths: string[] = [];

      const pageList = doc.pages && doc.pages.length > 0 ? doc.pages : [{ id: '1', uri: doc.thumbnailUri, rotation: 0, filter: 'magic' as const }];

      for (let i = 0; i < pageList.length; i++) {
        const pageItem = pageList[i];
        const fileName =
          pageList.length > 1
            ? `${cleanName}_page_${i + 1}.jpg`
            : `${cleanName}.jpg`;
        const destPath = `${targetDirectory}/${fileName}`;

        if (pageItem.uri.startsWith('http://') || pageItem.uri.startsWith('https://')) {
          await RNFS.downloadFile({
            fromUrl: pageItem.uri,
            toFile: destPath,
          }).promise;
          savedPaths.push(destPath);
        } else {
          const cleanLocalUri = pageItem.uri.replace('file://', '');
          await RNFS.copyFile(cleanLocalUri, destPath);
          savedPaths.push(destPath);
        }
      }

      return { success: true, filePaths: savedPaths };
    } catch (err: any) {
      console.warn('JPEG saving error:', err);
      return { success: false, error: err?.message || 'Failed to save JPEG images' };
    }
  },

  /**
   * Retrieves the actual size in bytes of the document's PDF or pages on disk.
   */
  async getDocumentActualSize(doc: ScannedDocument): Promise<number> {
    try {
      // 1. Check doc.fileSize if already stored and positive
      if (doc.fileSize && doc.fileSize > 0) {
        return doc.fileSize;
      }

      // 2. Check doc.pdfPath if exists
      if (doc.pdfPath) {
        const cleanPdfPath = doc.pdfPath.replace('file://', '');
        if (await RNFS.exists(cleanPdfPath)) {
          const stat = await RNFS.stat(cleanPdfPath);
          if (stat.size > 0) return stat.size;
        }
      }

      // 3. Check default app storage location
      const cleanName = sanitizeFileName(doc.title || `Scan_${doc.id}`);
      const defaultPath = `${RNFS.DocumentDirectoryPath}/KP_Scan/${cleanName}.pdf`;
      if (await RNFS.exists(defaultPath)) {
        const stat = await RNFS.stat(defaultPath);
        if (stat.size > 0) return stat.size;
      }

      // 4. Check downloads folder
      const downloadPath = `${RNFS.DownloadDirectoryPath}/KP_Scan/${cleanName}.pdf`;
      if (await RNFS.exists(downloadPath)) {
        const stat = await RNFS.stat(downloadPath);
        if (stat.size > 0) return stat.size;
      }

      // 5. Sum the actual size of scanned image pages on disk
      if (doc.pages && doc.pages.length > 0) {
        let totalSize = 0;
        for (const p of doc.pages) {
          if (p.uri) {
            const cleanImgPath = p.uri.replace('file://', '');
            if (await RNFS.exists(cleanImgPath)) {
              const stat = await RNFS.stat(cleanImgPath);
              totalSize += stat.size;
            }
          }
        }
        if (totalSize > 0) return totalSize;
      }

      // 6. Fallback check thumbnail
      if (doc.thumbnailUri) {
        const cleanThumbPath = doc.thumbnailUri.replace('file://', '');
        if (await RNFS.exists(cleanThumbPath)) {
          const stat = await RNFS.stat(cleanThumbPath);
          if (stat.size > 0) return stat.size;
        }
      }
    } catch (err) {
      console.warn('Could not get document actual size:', err);
    }
    return 0;
  },

  /**
   * Combines multiple documents (pages of images AND existing PDFs) into a single master PDF.
   */
  async combineDocumentsAsPdf(
    documents: ScannedDocument[],
    targetDirectory: string,
    customName?: string
  ): Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }> {
    try {
      const hasPermission = await ensureStoragePermission();
      if (!hasPermission) {
        return { success: false, error: 'Storage permission denied.' };
      }

      const exists = await RNFS.exists(targetDirectory);
      if (!exists) {
        await RNFS.mkdir(targetDirectory);
      }

      const cleanName = sanitizeFileName(customName || `Combined_${Date.now()}`);
      const filePath = `${targetDirectory}/${cleanName}.pdf`;

      const masterDoc = await PDFDocument.create();

      for (const doc of documents) {
        const pageList = doc.pages && doc.pages.length > 0
          ? doc.pages
          : doc.thumbnailUri
          ? [{ id: '1', uri: doc.thumbnailUri, rotation: 0, filter: 'magic' as const }]
          : [];

        if (pageList.length > 0) {
          for (const pageItem of pageList) {
            let base64Data = '';
            const uri = pageItem.uri;

            if (uri.startsWith('http://') || uri.startsWith('https://')) {
              const tempPath = `${RNFS.CachesDirectoryPath}/temp_comb_${Date.now()}.jpg`;
              const downloadResult = await RNFS.downloadFile({
                fromUrl: uri,
                toFile: tempPath,
              }).promise;
              if (downloadResult.statusCode === 200) {
                base64Data = await RNFS.readFile(tempPath, 'base64');
                RNFS.unlink(tempPath).catch(() => {});
              }
            } else {
              const cleanLocalUri = uri.replace('file://', '');
              if (await RNFS.exists(cleanLocalUri)) {
                base64Data = await RNFS.readFile(cleanLocalUri, 'base64');
              }
            }

            if (base64Data) {
              try {
                let embeddedImage;
                try {
                  embeddedImage = await masterDoc.embedJpg(base64Data);
                } catch {
                  embeddedImage = await masterDoc.embedPng(base64Data);
                }

                const page = masterDoc.addPage([embeddedImage.width, embeddedImage.height]);
                page.drawImage(embeddedImage, {
                  x: 0,
                  y: 0,
                  width: embeddedImage.width,
                  height: embeddedImage.height,
                });
              } catch (embedErr) {
                console.warn('Embed error in combine:', embedErr);
              }
            }
          }
        } else if (doc.pdfPath) {
          const cleanPdfPath = doc.pdfPath.replace('file://', '');
          if (await RNFS.exists(cleanPdfPath)) {
            try {
              const base64 = await RNFS.readFile(cleanPdfPath, 'base64');
              const sourceDoc = await PDFDocument.load(base64);
              const pageIndices = sourceDoc.getPageIndices();
              const copiedPages = await masterDoc.copyPages(sourceDoc, pageIndices);
              copiedPages.forEach((page) => masterDoc.addPage(page));
            } catch (pdfErr) {
              console.warn('Error loading source PDF during combine:', pdfErr);
            }
          }
        }
      }

      const pdfBase64 = await masterDoc.saveAsBase64();
      await RNFS.writeFile(filePath, pdfBase64, 'base64');

      let fileSize = 0;
      try {
        const stat = await RNFS.stat(filePath);
        fileSize = stat.size;
      } catch {}

      return { success: true, filePath, fileSize };
    } catch (err: any) {
      console.warn('Combine PDF error:', err);
      return { success: false, error: err?.message || 'Failed to combine documents' };
    }
  },
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

