#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binary = resolve(__dirname, '..', 'dist', 'index.js');

const EXPECTED_TOOLS = [
  'cadlens_parse_file',
  'cadlens_parse_url',
  'cadlens_get_job',
  'cadlens_get_result',
  'cadlens_refresh_image_url',
  'cadlens_list_jobs',
  'cadlens_delete_job',
];

const env = {
  ...process.env,
  CADLENS_API_KEY: process.env.CADLENS_API_KEY ?? 'cadl_smoke_dummy_key',
};

const child = spawn(process.execPath, [binary], { env, stdio: ['pipe', 'pipe', 'inherit'] });

function send(message) {
  child.stdin.write(JSON.stringify(message) + '\n');
}

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0.0.0' },
  },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

let resolved = false;
const timeout = setTimeout(() => {
  if (!resolved) {
    console.error('[smoke] timed out waiting for tools/list response');
    child.kill('SIGTERM');
    process.exit(2);
  }
}, 10_000);

const rl = createInterface({ input: child.stdout });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === 2 && msg.result) {
    resolved = true;
    clearTimeout(timeout);
    const tools = (msg.result.tools ?? []).map((t) => t.name);
    const missing = EXPECTED_TOOLS.filter((t) => !tools.includes(t));
    const extra = tools.filter((t) => !EXPECTED_TOOLS.includes(t));
    console.log('[smoke] tools:', tools.join(', '));
    if (missing.length) {
      console.error('[smoke] missing tools:', missing.join(', '));
      child.kill('SIGTERM');
      process.exit(1);
    }
    if (extra.length) {
      console.error('[smoke] unexpected tools:', extra.join(', '));
      child.kill('SIGTERM');
      process.exit(1);
    }
    console.log('[smoke] OK — all 7 expected tools present');
    child.kill('SIGTERM');
    process.exit(0);
  }
});

child.on('exit', (code) => {
  if (!resolved) {
    console.error(`[smoke] child exited (code ${code}) before tools/list response`);
    process.exit(2);
  }
});
