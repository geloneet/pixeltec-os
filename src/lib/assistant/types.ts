import { CATEGORIES, STATUSES } from './constants';

export type AssistantTaskCategory = typeof CATEGORIES[number]['value'];
export type AssistantTaskStatus   = typeof STATUSES[number]['value'];

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
  important:   boolean;
  createdAt:   string;
  updatedAt:   string;
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

// ── Phase 3: Archive + Weekly Reports ─────────────────────────────────────

export interface ReportTotals {
  total:       number;
  completed:   number;
  cancelled:   number;
  postponed:   number;
  pending:     number;
  inProgress:  number;
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
  // WhatsApp (current transport)
  whatsappMessageId: string | null;
  whatsappSentAt:    string | null;
  whatsappError:     string | null;
  // Telegram (legacy — kept optional for backwards compat with old docs)
  telegramMessageId?: number | null;
  telegramSentAt?:   string | null;
  // Email (future)
  emailSentAt:       string | null;
}
