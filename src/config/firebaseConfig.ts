/**
 * Firebase Configuration for KP Scan.
 * Replace placeholders with your Firebase project credentials from the Firebase Console:
 * Project Settings -> General -> Your Apps (Android / iOS / Web).
 */
export const FirebaseConfig = {
  apiKey: '[FIREBASE_API_KEY]',
  authDomain: '[FIREBASE_PROJECT_ID].firebaseapp.com',
  projectId: '[FIREBASE_PROJECT_ID]',
  storageBucket: '[FIREBASE_PROJECT_ID].appspot.com',
  messagingSenderId: '[FIREBASE_MESSAGING_SENDER_ID]',
  appId: '[FIREBASE_APP_ID]',
};

export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
} as const;
