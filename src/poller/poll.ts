import type { CadlensClient } from '../api/client.js';
import type { Job } from '../api/types.js';
import type { JobStateStore } from '../job-state/state.js';

export interface PollOptions {
  totalTimeoutMs?: number;
  signal?: AbortSignal;
}

export function computeDelayMs(attempt: number): number {
  if (attempt <= 5) return 1000;
  if (attempt <= 15) return 2000;
  return Math.min(5000 + (attempt - 15) * 100, 10_000);
}

export async function pollUntilDone(
  client: CadlensClient,
  jobState: JobStateStore,
  jobId: string,
  opts: PollOptions = {},
): Promise<Job | null> {
  const totalTimeoutMs = opts.totalTimeoutMs ?? 5 * 60 * 1000;
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < totalTimeoutMs) {
    if (opts.signal?.aborted) return null;

    const cached = jobState.get(jobId);
    if (cached && (cached.status === 'COMPLETED' || cached.status === 'FAILED')) {
      return await client.fetch<Job>(`/jobs/${jobId}`);
    }

    const job = await client.fetch<Job>(`/jobs/${jobId}`);
    if (job.status === 'COMPLETED' || job.status === 'FAILED') return job;

    attempt++;
    const delay = computeDelayMs(attempt);
    const remaining = totalTimeoutMs - (Date.now() - start);
    if (remaining <= 0) break;

    const waitMs = Math.min(delay, remaining);
    await Promise.race([
      jobState.waitForChange(jobId, waitMs),
      new Promise<void>((r) => setTimeout(r, waitMs)),
    ]);
  }
  return null;
}
