import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedDocument } from '../types/document';

interface DocumentContextType {
  documents: ScannedDocument[];
  addDocument: (doc: ScannedDocument) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocumentTitle: (id: string, newTitle: string) => Promise<void>;
  markAsSynced: (id: string, driveFileId: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
}

const STORAGE_KEY = '@kpscan_documents_list';

const DocumentContext = createContext<DocumentContextType>({} as DocumentContextType);

export const DocumentProvider = ({ children }: { children: ReactNode }) => {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ScannedDocument[] = JSON.parse(stored);
        // Filter out any legacy initial demo documents (doc_1, doc_2, doc_3)
        const userDocs = parsed.filter(
          (d) => d.id !== 'doc_1' && d.id !== 'doc_2' && d.id !== 'doc_3'
        );
        setDocuments(userDocs);
        if (userDocs.length !== parsed.length) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userDocs));
        }
      } else {
        setDocuments([]);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      }
    } catch (err) {
      console.log('Documents load notice:', err);
      setDocuments([]);
    }
  };

  const addDocument = async (doc: ScannedDocument) => {
    const updated = [doc, ...documents];
    setDocuments(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteDocument = async (id: string) => {
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const updateDocumentTitle = async (id: string, newTitle: string) => {
    const updated = documents.map((d) =>
      d.id === id ? { ...d, title: newTitle, updatedAt: new Date().toISOString() } : d
    );
    setDocuments(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const markAsSynced = async (id: string, driveFileId: string) => {
    const updated = documents.map((d) =>
      d.id === id ? { ...d, isSynced: true, driveFileId } : d
    );
    setDocuments(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <DocumentContext.Provider
      value={{
        documents,
        addDocument,
        deleteDocument,
        updateDocumentTitle,
        markAsSynced,
        refreshDocuments: loadDocuments,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => useContext(DocumentContext);
