import type { Config } from '../config.js';

export class CadlensApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly parsed: unknown,
  ) {
    super(`CADLens API ${status}: ${body}`);
    this.name = 'CadlensApiError';
  }
}

export interface CadlensClient {
  fetch<T = unknown>(path: string, init?: RequestInit): Promise<T>;
  fetchRaw(path: string, init?: RequestInit): Promise<Response>;
  readonly config: Config;
}

export function createCadlensClient(config: Config): CadlensClient {
  async function fetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${config.apiBase}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: init.signal ?? controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(init.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchRaw(path, init);
    if (res.status === 204) return undefined as T;
    const body = await res.text();
    let parsed: unknown = null;
    if (body) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = body;
      }
    }
    if (!res.ok) {
      throw new CadlensApiError(res.status, body, parsed);
    }
    return parsed as T;
  }

  return { fetch: fetchJson, fetchRaw, config };
}
