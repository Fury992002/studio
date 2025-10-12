'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This function initializes and returns the Firebase SDKs.
// It's designed to be idempotent, safely callable multiple times.
export function initializeFirebase(): { firebaseApp: FirebaseApp; auth: Auth; firestore: Firestore } {
  // Check if a Firebase app has already been initialized.
  if (!getApps().length) {
    // If not, initialize a new app.
    // In a Firebase App Hosting environment, initializeApp() can be called without args
    // to automatically use the provisioned project's configuration.
    // We fall back to the local config object for development.
    try {
      // Prefer automatic initialization.
      const firebaseApp = initializeApp();
      return getSdks(firebaseApp);
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('Automatic Firebase initialization failed. Falling back to firebaseConfig.', e);
      }
      // Fallback for local development or if auto-init fails.
      const firebaseApp = initializeApp(firebaseConfig);
      return getSdks(firebaseApp);
    }
  } else {
    // If an app already exists, get it and return the SDKs.
    return getSdks(getApp());
  }
}

// Helper function to get all necessary SDK instances from a FirebaseApp instance.
function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}

// Export all necessary hooks and providers for easy consumption in the app.
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
