import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/auth';

/**
 * PRIVACY NOTICE: Scanned documents/PDFs are strictly stored locally.
 * Firebase is exclusively utilized for Auth and User Directory management.
 */

export interface FirebaseUserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
  providerId: string;
}

const LOCAL_USERS_TABLE_KEY = '@kpscan_firestore_mock_users_collection';

export async function getAllUsers(): Promise<FirebaseUserRecord[]> {
  try {
    const data = await AsyncStorage.getItem(LOCAL_USERS_TABLE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function syncUserProfile(user: UserProfile, provider = 'password'): Promise<void> {
  try {
    const userRecord: FirebaseUserRecord = {
      uid: user.id,
      email: user.email,
      displayName: user.name,
      photoURL: user.photo || null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      providerId: provider,
    };

    const existing = await getAllUsers();
    const filtered = existing.filter((u) => u.uid !== user.id);
    await AsyncStorage.setItem(LOCAL_USERS_TABLE_KEY, JSON.stringify([userRecord, ...filtered]));
  } catch (error) {
    console.warn('Failed to sync user profile:', error);
  }
}

export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  const userId = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const profile: UserProfile = { id: userId, email, name: email.split('@')[0], photo: null };
  await syncUserProfile(profile, 'password');
  return profile;
}

export async function signUpWithEmail(email: string, pass: string, displayName?: string): Promise<UserProfile> {
  const userId = `usr_${Date.now()}`;
  const profile: UserProfile = { id: userId, email, name: displayName || email.split('@')[0], photo: null };
  await syncUserProfile(profile, 'password');
  return profile;
}

export const FirebaseService = {
  syncUserProfile,
  getAllUsers,
  signInWithEmail,
  signUpWithEmail,
};
