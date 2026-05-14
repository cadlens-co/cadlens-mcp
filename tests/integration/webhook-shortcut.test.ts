import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCadlensClient } from '../../src/api/client.js';
import { JobStateStore } from '../../src/job-state/state.js';
import { pollUntilDone } from '../../src/poller/poll.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

describe('webhook short-circuit', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('poller wakes immediately when webhook arrives during wait', async () => {
    const client = createCadlensClient({
      apiBase: `${ORIGIN}/v1`,
      apiKey: 'k',
      webhookPort: 0,
      webhookPublicUrl: null,
      requestTimeoutMs: 5_000,
    });
    const jobState = new JobStateStore();

    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/77', method: 'GET' })
      .reply(200, { id: '77', status: 'PROCESSING', fileName: 'x', fileSize: 1, createdAt: '' });
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/77', method: 'GET' })
      .reply(200, { id: '77', status: 'COMPLETED', fileName: 'x', fileSize: 1, createdAt: '' });

    setTimeout(() => {
      jobState.applyWebhook({
        eventId: 'e1',
        sequence: 1,
        event: 'job.completed',
        jobId: '77',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      });
    }, 50);

    const start = Date.now();
    const job = await pollUntilDone(client, jobState, '77');
    const elapsed = Date.now() - start;
    expect(job?.status).toBe('COMPLETED');
    expect(elapsed).toBeLessThan(1000);
  });
});
