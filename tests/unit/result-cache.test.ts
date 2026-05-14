import { describe, expect, it, vi } from 'vitest';
import { ResultCache } from '../../src/cache/result-cache.js';
import { makeJobResult } from '../helpers/fixtures.js';

describe('ResultCache', () => {
  it('stores and retrieves', () => {
    const cache = new ResultCache();
    cache.set('1', makeJobResult({ jobId: '1' }));
    expect(cache.get('1')?.jobId).toBe('1');
  });

  it('evicts after TTL', () => {
    vi.useFakeTimers();
    const cache = new ResultCache(1_000);
    cache.set('1', makeJobResult({ jobId: '1' }));
    vi.advanceTimersByTime(1_500);
    expect(cache.get('1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('invalidate removes the entry', () => {
    const cache = new ResultCache();
    cache.set('1', makeJobResult({ jobId: '1' }));
    cache.invalidate('1');
    expect(cache.get('1')).toBeUndefined();
  });

  it('patchImageUrl updates the cached imageUrl', () => {
    const cache = new ResultCache();
    cache.set('1', makeJobResult({ jobId: '1' }));
    cache.patchImageUrl('1', 'https://new.example/preview.png');
    expect(cache.get('1')?.imageUrl).toBe('https://new.example/preview.png');
  });
});
