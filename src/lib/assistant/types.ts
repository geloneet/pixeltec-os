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
  templateId?: string | null;
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
  templateId?: string | null;
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
    templateId:  doc.templateId ?? null,
    createdAt:   doc.createdAt.toDate().toISOString(),
    updatedAt:   doc.updatedAt.toDate().toISOString(),
  };
}

export interface AssistantTemplateDoc {
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  rrule:       string;
  defaultTime: string;
  durationMin: number;
  active:      boolean;
  createdAt:   Timestamp;
  updatedAt:   Timestamp;
}

export interface AssistantTemplateSerialized {
  id:          string;
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  rrule:       string;
  defaultTime: string;
  durationMin: number;
  active:      boolean;
  createdAt:   string;
  updatedAt:   string;
}

export function serializeTemplate(
  doc: AssistantTemplateDoc,
  id: string,
): AssistantTemplateSerialized {
  return {
    id,
    uid:         doc.uid,
    title:       doc.title,
    description: doc.description,
    category:    doc.category,
    rrule:       doc.rrule,
    defaultTime: doc.defaultTime,
    durationMin: doc.durationMin,
    active:      doc.active,
    createdAt:   doc.createdAt.toDate().toISOString(),
    updatedAt:   doc.updatedAt.toDate().toISOString(),
  };
}

// ── Phase 3: Archive + Weekly Reports ─────────────────────────────────────

export interface AssistantArchivedTaskDoc extends AssistantTaskDoc {
  archivedAt: Timestamp;
}

export interface ReportTotals {
  total:       number;
  completed:   number;
  cancelled:   number;
  postponed:   number;
  pending:     number;
  inProgress:  number;
}

export interface AssistantWeeklyReportDoc {
  uid:              string;
  weekKey:          string;
  weekStart:        Timestamp;
  weekEnd:          Timestamp;
  totals:           ReportTotals;
  byCategory:       Record<AssistantTaskCategory, ReportTotals>;
  generatedAt:      Timestamp;
  generatedBy:      'cron' | 'manual';
  telegramMessageId: number | null;
  telegramSentAt:   Timestamp | null;
  emailSentAt:      Timestamp | null;
}

export interface AssistantWeeklyReportSerialized {
  id:               string;
  uid:              string;
  weekKey:          string;
  weekStart:        string;
  weekEnd:          string;
  totals:           ReportTotals;
  byCategory:       Record<AssistantTaskCategory, ReportTotals>;
  generatedAt:      string;
  generatedBy:      'cron' | 'manual';
  telegramMessageId: number | null;
  telegramSentAt:   string | null;
  emailSentAt:      string | null;
}

export function serializeReport(
  doc: AssistantWeeklyReportDoc,
  id: string,
): AssistantWeeklyReportSerialized {
  return {
    id,
    uid:               doc.uid,
    weekKey:           doc.weekKey,
    weekStart:         doc.weekStart.toDate().toISOString(),
    weekEnd:           doc.weekEnd.toDate().toISOString(),
    totals:            doc.totals,
    byCategory:        doc.byCategory,
    generatedAt:       doc.generatedAt.toDate().toISOString(),
    generatedBy:       doc.generatedBy,
    telegramMessageId: doc.telegramMessageId,
    telegramSentAt:    doc.telegramSentAt?.toDate().toISOString() ?? null,
    emailSentAt:       doc.emailSentAt?.toDate().toISOString() ?? null,
  };
}
