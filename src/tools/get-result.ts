import type { JobResult } from '../api/types.js';
import { CAD_ENTITY_TYPES } from '../api/types.js';
import { summarize } from '../summarize.js';
import type { ToolContext, ToolDefinition } from './types.js';

export async function getResultCached(ctx: ToolContext, jobId: string): Promise<JobResult> {
  const cached = ctx.cache.get(jobId);
  if (cached) return cached;
  const fresh = await ctx.client.fetch<JobResult>(`/jobs/${encodeURIComponent(jobId)}/result`);
  ctx.cache.set(jobId, fresh);
  return fresh;
}

export const getResultTool: ToolDefinition = {
  name: 'cadlens_get_result',
  description:
    "Fetch the parsed result of a completed CAD job. Use mode='summary' (default) for an overview, 'entities_by_type' or 'entities_on_layer' for filtered detail, or 'full' for the complete vector JSON (can be very large — only use when explicitly needed).",
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string' },
      mode: {
        type: 'string',
        enum: ['summary', 'entities_by_type', 'entities_on_layer', 'full'],
        default: 'summary',
      },
      entity_type: {
        type: 'string',
        enum: CAD_ENTITY_TYPES,
        description: "Required when mode='entities_by_type'.",
      },
      layer_name: {
        type: 'string',
        description: "Required when mode='entities_on_layer'.",
      },
    },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const jobId = String(args['job_id']);
    const mode = (args['mode'] as string | undefined) ?? 'summary';
    const result = await getResultCached(ctx, jobId);

    if (mode === 'full') return result;

    if (mode === 'entities_by_type') {
      const t = args['entity_type'];
      if (!t) throw new Error("entity_type is required when mode='entities_by_type'");
      const entities = (result.vectorJson?.entities ?? []).filter((e) => e.type === t);
      return { jobId, metadata: result.metadata, type: t, entities };
    }
    if (mode === 'entities_on_layer') {
      const ln = args['layer_name'];
      if (!ln) throw new Error("layer_name is required when mode='entities_on_layer'");
      const entities = (result.vectorJson?.entities ?? []).filter((e) => e.layer === ln);
      return { jobId, metadata: result.metadata, layer: ln, entities };
    }
    return summarize(result);
  },
};
