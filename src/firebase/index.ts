import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

export function initializeFirebase(config = firebaseConfig): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  const app = !getApps().length ? initializeApp(config) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  return { firebaseApp: app, auth, firestore };
}

export { FirebaseProvider } from './provider';
export { FirebaseClientProvider } from './client-provider';
export {
  useCollection,
  useCollectionData,
  useCollectionGroup,
} from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
export { useUserProfile } from './auth/use-user-profile';
export {
  useFirebase,
  useFirebaseApp,
  useAuth,
  useFirestore,
} from './provider';
