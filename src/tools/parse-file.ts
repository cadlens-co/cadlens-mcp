import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ParseResponse } from '../api/types.js';
import { pollUntilDone } from '../poller/poll.js';
import { summarize } from '../summarize.js';
import { getResultCached } from './get-result.js';
import type { ToolDefinition } from './types.js';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const parseFileTool: ToolDefinition = {
  name: 'cadlens_parse_file',
  description:
    'Parse a local CAD file (DWG/DXF/DWF/DWFx/DGN-V7/PDF, max 100 MB). Polls until the job completes or 5 minutes elapse. Returns a summary including the preview image URL. Use cadlens_get_result with the returned job_id to fetch detailed entity data.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file on the local filesystem.' },
      webhook_url: {
        type: 'string',
        format: 'uri',
        description:
          'Optional external webhook URL for state-change notifications. Independent of the auto-registered local receiver.',
      },
    },
    required: ['path'],
  },
  handler: async (args, ctx) => {
    const path = String(args['path']);
    const st = await stat(path);
    if (st.size > MAX_FILE_BYTES) {
      throw new Error(`File exceeds 100 MB limit (${st.size} bytes)`);
    }
    const buf = await readFile(path);
    const form = new FormData();
    form.append('file', new File([buf], basename(path)));
    const webhookUrl = (args['webhook_url'] as string | undefined) ?? ctx.webhookUrl;
    if (webhookUrl) form.append('webhookUrl', webhookUrl);

    const created = await ctx.client.fetch<ParseResponse>('/parse', {
      method: 'POST',
      body: form,
    });

    if (created.status === 'COMPLETED' && 'vectorJson' in created) {
      const result = {
        jobId: created.job_id,
        status: 'COMPLETED' as const,
        vectorJson: created.vectorJson,
        layersJson: created.layersJson,
        metadata: created.metadata,
        imageUrl: created.imageUrl,
        createdAt: created.createdAt,
      };
      ctx.cache.set(created.job_id, result);
      return summarize(result);
    }

    const final = await pollUntilDone(ctx.client, ctx.jobState, created.job_id);
    if (final?.status === 'COMPLETED') {
      const result = await getResultCached(ctx, created.job_id);
      return summarize(result);
    }
    if (final?.status === 'FAILED') {
      const err = new Error(`Job FAILED: ${final.errorMsg ?? 'unknown error'}`);
      (err as { jobId?: string }).jobId = created.job_id;
      throw err;
    }
    return {
      job_id: created.job_id,
      status: 'TIMEOUT',
      message:
        'Polling timed out after 5 minutes. Call cadlens_get_job to check status, or cadlens_get_result once it is COMPLETED.',
    };
  },
};
