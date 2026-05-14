import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refreshImageUrlTool } from '../../src/tools/refresh-image-url.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { makeJobResult } from '../helpers/fixtures.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

describe('cadlens_refresh_image_url', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('GETs /jobs/:id/image and patches the cache', async () => {
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/42/image', method: 'GET' })
      .reply(200, { imageUrl: 'https://s3.test/fresh.png' });
    const ctx = buildCtx();
    ctx.cache.set('42', makeJobResult({ imageUrl: 'https://s3.test/stale.png' }));
    const out = (await refreshImageUrlTool.handler({ job_id: '42' }, ctx)) as { image_url: string };
    expect(out.image_url).toBe('https://s3.test/fresh.png');
    expect(ctx.cache.get('42')?.imageUrl).toBe('https://s3.test/fresh.png');
  });
});
