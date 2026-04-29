import { getAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export function db(): Firestore {
  return getFirestore(getAdminApp());
}

export const COL = {
  assistantTasks:      'assistantTasks',
  assistantTemplates:  'assistantTemplates',
} as const;
