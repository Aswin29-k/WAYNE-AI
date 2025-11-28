import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { 
  auth,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
} from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

// Define a default guest user
const GUEST_USER: User = {
  name: 'Guest User',
  email: 'guest@example.com',
  picture: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2EwYTVhZSIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xMiAxMmMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyem0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+PC9zdmc+`,
};

interface AuthContextType {
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser: User = {
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || 'No email provided',
          picture: firebaseUser.photoURL || `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2EwYTVhZSIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xMiAxMmMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyem0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+PC9zdmc+`,
        };
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  };

  const loginAsGuest = () => {
    setUser(GUEST_USER);
  };

  const logout = async () => {
    try {
      await signOut(auth); // Will trigger onAuthStateChanged for real users
      setUser(null); // Will clear guest user immediately
      localStorage.removeItem('chatHistory'); 
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  const value = { user, login, logout, loginAsGuest, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};