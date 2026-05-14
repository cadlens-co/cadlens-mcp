import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listJobsTool } from '../../src/tools/list-jobs.js';
import { deleteJobTool } from '../../src/tools/delete-job.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { makeJobResult } from '../helpers/fixtures.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

describe('cadlens_list_jobs', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('GETs /jobs', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs', method: 'GET' }).reply(200, {
      jobs: [{ id: '1' }, { id: '2' }],
    });
    const out = (await listJobsTool.handler({}, buildCtx())) as { jobs: Array<{ id: string }> };
    expect(out.jobs).toHaveLength(2);
  });
});

describe('cadlens_delete_job', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('DELETEs and invalidates the cache', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42', method: 'DELETE' }).reply(204, '');
    const ctx = buildCtx();
    ctx.cache.set('42', makeJobResult());
    const out = (await deleteJobTool.handler({ job_id: '42' }, ctx)) as {
      deleted: boolean;
      job_id: string;
    };
    expect(out.deleted).toBe(true);
    expect(ctx.cache.get('42')).toBeUndefined();
  });

  it('throws on 404', async () => {
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/missing', method: 'DELETE' })
      .reply(404, { error: 'Job not found' });
    await expect(deleteJobTool.handler({ job_id: 'missing' }, buildCtx())).rejects.toThrow(/404/);
  });
});
