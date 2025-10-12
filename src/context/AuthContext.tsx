'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, signInAnonymously, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { initializeFirebase } from '@/firebase'; // Correct import path

const SESSION_KEY = 'invoice-app-authenticated';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  hasPassedAuthCheck: boolean;
  handleLogin: (isSuccess: boolean) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // This state is now derived from sessionStorage
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasPassedAuthCheck, setHasPassedAuthCheck] = useState(false);

  useEffect(() => {
    // On initial load, check sessionStorage
    const sessionAuthenticated = sessionStorage.getItem(SESSION_KEY) === 'true';
    setIsAuthenticated(sessionAuthenticated);

    const auth = getAuth(initializeFirebase().firebaseApp);
    
    // Ensure we always have a Firebase user, even if anonymous
    if (!auth.currentUser) {
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed:", error);
        });
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser); // Keep track of the Firebase user
      setIsLoading(false);
      setHasPassedAuthCheck(true);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (isSuccess: boolean) => {
    if (isSuccess) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      setIsAuthenticated(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    // Optionally, sign out the Firebase user too if desired
    const auth = getAuth(initializeFirebase().firebaseApp);
    signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, hasPassedAuthCheck, handleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
