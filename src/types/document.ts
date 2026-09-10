export type FilterMode = 'original' | 'magic' | 'grayscale' | 'bw';

export interface ScannedPage {
  id: string;
  uri: string;
  rotation: number; // 0, 90, 180, 270
  filter: FilterMode;
}

export interface ScannedDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  thumbnailUri: string;
  pdfPath?: string;
  fileSize?: number;
  isSynced: boolean;
  driveFileId?: string;
  pages: ScannedPage[];
}
