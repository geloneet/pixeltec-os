import type { Timestamp } from 'firebase-admin/firestore';
import { CATEGORIES, STATUSES } from './constants';

export type AssistantTaskCategory = typeof CATEGORIES[number]['value'];
export type AssistantTaskStatus   = typeof STATUSES[number]['value'];

export interface AssistantTaskDoc {
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  startsAt:    Timestamp;
  durationMin: number;
  status:      AssistantTaskStatus;
  weekKey:     string;
  createdAt:   Timestamp;
  updatedAt:   Timestamp;
}

export interface AssistantTaskSerialized {
  id:          string;
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  startsAt:    string;
  durationMin: number;
  status:      AssistantTaskStatus;
  weekKey:     string;
  createdAt:   string;
  updatedAt:   string;
}

export function serializeTask(
  doc: AssistantTaskDoc,
  id: string,
): AssistantTaskSerialized {
  return {
    id,
    uid:         doc.uid,
    title:       doc.title,
    description: doc.description,
    category:    doc.category,
    startsAt:    doc.startsAt.toDate().toISOString(),
    durationMin: doc.durationMin,
    status:      doc.status,
    weekKey:     doc.weekKey,
    createdAt:   doc.createdAt.toDate().toISOString(),
    updatedAt:   doc.updatedAt.toDate().toISOString(),
  };
}
