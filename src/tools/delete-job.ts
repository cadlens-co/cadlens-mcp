import { CadlensApiError } from '../api/client.js';
import type { ToolDefinition } from './types.js';

export const deleteJobTool: ToolDefinition = {
  name: 'cadlens_delete_job',
  description:
    'Delete a job and its uploaded file and preview image from CADLens storage. Irreversible.',
  inputSchema: {
    type: 'object',
    properties: { job_id: { type: 'string' } },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const jobId = String(args['job_id']);
    const res = await ctx.client.fetchRaw(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      throw new CadlensApiError(res.status, body, body);
    }
    ctx.cache.invalidate(jobId);
    return { deleted: true, job_id: jobId };
  },
};
