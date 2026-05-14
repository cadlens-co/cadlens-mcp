import type { Job } from '../api/types.js';
import type { ToolDefinition } from './types.js';

export const getJobTool: ToolDefinition = {
  name: 'cadlens_get_job',
  description:
    'Check the status of a CAD parse job. Returns PENDING, PROCESSING, COMPLETED, or FAILED.',
  inputSchema: {
    type: 'object',
    properties: { job_id: { type: 'string', description: 'The job_id returned by parse_file/parse_url.' } },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const jobId = String(args['job_id']);
    return ctx.client.fetch<Job>(`/jobs/${encodeURIComponent(jobId)}`);
  },
};
