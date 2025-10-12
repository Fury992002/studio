'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirebase } from '@/firebase'; // Use client provider to get auth

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'invoice_flow_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // We rely on Firebase's auth state persistence, not our own session storage.
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
    });

    return () => unsubscribe();
  }, []);

  const loginWithFirebase = async (email: string, pass: string) => {
    const auth = getAuth(initializeFirebase().firebaseApp);
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
        // If sign-in fails because the user does not exist, create the user.
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            // Re-throw other errors.
            throw error;
        }
    }
  };

  const logout = () => {
    const auth = getAuth(initializeFirebase().firebaseApp);
    auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, loginWithFirebase, logout }}>
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
