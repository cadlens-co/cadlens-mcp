import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('requires CADLENS_API_KEY', () => {
    expect(() => loadConfig({})).toThrow(/CADLENS_API_KEY is required/);
  });

  it('uses defaults', () => {
    const c = loadConfig({ CADLENS_API_KEY: 'k' });
    expect(c.apiBase).toBe('https://api.cadlens.co/v1');
    expect(c.webhookPort).toBe(0);
    expect(c.webhookPublicUrl).toBeNull();
    expect(c.requestTimeoutMs).toBe(30_000);
  });

  it('strips trailing slashes from apiBase and webhookPublicUrl', () => {
    const c = loadConfig({
      CADLENS_API_KEY: 'k',
      CADLENS_API_BASE: 'http://localhost:3001/v1/',
      WEBHOOK_PUBLIC_URL: 'https://tun.example.com//',
    });
    expect(c.apiBase).toBe('http://localhost:3001/v1');
    expect(c.webhookPublicUrl).toBe('https://tun.example.com');
  });

  it('rejects invalid WEBHOOK_PORT', () => {
    expect(() => loadConfig({ CADLENS_API_KEY: 'k', WEBHOOK_PORT: '99999' })).toThrow(
      /Invalid WEBHOOK_PORT/,
    );
  });

  it('rejects invalid REQUEST_TIMEOUT_MS', () => {
    expect(() => loadConfig({ CADLENS_API_KEY: 'k', REQUEST_TIMEOUT_MS: '0' })).toThrow(
      /Invalid REQUEST_TIMEOUT_MS/,
    );
  });
});
