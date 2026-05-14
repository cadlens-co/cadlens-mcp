import { createCadlensClient } from '../../src/api/client.js';
import { ResultCache } from '../../src/cache/result-cache.js';
import { JobStateStore } from '../../src/job-state/state.js';
import type { ToolContext } from '../../src/tools/types.js';

export function buildCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  const client = createCadlensClient({
    apiBase: 'http://api.cadlens.test/v1',
    apiKey: 'cadl_testkey',
    webhookPort: 0,
    webhookPublicUrl: null,
    requestTimeoutMs: 5_000,
  });
  return {
    client,
    cache: new ResultCache(),
    jobState: new JobStateStore(),
    webhookUrl: null,
    ...overrides,
  };
}
