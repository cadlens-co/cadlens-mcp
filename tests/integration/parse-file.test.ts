import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFileTool } from '../../src/tools/parse-file.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { makeJobResult } from '../helpers/fixtures.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

async function tempDwg(content = 'DUMMY DWG'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cadlens-'));
  const path = join(dir, 'sample.dwg');
  await writeFile(path, content);
  return path;
}

describe('cadlens_parse_file', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('returns summary inline for sync-completed parse', async () => {
    const path = await tempDwg();
    pool(ORIGIN)
      .intercept({ path: '/v1/parse', method: 'POST' })
      .reply(200, {
        job_id: '99',
        status: 'COMPLETED',
        ...makeJobResult({ jobId: '99' }),
      });

    const out = (await parseFileTool.handler({ path }, buildCtx())) as {
      job_id: string;
      entity_count: number;
    };
    expect(out.job_id).toBe('99');
    expect(out.entity_count).toBe(4);
  });

  it('polls then fetches result for async parse', async () => {
    const path = await tempDwg();
    pool(ORIGIN).intercept({ path: '/v1/parse', method: 'POST' }).reply(202, {
      job_id: '100',
      status: 'PENDING',
      fileName: 'sample.dwg',
      fileSize: 9,
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    pool(ORIGIN).intercept({ path: '/v1/jobs/100', method: 'GET' }).reply(200, {
      id: '100',
      status: 'COMPLETED',
      fileName: 'sample.dwg',
      fileSize: 9,
      createdAt: '',
    });
    pool(ORIGIN)
      .intercept({ path: '/v1/jobs/100/result', method: 'GET' })
      .reply(200, makeJobResult({ jobId: '100' }));

    const out = (await parseFileTool.handler({ path }, buildCtx())) as { job_id: string };
    expect(out.job_id).toBe('100');
  });

  it('throws FAILED', async () => {
    const path = await tempDwg();
    pool(ORIGIN).intercept({ path: '/v1/parse', method: 'POST' }).reply(202, {
      job_id: '102',
      status: 'PENDING',
      fileName: 'sample.dwg',
      fileSize: 9,
      createdAt: '',
    });
    pool(ORIGIN).intercept({ path: '/v1/jobs/102', method: 'GET' }).reply(200, {
      id: '102',
      status: 'FAILED',
      fileName: 'sample.dwg',
      fileSize: 9,
      createdAt: '',
      errorMsg: 'corrupt file',
    });

    await expect(parseFileTool.handler({ path }, buildCtx())).rejects.toThrow(/FAILED.*corrupt/);
  });
});
