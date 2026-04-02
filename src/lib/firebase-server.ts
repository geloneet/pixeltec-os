/**
 * Firebase client SDK initialized for server-side use (Server Actions, API Routes).
 * The Firebase JS SDK works in Node.js — this avoids the need for firebase-admin.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const SERVER_APP_NAME = 'pixeltec-server';

export function getServerFirestore() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const existing = getApps().find(a => a.name === SERVER_APP_NAME);
  const app = existing ?? initializeApp(config, SERVER_APP_NAME);
  return getFirestore(app);
}
