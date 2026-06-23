'use client';

import useSWR from 'swr';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  currentStep: string;
  resultPostId: string | null;
  error: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGenerationJob(jobId: string | null) {
  const isActive = !!jobId;

  const { data, error } = useSWR<JobState>(
    isActive ? `/api/growth/jobs/${jobId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data) return 2000;
        if (data.status === 'completed' || data.status === 'failed') return 0;
        return 2000;
      },
      revalidateOnFocus: false,
    }
  );

  return {
    job: data ?? null,
    isLoading: isActive && !data && !error,
    isDone: data?.status === 'completed' || data?.status === 'failed',
    isSuccess: data?.status === 'completed',
    isFailed: data?.status === 'failed',
  };
}
