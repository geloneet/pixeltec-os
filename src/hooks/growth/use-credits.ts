'use client';

import useSWR from 'swr';

interface CreditBalance {
  balance: number;
  plan: string;
  monthlyAllowance: number;
  totalUsed: number;
}

const fetcher = async (url: string): Promise<CreditBalance> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<CreditBalance>;
};

export function useCredits() {
  return useSWR<CreditBalance>('/api/growth/credits', fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}

export function canAfford(balance: number | undefined, cost: number): boolean {
  if (balance === undefined) return false;
  return balance >= cost;
}
