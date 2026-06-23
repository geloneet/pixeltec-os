import type { Timestamp } from 'firebase-admin/firestore';

export type CreditTransactionType =
  | 'monthly_grant'
  | 'purchase'
  | 'charge'
  | 'refund'
  | 'manual_grant'
  | 'trial_grant';

export type OrganizationPlan = 'free' | 'starter' | 'pro' | 'agency';

export interface CreditSummary {
  // Document ID === uid of the owner: growthCredits/{uid}
  balance: number;
  monthlyAllowance: number;
  totalPurchased: number;
  totalUsed: number;
  lastMonthlyRefillAt?: Timestamp;
  plan: OrganizationPlan;
}

export interface CreditLedgerEntry {
  // Collection: growthCreditLedger/{entryId}
  // uid field used to filter per user
  id: string;
  uid: string;
  type: CreditTransactionType;
  amount: number;
  balance: number;
  operation?: string;
  referenceId?: string;
  description: string;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
}

export const PLAN_MONTHLY_ALLOWANCE: Record<OrganizationPlan, number> = {
  free: 50,
  starter: 200,
  pro: 600,
  agency: 2000,
};

export const TRIAL_GRANT_CREDITS = 50;
