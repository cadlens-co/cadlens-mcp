import { afterEach, describe, expect, it } from 'vitest';
import { JobStateStore } from '../../src/job-state/state.js';
import { generateWebhookToken } from '../../src/webhook/token.js';
import { startWebhookReceiver, type WebhookReceiver } from '../../src/webhook/server.js';

let receiver: WebhookReceiver | undefined;

afterEach(async () => {
  if (receiver) {
    await receiver.close();
    receiver = undefined;
  }
});

describe('startWebhookReceiver', () => {
  it('accepts a valid POST and updates JobStateStore', async () => {
    const token = generateWebhookToken();
    const jobState = new JobStateStore();
    receiver = await startWebhookReceiver({ port: 0, token, jobState });

    const url = `http://127.0.0.1:${receiver.port}${receiver.pathPrefix}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'e1',
        sequence: 1,
        event: 'job.completed',
        jobId: '42',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        result: { entityCount: 100, imageUrl: 'https://x.test/img.png' },
      }),
    });
    expect(res.status).toBe(204);

    const snap = jobState.get('42');
    expect(snap?.status).toBe('COMPLETED');
    expect(snap?.hints?.entityCount).toBe(100);
  });

  it('rejects wrong token with 404', async () => {
    const token = generateWebhookToken();
    receiver = await startWebhookReceiver({ port: 0, token, jobState: new JobStateStore() });
    const res = await fetch(`http://127.0.0.1:${receiver.port}/webhook/wrongtoken`, {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('rejects non-POST', async () => {
    const token = generateWebhookToken();
    receiver = await startWebhookReceiver({ port: 0, token, jobState: new JobStateStore() });
    const res = await fetch(`http://127.0.0.1:${receiver.port}${receiver.pathPrefix}`);
    expect(res.status).toBe(404);
  });

  it('rejects malformed JSON with 400', async () => {
    const token = generateWebhookToken();
    receiver = await startWebhookReceiver({ port: 0, token, jobState: new JobStateStore() });
    const res = await fetch(`http://127.0.0.1:${receiver.port}${receiver.pathPrefix}`, {
      method: 'POST',
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('generateWebhookToken', () => {
  it('produces 32-char hex per call and is unique', () => {
    const a = generateWebhookToken();
    const b = generateWebhookToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
