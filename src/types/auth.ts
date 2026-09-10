export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photo?: string | null;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isInitialized: boolean;
}
