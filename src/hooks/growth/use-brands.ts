'use client';

import useSWR from 'swr';
import type { BrandBrainClient } from '@/lib/growth/actions/brands';

const fetcher = async (url: string): Promise<BrandBrainClient[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<BrandBrainClient[]>;
};

const singleFetcher = async (url: string): Promise<BrandBrainClient> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<BrandBrainClient>;
};

export function useBrands() {
  return useSWR<BrandBrainClient[]>('/api/growth/brands', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });
}

export function useBrand(brandId: string | null) {
  return useSWR<BrandBrainClient>(
    brandId ? `/api/growth/brands/${brandId}` : null,
    singleFetcher,
    { revalidateOnFocus: false }
  );
}
