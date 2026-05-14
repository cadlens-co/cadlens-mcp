import type { CadlensClient } from '../api/client.js';
import type { ResultCache } from '../cache/result-cache.js';
import type { JobStateStore } from '../job-state/state.js';

export interface ToolContext {
  client: CadlensClient;
  cache: ResultCache;
  jobState: JobStateStore;
  webhookUrl: string | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
