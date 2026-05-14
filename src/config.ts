export interface Config {
  apiBase: string;
  apiKey: string;
  webhookPort: number;
  webhookPublicUrl: string | null;
  requestTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env['CADLENS_API_KEY'];
  if (!apiKey) {
    throw new Error('CADLENS_API_KEY is required');
  }
  const apiBase = (env['CADLENS_API_BASE'] ?? 'https://api.cadlens.co/v1').replace(/\/+$/, '');
  const webhookPort = Number(env['WEBHOOK_PORT'] ?? 0);
  if (!Number.isInteger(webhookPort) || webhookPort < 0 || webhookPort > 65535) {
    throw new Error(`Invalid WEBHOOK_PORT: ${env['WEBHOOK_PORT']}`);
  }
  const rawPublic = env['WEBHOOK_PUBLIC_URL'];
  const webhookPublicUrl = rawPublic && rawPublic.trim() ? rawPublic.replace(/\/+$/, '') : null;
  const requestTimeoutMs = Number(env['REQUEST_TIMEOUT_MS'] ?? 30_000);
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error(`Invalid REQUEST_TIMEOUT_MS: ${env['REQUEST_TIMEOUT_MS']}`);
  }
  return { apiBase, apiKey, webhookPort, webhookPublicUrl, requestTimeoutMs };
}
