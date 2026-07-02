'use client';

import { useMemo } from 'react';
import { collection, type CollectionReference } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import type { WhatsAppContact } from '@/types/whatsapp-inbox';

interface UseWhatsappContactsReturn {
  contactsByPhone: Map<string, WhatsAppContact>;
  loading: boolean;
  error?: Error;
}

/** Escucha /whatsappContacts en tiempo real y lo indexa por teléfono (doc id). */
export function useWhatsappContacts(): UseWhatsappContactsReturn {
  const fs = useFirestore();

  const contactsRef = useMemo(
    () => (fs ? (collection(fs, 'whatsappContacts') as CollectionReference<WhatsAppContact>) : null),
    [fs]
  );

  const { data, loading, error } = useCollection<WhatsAppContact>(contactsRef, { listen: true });

  const contactsByPhone = useMemo(() => {
    const map = new Map<string, WhatsAppContact>();
    (data ?? []).forEach((contact) => map.set(contact.id, contact));
    return map;
  }, [data]);

  return { contactsByPhone, loading, error };
}
