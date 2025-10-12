'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context for Firebase
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userState, setUserState] = useState<{ user: User | null; isLoading: boolean; error: Error | null }>({
    user: null,
    isLoading: true, // Start in loading state
    error: null,
  });

  // Subscribe to Firebase auth state changes.
  useEffect(() => {
    // This flag prevents state updates after the component has unmounted.
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (isMounted) {
          setUserState({ user: firebaseUser, isLoading: false, error: null });
        }
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        if (isMounted) {
          setUserState({ user: null, isLoading: false, error: error });
        }
      }
    );

    // Cleanup function: Unsubscribe and flip the mounted flag when the component unmounts.
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [auth]); // Re-run effect if the auth instance changes

  // Memoize the context value to prevent unnecessary re-renders.
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp,
    firestore,
    auth,
    user: userState.user,
    isUserLoading: userState.isLoading,
    userError: userState.error,
  }), [firebaseApp, firestore, auth, userState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


// Custom hook to access Firebase context safely.
function useFirebaseContext(): FirebaseContextState {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
}

export const useAuth = (): Auth => useFirebaseContext().auth!;
export const useFirestore = (): Firestore => useFirebaseContext().firestore!;
export const useFirebaseApp = (): FirebaseApp => useFirebaseContext().firebaseApp!;
export const useUser = () => {
    const { user, isUserLoading, userError } = useFirebaseContext();
    return { user, isUserLoading, userError };
};

// Helper for memoizing Firebase queries/refs to prevent infinite loops.
type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | MemoFirebase<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  
  if (typeof memoized === 'object' && memoized !== null) {
    (memoized as MemoFirebase<T>).__memo = true;
  }
  
  return memoized;
}
