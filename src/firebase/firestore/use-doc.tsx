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
      // Cancellation flag: if `ref` changes again or the component unmounts before this
      // one-shot getDoc resolves, a stale result must not overwrite newer state.
      let cancelled = false;
      getDoc(ref)
        .then((snapshot) => {
          if (cancelled) return;
          setData(snapshot.data());
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
