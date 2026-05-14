import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCadlensClient } from '../../src/api/client.js';
import { JobStateStore } from '../../src/job-state/state.js';
import { computeDelayMs, pollUntilDone } from '../../src/poller/poll.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';
const API_BASE = `${ORIGIN}/v1`;

function client() {
  return createCadlensClient({
    apiBase: API_BASE,
    apiKey: 'k',
    webhookPort: 0,
    webhookPublicUrl: null,
    requestTimeoutMs: 5_000,
  });
}

describe('computeDelayMs', () => {
  it('uses fast cadence for early attempts', () => {
    expect(computeDelayMs(1)).toBe(1000);
    expect(computeDelayMs(5)).toBe(1000);
  });
  it('uses 2s for attempts 6-15', () => {
    expect(computeDelayMs(6)).toBe(2000);
    expect(computeDelayMs(15)).toBe(2000);
  });
  it('ramps to 10s cap after 15', () => {
    expect(computeDelayMs(16)).toBe(5100);
    expect(computeDelayMs(70)).toBe(10_000);
  });
});

describe('pollUntilDone', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('short-circuits when job-state already has COMPLETED', async () => {
    const jobState = new JobStateStore();
    jobState.applyWebhook({
      eventId: 'e1',
      sequence: 1,
      event: 'job.completed',
      jobId: '42',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
    });

    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/42', method: 'GET' })
      .reply(200, { id: '42', status: 'COMPLETED', fileName: 'x', fileSize: 1, createdAt: '' });
    const job = await pollUntilDone(client(), jobState, '42');
    expect(job?.status).toBe('COMPLETED');
  });

  it('returns null on timeout', async () => {
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/42', method: 'GET' })
      .reply(200, { id: '42', status: 'PROCESSING', fileName: 'x', fileSize: 1, createdAt: '' })
      .persist();
    const jobState = new JobStateStore();
    const result = await pollUntilDone(client(), jobState, '42', { totalTimeoutMs: 50 });
    expect(result).toBeNull();
  });
});
