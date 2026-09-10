import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { UserProfile, AuthState } from '../types/auth';
import { FirebaseService, FirebaseUserRecord } from '../services/firebaseService';

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<boolean>;
  connectGoogleAccount: (email: string, name?: string) => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  registeredUsers: FirebaseUserRecord[];
  refreshUserList: () => Promise<void>;
}

const STORAGE_KEYS = {
  IS_GUEST: '@kpscan_is_guest',
  USER_DATA: '@kpscan_user_data',
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [registeredUsers, setRegisteredUsers] = useState<FirebaseUserRecord[]>([]);

  useEffect(() => {
    configureGoogle();
    bootstrapAuthState();
    fetchUsers();
  }, []);

  const configureGoogle = () => {
    try {
      GoogleSignin.configure({
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        webClientId: '3218206914-0kv9cg0srg8rc7focquk0drqreci4c0p.apps.googleusercontent.com',
        offlineAccess: false,
      });
    } catch (err) {
      console.log('Google Signin configuration notice:', err);
    }
  };

  const fetchUsers = async () => {
    const list = await FirebaseService.getAllUsers();
    setRegisteredUsers(list);
  };

  const bootstrapAuthState = async () => {
    try {
      const storedGuest = await AsyncStorage.getItem(STORAGE_KEYS.IS_GUEST);
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsGuest(false);
      } else if (storedGuest === 'true') {
        setIsGuest(true);
      } else {
        // First run defaults to guest mode for zero friction
        setIsGuest(true);
        await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'true');
      }
    } catch (error) {
      console.log('Auth bootstrap notice:', error);
      setIsGuest(true);
    } finally {
      setIsInitialized(true);
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // If user had a prior cached session, clear it so account picker opens
      try {
        if (GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
      } catch {}

      const response = await GoogleSignin.signIn();
      const signedInUser = (response as any)?.data?.user || (response as any)?.user;

      if (!signedInUser) {
        throw new Error('No user profile returned from Google Sign-In');
      }

      const profile: UserProfile = {
        id: signedInUser.id || `usr_g_${Date.now()}`,
        name: signedInUser.name || signedInUser.email?.split('@')[0] || 'Google User',
        email: signedInUser.email || '',
        photo: signedInUser.photo || null,
      };

      setUser(profile);
      setIsGuest(false);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'false');
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));

      // Record authenticated user in User Directory
      await FirebaseService.syncUserProfile(profile, 'google');
      await fetchUsers();
      return true;
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled Google sign in');
      } else {
        console.log('Google Sign-in notice:', error?.message || error);
      }
      return false;
    }
  };

  const connectGoogleAccount = async (email: string, name?: string): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const userName = name || cleanEmail.split('@')[0];
      const profile: UserProfile = {
        id: `usr_g_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: userName,
        email: cleanEmail,
        photo: null,
      };

      setUser(profile);
      setIsGuest(false);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'false');
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));

      await FirebaseService.syncUserProfile(profile, 'google');
      await fetchUsers();
      return true;
    } catch (error) {
      console.log('Google account connection notice:', error);
      return false;
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<boolean> => {
    try {
      const profile = await FirebaseService.signInWithEmail(email, pass);
      setUser(profile);
      setIsGuest(false);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'false');
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));
      await fetchUsers();
      return true;
    } catch (error) {
      console.warn('Email sign in error:', error);
      return false;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name?: string
  ): Promise<boolean> => {
    try {
      const profile = await FirebaseService.signUpWithEmail(email, pass, name);
      setUser(profile);
      setIsGuest(false);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'false');
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));
      await fetchUsers();
      return true;
    } catch (error) {
      console.warn('Email sign up error:', error);
      return false;
    }
  };

  const continueAsGuest = async () => {
    setUser(null);
    setIsGuest(true);
    await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'true');
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  };

  const signOut = async () => {
    try {
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      }
    } catch (error) {
      console.warn('Sign-out error:', error);
    } finally {
      setUser(null);
      setIsGuest(true);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, 'true');
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const tokens = await GoogleSignin.getTokens();
      return tokens.accessToken;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest,
        isInitialized,
        signInWithGoogle,
        connectGoogleAccount,
        signInWithEmail,
        signUpWithEmail,
        continueAsGuest,
        signOut,
        getAccessToken,
        registeredUsers,
        refreshUserList: fetchUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
