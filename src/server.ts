import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CadlensApiError, type CadlensClient } from './api/client.js';
import { ResultCache } from './cache/result-cache.js';
import { JobStateStore } from './job-state/state.js';
import { findTool, TOOLS } from './tools/registry.js';
import type { ToolContext } from './tools/types.js';

export interface CreateServerOptions {
  client: CadlensClient;
  cache?: ResultCache;
  jobState?: JobStateStore;
  webhookUrl?: string | null;
}

export function createMcpServer(opts: CreateServerOptions) {
  const cache = opts.cache ?? new ResultCache();
  const jobState = opts.jobState ?? new JobStateStore();
  const ctx: ToolContext = {
    client: opts.client,
    cache,
    jobState,
    webhookUrl: opts.webhookUrl ?? null,
  };

  const server = new Server(
    { name: 'cadlens-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = findTool(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const data = await tool.handler((args ?? {}) as Record<string, unknown>, ctx);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      const message =
        err instanceof CadlensApiError
          ? `CADLens API ${err.status}: ${err.body}`
          : err instanceof Error
            ? err.message
            : String(err);
      return { content: [{ type: 'text', text: message }], isError: true };
    }
  });

  return { server, ctx, cache, jobState };
}
