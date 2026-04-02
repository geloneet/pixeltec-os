'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// Define a type for the user profile for better type safety
interface UserProfile {
    uid: string;
    email?: string;
    displayName?: string;
    role?: 'admin' | 'editor';
    [key: string]: any; // Allow other properties
}

export function useUserProfile() {
  const user = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && firestore) {
      setLoading(true);
      const docRef = doc(firestore, 'users', user.uid);
      
      const unsubscribe = onSnapshot(docRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
          } else {
            // Handle case where user document doesn't exist in Firestore yet
            setUserProfile({ uid: user.uid, email: user.email || '', displayName: user.displayName || 'New User', role: 'editor' });
          }
          setLoading(false);
        }, 
        (error) => {
          console.error("Error fetching user profile:", error);
          setLoading(false);
          setUserProfile(null);
        }
      );

      return () => unsubscribe();
    } else {
      // If there's no user or firestore instance, we are not loading and there's no profile.
      setLoading(false);
      setUserProfile(null);
    }
  }, [user, firestore]);

  return { userProfile, loading };
}
