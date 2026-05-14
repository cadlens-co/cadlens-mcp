import { describe, expect, it } from 'vitest';
import { summarize } from '../../src/summarize.js';
import { makeJobResult } from '../helpers/fixtures.js';

describe('summarize', () => {
  it('counts entities by type and lists layers', () => {
    const s = summarize(makeJobResult());
    expect(s.job_id).toBe('42');
    expect(s.entity_count).toBe(4);
    expect(s.entity_count_by_type).toEqual({ LINE: 2, CIRCLE: 1, TEXT: 1 });
    expect(s.layers.map((l) => l.name)).toEqual(['0', 'WALLS', 'NOTES']);
    expect(s.image_url_expires_in_seconds).toBe(3600);
    expect(s.truncated).toBe(false);
  });

  it('flags truncated when metadata.truncated is true', () => {
    const s = summarize(makeJobResult({ metadata: { ...makeJobResult().metadata, truncated: true } }));
    expect(s.truncated).toBe(true);
  });

  it('handles empty entities and layers', () => {
    const s = summarize(
      makeJobResult({ vectorJson: { entities: [] }, layersJson: [] }),
    );
    expect(s.entity_count).toBe(0);
    expect(s.entity_count_by_type).toEqual({});
    expect(s.layers).toEqual([]);
  });
});
