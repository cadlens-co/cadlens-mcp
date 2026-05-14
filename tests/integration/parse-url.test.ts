import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseUrlTool } from '../../src/tools/parse-url.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { makeJobResult } from '../helpers/fixtures.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN_API = 'http://api.cadlens.test';
const ORIGIN_SRC = 'http://files.test';

describe('cadlens_parse_url', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('downloads then uploads, returning summary', async () => {
    pool(ORIGIN_SRC)
      .intercept({ path: '/sample.dwg', method: 'GET' })
      .reply(200, 'BINARY', { headers: { 'content-type': 'application/octet-stream' } });
    pool(ORIGIN_API)
      .intercept({ path: '/v1/parse', method: 'POST' })
      .reply(200, {
        job_id: '200',
        status: 'COMPLETED',
        ...makeJobResult({ jobId: '200' }),
      });

    const out = (await parseUrlTool.handler({ url: `${ORIGIN_SRC}/sample.dwg` }, buildCtx())) as {
      job_id: string;
    };
    expect(out.job_id).toBe('200');
  });

  it('rejects HTML response', async () => {
    pool(ORIGIN_SRC)
      .intercept({ path: '/notcad', method: 'GET' })
      .reply(200, '<html></html>', { headers: { 'content-type': 'text/html' } });
    await expect(parseUrlTool.handler({ url: `${ORIGIN_SRC}/notcad` }, buildCtx())).rejects.toThrow(
      /text\/html/,
    );
  });

  it('rejects unsupported extension', async () => {
    pool(ORIGIN_SRC)
      .intercept({ path: '/file.zip', method: 'GET' })
      .reply(200, 'BINARY', { headers: { 'content-type': 'application/zip' } });
    await expect(parseUrlTool.handler({ url: `${ORIGIN_SRC}/file.zip` }, buildCtx())).rejects.toThrow(
      /supported CAD file extension/,
    );
  });

  it('rejects when content-length exceeds 100MB', async () => {
    pool(ORIGIN_SRC)
      .intercept({ path: '/big.dwg', method: 'GET' })
      .reply(200, 'X', {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(101 * 1024 * 1024),
        },
      });
    await expect(parseUrlTool.handler({ url: `${ORIGIN_SRC}/big.dwg` }, buildCtx())).rejects.toThrow(
      /exceeds 100 MB/,
    );
  });
});
