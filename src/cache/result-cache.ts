import type { JobResult } from '../api/types.js';

interface Entry {
  data: JobResult;
  at: number;
}

export class ResultCache {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly ttlMs = 5 * 60 * 1000) {}

  get(jobId: string): JobResult | undefined {
    const entry = this.map.get(jobId);
    if (!entry) return undefined;
    if (Date.now() - entry.at > this.ttlMs) {
      this.map.delete(jobId);
      return undefined;
    }
    return entry.data;
  }

  set(jobId: string, data: JobResult): void {
    this.map.set(jobId, { data, at: Date.now() });
  }

  invalidate(jobId: string): void {
    this.map.delete(jobId);
  }

  patchImageUrl(jobId: string, imageUrl: string): void {
    const entry = this.map.get(jobId);
    if (entry) {
      entry.data = { ...entry.data, imageUrl };
      entry.at = Date.now();
    }
  }

  clear(): void {
    this.map.clear();
  }
}
