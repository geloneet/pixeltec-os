'use client';
import {
  getDocs,
  onSnapshot,
  query,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

interface UseCollectionOptions {
  listen?: boolean;
}

export function useCollection<T>(
  ref: CollectionReference<T> | Query<T> | null,
  options: UseCollectionOptions = { listen: false }
) {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      setData([]);
      return;
    }

    setLoading(true);

    if (options.listen) {
      const unsubscribe = onSnapshot(
        ref,
        (snapshot) => {
          setData(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as T[]);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      // Cancellation flag: if `ref` changes again or the component unmounts before this
      // one-shot getDocs resolves, a stale result must not overwrite newer state.
      let cancelled = false;
      getDocs(ref)
        .then((snapshot) => {
          if (cancelled) return;
          setData(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as T[]);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [ref, options.listen]);

  return { data, error, loading };
}

export const useCollectionData = useCollection;
export const useCollectionGroup = useCollection;
