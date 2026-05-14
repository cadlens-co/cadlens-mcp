import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getJobTool } from '../../src/tools/get-job.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

describe('cadlens_get_job', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('GETs /jobs/:id and returns the body', async () => {
    pool(ORIGIN)
      .intercept({
        path: '/v1/jobs/42',
        method: 'GET',
        headers: { authorization: 'Bearer cadl_testkey' },
      })
      .reply(200, { id: '42', status: 'PROCESSING', fileName: 'x.dwg', fileSize: 1, createdAt: '' });
    const result = (await getJobTool.handler({ job_id: '42' }, buildCtx())) as { status: string };
    expect(result.status).toBe('PROCESSING');
  });

  it('throws on 404 with CADLens body', async () => {
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/missing', method: 'GET' })
      .reply(404, { error: 'Job not found' });
    await expect(getJobTool.handler({ job_id: 'missing' }, buildCtx())).rejects.toThrow(/404/);
  });
});
