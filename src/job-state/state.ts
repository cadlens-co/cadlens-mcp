import type { JobStatus, WebhookPayload } from '../api/types.js';

export interface JobStateSnapshot {
  status: JobStatus;
  updatedAt: number;
  error?: string | null;
  hints?: WebhookPayload['result'];
}

export class JobStateStore {
  private readonly map = new Map<string, JobStateSnapshot>();
  private readonly waiters = new Map<string, Set<() => void>>();

  get(jobId: string): JobStateSnapshot | undefined {
    return this.map.get(jobId);
  }

  applyWebhook(payload: WebhookPayload): void {
    this.map.set(payload.jobId, {
      status: payload.status,
      updatedAt: Date.now(),
      error: payload.error ?? null,
      hints: payload.result,
    });
    const set = this.waiters.get(payload.jobId);
    if (set) {
      for (const fn of set) fn();
    }
  }

  waitForChange(jobId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const onChange = () => {
        clearTimeout(timer);
        this.waiters.get(jobId)?.delete(onChange);
        resolve();
      };
      const timer = setTimeout(() => {
        this.waiters.get(jobId)?.delete(onChange);
        resolve();
      }, timeoutMs);
      let set = this.waiters.get(jobId);
      if (!set) {
        set = new Set();
        this.waiters.set(jobId, set);
      }
      set.add(onChange);
    });
  }

  clear(): void {
    this.map.clear();
    this.waiters.clear();
  }
}
