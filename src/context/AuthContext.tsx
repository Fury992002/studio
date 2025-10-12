'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  hasPassedAuthCheck: boolean;
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasPassedAuthCheck, setHasPassedAuthCheck] = useState(false);

  useEffect(() => {
    const auth = getAuth(initializeFirebase().firebaseApp);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            setUser(firebaseUser);
            setIsAuthenticated(true);
        } else {
            setUser(null);
            setIsAuthenticated(false);
        }
        setIsLoading(false);
        setHasPassedAuthCheck(true);
    });

    const handleBeforeUnload = () => {
        // We don't sign out here as it can race with page navigation
        // Instead, we rely on the protected route logic to redirect
        // and the login page to handle session state.
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        unsubscribe();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        // On unmount of the entire app, we ensure logout.
        if (auth.currentUser) {
            signOut(auth);
        }
    };
  }, []);

  const loginWithFirebase = async (email: string, pass: string) => {
    const auth = getAuth(initializeFirebase().firebaseApp);
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            throw error;
        }
    }
  };

  const logout = () => {
    const auth = getAuth(initializeFirebase().firebaseApp);
    signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, hasPassedAuthCheck, loginWithFirebase, logout }}>
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
