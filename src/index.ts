#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCadlensClient } from './api/client.js';
import { loadConfig } from './config.js';
import { createMcpServer } from './server.js';
import { generateWebhookToken } from './webhook/token.js';
import { startWebhookReceiver } from './webhook/server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createCadlensClient(config);
  const token = generateWebhookToken();

  const { server, jobState } = createMcpServer({
    client,
    webhookUrl: config.webhookPublicUrl ? `${config.webhookPublicUrl}/webhook/${token}` : null,
  });

  const receiver = await startWebhookReceiver({
    port: config.webhookPort,
    token,
    jobState,
    onError: (err) => console.error('[webhook] error:', err),
  });

  if (config.webhookPublicUrl) {
    console.error(
      `[cadlens-mcp] webhook receiver listening on :${receiver.port}${receiver.pathPrefix}; public URL: ${config.webhookPublicUrl}${receiver.pathPrefix}`,
    );
  } else {
    console.error(
      `[cadlens-mcp] webhook receiver listening on :${receiver.port}${receiver.pathPrefix} (no public URL — auto-registration disabled)`,
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (signal: string) => {
    console.error(`[cadlens-mcp] ${signal} received, shutting down`);
    try {
      await receiver.close();
    } catch (err) {
      console.error('[cadlens-mcp] webhook close error:', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[cadlens-mcp] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
