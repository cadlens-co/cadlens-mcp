import type { Job } from '../api/types.js';
import type { ToolDefinition } from './types.js';

export const listJobsTool: ToolDefinition = {
  name: 'cadlens_list_jobs',
  description: 'List the 100 most recent CAD parse jobs for the configured API key, newest first.',
  inputSchema: { type: 'object', properties: {} },
  handler: async (_args, ctx) => {
    return ctx.client.fetch<{ jobs: Job[] }>('/jobs');
  },
};
