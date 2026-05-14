import type { ToolDefinition } from './types.js';

export const refreshImageUrlTool: ToolDefinition = {
  name: 'cadlens_refresh_image_url',
  description:
    'Re-fetch the presigned preview-image URL for a completed job. Cheaper than re-fetching the full result. The URL is valid for 3600 seconds.',
  inputSchema: {
    type: 'object',
    properties: { job_id: { type: 'string' } },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const jobId = String(args['job_id']);
    const data = await ctx.client.fetch<{ imageUrl: string }>(
      `/jobs/${encodeURIComponent(jobId)}/image`,
    );
    if (data?.imageUrl) {
      ctx.cache.patchImageUrl(jobId, data.imageUrl);
    }
    return { job_id: jobId, image_url: data.imageUrl, image_url_expires_in_seconds: 3600 };
  },
};
