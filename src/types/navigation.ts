import { NavigatorScreenParams } from '@react-navigation/native';
import { ScannedPage, ScannedDocument } from './document';

export type MainTabParamList = {
  HomeTab: undefined;
  ScanTriggerTab: undefined;
  FilesTab: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  MainTabs: undefined;
  ScannerModal: undefined;
  DocumentReview: {
    initialPages: string[];
    documentTitle?: string;
  };
  CombineFiles: {
    initialDocument?: ScannedDocument;
  };
  CompressPdf: {
    document: ScannedDocument;
  };
};
