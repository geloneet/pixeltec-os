'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeFirebase } from '@/firebase';
import { FirebaseProvider } from '@/firebase/provider';
import React, { useState, useEffect } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseInstance {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseInstance, setFirebaseInstance] = useState<FirebaseInstance | null>(null);
  const [isClient, setIsClient] = useState(false);

  // This effect runs only on the client, after the component has mounted.
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Don't try to initialize on the server or if already initialized.
    if (!isClient || firebaseInstance) return;

    const isConfigured = !!firebaseConfig.apiKey;
    if (!isConfigured) {
      // Log an error for the developer but don't show a UI.
      // This prevents the flash of unstyled content.
      console.error("Firebase is not configured. Please check your .env file.");
      return;
    }

    const init = async () => {
      const instance = await initializeFirebase(firebaseConfig);
      setFirebaseInstance(instance);
    };

    init();

  }, [isClient, firebaseInstance]);

  // While waiting for client-side mount or Firebase initialization, render nothing.
  // This prevents the "flash of fallback UI".
  if (!isClient || !firebaseInstance) {
    return null;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseInstance.firebaseApp}
      auth={firebaseInstance.auth}
      firestore={firebaseInstance.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
