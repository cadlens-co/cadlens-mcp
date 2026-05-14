import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResultTool } from '../../src/tools/get-result.js';
import { buildCtx } from '../helpers/build-ctx.js';
import { makeJobResult } from '../helpers/fixtures.js';
import { pool, startHttpMocks, stopHttpMocks } from '../helpers/http-mock.js';

const ORIGIN = 'http://api.cadlens.test';

describe('cadlens_get_result', () => {
  beforeEach(() => startHttpMocks());
  afterEach(() => stopHttpMocks());

  it('summary mode by default', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    const out = (await getResultTool.handler({ job_id: '42' }, buildCtx())) as {
      entity_count: number;
      entity_count_by_type: Record<string, number>;
    };
    expect(out.entity_count).toBe(4);
    expect(out.entity_count_by_type.LINE).toBe(2);
  });

  it('caches the full payload across calls', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    const ctx = buildCtx();
    await getResultTool.handler({ job_id: '42' }, ctx);
    const out = (await getResultTool.handler({ job_id: '42', mode: 'full' }, ctx)) as {
      vectorJson: { entities: unknown[] };
    };
    expect(out.vectorJson.entities).toHaveLength(4);
  });

  it('entities_by_type filters', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    const out = (await getResultTool.handler(
      { job_id: '42', mode: 'entities_by_type', entity_type: 'CIRCLE' },
      buildCtx(),
    )) as { entities: unknown[]; type: string };
    expect(out.type).toBe('CIRCLE');
    expect(out.entities).toHaveLength(1);
  });

  it('entities_on_layer filters', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    const out = (await getResultTool.handler(
      { job_id: '42', mode: 'entities_on_layer', layer_name: 'WALLS' },
      buildCtx(),
    )) as { entities: unknown[]; layer: string };
    expect(out.layer).toBe('WALLS');
    expect(out.entities).toHaveLength(2);
  });

  it('full mode returns the raw result', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    const out = (await getResultTool.handler(
      { job_id: '42', mode: 'full' },
      buildCtx(),
    )) as { vectorJson: { entities: unknown[] } };
    expect(out.vectorJson.entities).toHaveLength(4);
  });

  it('entities_by_type requires entity_type', async () => {
    pool(ORIGIN).intercept({ path: '/v1/jobs/42/result', method: 'GET' }).reply(200, makeJobResult());
    await expect(
      getResultTool.handler({ job_id: '42', mode: 'entities_by_type' }, buildCtx()),
    ).rejects.toThrow(/entity_type is required/);
  });
});
