import { basename } from 'node:path';
import type { ParseResponse } from '../api/types.js';
import { pollUntilDone } from '../poller/poll.js';
import { summarize } from '../summarize.js';
import { getResultCached } from './get-result.js';
import { MAX_FILE_BYTES } from './parse-file.js';
import type { ToolDefinition } from './types.js';

const DOWNLOAD_TIMEOUT_MS = 30_000;
const ALLOWED_EXTENSIONS = ['.dwg', '.dxf', '.dwf', '.dwfx', '.dgn', '.pdf'];

function filenameFromHeaders(headers: Headers, url: string): string {
  const cd = headers.get('content-disposition');
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    if (m && m[1]) return decodeURIComponent(m[1]);
  }
  try {
    const u = new URL(url);
    const last = basename(u.pathname);
    if (last) return last;
  } catch {
    // fallthrough
  }
  return 'download.bin';
}

function assertAllowedExtension(filename: string): void {
  const lower = filename.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new Error(
      `URL does not point to a supported CAD file extension (${ALLOWED_EXTENSIONS.join(', ')}): ${filename}`,
    );
  }
}

export const parseUrlTool: ToolDefinition = {
  name: 'cadlens_parse_url',
  description:
    'Download a CAD file from a URL (max 100 MB) and parse it. Same output as cadlens_parse_file.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', description: 'HTTPS URL pointing to a CAD file.' },
      webhook_url: { type: 'string', format: 'uri' },
    },
    required: ['url'],
  },
  handler: async (args, ctx) => {
    const url = String(args['url']);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`Failed to download URL: ${res.status} ${res.statusText}`);
    }
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.startsWith('text/html')) {
      throw new Error('URL returned text/html — not a CAD file');
    }
    const lengthHeader = res.headers.get('content-length');
    if (lengthHeader && Number(lengthHeader) > MAX_FILE_BYTES) {
      throw new Error(`Remote file exceeds 100 MB limit (${lengthHeader} bytes)`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE_BYTES) {
      throw new Error(`Downloaded file exceeds 100 MB limit (${buf.length} bytes)`);
    }

    const filename = filenameFromHeaders(res.headers, url);
    assertAllowedExtension(filename);

    const form = new FormData();
    form.append('file', new File([buf], filename));
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
      throw new Error(`Job FAILED: ${final.errorMsg ?? 'unknown error'}`);
    }
    return {
      job_id: created.job_id,
      status: 'TIMEOUT',
      message:
        'Polling timed out after 5 minutes. Call cadlens_get_job to check status, or cadlens_get_result once it is COMPLETED.',
    };
  },
};
