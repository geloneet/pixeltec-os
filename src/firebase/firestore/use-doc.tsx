'use client';
import {
  getDoc,
  onSnapshot,
  type DocumentReference,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

interface UseDocOptions {
  listen?: boolean;
}

export function useDoc<T>(
  ref: DocumentReference<T> | null,
  options: UseDocOptions = { listen: false }
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      setData(undefined);
      return;
    }

    setLoading(true);

    if (options.listen) {
      const unsubscribe = onSnapshot(
        ref,
        (snapshot) => {
          setData(snapshot.data());
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      getDoc(ref)
        .then((snapshot) => {
          setData(snapshot.data());
          setLoading(false);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
        });
    }
  }, [ref, options.listen]);

  return { data, error, loading };
}
