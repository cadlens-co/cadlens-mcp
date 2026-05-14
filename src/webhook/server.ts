import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { JobStateStore } from '../job-state/state.js';
import type { WebhookPayload } from '../api/types.js';

export interface WebhookReceiver {
  port: number;
  pathPrefix: string;
  close(): Promise<void>;
}

const MAX_BODY_BYTES = 64 * 1024;

export async function startWebhookReceiver(opts: {
  port: number;
  token: string;
  jobState: JobStateStore;
  onError?: (err: unknown) => void;
}): Promise<WebhookReceiver> {
  const pathPrefix = `/webhook/${opts.token}`;

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url || !req.url.startsWith(pathPrefix)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    let total = 0;
    const chunks: Buffer[] = [];
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        aborted = true;
        res.statusCode = 413;
        res.end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body) as WebhookPayload;
        if (payload && typeof payload.jobId === 'string' && typeof payload.status === 'string') {
          opts.jobState.applyWebhook(payload);
          res.statusCode = 204;
        } else {
          res.statusCode = 400;
        }
      } catch (err) {
        opts.onError?.(err);
        res.statusCode = 400;
      }
      res.end();
    });
    req.on('error', (err) => {
      opts.onError?.(err);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once('error', onError);
    server.listen(opts.port, () => {
      server.off('error', onError);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    pathPrefix,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
