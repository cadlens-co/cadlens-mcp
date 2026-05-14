import { randomBytes } from 'node:crypto';

export function generateWebhookToken(): string {
  return randomBytes(16).toString('hex');
}
