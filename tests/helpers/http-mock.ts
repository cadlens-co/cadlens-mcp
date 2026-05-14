import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  fetch as undiciFetch,
  type Dispatcher,
} from 'undici';

let agent: MockAgent | undefined;
let originalDispatcher: Dispatcher | undefined;
let originalFetch: typeof globalThis.fetch | undefined;

export function startHttpMocks(): MockAgent {
  if (agent) return agent;
  originalDispatcher = getGlobalDispatcher();
  originalFetch = globalThis.fetch;
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch;
  return agent;
}

export async function stopHttpMocks(): Promise<void> {
  if (!agent) return;
  try {
    await agent.close();
  } finally {
    if (originalDispatcher) setGlobalDispatcher(originalDispatcher);
    if (originalFetch) globalThis.fetch = originalFetch;
    agent = undefined;
    originalDispatcher = undefined;
    originalFetch = undefined;
  }
}

export function pool(origin: string) {
  if (!agent) throw new Error('startHttpMocks() must be called first');
  return agent.get(origin);
}
