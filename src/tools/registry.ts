import { deleteJobTool } from './delete-job.js';
import { getJobTool } from './get-job.js';
import { getResultTool } from './get-result.js';
import { listJobsTool } from './list-jobs.js';
import { parseFileTool } from './parse-file.js';
import { parseUrlTool } from './parse-url.js';
import { refreshImageUrlTool } from './refresh-image-url.js';
import type { ToolDefinition } from './types.js';

export const TOOLS: ToolDefinition[] = [
  parseFileTool,
  parseUrlTool,
  getJobTool,
  getResultTool,
  refreshImageUrlTool,
  listJobsTool,
  deleteJobTool,
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
